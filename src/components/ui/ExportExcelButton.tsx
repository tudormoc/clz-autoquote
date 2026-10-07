'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { APP_COPY } from '@/locales';
import { exportToExcel, type ExcelColumn } from '@/lib/excel';

export interface ExcelExport<R> {
    columns: ExcelColumn<R>[];
    sheetName: string;
    fileName: string;
}

interface ExportExcelButtonProps<R> extends ExcelExport<R> {
    /** Loads the rows to export (usually every row for the current filters) */
    getRows: () => Promise<R[]>;
    disabled?: boolean;
}

/** "Esporta Excel": fetches the rows and saves an .xlsx, showing its own progress. */
export function ExportExcelButton<R>({ getRows, columns, sheetName, fileName, disabled }: ExportExcelButtonProps<R>) {
    const [exporting, setExporting] = useState(false);

    const handleExport = async () => {
        setExporting(true);
        try {
            const rows = await getRows();
            if (rows.length > 0) await exportToExcel({ rows, columns, sheetName, fileName });
        } catch (err) {
            console.error('Excel export failed:', err);
        } finally {
            setExporting(false);
        }
    };

    return (
        <Button type="button" variant="secondary" onClick={handleExport} disabled={disabled || exporting}>
            <Download size={16} />
            {exporting ? APP_COPY.common.exporting : APP_COPY.common.exportExcel}
        </Button>
    );
}
