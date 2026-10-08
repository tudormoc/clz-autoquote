import type { OrderAreaRow } from '@/app/analytics/queries/netpro-queries';
import { APP_CONFIG } from '@/config/constants';
import { calcExpectedHours } from '@/lib/expectedHours';
import { EMPTY_VALUE, formatHours } from '@/lib/format';
import { escapeHtml, generatedAt, join, pdfDocument, percent, reportHeader } from '@/lib/pdf/html';
import type { PeriodData } from '@/lib/pdf/renderPdf';
import { PDF_COLORS as C } from '@/lib/pdf/theme';
import { APP_COPY, fmt } from '@/locales';

const pdf = APP_COPY.analytics.pdf;
const copy = pdf.orderArea;
const titles = APP_COPY.analytics.orderAreaSummary;
const { ORDER_TARGET_EFFICIENCY: TARGET, BAR_MAX_PERCENT, CLIENT_MIN_EXPECTED_HOURS, CLIENT_MIN_FOR_RANKING, CLIENT_RANK_SIZE } = APP_CONFIG.ANALYTICS.PDF;

/** Expected / worked hours as efficiency in % (0 when nothing was worked) */
const efficiencyOf = (expected: number, worked: number) => (worked > 0 ? (expected / worked) * 100 : 0);
/** Green on target, amber below */
const efficiencyColor = (value: number) => (value >= TARGET ? C.good : C.fair);

interface AreaHours {
    label: string;
    worked: number;
    /** Hours the area should take; null when the area has no expected speed */
    expected: number | null;
}

interface OrderHours {
    display: string;
    description: string;
    client: string;
    worked: number;
    expected: number;
    areas: AreaHours[];
}

interface Totals {
    label: string;
    worked: number;
    expected: number;
    efficiency: number;
}

/** Sums worked and expected hours per order and area, then per area, per client and overall */
function summarize(periods: PeriodData<OrderAreaRow>[]) {
    const orders = new Map<string, OrderHours>();
    for (const row of periods.flatMap((p) => p.data)) {
        let order = orders.get(row.commessa_display);
        if (!order) {
            order = { display: row.commessa_display, description: row.order_description, client: row.client_name ?? '', worked: 0, expected: 0, areas: [] };
            orders.set(row.commessa_display, order);
        }
        let area = order.areas.find((a) => a.label === row.area_name);
        if (!area) {
            // Expected hours count once per order and area, even over several periods
            area = { label: row.area_name, worked: 0, expected: calcExpectedHours(row.area_name, row.qty_requested, row.fogli) };
            order.areas.push(area);
            order.expected += area.expected ?? 0;
        }
        area.worked += row.work_time;
        order.worked += row.work_time;
    }
    const list = Array.from(orders.values());

    const totalsBy = (entries: { label: string; worked: number; expected: number }[]): Totals[] => {
        const map = new Map<string, Totals>();
        for (const entry of entries) {
            const totals = map.get(entry.label) ?? { label: entry.label, worked: 0, expected: 0, efficiency: 0 };
            totals.worked += entry.worked;
            totals.expected += entry.expected;
            map.set(entry.label, totals);
        }
        return Array.from(map.values()).map((t) => ({ ...t, efficiency: efficiencyOf(t.expected, t.worked) }));
    };

    const areas = totalsBy(list.flatMap((o) => o.areas.map((a) => ({ label: a.label, worked: a.worked, expected: a.expected ?? 0 })))).sort(
        (a, b) => b.efficiency - a.efficiency
    );

    // Clients ranked on efficiency; small clients only when there are not enough bigger ones
    const clients = totalsBy(list.map((o) => ({ label: o.client || copy.noClient, worked: o.worked, expected: o.expected }))).filter((c) => c.expected > 0);
    const significant = clients.filter((c) => c.expected >= CLIENT_MIN_EXPECTED_HOURS);
    const ranked = significant.length >= CLIENT_MIN_FOR_RANKING ? significant : clients;

    let gained = 0;
    let lost = 0;
    for (const order of list) {
        const delta = order.expected - order.worked;
        if (delta > 0) gained += delta;
        else lost -= delta;
    }
    const worked = list.reduce((sum, o) => sum + o.worked, 0);
    const expected = list.reduce((sum, o) => sum + o.expected, 0);
    const inTarget = list.filter((o) => efficiencyOf(o.expected, o.worked) >= TARGET).length;

    // Orders grouped by client (A–Z), most efficient first inside a client
    const groups = new Map<string, OrderHours[]>();
    for (const order of list) {
        const key = order.client.trim() || copy.noClient;
        groups.set(key, [...(groups.get(key) ?? []), order]);
    }
    const byClient = Array.from(groups.entries())
        .sort(([a], [b]) => a.localeCompare(b, 'it', { sensitivity: 'base' }))
        .map(([client, items]) => ({
            client,
            orders: items.sort((a, b) => efficiencyOf(b.expected, b.worked) - efficiencyOf(a.expected, a.worked)),
        }));

    return {
        orderCount: list.length,
        worked,
        expected,
        efficiency: efficiencyOf(expected, worked),
        inTarget,
        outOfTarget: list.length - inTarget,
        gained,
        lost,
        areas,
        bestClients: ranked.filter((c) => c.efficiency >= TARGET).sort((a, b) => b.efficiency - a.efficiency).slice(0, CLIENT_RANK_SIZE),
        worstClients: ranked.filter((c) => c.efficiency < TARGET).sort((a, b) => a.efficiency - b.efficiency).slice(0, CLIENT_RANK_SIZE),
        byClient,
    };
}

