/**
 * ============================================================================
 * PRESENCE QUERIES
 * ============================================================================
 * 
 * Reads Excel files from network path and aggregates weekly presence data.
 * 
 * DATA SOURCE:
 * - Network path: \\SERVER2019\Office\Preventivi LeZana\COOPERATIVA\PRODUZIONE
 * - Files: XX Produzione [month] YYYY.xlsx (e.g., "01 Produzione gennaio 2026.xlsx")
 * - Columns used:
 *   - AM: Week number (1, 2, 3, 4, 5)
 *   - AO: Operator group
 *   - X: Ore Ordinarie (regular hours)
 * 
 * OUTPUT:
 * - Weekly totals per operator group
 * - Grand total per week
 * - Grand total overall
 * 
 * ============================================================================
 */

'use server'

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { PresenceData, WeeklyGroupData, WeekDateRange, MonthlyPresenceData, MonthlyGroupData } from '@/types';
import { toIsoDate } from '@/lib/dateUtils';

const PRIMARY_NETWORK_PATH = '\\\\SERVER2019\\Office\\Preventivi LeZana\\COOPERATIVA\\PRODUZIONE';
const FALLBACK_MAPPED_PATH = 'Z:\\';

function getValidPath(): string | null {
    if (fs.existsSync(PRIMARY_NETWORK_PATH)) return PRIMARY_NETWORK_PATH;
    if (fs.existsSync(FALLBACK_MAPPED_PATH)) return FALLBACK_MAPPED_PATH;
    return null;
}

const MONTH_NAMES = [
    'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'
];

interface PresenceRow {
    month: number;
    week: number;
    group: string;
    hours: number;
}

/**
 * Get column letter from index (0 = A, 1 = B, etc.)
 */
function getColumnLetter(index: number): string {
    let letter = '';
    while (index >= 0) {
        letter = String.fromCharCode((index % 26) + 65) + letter;
        index = Math.floor(index / 26) - 1;
    }
    return letter;
}

/**
 * Parse Excel file and extract presence data
 */
function parseExcelFile(filePath: string): PresenceRow[] {
    const rows: PresenceRow[] = [];
    
    try {
        // Read file as buffer first (fixes UNC path issues)
        const buffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Get the range to understand the sheet structure
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        console.log(`File: ${path.basename(filePath)}`);
        console.log(`Sheet: ${sheetName}, Rows: ${range.e.r + 1}, Cols: ${range.e.c + 1}`);
        
        // Convert to JSON with header row
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];
        
        // Find column indexes
        // Excel columns: A=0, B=1, ..., AM=38, AN=39, AO=40
        const weekCol = 38;  // AM
        const groupCol = 40; // AO
        const hoursCol = 39; // AN (changed from X)
        
        console.log(`Looking for columns - Week: ${weekCol} (AM), Group: ${groupCol} (AO), Hours: ${hoursCol} (AN)`);
        
        // Debug: Check rows with actual hour values
        console.log('Scanning for rows with hour values...');
        let sampleCount = 0;
        for (let i = 0; i < data.length && sampleCount < 10; i++) {
            const row = data[i];
            const hours = row[hoursCol];
            if (hours && typeof hours === 'number' && hours > 0) {
                console.log(`Row ${i}: Week=[${row[weekCol]}], Group=[${row[groupCol]}], Hours=[${hours}]`);
                sampleCount++;
            }
        }
        
        if (sampleCount === 0) {
            console.log('No rows with numeric hours found. Checking for any non-empty hour values...');
            for (let i = 0; i < Math.min(50, data.length); i++) {
                const row = data[i];
                const hours = row[hoursCol];
                if (hours !== null && hours !== undefined && hours !== '') {
                    console.log(`Row ${i}: Week=[${row[weekCol]}], Group=[${row[groupCol]}], Hours=[${hours}] (type: ${typeof hours})`);
                }
            }
        }
        
        // Extract month index from filename
        const fileNameLower = path.basename(filePath).toLowerCase();
        let fileMonth = 1;
        for (let mIdx = 0; mIdx < MONTH_NAMES.length; mIdx++) {
            if (fileNameLower.includes(MONTH_NAMES[mIdx])) {
                fileMonth = mIdx + 1;
                break;
            }
        }
        
        // Skip header row, start from row 1
        let validRows = 0;
        const weekNumbers = new Set<number>();
        
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            
            const weekText = row[weekCol];
            const group = row[groupCol];
            const hours = row[hoursCol];
            
            // Only process rows with valid data
            if (weekText && group && hours) {
                // Extract week number from "Totale settimana X" or similar format
                const weekMatch = String(weekText).match(/(\d+)/);
                if (!weekMatch) continue;
                
                const weekNum = Number(weekMatch[1]);
                const hoursNum = Number(hours);
                
                if (!isNaN(weekNum) && !isNaN(hoursNum) && hoursNum > 0) {
                    weekNumbers.add(weekNum);
                    
                    // Use actual week number directly (don't map)
                    rows.push({
                        month: fileMonth,
                        week: weekNum,
                        group: String(group).trim(),
                        hours: hoursNum
                    });
                    validRows++;
                }
            }
        }
        
        console.log(`Valid rows extracted: ${validRows}`);
        console.log(`Week numbers found: ${Array.from(weekNumbers).sort((a,b) => a-b).join(', ')}`);
        
    } catch (err: any) {
        console.error(`Error parsing file ${path.basename(filePath)}:`, err.message);
    }
    
    return rows;
}

