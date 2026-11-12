/**
 * Checks src/lib/excel.ts against the per-report export code it replaced
 * (json_to_sheet + manual column formats), on made-up rows.
 * Run: npm run excel:examples
 */
import * as XLSX from 'xlsx';
import { APP_CONFIG } from '@/config/constants';
import { buildWorkbook, type ExcelColumn } from '@/lib/excel';
import { columnLetter, misplacedColumns } from '@/lib/excelLayout';

interface Row {
    date: string;
    commessa_display: string;
    order_description: string;
    machine: string;
    work_time: number;
    qty_requested: number | null;
}

const rows: Row[] = [
    { date: '2025-03-04T08:15:00', commessa_display: '8923', order_description: 'Libro di prova', machine: '101', work_time: 1.23456, qty_requested: 1500 },
    { date: '2025-12-31T23:10:00', commessa_display: '0042', order_description: '', machine: '7', work_time: 0, qty_requested: null },
];

const dayOf = (value: string) => {
    const d = new Date(value);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

// Old way (as ProductionReport did it)
const oldBook = (() => {
    const data = rows.map((row) => ({
        Data: dayOf(row.date),
        Commessa: Number(row.commessa_display),
        Descrizione: row.order_description,
        Macchina: Number(row.machine),
        'Ore Lavoro': Number(row.work_time.toFixed(2)),
        'Qta Richiesta': row.qty_requested || 0,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 15 }];
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let r = 1; r <= range.e.r; r++) {
        const dateCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
        if (dateCell) dateCell.z = 'dd/mm/yyyy';
        for (const c of [1, 3]) {
            const cell = ws[XLSX.utils.encode_cell({ r, c })];
            if (cell) {
                cell.t = 'n';
                cell.z = '0';
            }
        }
    }
    XLSX.utils.book_append_sheet(wb, ws, 'Produzione');
    return wb;
})();

// New way
const columns: ExcelColumn<Row>[] = [
    { header: 'Data', value: (row) => dayOf(row.date), width: 12, format: 'date' },
    { header: 'Commessa', value: (row) => Number(row.commessa_display), width: 10, format: 'integer' },
    { header: 'Descrizione', value: (row) => row.order_description, width: 30 },
    { header: 'Macchina', value: (row) => Number(row.machine), width: 10, format: 'integer' },
    { header: 'Ore Lavoro', value: (row) => Number(row.work_time.toFixed(2)), width: 12 },
    { header: 'Qta Richiesta', value: (row) => row.qty_requested || 0, width: 15 },
];

function main() {
    const newBook = buildWorkbook(XLSX, [{ rows, columns, sheetName: 'Produzione' }]);

    // Round-trip through the .xlsx format, as Excel would read the saved file
    const read = (book: XLSX.WorkBook) => {
        const wb = XLSX.read(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }), { cellNF: true, cellStyles: true });
        return { names: wb.SheetNames, sheet: wb.Sheets[wb.SheetNames[0]] };
    };
    const a = read(oldBook);
    const b = read(newBook);

    let failures = 0;
    let checks = 0;
    const expectEqual = (label: string, x: unknown, y: unknown) => {
        checks++;
        if (JSON.stringify(x) !== JSON.stringify(y)) {
            failures++;
            console.log(`FAIL ${label}: old ${JSON.stringify(x)} new ${JSON.stringify(y)}`);
        }
    };

    expectEqual('sheet names', a.names, b.names);
    expectEqual('range', a.sheet['!ref'], b.sheet['!ref']);
    expectEqual('column widths', a.sheet['!cols']?.map((c) => c.wch), b.sheet['!cols']?.map((c) => c.wch));
    const range = XLSX.utils.decode_range(a.sheet['!ref'] || 'A1');
    for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
            const ref = XLSX.utils.encode_cell({ r, c });
            const x = a.sheet[ref];
            const y = b.sheet[ref];
            expectEqual(`${ref} value`, x?.v, y?.v);
            expectEqual(`${ref} type`, x?.t, y?.t);
            expectEqual(`${ref} format`, x?.z, y?.z);
        }
    }

    // A sheet the app reads by position (the monthly production files): the header row must show the expected title
    // at every column read (src/lib/excelLayout.ts). Here: what is found, then what is expected
    const positions = { ID: 1, HOURS: 3 };
    const titles = { ID: 'ID Operatore', HOURS: 'Ore Ordinarie' };
    expectEqual('column letters', [0, 14, 25, 26, 27, 40, 701, 702].map(columnLetter), ['A', 'O', 'Z', 'AA', 'AB', 'AO', 'ZZ', 'AAA']);
    expectEqual('layout: as expected', misplacedColumns(['x', 'ID Operatore', 'y', 'Ore Ordinarie'], positions, titles), []);
    expectEqual('layout: capitals and spaces do not count', misplacedColumns([null, ' id  operatore', null, 'ORE ORDINARIE '], positions, titles), []);
    expectEqual('layout: a column added in front moves both', misplacedColumns(['x', 'Nuova', 'ID Operatore', 'y', 'Ore Ordinarie'], positions, titles), [
        { column: 'B', expected: 'ID Operatore', found: 'Nuova' },
        { column: 'D', expected: 'Ore Ordinarie', found: 'y' },
    ]);
    expectEqual('layout: a header cell that is empty', misplacedColumns(['x', 'ID Operatore'], positions, titles), [{ column: 'D', expected: 'Ore Ordinarie', found: null }]);
    expectEqual('layout: no header row at all', misplacedColumns(undefined, positions, titles).map((each) => each.column), ['B', 'D']);
    // The real titles, at the real positions, are a layout as expected (a typo in constants.ts would fail here)
    for (const { EXCEL_COLUMNS, EXCEL_HEADERS } of [APP_CONFIG.PRESENCE, APP_CONFIG.PAYROLL]) {
        const header: string[] = [];
        for (const [key, index] of Object.entries(EXCEL_COLUMNS)) header[index] = (EXCEL_HEADERS as Record<string, string>)[key];
        expectEqual('layout: the settings name a title for every column read', misplacedColumns(header, EXCEL_COLUMNS, EXCEL_HEADERS as Record<string, string>), []);
    }

    console.log(`\n${checks - failures}/${checks} excel checks pass`);
    if (failures) process.exit(1);
}

main();
