import type { AreaSummaryRow } from '@/app/analytics/queries/area-queries';
import { APP_CONFIG } from '@/config/constants';
import { formatHours, formatNumber } from '@/lib/format';
import { escapeHtml, generatedAt, join, pdfDocument, percent, reportHeader, signedPercent } from '@/lib/pdf/html';
import type { PeriodData } from '@/lib/pdf/renderPdf';
import { PDF_COLORS as C, tint, toneColor } from '@/lib/pdf/theme';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.analytics.pdf;
const REPORT_NAME = APP_COPY.analytics.reports.areaSummary;
const { EXCELLENT, ACCEPTABLE } = APP_CONFIG.ANALYTICS.EFFICIENCY_THRESHOLDS;
const { TREND_CHANGE_PERCENT, TOP_AREAS } = APP_CONFIG.ANALYTICS.PDF;
const AREA_ORDER = Object.keys(APP_CONFIG.ANALYTICS.MACHINE_AREAS);

/** One period of one area */
interface AreaPeriod {
    period: string;
    quantity: number;
    hours: number;
    velocity: number;
    target: number;
    efficiency: number;
}

const efficiencyColor = (value: number) => toneColor(value, EXCELLENT, ACCEPTABLE);
const trendColor = (change: number) => (change > TREND_CHANGE_PERCENT ? C.good : change < -TREND_CHANGE_PERCENT ? C.bad : C.muted);
const trendIcon = (change: number) => (change > TREND_CHANGE_PERCENT ? '↑' : change < -TREND_CHANGE_PERCENT ? '↓' : '→');
const coloredPercent = (value: number) => `<span class="strong" style="color: ${efficiencyColor(value)};">${percent(value)}</span>`;

/** Totals over all periods and, per area (in production-flow order), its periods with the efficiency trend */
function summarize(periods: PeriodData<AreaSummaryRow>[]) {
    const rows = periods.flatMap((p) => p.data);
    const totalQuantity = rows.reduce((sum, row) => sum + row.requested_quantity, 0);
    const totalHours = rows.reduce((sum, row) => sum + row.work_time, 0);
    // Efficiency weighted by hours
    const weighted = rows.reduce((sum, row) => sum + row.efficiency * row.work_time, 0);

    const byArea = new Map<string, AreaPeriod[]>();
    for (const period of periods) {
        for (const row of period.data) {
            if (!byArea.has(row.area_name)) byArea.set(row.area_name, []);
            byArea.get(row.area_name)!.push({
                period: period.month,
                quantity: row.requested_quantity,
                hours: row.work_time,
                velocity: row.velocity,
                target: row.target_velocity,
                efficiency: row.efficiency,
            });
        }
    }

    const areas = Array.from(byArea.entries())
        .map(([name, list]) => {
            const first = list[0];
            const last = list[list.length - 1];
            return {
                name,
                periods: list,
                averageEfficiency: list.reduce((sum, p) => sum + p.efficiency, 0) / list.length,
                // % change of efficiency from the first to the last period
                efficiencyChange: list.length > 1 ? ((last.efficiency - first.efficiency) / first.efficiency) * 100 : 0,
            };
        })
        .sort((a, b) => AREA_ORDER.indexOf(a.name) - AREA_ORDER.indexOf(b.name));

    return {
        areas,
        totalHours,
        velocity: totalHours > 0 ? totalQuantity / totalHours : 0,
        efficiency: totalHours > 0 ? weighted / totalHours : 0,
    };
}

/** "Luglio 2026, Agosto 2026" or, for weeks, "Settimane S36–S40, 2026" */
function periodText(periods: PeriodData<AreaSummaryRow>[], mode: 'months' | 'weeks'): string {
    if (mode === 'months') return periods.map((p) => `${p.month} ${p.year}`).join(', ');
    const labels = periods.map((p) => p.month);
    const year = periods[0]?.year ?? '';
    return labels.length > 4
        ? fmt(copy.weeksRange, { from: labels[0], to: labels[labels.length - 1], year })
        : fmt(copy.weeksList, { weeks: labels.join(', '), year });
}

const STYLES = `
    body { font-size: 10pt; line-height: 1.4; }
    .header { margin-bottom: 15px; padding-bottom: 10px; border-bottom-width: 3px; }
    .header h1 { font-size: 18pt; margin-bottom: 4px; }
    .header .line { font-size: 10pt; }
    .header .line.small { font-size: 8pt; }
    .section { margin-bottom: 20px; page-break-inside: avoid; }
    .section-title { font-size: 13pt; font-weight: 600; color: ${C.brand}; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid ${C.border}; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 15px; }
    .summary-card { background: ${C.surface}; padding: 8px 10px; border-radius: 6px; border-left: 4px solid ${C.accent}; }
    .summary-card .label { font-size: 9pt; color: ${C.muted}; margin-bottom: 4px; }
    .summary-card .value { font-size: 16pt; font-weight: 600; }
    .area-card { background: ${C.white}; border: 1px solid ${C.border}; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
    .area-card.keep { page-break-inside: avoid; }
    .area-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid ${C.border}; }
    .area-name { font-size: 14pt; font-weight: 600; }
    td.area-name { font-size: 9pt; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 9pt; font-weight: 600; margin-left: 8px; }
    .badge.large { font-size: 11pt; padding: 4px 10px; }
    table { margin-bottom: 10px; }
    th { background: ${C.surface}; padding: 6px 8px; font-size: 8pt; border-bottom: 1px solid ${C.border}; }
    td { padding: 5px 8px; border-bottom: 1px solid ${C.rowLine}; font-size: 9pt; }
    .summary-sections { page-break-inside: avoid; margin-bottom: 30px; }
`;

