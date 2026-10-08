/**
 * Excel export. The xlsx library (~1 MB) is loaded only when an export actually runs,
 * so it never weighs on page loads.
 */

type Xlsx = typeof import('xlsx');

export type ExcelValue = string | number | Date | null | undefined;

export interface ExcelColumn<R> {
    header: string;
    value: (row: R) => ExcelValue;
    /** Column width in characters */
    width?: number;
    /** integer: plain number without separators (codes, ids) · date: dd/mm/yyyy */
    format?: 'integer' | 'date';
}

interface ExcelSheet<R> {
    rows: R[];
    columns: ExcelColumn<R>[];
    sheetName: string;
}

/** A sheet name Excel accepts: at most 31 characters, none of : \ / ? * [ ] */
const sheetTitle = (name: string) => name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31);

const CELL_FORMATS = {
    integer: '0',
    date: 'dd/mm/yyyy',
} as const;

/** One-sheet workbook: a header row, then one row per item */
export function buildWorkbook<R>(XLSX: Xlsx, { rows, columns, sheetName }: ExcelSheet<R>) {
    const sheet = XLSX.utils.aoa_to_sheet([
        columns.map((c) => c.header),
        ...rows.map((row) => columns.map((c) => c.value(row) ?? '')),
    ]);

    sheet['!cols'] = columns.map((c) => (c.width ? { wch: c.width } : {}));

    columns.forEach((column, c) => {
        if (!column.format) return;
        for (let r = 1; r <= rows.length; r++) {
            const cell = sheet[XLSX.utils.encode_cell({ r, c })];
            if (!cell || cell.v === '') continue;
            if (column.format === 'integer') cell.t = 'n';
            cell.z = CELL_FORMATS[column.format];
        }
    });

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, sheetTitle(sheetName));
    return book;
}

/** Build the workbook and download it as fileName */
export async function exportToExcel<R>(options: ExcelSheet<R> & { fileName: string }) {
    const XLSX = await import('xlsx');
    XLSX.writeFile(buildWorkbook(XLSX, options), options.fileName);
}