const styles = (columns: number) => `
    @page { margin: 15mm 10mm 15mm 10mm; }
    body { font-size: 8pt; line-height: 1.2; }
    .header { margin-bottom: 10px; }
    .header h1 { font-size: 14pt; margin-bottom: 2px; }
    .header .line { font-size: 9pt; }
    .header .line.small { font-size: 7pt; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 15px; }
    .summary-card { background: ${C.surfaceCool}; padding: 6px 10px; border-radius: 4px; border: 1px solid ${C.borderCool}; border-left: 3px solid ${C.accent}; }
    .summary-card .label { font-size: 7pt; color: ${C.muted}; margin-bottom: 1px; }
    .summary-card .value { font-size: 11pt; font-weight: 600; }
    .panel { margin-bottom: 20px; padding: 12px; background: ${C.white}; border: 1px solid ${C.borderCool}; border-radius: 6px; }
    .panel-title { font-size: 10pt; font-weight: 700; color: ${C.brand}; margin-bottom: 10px; }
    .panels { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
    .panels .panel { margin-bottom: 0; }
    .stack { display: flex; flex-direction: column; gap: 15px; }
    .bar-row { display: flex; align-items: center; margin-bottom: 6px; }
    .bar-label { width: 120px; font-size: 7.5pt; font-weight: 600; color: ${C.slate}; }
    .bar-track { flex: 1; background: ${C.headerCell}; height: 10px; border-radius: 5px; margin: 0 12px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 5px; }
    .bar-hours { width: 70px; text-align: right; font-size: 7pt; color: ${C.slateMuted}; font-family: monospace; }
    .bar-value { width: 45px; text-align: right; font-weight: 700; font-size: 8pt; }
    .kpi-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid ${C.headerCell}; }
    .kpi-row:last-child { border-bottom: none; }
    .kpi-row.total { background: ${C.surfaceCool}; padding: 6px; border-radius: 4px; margin-top: 4px; font-weight: bold; }
    .kpi-label { font-size: 8pt; color: ${C.slate}; }
    .kpi-value { font-size: 8.5pt; font-weight: 600; text-align: right; }
    .divider { margin: 10px 0; border-top: 2px dashed ${C.borderCool}; }
    .client-row { display: flex; align-items: center; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid ${C.headerCell}; }
    .client-row:last-child { border-bottom: none; }
    .client-name { font-size: 7.5pt; font-weight: 600; color: ${C.brand}; width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .client-hours { font-size: 7pt; color: ${C.slateMuted}; font-family: monospace; width: 60px; text-align: right; }
    .client-eff { font-size: 8pt; font-weight: 700; width: 45px; text-align: right; }
    .empty { font-size: 7.5pt; color: ${C.slateMuted}; }
    .page-break { page-break-before: always; }
    .columns { column-count: ${columns}; column-gap: 20px; column-fill: auto; }
    .client-group { font-size: 9pt; font-weight: 700; color: ${C.brand}; background: ${C.accentSoft}; border-left: 3px solid ${C.accent}; padding: 5px 8px; margin: 12px 0 8px 0; border-radius: 2px; break-after: avoid; break-inside: avoid; }
    .order-table { break-inside: avoid-column; margin: 5px 0 15px 0; }
    .order-table th { background: ${C.headerCell}; padding: 4px 8px; font-size: 7pt; color: ${C.slate}; border: 1px solid ${C.borderCool}; }
    .order-table td { padding: 3px 8px; border: 1px solid ${C.headerCell}; }
    .order-table .mono { font-size: 7.5pt; }
    .order-table tbody { page-break-inside: avoid; }
    .order-row { background: ${C.surfaceCool}; font-weight: 700; border-top: 2px solid ${C.borderCool}; }
    .order-meta { display: flex; align-items: baseline; gap: 4px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; width: 220px; }
    .order-number { color: ${C.brand}; font-family: monospace; font-size: 8.5pt; flex-shrink: 0; }
    .order-client { color: ${C.textSoft}; font-size: 7.5pt; overflow: hidden; text-overflow: ellipsis; }
    .order-desc { color: ${C.faint}; font-size: 7pt; font-weight: normal; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 220px; margin-top: 1px; }
    .area-row td:first-child { padding-left: 15px; color: ${C.slate}; }
`;

