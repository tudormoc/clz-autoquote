import { calcExpectedHours } from '@/lib/expectedHours';
import { formatHours } from '@/lib/format';
import type { PeriodData } from '@/lib/pdf/renderPdf';
import { APP_COPY } from '@/locales';

/** HTML of the Sommario Ordini per Area PDF (A4 or A3) */
export function orderAreaSummaryReportHtml(monthsData: PeriodData[], commessaFilter?: string, areaFilter?: string, format: 'A4' | 'A3' = 'A4'): string {
    const copy = APP_COPY.analytics;
    const pdfCopy = copy.pdf;
    const orderCopy = copy.orderAreaSummary;

    const getEfficiencyColor = (eff: number) => {
        if (eff >= 100) return '#10b981';
        return '#f59e0b';
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

    // --- NEW KPIs ---
    let ordersInTarget = 0;
    let ordersOutTarget = 0;
    let hoursGained = 0;
    let hoursLost = 0;

    commessaList.forEach(order => {
        const eff = order.total_time > 0 ? (order.total_expected / order.total_time) * 100 : 0;
        if (eff >= 100) ordersInTarget++;
        else ordersOutTarget++;

        const delta = order.total_expected - order.total_time;
        if (delta > 0) hoursGained += delta;
        else if (delta < 0) hoursLost += Math.abs(delta);
    });

    const netDelta = hoursGained - hoursLost;

    // Client Aggregation
    const clientStatsMap = new Map<string, { time: number, expected: number }>();
    commessaList.forEach(c => {
        const clientName = c.client || 'Sconosciuto';
        if (!clientStatsMap.has(clientName)) {
            clientStatsMap.set(clientName, { time: 0, expected: 0 });
        }
        const s = clientStatsMap.get(clientName)!;
        s.time += c.total_time;
        s.expected += c.total_expected;
    });

    const clientStatsList = Array.from(clientStatsMap.entries())
        .map(([client, stats]) => ({
            client,
            ...stats,
            efficiency: stats.time > 0 ? (stats.expected / stats.time) * 100 : 0
        }))
        .filter(c => c.expected > 0);

    // Filter significant clients (at least 2 hours expected) for accurate efficiency ranking
    const significantClients = clientStatsList.filter(c => c.expected >= 2);
    const clientsToRank = significantClients.length >= 5 ? significantClients : clientStatsList;
    
    // Best clients: strictly >= 100%, sorted highest to lowest
    const bestClients = [...clientsToRank]
        .filter(c => c.efficiency >= 100)
        .sort((a, b) => b.efficiency - a.efficiency)
        .slice(0, 5);
        
    // Worst clients: strictly < 100%, sorted lowest to highest (worst first)
    const worstClients = [...clientsToRank]
        .filter(c => c.efficiency < 100)
        .sort((a, b) => a.efficiency - b.efficiency)
        .slice(0, 5);

    // Group commessa list by client (alphabetically) and sort orders inside each client by efficiency descending
    const groupedOrders: Record<string, typeof commessaList> = {};
    for (const order of commessaList) {
        const clientKey = (order.client && order.client.trim()) ? order.client.trim() : 'Senza Cliente';
        if (!groupedOrders[clientKey]) {
            groupedOrders[clientKey] = [];
        }
        groupedOrders[clientKey].push(order);
    }

    const sortedClientNames = Object.keys(groupedOrders).sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));

    for (const clientName of sortedClientNames) {
        groupedOrders[clientName].sort((a, b) => {
            const effA = a.total_time > 0 ? (a.total_expected / a.total_time) * 100 : 0;
            const effB = b.total_time > 0 ? (b.total_expected / b.total_time) * 100 : 0;
            return effB - effA;
        });
    }

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
        
        /* New KPI Widgets */
        .dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        .kpi-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
        .kpi-row:last-child { border-bottom: none; }
        .kpi-label { font-size: 8pt; color: #475569; }
        .kpi-val { font-size: 8.5pt; font-weight: 600; text-align: right; }
        
        .client-row { display: flex; align-items: center; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f1f5f9; }
        .client-row:last-child { border-bottom: none; }
        .client-name { font-size: 7.5pt; font-weight: 600; color: #1e40af; width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .client-vol { font-size: 7pt; color: #64748b; font-family: monospace; width: 60px; text-align: right; }
        .client-eff { font-size: 8pt; font-weight: 700; width: 45px; text-align: right; }
        
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
        .client-group-header {
            font-size: 9pt;
            font-weight: 700;
            color: #1e40af;
            background: #eff6ff;
            border-left: 3px solid #3b82f6;
            padding: 5px 8px;
            margin: 12px 0 8px 0;
            border-radius: 2px;
            break-after: avoid;
            break-inside: avoid;
        }
        .order-table {
            break-inside: avoid-column;
            width: 100%;
            margin-bottom: 15px;
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
            <div class="label">Totale Commesse Analizzate</div>
            <div class="value">${totalOrders}</div>
        </div>
        <div class="summary-card">
            <div class="label">${pdfCopy.totalHours}</div>
            <div class="value">${formatHours(totalHours)}</div>
        </div>
        <div class="summary-card">
            <div class="label">Ore Attese Totali</div>
            <div class="value">${formatHours(totalExpected)}</div>
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
                <div class="chart-hours">${formatHours(area.time)} / ${formatHours(area.expected)}</div>
                <div class="chart-value" style="color: ${color};">${area.efficiency.toFixed(1)}%</div>
            </div>
            `;
        }).join('')}
    </div>

    <!-- New KPI Sections -->
    <div class="dashboard-grid">
        <div class="dashboard-section" style="margin-bottom: 0;">
            <div class="dashboard-title">Bilancio Ore & Volume</div>
            
            <div class="kpi-row">
                <div class="kpi-label">Ordini a Target (≥ 100%)</div>
                <div class="kpi-val" style="color: #10b981;">${ordersInTarget}</div>
            </div>
            <div class="kpi-row">
                <div class="kpi-label">Ordini fuori Target (< 100%)</div>
                <div class="kpi-val" style="color: #f59e0b;">${ordersOutTarget}</div>
            </div>
            
            <div style="margin: 10px 0; border-top: 2px dashed #e2e8f0;"></div>

            <div class="kpi-row">
                <div class="kpi-label">Ore Guadagnate</div>
                <div class="kpi-val" style="color: #10b981;">+${formatHours(hoursGained)}</div>
            </div>
            <div class="kpi-row">
                <div class="kpi-label">Ore Perse</div>
                <div class="kpi-val" style="color: #ef4444;">-${formatHours(hoursLost)}</div>
            </div>
            <div class="kpi-row" style="background: #f8fafc; padding: 6px; border-radius: 4px; margin-top: 4px;">
                <div class="kpi-label" style="font-weight: bold;">Bilancio Netto Ore</div>
                <div class="kpi-val" style="color: ${netDelta >= 0 ? '#10b981' : '#ef4444'}; font-size: 9pt;">
                    ${netDelta > 0 ? '+' : ''}${formatHours(netDelta)}
                </div>
            </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 15px;">
            <!-- Best Clients -->
            <div class="dashboard-section" style="margin-bottom: 0;">
                <div class="dashboard-title" style="color: #10b981;">${orderCopy.topClientsTitle}</div>
                ${bestClients.length > 0 ? bestClients.map(client => {
                    const color = getEfficiencyColor(client.efficiency);
                    return `
                    <div class="client-row">
                        <div class="client-name">${client.client}</div>
                        <div class="client-vol" title="Ore Lavoro / Ore Attese">${formatHours(client.time)} / ${formatHours(client.expected)}</div>
                        <div class="client-eff" style="color: ${color};">${client.efficiency.toFixed(1)}%</div>
                    </div>
                    `;
                }).join('') : '<div style="font-size: 7.5pt; color: #64748b;">Dati insufficienti</div>'}
            </div>

            <!-- Worst Clients -->
            ${worstClients.length > 0 ? `
            <div class="dashboard-section" style="margin-bottom: 0;">
                <div class="dashboard-title" style="color: #ef4444;">${orderCopy.worstClientsTitle}</div>
                ${worstClients.map(client => {
                    const color = getEfficiencyColor(client.efficiency);
                    return `
                    <div class="client-row">
                        <div class="client-name">${client.client}</div>
                        <div class="client-vol" title="Ore Lavoro / Ore Attese">${formatHours(client.time)} / ${formatHours(client.expected)}</div>
                        <div class="client-eff" style="color: ${color};">${client.efficiency.toFixed(1)}%</div>
                    </div>
                    `;
                }).join('')}
            </div>
            ` : ''}
        </div>
    </div>

    <!-- Force a page break before the individual orders -->
    <div style="page-break-before: always;"></div>

    <div class="column-layout">
        ${sortedClientNames.map(clientName => `
            <div class="client-group-header">CLIENTE: ${clientName} (${groupedOrders[clientName].length} commesse)</div>
            ${groupedOrders[clientName].map(order => {
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
                            <td class="right mono">${formatHours(order.total_expected)}</td>
                            <td class="right mono">${formatHours(order.total_time)}</td>
                            <td class="right" style="color: ${getEfficiencyColor(orderEff)}; font-weight: bold; font-size: 9pt;">
                                ${orderEff.toFixed(1)}%
                            </td>
                        </tr>
                        ${order.areas.map((area: any) => `
                            <tr>
                                <td class="area-label">${area.label}</td>
                                <td class="right mono" style="color: #64748b;">${area.expected != null ? formatHours(area.expected) : '—'}</td>
                                <td class="right mono font-semibold">${formatHours(area.time)}</td>
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
        `).join('')}
    </div>
</body>
</html>
    `;
}
