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

const NETWORK_PATH = '\\\\SERVER2019\\Office\\Preventivi LeZana\\COOPERATIVA\\PRODUZIONE';

interface PresenceRow {
    week: number;
    group: string;
    hours: number;
}

interface WeeklyGroupData {
    group: string;
    week1: number;
    week2: number;
    week3: number;
    week4: number;
    week5: number;
    total: number;
}

interface PresenceData {
    groups: WeeklyGroupData[];
    weekTotals: {
        week1: number;
        week2: number;
        week3: number;
        week4: number;
        week5: number;
        total: number;
    };
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
 * Aggregate presence data by week and group
 */
function aggregatePresenceData(rows: PresenceRow[]): PresenceData {
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
    
    return {
        groups: Array.from(groupMap.values()).sort((a, b) => a.group.localeCompare(b.group)),
        weekTotals,
        weekNumbers: Array.from(weekNumbers).sort((a, b) => a - b)
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
        // Check if network path exists
        if (!fs.existsSync(NETWORK_PATH)) {
            return {
                success: false,
                error: `Network path not accessible: ${NETWORK_PATH}`,
                data: null
            };
        }
        
        // Get all Excel files in directory
        const files = fs.readdirSync(NETWORK_PATH)
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
            const filePath = path.join(NETWORK_PATH, file);
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
        const aggregatedData = aggregatePresenceData(allRows);
        
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
