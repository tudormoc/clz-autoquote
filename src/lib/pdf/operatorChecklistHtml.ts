import { formatDate } from '@/lib/format';
import { escapeHtml, join, pdfDocument, reportHeader } from '@/lib/pdf/html';
import { PDF_COLORS as C } from '@/lib/pdf/theme';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.analytics.operators.checklist;

const STYLES = `
    .header h1 { font-size: 16pt; }
    .header .line { font-size: 10pt; }
    table { margin-top: 14px; font-size: 11pt; }
    th { font-size: 9pt; padding: 4px 6px; border-bottom: 1px solid ${C.text}; }
    th.check { text-align: center; }
    td { padding: 7px 6px; border-bottom: 1px solid ${C.border}; }
    tr { page-break-inside: avoid; }
    .check { width: 70px; }
    .box { width: 16px; height: 16px; border: 1.5px solid ${C.text}; border-radius: 2px; margin: 0 auto; }
`;

/**
 * HTML of the operator checklist: title and today's date (or a blank line to write it when not `showDate`), then one
 * row per name, with an empty box under each Entrata / Uscita column when `showChecks` (just the names otherwise)
 */
export function operatorChecklistHtml(title: string, names: string[], showDate: boolean, showChecks: boolean): string {
    const boxes = showChecks ? copy.checkColumns.map(() => '<td class="check"><div class="box"></div></td>').join('') : '';
    const rows = names.map((name) => `<tr><td>${escapeHtml(name)}</td>${boxes}</tr>`).join('');
    const head = showChecks && `<thead><tr><th></th>${copy.checkColumns.map((label) => `<th class="check">${escapeHtml(label)}</th>`).join('')}</tr></thead>`;
    return pdfDocument(
        STYLES,
        `${reportHeader(title, [{ text: showDate ? formatDate(new Date()) : copy.blankDate }])}
        ${join(["<table>", head, `<tbody>${rows}</tbody></table>`])}`
    );
}
