'use server';

/**
 * PDF reports: each action loads the report rows per period, builds the page HTML (src/lib/pdf/*Html.ts)
 * and prints it (renderPdfBase64). Returns { success, pdf (base64), filename } for downloadBase64File.
 */

import { errorMessage } from '@/lib/utils';
import { getAreaSummaryDataAction, getOrderAreaSummaryDataAction, getClientSummaryDataAction } from './analytics-actions';
import { APP_CONFIG } from '@/config/constants';
import type { AreaSummaryRow, OrderAreaRow } from './queries/area-queries';
import { isoWeekStart, toIsoDate } from '@/lib/dateUtils';
import { formatDate, monthName } from '@/lib/format';
import { areaSummaryReportHtml } from '@/lib/pdf/areaSummaryHtml';
import { clientSummaryReportHtml } from '@/lib/pdf/clientSummaryHtml';
import { readLabourRates } from './queries/shared/labour-rates';
import { orderAreaSummaryReportHtml } from '@/lib/pdf/orderAreaSummaryHtml';
import { fileSlug, reportFileName } from '@/lib/download';
import { monthRange, renderPdfBase64, type PeriodData } from '@/lib/pdf/renderPdf';
import { APP_COPY } from '@/locales';
import { authorize } from '@/lib/auth/access';
import { LINKS } from '@/config/navigation';

const ALL_ROWS = APP_CONFIG.ANALYTICS.ALL_ROWS_LIMIT;
const PAGE_MARGIN = { top: '20mm', right: '15mm', bottom: '25mm', left: '15mm' };

/** Answer of every PDF action: the file as base64 and its name, or the error */
type PdfResult =
    | { success: true; pdf: string; filename: string; error?: undefined }
    | { success: false; error: string; pdf?: undefined; filename?: undefined };

const failure = (label: string, error: unknown): PdfResult => {
    console.error(`${label} PDF generation error:`, error);
    return { success: false, error: errorMessage(error) };
};

/** PDF title, footer and file name: the report's name as in the menu */
const reports = APP_COPY.analytics.reports;
/** File-name part when the area PDF covers every area */
const AREA_ALL = 'tutte-le-aree';

/** "1-2-3" for up to three periods, "first-to-last" (months) / "Sfirst-Slast" (weeks) for more */
const periodSuffix = (values: number[], prefix: string, joiner: string) =>
    values.length > 3
        ? `${prefix}${values[0]}${joiner}${prefix}${values[values.length - 1]}`
        : values.map((v) => `${prefix}${v}`).join('-');

/**
 * ============================================================================
 * AREA SUMMARY (Report Area): by month or by ISO week
 * ============================================================================
 */
export async function generateAreaSummaryPDFAction(
    year: number,
    months: number[],          // Month numbers 1-12 (used when mode === 'months')
    areaFilter?: string,       // Optional area name filter
    mode: 'months' | 'weeks' = 'months',
    weeks: number[] = []       // ISO week numbers 1-53 (used when mode === 'weeks')
): Promise<PdfResult> {
    await authorize('view', LINKS.analytics['area-summary']);
    try {
        const load = async (label: string, dateFrom: string, dateTo: string): Promise<PeriodData<AreaSummaryRow>> => {
            const result = await getAreaSummaryDataAction(
                year, 1, ALL_ROWS,
                { dateFrom, dateTo, machine: areaFilter || undefined },
                { column: 'display_order', direction: 'asc' }
            );
            return { month: label, year, data: result.success ? result.data : [] };
        };

        const periods = await Promise.all(
            mode === 'weeks'
                ? weeks.map((week) => {
                      const weekStart = isoWeekStart(year, week);
                      const weekEnd = new Date(weekStart);
                      weekEnd.setDate(weekStart.getDate() + 6); // Sunday of that week
                      return load(`S${week}`, toIsoDate(weekStart), toIsoDate(weekEnd));
                  })
                : months.map((month) => {
                      const { dateFrom, dateTo } = monthRange(year, month);
                      return load(monthName(month), dateFrom, dateTo);
                  })
        );

        const pdf = await renderPdfBase64(areaSummaryReportHtml(periods, areaFilter, mode), {
            format: 'A4',
            footerTitle: reports.areaSummary,
            margin: PAGE_MARGIN,
        });

        const period = mode === 'weeks' ? periodSuffix(weeks, 'S', '-') : periodSuffix(months, '', '-to-');
        const area = areaFilter ? fileSlug(areaFilter) : AREA_ALL;
        return { success: true as const, pdf, filename: reportFileName(reports.areaSummary, [String(year), period, area], 'pdf') };
    } catch (error) {
        return failure('Area summary', error);
    }
}

