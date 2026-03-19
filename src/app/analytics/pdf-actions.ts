'use server';

import puppeteer from 'puppeteer';
import { getAreaSummaryDataAction, getOrderAreaSummaryDataAction } from './analytics-actions';
import { APP_CONFIG } from '@/config/constants';
import { APP_COPY } from '@/locales';

interface MonthData {
    month: string;
    year: number;
    data: any[];
}

export async function generateAreaSummaryPDFAction(
    year: number,
    months: number[], // Array of month numbers (1-12)
    areaFilter?: string // Optional area filter
) {
    try {
        // Fetch data for each selected month
        const monthDataPromises = months.map(async (month) => {
            const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const monthEnd = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

            const result = await getAreaSummaryDataAction(
                year,
                1,
                999999,
                { 
                    dateFrom: monthStart, 
                    dateTo: monthEnd,
                    machine: areaFilter || undefined // Pass area filter
                },
                { column: 'display_order', direction: 'asc' },
                true
            );

            return {
                month: new Date(year, month - 1).toLocaleString('it-IT', { month: 'long' }),
                year,
                data: result.success ? result.data : []
            };
        });

        const monthsData = await Promise.all(monthDataPromises);

        // Get copy for footer template
        const copy = APP_COPY.analytics.pdf;

        // Generate HTML for PDF
        const html = generateReportHTML(monthsData, areaFilter);

        // Launch Puppeteer and generate PDF
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
                <div style="width: 100%; font-size: 8pt; padding: 0 15mm; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e5e7eb; color: #6b7280;">
                    <div style="font-weight: 600; color: #1e40af;">${APP_CONFIG.ANALYTICS.COMPANY_NAME}</div>
                    <div style="text-align: center;">${copy.title}</div>
                    <div style="text-align: right;">${copy.footer.page} <span class="pageNumber"></span> ${copy.footer.of} <span class="totalPages"></span></div>
                </div>
            `,
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '25mm',
                left: '15mm'
            }
        });

        await browser.close();

        // Convert buffer to base64 for client download
        const base64PDF = Buffer.from(pdfBuffer).toString('base64');

        // Create a descriptive filename
        const sanitize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').trim();
        const areaSuffix = areaFilter ? `-${sanitize(areaFilter)}` : '-tutte-le-aree';
        const monthsSuffix = months.length > 3 
            ? `${months[0]}-to-${months[months.length - 1]}`
            : months.join('-');
            
        return {
            success: true,
            pdf: base64PDF,
            filename: `report-aree-${year}-${monthsSuffix}${areaSuffix}.pdf`
        };
    } catch (error) {
        console.error('PDF generation error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate PDF'
        };
    }
}

function generateReportHTML(monthsData: MonthData[], areaFilter?: string): string {
    const thresholds = APP_CONFIG.ANALYTICS.EFFICIENCY_THRESHOLDS;
    const copy = APP_COPY.analytics.pdf;

    // Calculate overall totals
    const allData = monthsData.flatMap(m => m.data);
    const totalQuantity = allData.reduce((sum, row) => sum + row.requested_quantity, 0);
    const totalHours = allData.reduce((sum, row) => sum + row.work_time, 0);
    const overallVelocity = totalHours > 0 ? totalQuantity / totalHours : 0;
    
    // Calculate weighted efficiency
    const totalWeightedEfficiency = allData.reduce((sum, row) => 
        sum + (row.efficiency * row.work_time), 0
    );
    const overallEfficiency = totalHours > 0 ? totalWeightedEfficiency / totalHours : 0;

    // Reorganize data by area (instead of by month)
    const areaMap = new Map<string, Array<{
        month: string;
        quantity: number;
        hours: number;
        velocity: number;
        target: number;
        efficiency: number;
    }>>();

    monthsData.forEach(md => {
        md.data.forEach(row => {
            if (!areaMap.has(row.area_name)) {
                areaMap.set(row.area_name, []);
            }
            areaMap.get(row.area_name)!.push({
                month: md.month,
                quantity: row.requested_quantity,
                hours: row.work_time,
                velocity: row.velocity,
                target: row.target_velocity,
                efficiency: row.efficiency
            });
        });
    });

    // Calculate trends for each area
    const areaStats = Array.from(areaMap.entries()).map(([areaName, months]) => {
        const avgEfficiency = months.reduce((sum, m) => sum + m.efficiency, 0) / months.length;
        const firstMonth = months[0];
        const lastMonth = months[months.length - 1];
        
        const efficiencyChange = months.length > 1 
            ? ((lastMonth.efficiency - firstMonth.efficiency) / firstMonth.efficiency) * 100 
            : 0;
        const quantityChange = months.length > 1
            ? ((lastMonth.quantity - firstMonth.quantity) / firstMonth.quantity) * 100
            : 0;
        const velocityChange = months.length > 1
            ? ((lastMonth.velocity - firstMonth.velocity) / firstMonth.velocity) * 100
            : 0;

        return {
            areaName,
            months,
            avgEfficiency,
            efficiencyChange,
            quantityChange,
            velocityChange,
            trend: efficiencyChange > 5 ? 'improving' : efficiencyChange < -5 ? 'declining' : 'stable'
        };
    });

    // Sort by custom order from MACHINE_AREAS (same as dashboard)
    const MACHINE_AREAS = APP_CONFIG.ANALYTICS.MACHINE_AREAS;
    const areaOrder = Object.keys(MACHINE_AREAS);
    areaStats.sort((a, b) => {
        const indexA = areaOrder.indexOf(a.areaName);
        const indexB = areaOrder.indexOf(b.areaName);
        return indexA - indexB;
    });

    const formatTime = (hours: number) => {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}:${m.toString().padStart(2, '0')}`;
    };

    const getEfficiencyColor = (eff: number) => {
        if (eff >= thresholds.EXCELLENT) return '#10b981';
        if (eff >= thresholds.ACCEPTABLE) return '#f59e0b';
        return '#ef4444';
    };

    const getTrendIcon = (change: number) => {
        if (change > 5) return '↑';
        if (change < -5) return '↓';
        return '→';
    };

    const getTrendColor = (change: number) => {
        if (change > 5) return '#10b981';
        if (change < -5) return '#ef4444';
        return '#6b7280';
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        @page {
            margin: 20mm 15mm 25mm 15mm;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            font-size: 10pt;
            line-height: 1.4;
            color: #1f2937;
        }
        
        .page-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 20mm;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 15mm;
            border-top: 1px solid #e5e7eb;
            font-size: 8pt;
            color: #6b7280;
            background: white;
        }
        
        .page-footer .left {
            font-weight: 600;
            color: #1e40af;
        }
        
        .page-footer .center {
            text-align: center;
        }
        
        .page-footer .right {
            text-align: right;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 15px;
            border-bottom: 3px solid #3b82f6;
        }
        .header h1 {
            font-size: 24pt;
            color: #1e40af;
            margin-bottom: 8px;
        }
        .header .period {
            font-size: 12pt;
            color: #6b7280;
            margin-bottom: 4px;
        }
        .header .generated {
            font-size: 9pt;
            color: #9ca3af;
        }
        .section {
            margin-bottom: 20px;
            page-break-inside: avoid;
        }
        .section.summary-overview {
            margin-bottom: 50px;
        }
        .section-title {
            font-size: 13pt;
            font-weight: 600;
            color: #1e40af;
            margin-bottom: 12px;
            padding-bottom: 6px;
            border-bottom: 2px solid #e5e7eb;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        }
        .summary-card {
            background: #f9fafb;
            padding: 12px;
            border-radius: 6px;
            border-left: 4px solid #3b82f6;
        }
        .summary-card .label {
            font-size: 9pt;
            color: #6b7280;
            margin-bottom: 4px;
        }
        .summary-card .value {
            font-size: 16pt;
            font-weight: 600;
            color: #1f2937;
        }
        .area-card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            page-break-inside: avoid;
        }
        .area-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e5e7eb;
        }
        .area-name {
            font-size: 14pt;
            font-weight: 600;
            color: #1f2937;
        }
        .area-avg {
            font-size: 11pt;
            font-weight: 600;
            padding: 4px 10px;
            border-radius: 4px;
        }
        .trend-badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 9pt;
            font-weight: 600;
            margin-left: 8px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
        }
        th {
            background: #f9fafb;
            padding: 6px 8px;
            text-align: left;
            font-size: 8pt;
            font-weight: 600;
            color: #6b7280;
            border-bottom: 1px solid #e5e7eb;
        }
        th.right, td.right { text-align: right; }
        td {
            padding: 5px 8px;
            border-bottom: 1px solid #f3f4f6;
            font-size: 9pt;
        }
        .mono { font-family: 'Courier New', monospace; }
        .change {
            font-size: 8pt;
            font-weight: 600;
            padding: 2px 5px;
            border-radius: 3px;
        }
        .page-break { page-break-before: always; }
        .summary-sections {
            page-break-inside: avoid;
            margin-bottom: 30px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${copy.title}${areaFilter ? ` - ${areaFilter}` : ''}</h1>
        <div class="period">${copy.period}: ${monthsData.map(m => `${m.month} ${m.year}`).join(', ')}</div>
        <div class="generated">${copy.generated}: ${new Date().toLocaleString('it-IT')}</div>
    </div>

    <!-- Summary Totals -->
    <div class="section summary-overview">
        <div class="section-title">${copy.overallSummary}</div>
        <div class="summary-grid">
            <div class="summary-card">
                <div class="label">${copy.totalAreas}</div>
                <div class="value">${areaStats.length}</div>
            </div>
            <div class="summary-card">
                <div class="label">${copy.totalHours}</div>
                <div class="value">${formatTime(totalHours)}</div>
            </div>
            <div class="summary-card">
                <div class="label">${copy.overallVelocity}</div>
                <div class="value">${overallVelocity.toFixed(1)} ${copy.units.pcsPerHour}</div>
            </div>
            <div class="summary-card" style="border-left-color: ${getEfficiencyColor(overallEfficiency)};">
                <div class="label">${copy.overallEfficiency}</div>
                <div class="value" style="color: ${getEfficiencyColor(overallEfficiency)};">${overallEfficiency.toFixed(1)}%</div>
            </div>
        </div>
    </div>

    ${(() => {
        // Only show best/worst performers section when no area filter is applied
        if (areaFilter) {
            return '';
        }

        // Top performers (by efficiency)
        const topPerformers = [...areaStats]
            .sort((a, b) => b.avgEfficiency - a.avgEfficiency)
            .slice(0, 2);
        
        // Areas needing attention (efficiency < ACCEPTABLE threshold)
        const needsAttention = areaStats
            .filter(area => area.avgEfficiency < thresholds.ACCEPTABLE)
            .sort((a, b) => a.avgEfficiency - b.avgEfficiency);

        return `
        <div class="summary-sections">
        ${topPerformers.length > 0 ? `
        <!-- Top Performers -->
        <div class="section">
            <div class="section-title">${copy.topPerformers}</div>
            <table>
                <thead>
                    <tr>
                        <th>${copy.columns.area}</th>
                        <th class="right">${copy.columns.efficiency}</th>
                    </tr>
                </thead>
                <tbody>
                    ${topPerformers.map(area => `
                    <tr>
                        <td class="area-name">${area.areaName}</td>
                        <td class="right">
                            <span style="font-weight: 600; color: ${getEfficiencyColor(area.avgEfficiency)};">
                                ${area.avgEfficiency.toFixed(1)}%
                            </span>
                        </td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        ${needsAttention.length > 0 ? `
        <!-- Areas Needing Attention -->
        <div class="section">
            <div class="section-title">${copy.areasNeedingAttention} (${copy.efficiencyBelow.replace('{threshold}', thresholds.ACCEPTABLE.toString())})</div>
            <table>
                <thead>
                    <tr>
                        <th>${copy.columns.area}</th>
                        <th class="right">${copy.columns.efficiency}</th>
                    </tr>
                </thead>
                <tbody>
                    ${needsAttention.map(area => `
                    <tr>
                        <td class="area-name">${area.areaName}</td>
                        <td class="right">
                            <span style="font-weight: 600; color: ${getEfficiencyColor(area.avgEfficiency)};">
                                ${area.avgEfficiency.toFixed(1)}%
                            </span>
                        </td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}
        </div>
        `;
    })()}

    <!-- Area-by-Area Analysis -->
    <div class="section">
        <div class="section-title">${monthsData.length > 1 ? copy.areaPerformanceTrends : copy.areaPerformance}</div>
        ${monthsData.length === 1 ? `
        <!-- Single month: consolidated table -->
        <table>
            <thead>
                <tr>
                    <th>${copy.columns.area}</th>
                    <th class="right">${copy.columns.quantity}</th>
                    <th class="right">${copy.columns.hours}</th>
                    <th class="right">${copy.columns.velocity}</th>
                    <th class="right">${copy.columns.target}</th>
                    <th class="right">${copy.columns.efficiency}</th>
                </tr>
            </thead>
            <tbody>
                ${areaStats.map(area => {
                    const month = area.months[0];
                    return `
                    <tr>
                        <td class="area-name">${area.areaName}</td>
                        <td class="right mono">${month.quantity.toLocaleString('it-IT')}</td>
                        <td class="right mono">${formatTime(month.hours)}</td>
                        <td class="right mono">${month.velocity.toFixed(1)}</td>
                        <td class="right mono">${month.target}</td>
                        <td class="right">
                            <span style="font-weight: 600; color: ${getEfficiencyColor(month.efficiency)};">${month.efficiency.toFixed(1)}%</span>
                        </td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        ` : `
        <!-- Multiple months: area cards with trends -->
        ${areaStats.map((area) => {
            return `
            <div class="area-card">
                <div class="area-header">
                    <div>
                        <span class="area-name">${area.areaName}</span>
                        ${area.months.length > 1 ? `
                        <span class="trend-badge" style="background: ${getTrendColor(area.efficiencyChange)}20; color: ${getTrendColor(area.efficiencyChange)};">
                            ${getTrendIcon(area.efficiencyChange)} ${area.efficiencyChange > 0 ? '+' : ''}${area.efficiencyChange.toFixed(1)}%
                        </span>
                        ` : ''}
                    </div>
                    ${area.months.length > 1 ? `
                    <div class="area-avg" style="background: ${getEfficiencyColor(area.avgEfficiency)}20; color: ${getEfficiencyColor(area.avgEfficiency)};">
                        ${copy.average}: ${area.avgEfficiency.toFixed(1)}%
                    </div>
                    ` : ''}
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>${copy.columns.month}</th>
                            <th class="right">${copy.columns.quantity}</th>
                            <th class="right">${copy.columns.hours}</th>
                            <th class="right">${copy.columns.velocity}</th>
                            <th class="right">${copy.columns.target}</th>
                            <th class="right">${copy.columns.efficiency}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${area.months.map((month) => {
                            return `
                            <tr>
                                <td><strong>${month.month}</strong></td>
                                <td class="right mono">${month.quantity.toLocaleString('it-IT')}</td>
                                <td class="right mono">${formatTime(month.hours)}</td>
                                <td class="right mono">${month.velocity.toFixed(1)}</td>
                                <td class="right mono">${month.target}</td>
                                <td class="right">
                                    <span style="font-weight: 600; color: ${getEfficiencyColor(month.efficiency)};">${month.efficiency.toFixed(1)}%</span>
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            `;
        }).join('')}
        `}
    </div>
</body>
</html>
    `;
}

/**
 * ============================================================================
 * ORDER AREA SUMMARY PDF GENERATION
 * ============================================================================
 */

export async function generateOrderAreaSummaryPDFAction(
    year: number,
    months: number[],
    commessaFilter?: string,
    areaFilter?: string,
    format: 'A4' | 'A3' = 'A4',
    complexOnly: boolean = false
) {
    try {
        // Fetch data for each selected month
        const monthDataPromises = months.map(async (month) => {
            const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const monthEnd = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

            const result = await getOrderAreaSummaryDataAction(
                year,
                1,
                999999,
                { 
                    dateFrom: monthStart, 
                    dateTo: monthEnd,
                    commessa: commessaFilter || undefined,
                    area: areaFilter || undefined,
                    complexOnly
                },
                undefined,
                true
            );

            return {
                month: new Date(year, month - 1).toLocaleString('it-IT', { month: 'long' }),
                year,
                data: result.success ? result.data : []
            };
        });

        const monthsData = await Promise.all(monthDataPromises);

        // Generate HTML for PDF
        const html = generateOrderReportHTML(monthsData, commessaFilter, areaFilter, format);

        // Launch Puppeteer and generate PDF
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const copy = APP_COPY.analytics.pdf;
        const pdfBuffer = await page.pdf({
            format: format as any,
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
                <div style="width: 100%; font-size: 8pt; padding: 0 15mm; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e5e7eb; color: #6b7280;">
                    <div style="font-weight: 600; color: #1e40af;">${APP_CONFIG.ANALYTICS.COMPANY_NAME}</div>
                    <div style="text-align: center;">${APP_COPY.analytics.orderAreaSummary.pdfTitle}</div>
                    <div style="text-align: right;">${copy.footer.page} <span class="pageNumber"></span> ${copy.footer.of} <span class="totalPages"></span></div>
                </div>
            `,
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '25mm',
                left: '15mm'
            }
        });

        await browser.close();

        const base64PDF = Buffer.from(pdfBuffer).toString('base64');
        const sanitize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').trim();
        const suffix = (commessaFilter ? `-${sanitize(commessaFilter)}` : '') + (areaFilter ? `-${sanitize(areaFilter)}` : '');
        
        return {
            success: true,
            pdf: base64PDF,
            filename: `report-commesse-${format.toLowerCase()}-${year}-${months.join('-')}${suffix}.pdf`
        };
    } catch (error) {
        console.error('Order PDF generation error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate PDF'
        };
    }
}

function generateOrderReportHTML(monthsData: MonthData[], commessaFilter?: string, areaFilter?: string, format: 'A4' | 'A3' = 'A4'): string {
    const copy = APP_COPY.analytics;
    const pdfCopy = copy.pdf;
    const orderCopy = copy.orderAreaSummary;
    const AREA_EXPECTED_VELOCITY = APP_CONFIG.ANALYTICS.AREA_EXPECTED_VELOCITY;
    const thresholds = APP_CONFIG.ANALYTICS.EFFICIENCY_THRESHOLDS;

    function calcExpectedHours(areaName: string, qtyRequested: number | null, fogli: number | null = null): number | null {
        const velocity = AREA_EXPECTED_VELOCITY[areaName as keyof typeof AREA_EXPECTED_VELOCITY] ?? 0;
        if (!velocity) return null;
        if (areaName === 'Piega') {
            if (fogli == null) return null;
            return fogli / velocity;
        }
        if (qtyRequested == null) return null;
        return qtyRequested / velocity;
    }

    const formatTime = (hours: number) => {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}:${m.toString().padStart(2, '0')}`;
    };

    const getEfficiencyColor = (eff: number) => {
        if (eff >= thresholds.EXCELLENT) return '#10b981';
        if (eff >= thresholds.ACCEPTABLE) return '#f59e0b';
        return '#ef4444';
    };

    // Group all data by commessa and area
    const commessaMap = new Map<string, any>();
    monthsData.forEach(md => {
        md.data.forEach(row => {
            const key = row.commessa_display;
            if (!commessaMap.has(key)) {
                commessaMap.set(key, {
                    display: row.commessa_display,
                    description: row.order_description,
                    client: row.client_name ?? '',
                    total_time: 0,
                    total_expected: 0,
                    areasMap: new Map<string, any>()
                });
            }
            
            const group = commessaMap.get(key);
            
            // Handle area aggregation
            const areaKey = row.area_name;
            if (!group.areasMap.has(areaKey)) {
                const expectedHours = calcExpectedHours(row.area_name, row.qty_requested, row.fogli);
                group.areasMap.set(areaKey, {
                    label: row.area_name,
                    time: 0,
                    expected: expectedHours
                });
                
                // Add expected hours to total once per commessa-area
                if (expectedHours != null) {
                    group.total_expected += expectedHours;
                }
            }
            
            const area = group.areasMap.get(areaKey);
            area.time += row.work_time;
            group.total_time += row.work_time;
        });
    });

    const commessaList = Array.from(commessaMap.values()).map(group => {
        const areas = Array.from(group.areasMap.values()).map((area: any) => ({
            ...area,
            efficiency: area.expected != null && area.time > 0 ? (area.expected / area.time) * 100 : 0
        }));
        
        return {
            ...group,
            areas
        };
    });

    // Calculate Area Statistics for the dashboard
    const areaStatsMap = new Map<string, { time: number, expected: number }>();
    commessaList.forEach(c => {
        c.areas.forEach((a: any) => {
            if (!areaStatsMap.has(a.label)) {
                areaStatsMap.set(a.label, { time: 0, expected: 0 });
            }
            const s = areaStatsMap.get(a.label)!;
            s.time += a.time;
            s.expected += a.expected || 0;
        });
    });

    const areaStatsList = Array.from(areaStatsMap.entries()).map(([label, stats]) => ({
        label,
        ...stats,
        efficiency: stats.time > 0 ? (stats.expected / stats.time) * 100 : 0
    }));
    areaStatsList.sort((a, b) => b.efficiency - a.efficiency);

    // Calculate overall totals
    const totalOrders = commessaList.length;
    const totalHours = commessaList.reduce((sum, c) => sum + c.total_time, 0);
    const totalExpected = commessaList.reduce((sum, c) => sum + c.total_expected, 0);
    const overallEfficiency = totalHours > 0 ? (totalExpected / totalHours) * 100 : 0;

    // Sort commessa list chronologically for display
    commessaList.sort((a, b) => a.display.localeCompare(b.display));

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { margin: 15mm 10mm 15mm 10mm; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            font-size: 8pt; line-height: 1.2; color: #1f2937;
        }
        .header {
            text-align: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #3b82f6;
        }
        .header h1 { font-size: 14pt; color: #1e40af; margin-bottom: 2px; }
        .header .period { font-size: 9pt; color: #6b7280; }
        .summary-grid {
            display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 15px;
        }
        .summary-card {
            background: #f8fafc; padding: 6px 10px; border-radius: 4px; border: 1px solid #e2e8f0; border-left: 3px solid #3b82f6;
        }
        .summary-card .label { font-size: 7pt; color: #6b7280; margin-bottom: 1px; }
        .summary-card .value { font-size: 11pt; font-weight: 600; color: #1f2937; }

        /* Dashboard Charts */
        .dashboard-section {
            margin-bottom: 20px; padding: 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px;
        }
        .dashboard-title { font-size: 10pt; font-weight: 700; color: #1e40af; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
        .chart-row { display: flex; align-items: center; margin-bottom: 6px; }
        .chart-label { width: 120px; font-size: 7.5pt; font-weight: 600; color: #475569; }
        .chart-bar-bg { flex: 1; background: #f1f5f9; height: 10px; border-radius: 5px; margin: 0 12px; overflow: hidden; position: relative; }
        .chart-bar-fill { height: 100%; border-radius: 5px; }
        .chart-value { width: 45px; text-align: right; font-weight: 700; font-size: 8pt; }
        .chart-hours { width: 70px; text-align: right; font-size: 7pt; color: #64748b; font-family: monospace; }
        
        table { width: 100%; border-collapse: collapse; margin-top: 5px; }
        thead { display: table-header-group; }
        th {
            background: #f1f5f9; padding: 4px 8px; text-align: left; font-size: 7pt; font-weight: 600; color: #475569; border: 1px solid #e2e8f0;
        }
        td { padding: 3px 8px; border: 1px solid #f1f5f9; }
        .right { text-align: right; }
        .mono { font-family: 'Courier New', monospace; font-size: 7.5pt; }
        .font-semibold { font-weight: 600; }
        
        /* Order Header Row */
        .order-row-header { background: #f8fafc; font-weight: 700; border-top: 2px solid #e2e8f0; }
        .order-meta-row { 
            display: flex; align-items: baseline; gap: 4px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; width: 220px;
        }
        .order-display { color: #1e40af; font-family: monospace; font-size: 8.5pt; flex-shrink: 0; }
        .order-client { color: #4b5563; font-size: 7.5pt; overflow: hidden; text-overflow: ellipsis; }
        .order-desc { 
            color: #94a3b8; font-size: 7pt; font-weight: normal; 
            display: block; 
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis;
            width: 220px;
            margin-top: 1px;
        }
        
        /* Sub-rows */
        .area-label { padding-left: 15px; color: #475569; }
        
        tbody { page-break-inside: avoid; }
        .column-layout {
            column-count: ${format === 'A3' ? '2' : '1'};
            column-gap: 20px;
            column-fill: auto;
        }
        .order-table {
            break-inside: avoid-column;
            width: 100%;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${orderCopy.pdfTitle}</h1>
        <div class="period">${pdfCopy.period}: ${monthsData.map(m => `${m.month} ${m.year}`).join(', ')}</div>
    </div>

    <div class="summary-grid">
        <div class="summary-card">
            <div class="label">Totale Commesse</div>
            <div class="value">${totalOrders}</div>
        </div>
        <div class="summary-card">
            <div class="label">${pdfCopy.totalHours}</div>
            <div class="value">${formatTime(totalHours)}</div>
        </div>
        <div class="summary-card">
            <div class="label">Ore Attese Totali</div>
            <div class="value">${formatTime(totalExpected)}</div>
        </div>
        <div class="summary-card" style="border-left-color: ${getEfficiencyColor(overallEfficiency)};">
            <div class="label">${pdfCopy.overallEfficiency}</div>
            <div class="value" style="color: ${getEfficiencyColor(overallEfficiency)};">${overallEfficiency.toFixed(1)}%</div>
        </div>
    </div>

    <!-- Performance Dashboard -->
    <div class="dashboard-section">
        <div class="dashboard-title">Performance per Macro Area</div>
        ${areaStatsList.map(area => {
            const color = getEfficiencyColor(area.efficiency);
            const barWidth = Math.min(area.efficiency, 120); // Cap visual bar at 120%
            return `
            <div class="chart-row">
                <div class="chart-label">${area.label}</div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill" style="width: ${barWidth}%; background-color: ${color};"></div>
                </div>
                <div class="chart-hours">${formatTime(area.time)} / ${formatTime(area.expected)}</div>
                <div class="chart-value" style="color: ${color};">${area.efficiency.toFixed(1)}%</div>
            </div>
            `;
        }).join('')}
    </div>

    <div class="column-layout">
        ${commessaList.map(order => {
            const orderEff = order.total_time > 0 ? (order.total_expected / order.total_time) * 100 : 0;
            return `
            <table class="order-table">
                <thead>
                    <tr>
                        <th style="width: 45%; font-size: 7pt;">Commessa / Area</th>
                        <th class="right" style="width: 15%; font-size: 7pt;">Attese</th>
                        <th class="right" style="width: 15%; font-size: 7pt;">Lavoro</th>
                        <th class="right" style="width: 25%; font-size: 7pt;">Efficiency</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="order-row-header">
                        <td>
                            <div class="order-meta-row">
                                <span class="order-display">${order.display}</span>
                                ${order.client ? `<span class="order-client">${order.client}</span>` : ''}
                            </div>
                            <div class="order-desc">${order.description}</div>
                        </td>
                        <td class="right mono">${formatTime(order.total_expected)}</td>
                        <td class="right mono">${formatTime(order.total_time)}</td>
                        <td class="right" style="color: ${getEfficiencyColor(orderEff)}; font-weight: bold; font-size: 9pt;">
                            ${orderEff.toFixed(1)}%
                        </td>
                    </tr>
                    ${order.areas.map((area: any) => `
                        <tr>
                            <td class="area-label">${area.label}</td>
                            <td class="right mono" style="color: #64748b;">${area.expected != null ? formatTime(area.expected) : '—'}</td>
                            <td class="right mono font-semibold">${formatTime(area.time)}</td>
                            <td class="right">
                                <span style="font-weight: 600; color: ${getEfficiencyColor(area.efficiency)};">
                                    ${area.expected != null ? `${area.efficiency.toFixed(1)}%` : '—'}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            `;
        }).join('')}
    </div>
</body>
</html>
    `;
}
