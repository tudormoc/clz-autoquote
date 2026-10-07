import type { ClientSummaryRow } from '@/app/analytics/queries/business-queries';
import { APP_CONFIG } from '@/config/constants';
import { formatCurrencyRounded } from '@/lib/format';
import { APP_COPY } from '@/locales';

/** HTML of the Sommario Clienti PDF: every client on one A4 page */
export function clientSummaryReportHtml(data: ClientSummaryRow[], periods: string[], clientFilter?: string, includeAllRevenueForSplit: boolean = false, _format: 'A4' | 'A3' = 'A4'): string {
    const totalRevenue = data.reduce((sum, r) => sum + r.total_revenue, 0);
    const totalCost = data.reduce((sum, r) => sum + r.material_cost, 0);
    const totalWorkCost = data.reduce((sum, r) => sum + r.work_cost, 0);
    const totalMargin = data.reduce((sum, r) => sum + r.margin, 0);
    const overallMarginPercent = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

    // Always A4 portrait — dynamically shrink to fit all rows on one page.
    // A4 portrait usable height ≈ 247mm (297 - 35mm margins - 15mm footer).
    // Approximate row height budgets to determine tier:
    //   > 80 rows → ultra-compact   (~2.5mm/row)
    //   > 60 rows → very compact    (~3mm/row)
    //   > 40 rows → compact         (~4mm/row)
    //   > 25 rows → slightly tight  (~5mm/row)
    //   ≤ 25 rows → normal          (~6mm/row)
    const rowCount = data.length;
    let fontSize = '8pt';
    let headerFontSize = '8pt';
    let cellPadding = '5px 4px';
    let headerPadding = '6px 4px';
    let summaryPadding = '10px';
    let summaryFontSize = '10pt';
    let marginBottom = '12px';

    if (rowCount > 80) {
        fontSize = '5.5pt';
        headerFontSize = '6pt';
        cellPadding = '1.5px 3px';
        headerPadding = '2px 3px';
        summaryPadding = '5px';
        summaryFontSize = '7.5pt';
        marginBottom = '6px';
    } else if (rowCount > 60) {
        fontSize = '6pt';
        headerFontSize = '6.5pt';
        cellPadding = '2px 3px';
        headerPadding = '3px 3px';
        summaryPadding = '6px';
        summaryFontSize = '8pt';
        marginBottom = '8px';
    } else if (rowCount > 40) {
        fontSize = '7pt';
        headerFontSize = '7pt';
        cellPadding = '3px 4px';
        headerPadding = '4px 4px';
        summaryPadding = '7px';
        summaryFontSize = '9pt';
        marginBottom = '10px';
    } else if (rowCount > 25) {
        fontSize = '7.5pt';
        headerFontSize = '7.5pt';
        cellPadding = '4px 4px';
        headerPadding = '5px 4px';
        summaryPadding = '8px';
        summaryFontSize = '9.5pt';
        marginBottom = '11px';
    }

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { 
            size: A4 portrait;
            margin: 14mm 13mm 18mm 13mm;
        }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
            font-size: ${fontSize}; 
            line-height: 1.2; 
            color: #1f2937; 
        }
        .header { 
            text-align: center; 
            margin-bottom: ${marginBottom}; 
            padding-bottom: ${rowCount > 60 ? '5px' : '8px'}; 
            border-bottom: 2px solid #3b82f6; 
        }
        .header h1 { 
            font-size: ${rowCount > 60 ? '12pt' : '15pt'}; 
            color: #1e40af; 
            margin-bottom: 3px; 
        }
        .period { 
            font-size: ${rowCount > 60 ? '7.5pt' : '9.5pt'}; 
            color: #6b7280; 
        }
        .generated { 
            font-size: ${rowCount > 60 ? '6pt' : '7.5pt'}; 
            color: #9ca3af; 
            margin-top: 2px; 
        }
        
        table { 
            width: 100%; 
            border-collapse: collapse; 
            table-layout: fixed; 
        }
        th { 
            background: #f9fafb; 
            padding: ${headerPadding}; 
            text-align: left; 
            font-size: ${headerFontSize}; 
            font-weight: 600; 
            color: #6b7280; 
            border-bottom: 1px solid #e5e7eb; 
        }
        td { 
            padding: ${cellPadding}; 
            border-bottom: 1px solid #f3f4f6; 
            font-size: ${fontSize}; 
            vertical-align: middle; 
        }
        th.right, td.right { text-align: right; }
        .mono { font-family: 'Courier New', monospace; }
        .truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }

        /* A4 portrait column widths */
            .col-client { width: 30%; }
            .col-rev { width: 14%; }
            .col-cost { width: 11%; }
            .col-work { width: 11%; }
            .col-total { width: 12%; }
            .col-margin { width: 14%; }
            .col-percent { width: 8%; }
        
        .summary-box { 
            margin-bottom: ${marginBottom}; 
            padding: ${summaryPadding}; 
            background: #f9fafb; 
            border-left: 3px solid #3b82f6; 
            border-radius: 4px; 
            display: flex; 
            justify-content: space-between; 
        }
        .summary-item { flex: 1; text-align: center; }
        .summary-label { 
            color: #6b7280; 
            font-size: ${rowCount > 60 ? '6pt' : '7.5pt'}; 
            margin-bottom: 2px; 
        }
        .summary-value { 
            font-size: ${summaryFontSize}; 
            font-weight: 600; 
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${APP_COPY.analytics.clientSummary.pdfTitle}${clientFilter ? ` (${clientFilter})` : ''}</h1>
        <div class="period">${APP_COPY.analytics.pdf.period}: ${periods.join(', ')}</div>
        <div class="generated">${includeAllRevenueForSplit ? '(Incluso fatturato per ordini parziali) - ' : ''}${APP_COPY.analytics.pdf.generated}: ${new Date().toLocaleString('it-IT')}</div>
    </div>

    <div class="summary-box">
        <div class="summary-item">
            <div class="summary-label">Totale Fatturato</div>
            <div class="summary-value">${formatCurrencyRounded(totalRevenue)}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">Materiali</div>
            <div class="summary-value">${formatCurrencyRounded(totalCost)}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">Manodopera</div>
            <div class="summary-value">${formatCurrencyRounded(totalWorkCost)}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">Margine</div>
            <div class="summary-value">${formatCurrencyRounded(totalMargin)}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">% Margine</div>
            <div class="summary-value" style="color: ${overallMarginPercent >= 20 ? '#10b981' : overallMarginPercent >= 10 ? '#f59e0b' : '#ef4444'}">${overallMarginPercent.toFixed(1)}%</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">Costo Orario Manodopera</div>
            <div class="summary-value">${APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE} €/h</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th class="col-client">${APP_COPY.analytics.common.client}</th>
                <th class="col-rev right">${APP_COPY.analytics.clientSummary.headers.revenue}</th>
                <th class="col-cost right">${APP_COPY.analytics.clientSummary.headers.materialCost}</th>
                <th class="col-work right">${APP_COPY.analytics.clientSummary.headers.laborCost}</th>
                <th class="col-total right">Costo Totale</th>
                <th class="col-margin right">${APP_COPY.analytics.clientSummary.headers.margin}</th>
                <th class="col-percent right">%</th>
            </tr>
        </thead>
        <tbody>
            ${data.map(row => {
                const marginPct = row.total_revenue > 0 ? (row.margin / row.total_revenue) * 100 : 0;
                
                return `
                <tr>
                    <td class="col-client">
                        <div class="truncate">${row.client_name}</div>
                    </td>
                    <td class="col-rev right mono" style="font-weight: 600;">${formatCurrencyRounded(row.total_revenue)}</td>
                    <td class="col-cost right mono">${formatCurrencyRounded(row.material_cost)}</td>
                    <td class="col-work right mono">${formatCurrencyRounded(row.work_cost)}</td>
                    <td class="col-total right mono" style="font-weight: 600;">${formatCurrencyRounded(row.full_cost)}</td>
                    <td class="col-margin right mono" style="font-weight: 600;">${formatCurrencyRounded(row.margin)}</td>
                    <td class="col-percent right mono" style="font-weight: 600; color: ${marginPct >= 20 ? '#10b981' : marginPct >= 10 ? '#f59e0b' : '#ef4444'}">${marginPct.toFixed(1)}%</td>
                </tr>
                `;
            }).join('')}
        </tbody>
    </table>
</body>
</html>
    `;
}
