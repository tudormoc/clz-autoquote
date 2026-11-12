import { Check, FileText } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { EMPTY_VALUE, formatNumber } from '@/lib/format';
import { APP_COPY } from '@/locales';
import type { DibaOperationRow } from '@/types';

const t = APP_COPY.analytics.orderOperations;

const COLUMNS: DataTableColumn<DibaOperationRow>[] = [
    { key: 'riga', header: t.dibaRow, align: 'center', variant: 'number', cell: (row) => formatNumber(row.riga, 4) },
    { key: 'fase', header: t.dibaFase, align: 'center', cell: (row) => <span className="font-mono font-bold text-primary">{row.fase}</span> },
    { key: 'codlavo', header: t.dibaLav, align: 'center', variant: 'number', cell: (row) => row.codlavo },
    { key: 'descr_lavor', header: t.dibaDescrLav, cell: (row) => <span className="font-semibold text-fg">{row.descr_lavor}</span> },
    { key: 'terzista', header: t.dibaTerzista, cell: (row) => <span className="text-2xs text-fg-muted">{row.terzista === 'S' ? t.dibaTerzistaYes : t.dibaTerzistaNo}</span> },
    { key: 'codcent', header: t.dibaCentro, align: 'center', variant: 'number', cell: (row) => row.codcent },
    { key: 'descr_centro', header: t.dibaDescrCentro, cell: (row) => row.descr_centro },
    {
        key: 'note',
        header: t.dibaNote,
        className: 'max-w-80',
        cell: (row) =>
            row.note ? (
                <div className="flex items-start gap-1 whitespace-normal">
                    <FileText className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                    <span className="leading-snug break-words text-2xs">{row.note}</span>
                </div>
            ) : (
                EMPTY_VALUE
            ),
    },
    { key: 'tesec', header: t.dibaTEsec, variant: 'number', cell: (row) => formatNumber(row.tesec, 4) },
    { key: 'perqta', header: t.dibaPerQta, variant: 'number', cell: (row) => formatNumber(row.perqta, 2) },
    {
        key: 'aggriga',
        header: t.dibaAggRiga,
        align: 'center',
        cell: (row) =>
            row.aggriga === 'S' ? (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-success-500/20 text-success-400">
                    <Check className="w-3 h-3" />
                </span>
            ) : (
                EMPTY_VALUE
            ),
    },
];

/** The phases of the DiBa (Distinta Base) of the article. */
export function DibaOperationsTable({ rows }: { rows: DibaOperationRow[] }) {
    return <DataTable columns={COLUMNS} rows={rows} emptyMessage={t.noDibaOperations} nowrap />;
}
