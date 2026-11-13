'use client';

import { useState } from 'react';
import { Download } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { APP_COPY, fmt } from '@/locales';
import { exportToExcel, type ExcelColumn, type ExcelSheet } from '@/lib/excel';
import { notify } from '@/lib/notify';
import { errorMessage } from '@/lib/utils';

export interface ExcelExport<R> {
    columns: ExcelColumn<R>[];
    sheetName: string;
    fileName: string;
}

/** One sheet: the columns and a loader of its rows (usually every row for the current filters) */
interface OneSheetProps<R> extends ExcelExport<R> {
    getRows: () => Promise<R[]>;
}

/** Several sheets (one tab each), loaded together */
interface SheetsProps<R> {
    fileName: string;
    getSheets: () => Promise<ExcelSheet<R>[]>;
}

type ExportExcelButtonProps<R> = (OneSheetProps<R> | SheetsProps<R>) & { disabled?: boolean };

/**
 * "Esporta Excel": fetches the rows and saves an .xlsx, showing its own progress. A loader that cannot read the rows
 * throws: the button then says why, instead of saving nothing without a word.
 */
export function ExportExcelButton<R>(props: ExportExcelButtonProps<R>) {
    const [exporting, setExporting] = useState(false);

    const handleExport = async () => {
        setExporting(true);
        try {
            const sheets =
                'getSheets' in props
                    ? await props.getSheets()
                    : [{ rows: await props.getRows(), columns: props.columns, sheetName: props.sheetName }];
            // No file is saved for no rows, and the person is told: a click that does nothing looks like a fault
            if (sheets.every((sheet) => sheet.rows.length === 0)) notify.info(APP_COPY.common.nothingToExport);
            else await exportToExcel({ sheets, fileName: props.fileName });
        } catch (err) {
            notify.error(fmt(APP_COPY.common.exportFailed, { error: errorMessage(err) }));
        } finally {
            setExporting(false);
        }
    };

    return (
        <Button type="button" variant="secondary" onClick={handleExport} disabled={props.disabled || exporting}>
            <Download size={16} />
            {exporting ? APP_COPY.common.exporting : APP_COPY.common.exportExcel}
        </Button>
    );
}