const card = (label: string, value: string, color?: string) => `
    <div class="summary-card"${color ? ` style="border-left-color: ${color};"` : ''}>
        <div class="label">${label}</div>
        <div class="value"${color ? ` style="color: ${color};"` : ''}>${value}</div>
    </div>`;

const kpi = (label: string, value: string, color: string, total = false) => `
    <div class="kpi-row${total ? ' total' : ''}">
        <div class="kpi-label">${label}</div>
        <div class="kpi-value" style="color: ${color};">${value}</div>
    </div>`;

const clientRows = (clients: Totals[]) =>
    clients
        .map((c) => `
        <div class="client-row">
            <div class="client-name">${escapeHtml(c.label)}</div>
            <div class="client-hours" title="${copy.workVsExpected}">${formatHours(c.worked)} / ${formatHours(c.expected)}</div>
            <div class="client-eff" style="color: ${efficiencyColor(c.efficiency)};">${percent(c.efficiency)}</div>
        </div>`)
        .join('');

const orderTable = (order: OrderHours) => {
    const efficiency = efficiencyOf(order.expected, order.worked);
    return `
    <table class="order-table">
        <thead><tr>
            <th style="width: 45%;">${copy.orderArea}</th>
            <th class="right" style="width: 15%;">${copy.expected}</th>
            <th class="right" style="width: 15%;">${copy.work}</th>
            <th class="right" style="width: 25%;">${copy.efficiency}</th>
        </tr></thead>
        <tbody>
            <tr class="order-row">
                <td>
                    <div class="order-meta">
                        <span class="order-number">${escapeHtml(order.display)}</span>
                        ${order.client ? `<span class="order-client">${escapeHtml(order.client)}</span>` : ''}
                    </div>
                    <div class="order-desc">${escapeHtml(order.description)}</div>
                </td>
                <td class="right mono">${formatHours(order.expected)}</td>
                <td class="right mono">${formatHours(order.worked)}</td>
                <td class="right" style="color: ${efficiencyColor(efficiency)}; font-size: 9pt;">${percent(efficiency)}</td>
            </tr>
            ${order.areas
                .map((area) => {
                    const areaEfficiency = area.expected != null ? efficiencyOf(area.expected, area.worked) : 0;
                    return `
            <tr class="area-row">
                <td>${escapeHtml(area.label)}</td>
                <td class="right mono" style="color: ${C.slateMuted};">${area.expected != null ? formatHours(area.expected) : EMPTY_VALUE}</td>
                <td class="right mono strong">${formatHours(area.worked)}</td>
                <td class="right"><span class="strong" style="color: ${efficiencyColor(areaEfficiency)};">${area.expected != null ? percent(areaEfficiency) : EMPTY_VALUE}</span></td>
            </tr>`;
                })
                .join('')}
        </tbody>
    </table>`;
};

