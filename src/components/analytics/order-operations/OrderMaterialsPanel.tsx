import type { Material } from '@/app/analytics/queries/order-operations-queries';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatNumber } from '@/lib/format';
import { APP_COPY } from '@/locales';

const t = APP_COPY.analytics.orderOperations;

const quantity = (value: number, unit: string) => (
    <>
        {formatNumber(value, 3)} <span className="font-normal text-fg-muted">{unit}</span>
    </>
);

const COLUMNS: DataTableColumn<Material>[] = [
    { key: 'part_number', header: t.materialCode, cell: (row) => <span className="font-mono font-bold text-primary">{row.part_number}</span> },
    { key: 'description', header: t.materialDescription, cell: (row) => <span className="font-medium text-fg-soft">{row.description}</span> },
    { key: 'total_quantity', header: t.materialQty, variant: 'number', cell: (row) => quantity(row.total_quantity, row.unit_of_measure) },
    {
        key: 'stock_quantity',
        header: t.materialStock,
        align: 'right',
        cell: (row) => (
            <StatusBadge tone={row.stock_quantity >= row.total_quantity ? 'success' : 'warning'} mono>
                {quantity(row.stock_quantity, row.unit_of_measure)}
            </StatusBadge>
        ),
    },
];

/** Materials the order needs, with the quantity in stock (amber when the stock does not cover it). */
export function OrderMaterialsPanel({ materials }: { materials: Material[] }) {
    return <DataTable columns={COLUMNS} rows={materials} emptyMessage={t.noMaterials} />;
}
