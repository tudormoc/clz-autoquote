import type { ClientSummaryRow } from '@/app/analytics/queries/client-summary-queries';
import { APP_CONFIG } from '@/config/constants';
import { formatCurrencyRounded } from '@/lib/format';
import { escapeHtml, generatedAt, pdfDocument, percent, reportHeader } from '@/lib/pdf/html';
import { PDF_COLORS as C, toneColor } from '@/lib/pdf/theme';
import { APP_COPY, fmt } from '@/locales';

const pdf = APP_COPY.analytics.pdf;
const copy = pdf.client;
const headers = APP_COPY.analytics.clientSummary.headers;
const { GOOD, FAIR } = APP_CONFIG.ANALYTICS.MARGIN_THRESHOLDS;

/**
 * Text sizes by number of clients, so the whole list fits on one A4 portrait page (≈247 mm usable): the first tier
 * whose `minRows` the list exceeds is used. Anything still too tall is shrunk when printing (fitHeightPx).
 */
const DENSITY = [
    { minRows: 80, font: '5.5pt', head: '6pt', cell: '1.5px 3px', headCell: '2px 3px', box: '5px', boxFont: '7.5pt', gap: '6px' },
    { minRows: 60, font: '6pt', head: '6.5pt', cell: '2px 3px', headCell: '3px 3px', box: '6px', boxFont: '8pt', gap: '8px' },
    { minRows: 40, font: '7pt', head: '7pt', cell: '3px 4px', headCell: '4px 4px', box: '7px', boxFont: '9pt', gap: '10px' },
    { minRows: 25, font: '7.5pt', head: '7.5pt', cell: '4px 4px', headCell: '5px 4px', box: '8px', boxFont: '9.5pt', gap: '11px' },
    { minRows: 0, font: '8pt', head: '8pt', cell: '5px 4px', headCell: '6px 4px', box: '10px', boxFont: '10pt', gap: '12px' },
] as const;

/** Column widths (A4 portrait), in table order */
const COLUMNS = [
    { label: APP_COPY.analytics.common.client, width: '30%', right: false },
    { label: headers.revenue, width: '14%', right: true },
    { label: headers.materialCost, width: '11%', right: true },
    { label: headers.laborCost, width: '11%', right: true },
    { label: copy.totalCost, width: '12%', right: true },
    { label: headers.margin, width: '14%', right: true },
    { label: '%', width: '8%', right: true },
];

const marginColor = (value: number) => toneColor(value, GOOD, FAIR);
const marginPercent = (margin: number, revenue: number) => (revenue > 0 ? (margin / revenue) * 100 : 0);

/** HTML of the Sommario Clienti PDF: totals, then every client on one A4 page */
export function clientSummaryReportHtml(rows: ClientSummaryRow[], hourlyRate: number, periods: string[], clientFilter?: string, includeAllRevenueForSplit = false): string {
    const sum = (pick: (row: ClientSummaryRow) => number) => rows.reduce((total, row) => total + pick(row), 0);
    const revenue = sum((r) => r.total_revenue);
    const margin = sum((r) => r.margin);
    const overall = marginPercent(margin, revenue);

    const d = DENSITY.find((tier) => rows.length > tier.minRows) ?? DENSITY[DENSITY.length - 1];
    const dense = rows.length > 60;

    const styles = `
        @page { size: A4 portrait; margin: 14mm 13mm 18mm 13mm; }
        body { font-size: ${d.font}; line-height: 1.2; }
        .header { margin-bottom: ${d.gap}; padding-bottom: ${dense ? '5px' : '8px'}; }
        .header h1 { font-size: ${dense ? '12pt' : '15pt'}; }
        .header .line { font-size: ${dense ? '7.5pt' : '9.5pt'}; }
        .header .line.small { font-size: ${dense ? '6pt' : '7.5pt'}; margin-top: 2px; }
        table { table-layout: fixed; }
        th { background: ${C.surface}; padding: ${d.headCell}; font-size: ${d.head}; border-bottom: 1px solid ${C.border}; }
        td { padding: ${d.cell}; border-bottom: 1px solid ${C.rowLine}; font-size: ${d.font}; vertical-align: middle; }
        .totals { margin-bottom: ${d.gap}; padding: ${d.box}; background: ${C.surface}; border-left: 3px solid ${C.accent}; border-radius: 4px; display: flex; justify-content: space-between; }
        .totals .item { flex: 1; text-align: center; }
        .totals .label { color: ${C.muted}; font-size: ${dense ? '6pt' : '7.5pt'}; margin-bottom: 2px; }
        .totals .value { font-size: ${d.boxFont}; font-weight: 600; }
    `;

    const totals = [
        { label: copy.totalRevenue, value: formatCurrencyRounded(revenue) },
        { label: copy.materials, value: formatCurrencyRounded(sum((r) => r.material_cost)) },
        { label: copy.labour, value: formatCurrencyRounded(sum((r) => r.work_cost)) },
        { label: copy.margin, value: formatCurrencyRounded(margin) },
        { label: copy.marginPercent, value: percent(overall), color: marginColor(overall) },
        { label: copy.hourlyRate, value: fmt(copy.perHour, { rate: hourlyRate }) },
    ];

    const generated = generatedAt(pdf.generated);
    const body = `
        ${reportHeader(clientFilter ? `${APP_COPY.analytics.clientSummary.pdfTitle} (${clientFilter})` : APP_COPY.analytics.clientSummary.pdfTitle, [
            { text: `${pdf.period}: ${periods.join(', ')}` },
            { text: includeAllRevenueForSplit ? `(${copy.includesSplit}) - ${generated}` : generated, small: true },
        ])}
        <div class="totals">
            ${totals
                .map((t) => `
            <div class="item">
                <div class="label">${t.label}</div>
                <div class="value"${t.color ? ` style="color: ${t.color};"` : ''}>${t.value}</div>
            </div>`)
                .join('')}
        </div>
        <table>
            <thead><tr>${COLUMNS.map((c) => `<th${c.right ? ' class="right"' : ''} style="width: ${c.width};">${c.label}</th>`).join('')}</tr></thead>
            <tbody>
                ${rows
                    .map((row) => {
                        const pct = marginPercent(row.margin, row.total_revenue);
                        return `
                <tr>
                    <td><div class="truncate">${escapeHtml(row.client_name)}</div></td>
                    <td class="right mono strong">${formatCurrencyRounded(row.total_revenue)}</td>
                    <td class="right mono">${formatCurrencyRounded(row.material_cost)}</td>
                    <td class="right mono">${formatCurrencyRounded(row.work_cost)}</td>
                    <td class="right mono strong">${formatCurrencyRounded(row.full_cost)}</td>
                    <td class="right mono strong">${formatCurrencyRounded(row.margin)}</td>
                    <td class="right mono strong" style="color: ${marginColor(pct)};">${percent(pct)}</td>
                </tr>`;
                    })
                    .join('')}
            </tbody>
        </table>`;

    return pdfDocument(styles, body);
}