/** Header row of the period tables; the first column is the area or the period */
const tableHead = (first: string) => `
    <thead><tr>
        <th>${first}</th>
        ${[copy.columns.quantity, copy.columns.hours, copy.columns.velocity, copy.columns.target, copy.columns.efficiency].map((label) => `<th class="right">${label}</th>`).join('')}
    </tr></thead>`;

/** Quantity, hours, speed, target and efficiency of one period */
const periodCells = (p: AreaPeriod) => `
    <td class="right mono">${formatNumber(p.quantity)}</td>
    <td class="right mono">${formatHours(p.hours)}</td>
    <td class="right mono">${formatNumber(p.velocity, 1)}</td>
    <td class="right mono">${p.target}</td>
    <td class="right">${coloredPercent(p.efficiency)}</td>`;

/** Small table of areas with their average efficiency */
const areaList = (title: string, list: { name: string; averageEfficiency: number }[]) => `
    <div class="section">
        <div class="section-title">${title}</div>
        <table>
            <thead><tr><th>${copy.columns.area}</th><th class="right">${copy.columns.efficiency}</th></tr></thead>
            <tbody>${list.map((area) => `<tr><td class="area-name">${escapeHtml(area.name)}</td><td class="right">${coloredPercent(area.averageEfficiency)}</td></tr>`).join('')}</tbody>
        </table>
    </div>`;

/** HTML of the Sommario Area PDF: totals, best and weakest areas, then one table per area with a row per period */
export function areaSummaryReportHtml(periods: PeriodData<AreaSummaryRow>[], areaFilter?: string, mode: 'months' | 'weeks' = 'months'): string {
    const { areas, totalHours, velocity, efficiency } = summarize(periods);
    const singlePeriod = periods.length === 1;

    const cards = [
        { label: copy.totalAreas, value: String(areas.length) },
        { label: copy.totalHours, value: formatHours(totalHours) },
        { label: copy.overallVelocity, value: `${formatNumber(velocity, 1)} ${copy.units.pcsPerHour}` },
        { label: copy.overallEfficiency, value: percent(efficiency), color: efficiencyColor(efficiency) },
    ];

    // Best and weakest areas only for the whole factory
    const best = [...areas].sort((a, b) => b.averageEfficiency - a.averageEfficiency).slice(0, TOP_AREAS);
    const weak = areas.filter((area) => area.averageEfficiency < ACCEPTABLE).sort((a, b) => a.averageEfficiency - b.averageEfficiency);

    const body = join([
        reportHeader(areaFilter ? `${REPORT_NAME} - ${areaFilter}` : REPORT_NAME, [
            { text: `${copy.period}: ${periodText(periods, mode)}` },
            { text: generatedAt(copy.generated), small: true },
        ]),
        `<div class="section">
            <div class="section-title">${copy.overallSummary}</div>
            <div class="summary-grid">
                ${cards
                    .map((card) => `
                <div class="summary-card"${card.color ? ` style="border-left-color: ${card.color};"` : ''}>
                    <div class="label">${card.label}</div>
                    <div class="value"${card.color ? ` style="color: ${card.color};"` : ''}>${card.value}</div>
                </div>`)
                    .join('')}
            </div>
        </div>`,
        !areaFilter &&
            `<div class="summary-sections">
                ${join([
                    best.length > 0 && areaList(copy.topPerformers, best),
                    weak.length > 0 && areaList(`${copy.areasNeedingAttention} (${fmt(copy.efficiencyBelow, { threshold: ACCEPTABLE })})`, weak),
                ])}
            </div>`,
        `<div class="section">
            <div class="section-title">${singlePeriod ? copy.areaPerformance : copy.areaPerformanceTrends}</div>
            ${singlePeriod
                ? `<table>
                    ${tableHead(copy.columns.area)}
                    <tbody>${areas.map((area) => `<tr><td class="area-name">${escapeHtml(area.name)}</td>${periodCells(area.periods[0])}</tr>`).join('')}</tbody>
                </table>`
                : areas
                      .map((area) => {
                          const hasTrend = area.periods.length > 1;
                          const trend = trendColor(area.efficiencyChange);
                          const average = efficiencyColor(area.averageEfficiency);
                          return `
            <div class="area-card${areaFilter ? '' : ' keep'}">
                <div class="area-header">
                    <div>
                        <span class="area-name">${escapeHtml(area.name)}</span>
                        ${hasTrend ? `<span class="badge" style="background: ${tint(trend)}; color: ${trend};">${trendIcon(area.efficiencyChange)} ${signedPercent(area.efficiencyChange)}</span>` : ''}
                    </div>
                    ${hasTrend ? `<div class="badge large" style="background: ${tint(average)}; color: ${average};">${copy.average}: ${percent(area.averageEfficiency)}</div>` : ''}
                </div>
                <table>
                    ${tableHead(mode === 'weeks' ? copy.columns.week : copy.columns.month)}
                    <tbody>${area.periods.map((p) => `<tr><td><strong>${escapeHtml(p.period)}</strong></td>${periodCells(p)}</tr>`).join('')}</tbody>
                </table>
            </div>`;
                      })
                      .join('')}
        </div>`,
    ]);

    return pdfDocument(STYLES, body);
}