/**
 * Calculate date range for a given week number in a year
 * Week 1 = first full week of the year (Monday to Sunday)
 * Uses ISO 8601 week numbering standard
 */
function getWeekDateRange(year: number, weekNumber: number): WeekDateRange {
    // January 4th is always in week 1 of the year (ISO 8601)
    const jan4 = new Date(year, 0, 4);
    
    // Find the Monday of week 1 (the Monday of the week containing January 4th)
    const jan4DayOfWeek = jan4.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysFromMonday = jan4DayOfWeek === 0 ? 6 : jan4DayOfWeek - 1; // Sunday = 6 days from Monday
    
    const firstMondayOfYear = new Date(jan4);
    firstMondayOfYear.setDate(jan4.getDate() - daysFromMonday);
    
    // Calculate start date (Monday of the given week)
    const startDate = new Date(firstMondayOfYear);
    startDate.setDate(firstMondayOfYear.getDate() + (weekNumber - 1) * 7);
    
    // Calculate end date (Sunday of the given week)
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    
    return {
        weekNumber,
        startDate: toIsoDate(startDate),
        endDate: toIsoDate(endDate)
    };
}

/**
 * Aggregate presence data by week and group
 */
function aggregatePresenceData(rows: PresenceRow[], year: number): PresenceData {
    const groupMap = new Map<string, WeeklyGroupData>();
    const weekNumbers = new Set<number>();
    
    // Collect all unique week numbers
    rows.forEach(row => weekNumbers.add(row.week));
    
    // Aggregate by group and week
    rows.forEach(row => {
        if (!groupMap.has(row.group)) {
            groupMap.set(row.group, {
                group: row.group
            });
        }
        
        const groupData = groupMap.get(row.group)!;
        const weekKey = `week${row.week}`;
        
        groupData[weekKey] = (groupData[weekKey] as number || 0) + row.hours;
    });
    
    // Calculate week totals
    const weekTotals: { [key: string]: number } = {};
    
    weekNumbers.forEach(weekNum => {
        const weekKey = `week${weekNum}`;
        weekTotals[weekKey] = 0;
        
        groupMap.forEach(groupData => {
            weekTotals[weekKey] += (groupData[weekKey] as number || 0);
        });
    });
    
    const sortedWeekNumbers = Array.from(weekNumbers).sort((a, b) => a - b);
    const weekDateRanges = sortedWeekNumbers.map(weekNum => getWeekDateRange(year, weekNum));
    
    return {
        groups: Array.from(groupMap.values()).sort((a, b) => a.group.localeCompare(b.group)),
        weekTotals,
        weekNumbers: sortedWeekNumbers,
        weekDateRanges
    };
}

/**
 * Aggregate presence data by month and group
 */
function aggregateMonthlyPresenceData(rows: PresenceRow[]): MonthlyPresenceData {
    const groupMap = new Map<string, MonthlyGroupData>();
    const monthNumbers = new Set<number>();
    
    // Collect all unique month numbers
    rows.forEach(row => monthNumbers.add(row.month));
    
    // Aggregate by group and month
    rows.forEach(row => {
        if (!groupMap.has(row.group)) {
            groupMap.set(row.group, {
                group: row.group
            });
        }
        
        const groupData = groupMap.get(row.group)!;
        const monthKey = `month${row.month}`;
        
        groupData[monthKey] = (groupData[monthKey] as number || 0) + row.hours;
    });
    
    // Calculate month totals
    const monthTotals: { [key: string]: number } = {};
    
    monthNumbers.forEach(monthNum => {
        const monthKey = `month${monthNum}`;
        monthTotals[monthKey] = 0;
        
        groupMap.forEach(groupData => {
            monthTotals[monthKey] += (groupData[monthKey] as number || 0);
        });
    });
    
    const sortedMonthNumbers = Array.from(monthNumbers).sort((a, b) => a - b);
    
    return {
        groups: Array.from(groupMap.values()).sort((a, b) => a.group.localeCompare(b.group)),
        monthTotals,
        monthNumbers: sortedMonthNumbers
    };
}

/**
 * Get presence data from Excel files
 */
