/**
 * Building blocks of the PDF report pages: the document with the shared styles, the title block, HTML escaping and
 * the number formats used in the reports. Each report (areaSummaryHtml, orderAreaSummaryHtml, clientSummaryHtml)
 * adds only its own styles and markup.
 */
import { formatDateTime, formatPercent } from '@/lib/format';
import { PDF_COLORS as C, PDF_FONT, PDF_MONO } from '@/lib/pdf/theme';

/** Text made safe for HTML (client names can contain &, <, quotes) */
export function escapeHtml(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

/** Pieces of markup joined, skipping the ones that are false / empty (for optional blocks) */
export const join = (parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join('');

/** 53.24 → "53,2%" */
export const percent = (value: number) => formatPercent(value);

/** Same, with a "+" in front of a positive value */
export const signedPercent = (value: number) => `${value > 0 ? '+' : ''}${percent(value)}`;

/** Styles every report starts from: reset, font, title block, tables, numbers */
const BASE_STYLES = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: ${PDF_FONT}; line-height: 1.3; color: ${C.text}; }
    .header { text-align: center; padding-bottom: 8px; border-bottom: 2px solid ${C.accent}; }
    .header h1 { color: ${C.brand}; margin-bottom: 3px; }
    .header .line { color: ${C.muted}; }
    .header .line.small { color: ${C.subtle}; }
    table { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    th { text-align: left; font-weight: 600; color: ${C.muted}; }
    .right { text-align: right; }
    .mono { font-family: ${PDF_MONO}; }
    .strong { font-weight: 600; }
    .truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
`;

/** A whole report page: shared styles, the report's own styles, its body */
export function pdfDocument(styles: string, body: string): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>${BASE_STYLES}${styles}</style>
</head>
<body>${body}</body>
</html>`;
}

/** Title block at the top: title, then one line per item (period, "Aggiornato: …"); `small` lines are lighter */
export function reportHeader(title: string, lines: { text: string; small?: boolean }[]): string {
    return `
    <div class="header">
        <h1>${escapeHtml(title)}</h1>
        ${lines.map((line) => `<div class="line${line.small ? ' small' : ''}">${escapeHtml(line.text)}</div>`).join('')}
    </div>`;
}

/** "Aggiornato: 08/10/2026, 09:15" */
export const generatedAt = (label: string) => `${label}: ${formatDateTime(new Date())}`;
