'use client';

import { getRimanenzeDataAction, getRimanenzeStatsAction } from '@/app/analytics/analytics-actions';
import { ReportView } from '@/components/analytics/report/ReportView';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { SearchField } from '@/components/ui/SearchField';
import { StackedCell } from '@/components/ui/TableCells';
import { APP_CONFIG } from '@/config/constants';
import { useReportTable } from '@/hooks/useReportTable';
import type { ExcelColumn } from '@/lib/excel';
import { formatCurrencyRounded, formatHours } from '@/lib/format';
import { APP_COPY } from '@/locales';

interface RimanenzeRow {
    commessa_display: string;
    commessa_full: number;
    order_description: string;
    client_code: string;
    client_name: string;
    material_cost: number;
    total_quantity: number;
    work_time: number;
    work_cost: number;
}

interface Filters {
    commessa: string;
    client: string;
}

interface Stats {
    total_material_cost: number;
    total_orders: number;
}

const copy = APP_COPY.analytics.rimanenze;
const YEAR = APP_CONFIG.ANALYTICS.FALLBACK_YEAR;

const initialFilters = (): Filters => ({ commessa: '', client: '' });

const toQuery = (f: Filters) => ({
    commessa: f.commessa || undefined,
    client: f.client || undefined,
});

/** Value tied up in the order: materials bought plus work done */
const totalInvested = (row: RimanenzeRow) => row.material_cost + row.work_cost;

const columns: DataTableColumn<RimanenzeRow>[] = [
    {
        key: 'commessa',
        header: copy.headers.commessa,
        cell: (row) => <StackedCell primary={row.commessa_display} secondary={row.order_description} />,
    },
    {
        key: 'client',
        header: copy.headers.client,
        cell: (row) =>
            row.client_code ? (
                <StackedCell tone="muted" primary={row.client_code} secondary={row.client_name} />
            ) : (
                <div className="text-xs text-fg-faint italic">{copy.notAssigned}</div>
            ),
    },
    { key: 'material_cost', header: copy.headers.materialCost, variant: 'number', cell: (row) => formatCurrencyRounded(row.material_cost) },
    { key: 'work_time', header: copy.headers.workTime, variant: 'total', sortable: false, cell: (row) => formatHours(row.work_time) },
    { key: 'work_cost', header: copy.headers.laborCost, variant: 'number', sortable: false, cell: (row) => formatCurrencyRounded(row.work_cost) },
    { key: 'total_invested', header: copy.headers.totalInvested, variant: 'total', cell: (row) => formatCurrencyRounded(totalInvested(row)) },
];

const excelColumns: ExcelColumn<RimanenzeRow>[] = [
    { header: copy.export.commessa, value: (row) => row.commessa_display, width: 10 },
    { header: copy.export.description, value: (row) => row.order_description || '', width: 40 },
    { header: copy.export.clientCode, value: (row) => row.client_code || '', width: 15 },
    { header: copy.export.clientName, value: (row) => row.client_name || '', width: 35 },
    { header: copy.export.materialCost, value: (row) => Math.round(row.material_cost), width: 15 },
    { header: copy.export.workTime, value: (row) => Number(row.work_time.toFixed(2)), width: 12 },
    { header: copy.export.laborCost, value: (row) => Math.round(row.work_cost), width: 15 },
    { header: copy.export.totalInvested, value: (row) => Math.round(totalInvested(row)), width: 18 },
];

export function RimanenzeReport() {
    const report = useReportTable<Filters, RimanenzeRow, Stats>({
        initialFilters,
        defaultSort: { column: 'total_invested', direction: 'desc' },
        autoApply: true,
        fetchPage: ({ filters, page, limit, sort, exportAll }) =>
            getRimanenzeDataAction(YEAR, page, limit, toQuery(filters), sort ?? undefined, exportAll),
        fetchSummary: (filters) => getRimanenzeStatsAction(YEAR, toQuery(filters)),
    });
    const { filters, updateFilters } = report;

    return (
        <ReportView
            report={report}
            columns={columns}
            filterColumns={2}
            filters={
                <>
                    <SearchField label={copy.filters.commessa} value={filters.commessa} onChange={(commessa) => updateFilters({ commessa })} />
                    <SearchField label={copy.filters.client} value={filters.client} onChange={(client) => updateFilters({ client })} />
                </>
            }
            excel={{ columns: excelColumns, sheetName: 'Rimanenze', fileName: () => 'rimanenze_ordini_attivi.xlsx' }}
            summary={{
                items: (stats) => [
                    {
                        label: copy.summary.totalValue,
                        value: formatCurrencyRounded(stats.total_material_cost),
                        subItems: [{ label: copy.summary.totalOrders, value: stats.total_orders.toString() }],
                    },
                ],
            }}
        />
    );
}
