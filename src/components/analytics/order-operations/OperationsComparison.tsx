import { NetproStatusBadge } from '@/components/analytics/order-operations/NetproStatusBadge';
import { OperationCell } from '@/components/analytics/order-operations/OperationCell';
import { AlignmentCell } from '@/components/ui/AlignmentCell';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import type { OperationComparisonRow, OpField } from '@/lib/orders/compare';
import { APP_COPY, fmt } from '@/locales';

const t = APP_COPY.analytics.orderOperations;

/** Which parts of a phase differ from the DiBa */
const differences = (fields: OpField[]) => ({ operation: fields.includes('lav'), center: fields.includes('centro'), note: fields.includes('note') });

/** Cell of a phase missing from one of the orders ("Mancante" when the DiBa has it) */
const missing = (row: OperationComparisonRow) => (
    <span className={row.diba ? 'text-warning-300 font-semibold' : 'text-fg-faint'}>{row.diba ? t.missing : '-'}</span>
);

/** Cells line up at the top, the three order columns have several lines */
const top = (column: DataTableColumn<OperationComparisonRow>): DataTableColumn<OperationComparisonRow> => ({ ...column, cellClassName: 'align-top' });

/** Table comparing each phase of the DiBa (the truth) with the Business order and the NetPro order. */
export function OperationsComparison({ rows, businessOrderNumber }: { rows: OperationComparisonRow[]; businessOrderNumber?: number }) {
    const columns = [
        top({ key: 'fase', header: t.phase, align: 'center', cell: (row) => <span className="font-mono font-bold text-fg">{row.fase}</span> }),
        top({
            key: 'diba',
            header: <span className="text-highlight-300">{t.dibaColumn}</span>,
            cell: ({ diba }) =>
                diba ? (
                    <OperationCell operation={diba.descr_lavor} code={diba.codlavo} center={diba.codcent} centerName={diba.descr_centro} note={diba.note} />
                ) : (
                    <span className="text-fg-subtle italic">{t.notInDiba}</span>
                ),
        }),
        top({
            key: 'business',
            header: <span className="text-warning-200">{fmt(t.businessOrderNum, { num: businessOrderNumber || '-' })}</span>,
            cell: (row) =>
                row.bus ? (
                    <OperationCell
                        operation={row.bus.descr_lavor}
                        code={row.bus.codlavo}
                        center={row.bus.codcent}
                        centerName={row.bus.descr_centro}
                        note={row.bus.note}
                        differs={differences(row.busDiff)}
                    />
                ) : (
                    missing(row)
                ),
        }),
        top({
            key: 'netpro',
            header: <span className="text-info-300">{t.netproOrder}</span>,
            cell: (row) =>
                row.net ? (
                    <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                            <OperationCell
                                operation={row.net.descrizione}
                                center={row.net.centro_assegnato}
                                centerName={row.net.machine_name}
                                note={row.net.note}
                                differs={differences(row.netDiff)}
                            />
                        </div>
                        <NetproStatusBadge status={row.net.stato} />
                    </div>
                ) : (
                    missing(row)
                ),
        }),
        // A phase that left the DiBa after somebody worked on it stays on the order: said here, not counted as a difference
        top({ key: 'issues', header: t.alignedStatus, className: 'w-56', cell: (row) => <AlignmentCell issues={row.issues} note={row.kept ? t.keptPhaseNote : undefined} /> }),
    ];

    return (
        <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.fase}
            getRowClassName={(row) => (row.issues.length ? 'bg-warning-500/5 hover:bg-warning-500/10' : undefined)}
        />
    );
}
