/**
 * PDF reports: HTML → PDF with Puppeteer, the page footer, and small helpers shared by the report actions.
 * Server only (used by src/app/analytics/pdf-actions.ts).
 */
import puppeteer from 'puppeteer';
import { APP_CONFIG } from '@/config/constants';
import { APP_COPY } from '@/locales';

/** One period of a report (month name or week label such as "S3") with its rows */
export interface PeriodData {
    month: string;
    year: number;
    data: any[];
}

interface PdfOptions {
    format: 'A4' | 'A3';
    /** Text in the middle of the footer (report title) */
    footerTitle: string;
    /** Text on the right of the footer; default "Pagina x di y" */
    footerRight?: string;
    margin: { top: string; right: string; bottom: string; left: string };
    landscape?: boolean;
    /** Shrinks the content to this height (px at 96 dpi) when it is taller, so the report fits on one page */
    fitHeightPx?: number;
}

const copy = APP_COPY.analytics.pdf;

/** Footer of every page: company name, report title, page number (or the given text) */
function footerTemplate(title: string, right?: string): string {
    const rightText = right ?? `${copy.footer.page} <span class="pageNumber"></span> ${copy.footer.of} <span class="totalPages"></span>`;
    return `
                <div style="width: 100%; font-size: 8pt; padding: 0 15mm; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e5e7eb; color: #6b7280;">
                    <div style="font-weight: 600; color: #1e40af;">${APP_CONFIG.ANALYTICS.COMPANY_NAME}</div>
                    <div style="text-align: center;">${title}</div>
                    <div style="text-align: right;">${rightText}</div>
                </div>
            `;
}

/** Prints the HTML to a PDF and returns it as base64. The browser is always closed, also when printing fails. */
export async function renderPdfBase64(html: string, options: PdfOptions): Promise<string> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'domcontentloaded' });

        if (options.fitHeightPx) {
            const fitHeight = options.fitHeightPx;
            const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
            if (bodyHeight > fitHeight) {
                await page.evaluate((scale: number) => {
                    document.body.style.zoom = `${scale}`;
                }, fitHeight / bodyHeight);
                // Let the browser lay the page out again after the zoom
                await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            }
        }

        const pdf = await page.pdf({
            format: options.format,
            ...(options.landscape !== undefined && { landscape: options.landscape }),
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: footerTemplate(options.footerTitle, options.footerRight),
            margin: options.margin,
        });
        return Buffer.from(pdf).toString('base64');
    } finally {
        await browser.close();
    }
}

/** Text → safe file-name part: "Area Taglio/2" → "area-taglio-2" */
export function fileSlug(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').trim();
}

/** First and last day of a month as "YYYY-MM-DD" */
export function monthRange(year: number, month: number): { dateFrom: string; dateTo: string } {
    const mm = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    return { dateFrom: `${year}-${mm}-01`, dateTo: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` };
}

/** Monday of ISO week `week` in `year` (1 to 53) */
export function isoWeekStart(year: number, week: number): Date {
    // 4 January is always in ISO week 1
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7; // Sunday (0) → 7
    const week1Monday = new Date(jan4);
    week1Monday.setDate(jan4.getDate() - (dayOfWeek - 1));
    const target = new Date(week1Monday);
    target.setDate(week1Monday.getDate() + (week - 1) * 7);
    return target;
}
