/**
 * The monthly production Excel files ("01 Produzione gennaio 2026.xlsx") on the share, read by Presenze Annuali
 * (presence-queries.ts) and Ore Studio Paghe (payroll-queries.ts). They live outside the project: the
 * turbopackIgnore hints keep the build from tracing the whole project for these file-system calls.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { APP_CONFIG } from '@/config/constants';
import { misplacedColumns } from '@/lib/excelLayout';
import { errorMessage } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';

const { EXCEL_FOLDERS, EXCEL_FILE_MARK, EXCEL_MISPLACED_SHOWN } = APP_CONFIG.PRESENCE;
const copy = APP_COPY.analytics.presence;

/** First folder that can be read: the share, then the mapped drive */
export function presenceFolder(): string | null {
    return EXCEL_FOLDERS.find((folder) => fs.existsSync(/* turbopackIgnore: true */ folder)) ?? null;
}

/** Names of the production files of a year in the folder (Excel's own "~$" lock files left out) */
export function presenceFileNames(folder: string, year: number): string[] {
    return fs.readdirSync(/* turbopackIgnore: true */ folder).filter(
        (file) => file.endsWith('.xlsx') && !file.startsWith('~$') && file.includes(EXCEL_FILE_MARK) && file.includes(String(year))
    );
}

/** The rows of the first sheet of a file, one array per row (header row included), empty cells null */
function readFirstSheet(folder: string, fileName: string): unknown[][] {
    // Read as a buffer first: XLSX.readFile has trouble with UNC paths
    const buffer = fs.readFileSync(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ folder, fileName));
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
}

/**
 * The rows of a file whose columns are read by position, once its header row shows the expected title at every
 * position read (src/lib/excelLayout.ts). Throws, naming the file: when it cannot be read, and when a column is not
 * where the app reads it ("la colonna X dovrebbe essere … ed è …"). A report then says so instead of showing a
 * month without hours, or hours taken from another column.
 */
export function readSheetByPosition<K extends string>(folder: string, fileName: string, positions: Record<K, number>, titles: Record<K, string>): unknown[][] {
    let rows: unknown[][];
    try {
        rows = readFirstSheet(folder, fileName);
    } catch (err) {
        throw new Error(fmt(copy.fileNotRead, { file: fileName, error: errorMessage(err) }));
    }
    const misplaced = misplacedColumns(rows[0], positions, titles);
    if (misplaced.length > 0) {
        // One added column moves every column after it: the first few say enough
        const columns = misplaced.slice(0, EXCEL_MISPLACED_SHOWN).map((each) => fmt(copy.wrongColumn, { ...each, found: each.found ?? copy.emptyHeaderCell }));
        if (misplaced.length > columns.length) columns.push(fmt(copy.moreColumns, { count: misplaced.length - columns.length }));
        throw new Error(fmt(copy.wrongColumns, { file: fileName, columns: columns.join('; ') }));
    }
    return rows;
}