export async function getPresenceDataAction(
    year: number = 2026,
    months: number[] = [] // Empty = all months, or [1,2,3] for specific months
) {
    try {
        const activePath = getValidPath();
        if (!activePath) {
            return {
                success: false,
                error: `Network path not accessible: ${PRIMARY_NETWORK_PATH} or ${FALLBACK_MAPPED_PATH}`,
                data: null
            };
        }
        
        // Get all Excel files in directory
        const files = fs.readdirSync(activePath)
            .filter(file => file.endsWith('.xlsx') && file.includes('Produzione'))
            .filter(file => file.includes(String(year)));
        
        // Filter by specific months if provided
        let filesToProcess = files;
        if (months.length > 0) {
            const monthNames = [
                'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
                'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'
            ];
            filesToProcess = files.filter(file => {
                return months.some(m => file.toLowerCase().includes(monthNames[m - 1]));
            });
        }
        
        if (filesToProcess.length === 0) {
            return {
                success: false,
                error: `No Excel files found for year ${year}`,
                data: null
            };
        }
        
        // Parse all files and collect rows
        const allRows: PresenceRow[] = [];
        
        for (const file of filesToProcess) {
            const filePath = path.join(activePath, file);
            const rows = parseExcelFile(filePath);
            allRows.push(...rows);
        }
        
        if (allRows.length === 0) {
            return {
                success: false,
                error: 'No valid data found in Excel files',
                data: null
            };
        }
        
        // Aggregate data
        const aggregatedData = aggregatePresenceData(allRows, year);
        
        return {
            success: true,
            data: aggregatedData,
            filesProcessed: filesToProcess.length
        };
        
    } catch (err: any) {
        console.error('Error in getPresenceDataAction:', err);
        return {
            success: false,
            error: err.message,
            data: null
        };
    }
}

/**
 * Get list of available months (fast - only checks file existence)
 */
export async function getAvailableMonthsAction(year: number = 2026) {
    try {
        const activePath = getValidPath();
        if (!activePath) {
            return {
                success: false,
                error: `Network path not accessible: ${PRIMARY_NETWORK_PATH} or ${FALLBACK_MAPPED_PATH}`,
                months: [] as number[]
            };
        }
        
        // Get all Excel files in directory
        const files = fs.readdirSync(activePath)
            .filter(file => file.endsWith('.xlsx') && file.includes('Produzione'))
            .filter(file => file.includes(String(year)));
        
        // Extract month numbers from filenames
        const availableMonths: number[] = [];
        
        for (let monthNum = 1; monthNum <= 12; monthNum++) {
            const monthName = MONTH_NAMES[monthNum - 1];
            const hasFile = files.some(file => file.toLowerCase().includes(monthName));
            if (hasFile) {
                availableMonths.push(monthNum);
            }
        }
        
        return {
            success: true,
            months: availableMonths
        };
        
    } catch (err: any) {
        console.error('Error in getAvailableMonthsAction:', err);
        return {
            success: false,
            error: err.message,
            months: [] as number[]
        };
    }
}

/**
 * Get monthly presence data from Excel files
 */
export async function getMonthlyPresenceDataAction(
    year: number = 2026,
    months: number[] = [] // Empty = all months, or [1,2,3] for specific months
) {
    try {
        const activePath = getValidPath();
        if (!activePath) {
            return {
                success: false,
                error: `Network path not accessible: ${PRIMARY_NETWORK_PATH} or ${FALLBACK_MAPPED_PATH}`,
                data: null
            };
        }
        
        // Get all Excel files in directory
        const files = fs.readdirSync(activePath)
            .filter(file => file.endsWith('.xlsx') && file.includes('Produzione'))
            .filter(file => file.includes(String(year)));
        
        // Filter by specific months if provided
        let filesToProcess = files;
        if (months.length > 0) {
            filesToProcess = files.filter(file => {
                return months.some(m => file.toLowerCase().includes(MONTH_NAMES[m - 1]));
            });
        }
        
        if (filesToProcess.length === 0) {
            return {
                success: false,
                error: `No Excel files found for year ${year}`,
                data: null
            };
        }
        
        // Parse all files and collect rows
        const allRows: PresenceRow[] = [];
        
        for (const file of filesToProcess) {
            const filePath = path.join(activePath, file);
            const rows = parseExcelFile(filePath);
            allRows.push(...rows);
        }
        
        if (allRows.length === 0) {
            return {
                success: false,
                error: 'No valid data found in Excel files',
                data: null
            };
        }
        
        // Aggregate monthly data
        const aggregatedData = aggregateMonthlyPresenceData(allRows);
        
        return {
            success: true,
            data: aggregatedData,
            filesProcessed: filesToProcess.length
        };
        
    } catch (err: any) {
        console.error('Error in getMonthlyPresenceDataAction:', err);
        return {
            success: false,
            error: err.message,
            data: null
        };
    }
}

