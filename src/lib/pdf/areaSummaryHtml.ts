import { APP_CONFIG } from '@/config/constants';
import { formatHours } from '@/lib/format';
import type { PeriodData } from '@/lib/pdf/renderPdf';
import { APP_COPY } from '@/locales';

/** HTML of the Sommario Area PDF: one table per area, one row per period (month or ISO week) */
export function areaSummaryReportHtml(monthsData: PeriodData[], areaFilter?: string, mode: 'months' | 'weeks' = 'months'): string {
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

    // Period display string for report header
    const periodDisplay = (() => {
        if (mode === 'weeks') {
            const labels = monthsData.map(m => m.month); // ["S1", "S2", ...]
            const yr = monthsData[0]?.year ?? '';
            return labels.length > 4
                ? `Settimane ${labels[0]}\u2013${labels[labels.length - 1]}, ${yr}`
                : `Settimane ${labels.join(', ')} \u2014 ${yr}`;
        }
        return monthsData.map(m => `${m.month} ${m.year}`).join(', ');
    })();

    // Column header for period column: "Mese" or "Settimana"
    const periodColumnHeader = mode === 'weeks' ? copy.columns.week : copy.columns.month;

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
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 3px solid #3b82f6;
        }
        .header h1 {
            font-size: 18pt;
            color: #1e40af;
            margin-bottom: 4px;
        }
        .header .period {
            font-size: 10pt;
            color: #6b7280;
            margin-bottom: 2px;
        }
        .header .generated {
            font-size: 8pt;
            color: #9ca3af;
        }
        .section {
            margin-bottom: 20px;
            page-break-inside: avoid;
        }
        .section.summary-overview {
            margin-bottom: 20px;
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
            gap: 10px;
            margin-bottom: 15px;
        }
        .summary-card {
            background: #f9fafb;
            padding: 8px 10px;
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
            ${areaFilter ? '' : 'page-break-inside: avoid;'}
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
        <div class="period">${copy.period}: ${periodDisplay}</div>
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
                <div class="value">${formatHours(totalHours)}</div>
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
                        <td class="right mono">${formatHours(month.hours)}</td>
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
                            <th>${periodColumnHeader}</th>
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
                                <td class="right mono">${formatHours(month.hours)}</td>
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
