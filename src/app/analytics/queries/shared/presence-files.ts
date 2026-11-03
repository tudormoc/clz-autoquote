/**
 * The monthly production Excel files ("01 Produzione gennaio 2026.xlsx") on the share, read by Presenze Annuali
 * (presence-queries.ts) and Ore Studio Paghe (payroll-queries.ts). They live outside the project: the
 * turbopackIgnore hints keep the build from tracing the whole project for these file-system calls.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { APP_CONFIG } from '@/config/constants';

const { EXCEL_FOLDERS, EXCEL_FILE_MARK } = APP_CONFIG.PRESENCE;

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
export function readFirstSheet(folder: string, fileName: string): unknown[][] {
    // Read as a buffer first: XLSX.readFile has trouble with UNC paths
    const buffer = fs.readFileSync(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ folder, fileName));
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
}
