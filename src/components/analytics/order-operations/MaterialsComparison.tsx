import { AlignmentCell } from '@/components/ui/AlignmentCell';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { EMPTY_VALUE, formatNumber } from '@/lib/format';
import type { MaterialComparisonRow } from '@/lib/orders/compare';
import { cn } from '@/lib/utils';
import { APP_COPY } from '@/locales';

const t = APP_COPY.analytics.orderOperations;

const quantity = (value?: number) => formatNumber(value, 3);
/** Quantity of an order, amber when it differs from the DiBa */
const orderQuantity = (value: number | undefined, differs: boolean) => <span className={cn('font-semibold', differs ? 'text-warning-300' : 'text-fg-soft')}>{quantity(value)}</span>;

const COLUMNS: DataTableColumn<MaterialComparisonRow>[] = [
    { key: 'part_number', header: t.materialCode, cell: (row) => <span className="font-mono font-bold text-fg">{row.part_number}</span> },
    { key: 'description', header: t.materialDescription, className: 'max-w-96', cell: (row) => <span className="block truncate text-fg-soft" title={row.description}>{row.description}</span> },
    { key: 'unmis', header: t.materialUm, align: 'center', cell: (row) => <span className="font-mono text-fg-muted">{row.unmis || EMPTY_VALUE}</span> },
    { key: 'expected', header: <span className="text-highlight-300">{t.expectedQty}</span>, align: 'right', className: 'w-28', cell: (row) => <span className="font-mono font-semibold text-highlight-300">{quantity(row.expected)}</span> },
    { key: 'bus', header: <span className="text-warning-200">{t.businessOrder}</span>, align: 'right', className: 'w-28', cell: (row) => <span className="font-mono">{orderQuantity(row.bus, row.busDiff)}</span> },
    { key: 'net', header: <span className="text-info-300">{t.netproOrder}</span>, align: 'right', className: 'w-28', cell: (row) => <span className="font-mono">{orderQuantity(row.net, row.netDiff)}</span> },
    { key: 'issues', header: t.alignedStatus, className: 'w-56', cell: (row) => <AlignmentCell issues={row.issues} /> },
];

/** Table comparing the materials the DiBa expects with those of the Business order and the NetPro order. */
export function MaterialsComparison({ rows }: { rows: MaterialComparisonRow[] }) {
    return (
        <DataTable
            columns={COLUMNS}
            rows={rows}
            getRowKey={(row) => row.part_number}
            getRowClassName={(row) => (row.issues.length ? 'bg-warning-500/5 hover:bg-warning-500/10' : undefined)}
            emptyMessage={t.noDibaMaterials}
        />
    );
}