/**
 * ============================================================================
 * ORDER AREA SUMMARY (Report Ordini per Area): by month, A4 or A3
 * ============================================================================
 */
export async function generateOrderAreaSummaryPDFAction(
    year: number,
    months: number[],
    commessaFilter?: string,
    areaFilter?: string,
    format: 'A4' | 'A3' = 'A4',
    complexOnly: boolean = false
): Promise<PdfResult> {
    await authorize('view', LINKS.analytics['order-area-summary']);
    try {
        const periods = await Promise.all(
            months.map(async (month): Promise<PeriodData<OrderAreaRow>> => {
                const result = await getOrderAreaSummaryDataAction(
                    year, 1, ALL_ROWS,
                    { ...monthRange(year, month), commessa: commessaFilter || undefined, area: areaFilter || undefined, complexOnly }
                );
                return { month: monthName(month), year, data: result.success ? result.data : [] };
            })
        );

        const pdf = await renderPdfBase64(orderAreaSummaryReportHtml(periods, format), {
            format,
            footerTitle: reports.orderAreaSummary,
            margin: PAGE_MARGIN,
        });

        const parts = [format.toLowerCase(), String(year), months.join('-'), commessaFilter && fileSlug(commessaFilter), areaFilter && fileSlug(areaFilter)];
        return { success: true as const, pdf, filename: reportFileName(reports.orderAreaSummary, parts, 'pdf') };
    } catch (error) {
        return failure('Order area summary', error);
    }
}

/**
 * ============================================================================
 * CLIENT SUMMARY (Report Clienti): every client on one A4 page
 * ============================================================================
 */

/** A4 height minus the margins (297 − 15 − 20 mm ≈ 262 mm ≈ 990 px at 96 dpi): taller content is shrunk to fit */
const A4_USABLE_HEIGHT_PX = 990;

export async function generateClientSummaryPDFAction(
    year: number,
    months: number[],
    clientFilter?: string,
    includeAllRevenueForSplit: boolean = false,
    format: 'A4' | 'A3' = 'A4'
): Promise<PdfResult> {
    await authorize('view', LINKS.analytics['client-summary']);
    try {
        // One query over the whole period (as on screen): per-month queries counted a split order's full
        // revenue once per month when "Intero" was on
        const sortedMonths = [...months].sort((a, b) => a - b);
        const { dateFrom } = monthRange(year, sortedMonths[0]);
        const { dateTo } = monthRange(year, sortedMonths[sortedMonths.length - 1]);

        const [result, rates] = await Promise.all([
            getClientSummaryDataAction(year, 1, ALL_ROWS, {
                dateFrom,
                dateTo,
                client: clientFilter || undefined,
                includeAllRevenueForSplit,
            }),
            readLabourRates(),
        ]);

        // Internal clients and test accounts are left out of the PDF (codes come from the DB as numbers)
        const excluded = new Set(APP_CONFIG.ANALYTICS.EXCLUDED_CLIENTS_PDF);
        const rows = (result.success ? result.data : [])
            .filter((row) => !excluded.has(String(row.client_code)))
            .sort((a, b) => b.total_revenue - a.total_revenue);

        const periodLabels = sortedMonths.map((m) => `${monthName(m)} ${year}`);
        const pdf = await renderPdfBase64(clientSummaryReportHtml(rows, rates.hourly, periodLabels, clientFilter, includeAllRevenueForSplit), {
            format: 'A4',
            landscape: false,
            footerTitle: reports.clientSummary,
            footerRight: formatDate(new Date()),
            margin: { top: '15mm', right: '12mm', bottom: '20mm', left: '12mm' },
            fitHeightPx: A4_USABLE_HEIGHT_PX,
        });

        const parts = [format.toLowerCase(), String(year), months.join('-'), clientFilter && fileSlug(clientFilter)];
        return { success: true as const, pdf, filename: reportFileName(reports.clientSummary, parts, 'pdf') };
    } catch (error) {
        return failure('Client Summary', error);
    }
}