/** HTML of the Sommario Ordini per Area PDF: totals, areas, hours balance and clients, then every order (A3: two columns) */
export function orderAreaSummaryReportHtml(periods: PeriodData<OrderAreaRow>[], format: 'A4' | 'A3' = 'A4'): string {
    const s = summarize(periods);
    const net = s.gained - s.lost;

    const body = join([
        reportHeader(titles.pdfTitle, [
            { text: `${pdf.period}: ${periods.map((p) => `${p.month} ${p.year}`).join(', ')}` },
            { text: generatedAt(pdf.generated), small: true },
        ]),
        `<div class="summary-grid">
            ${card(copy.totalOrders, String(s.orderCount))}
            ${card(pdf.totalHours, formatHours(s.worked))}
            ${card(copy.expectedHours, formatHours(s.expected))}
            ${card(pdf.overallEfficiency, percent(s.efficiency), efficiencyColor(s.efficiency))}
        </div>`,
        `<div class="panel">
            <div class="panel-title">${copy.areaPerformance}</div>
            ${s.areas
                .map((area) => {
                    const color = efficiencyColor(area.efficiency);
                    return `
            <div class="bar-row">
                <div class="bar-label">${escapeHtml(area.label)}</div>
                <div class="bar-track"><div class="bar-fill" style="width: ${Math.min(area.efficiency, BAR_MAX_PERCENT)}%; background-color: ${color};"></div></div>
                <div class="bar-hours">${formatHours(area.worked)} / ${formatHours(area.expected)}</div>
                <div class="bar-value" style="color: ${color};">${percent(area.efficiency)}</div>
            </div>`;
                })
                .join('')}
        </div>`,
        `<div class="panels">
            <div class="panel">
                <div class="panel-title">${copy.balance}</div>
                ${kpi(fmt(copy.inTarget, { target: TARGET }), String(s.inTarget), C.good)}
                ${kpi(fmt(copy.outOfTarget, { target: TARGET }), String(s.outOfTarget), C.fair)}
                <div class="divider"></div>
                ${kpi(copy.hoursGained, `+${formatHours(s.gained)}`, C.good)}
                ${kpi(copy.hoursLost, `-${formatHours(s.lost)}`, C.bad)}
                ${kpi(copy.netBalance, `${net > 0 ? '+' : ''}${formatHours(net)}`, net >= 0 ? C.good : C.bad, true)}
            </div>
            <div class="stack">
                <div class="panel">
                    <div class="panel-title" style="color: ${C.good};">${titles.topClientsTitle}</div>
                    ${s.bestClients.length > 0 ? clientRows(s.bestClients) : `<div class="empty">${copy.notEnoughData}</div>`}
                </div>
                ${s.worstClients.length > 0 ? `
                <div class="panel">
                    <div class="panel-title" style="color: ${C.bad};">${titles.worstClientsTitle}</div>
                    ${clientRows(s.worstClients)}
                </div>` : ''}
            </div>
        </div>`,
        `<div class="page-break"></div>`,
        `<div class="columns">
            ${s.byClient
                .map(({ client, orders }) => `
            <div class="client-group">${escapeHtml(fmt(copy.clientGroup, { client, count: orders.length }))}</div>
            ${orders.map(orderTable).join('')}`)
                .join('')}
        </div>`,
    ]);

    return pdfDocument(styles(format === 'A3' ? 2 : 1), body);
}
