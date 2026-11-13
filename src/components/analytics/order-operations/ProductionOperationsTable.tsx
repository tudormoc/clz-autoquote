import { FileText } from '@/components/ui/icons';
import { NetproStatusBadge } from '@/components/analytics/order-operations/NetproStatusBadge';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { EMPTY_VALUE } from '@/lib/format';
import { APP_COPY } from '@/locales';
import type { OrderProductionOperationRow } from '@/types';

const t = APP_COPY.analytics.orderOperations;

const COLUMNS: DataTableColumn<OrderProductionOperationRow>[] = [
    { key: 'sequenza', header: t.orderSeq, align: 'center', cell: (row) => <span className="font-mono font-bold text-info-400">{row.sequenza}</span> },
    { key: 'descrizione', header: t.orderOperation, cell: (row) => <span className="font-semibold text-fg">{row.descrizione}</span> },
    { key: 'stato', header: t.orderStatus, align: 'center', cell: (row) => <NetproStatusBadge status={row.stato} /> },
    { key: 'centro_assegnato', header: t.orderCenter, align: 'center', variant: 'number', cell: (row) => row.centro_assegnato || EMPTY_VALUE },
    { key: 'machine', header: t.orderMachine, cell: (row) => row.machine_name || row.machine_code || EMPTY_VALUE },
    { key: 'area_name', header: t.orderArea, cell: (row) => <span className="text-2xs text-fg-muted">{row.area_name}</span> },
    {
        key: 'note',
        header: t.dibaNote,
        className: 'max-w-80',
        cell: (row) =>
            row.note ? (
                <div className="flex items-start gap-1 whitespace-normal">
                    <FileText size={12} className="text-info-400 flex-shrink-0 mt-0.5" />
                    <span className="leading-snug break-words text-2xs">{row.note}</span>
                </div>
            ) : (
                EMPTY_VALUE
            ),
    },
    { key: 'id_oper', header: t.orderId, cell: (row) => <span className="font-mono text-3xs text-fg-subtle">{row.id_oper}</span> },
];

/** The phases of the NetPro production order. */
export function ProductionOperationsTable({ rows }: { rows: OrderProductionOperationRow[] }) {
    return <DataTable columns={COLUMNS} rows={rows} emptyMessage={t.noOrderOperations} nowrap />;
}
