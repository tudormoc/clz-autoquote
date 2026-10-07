'use client';

import { getOrderRevenueDataAction, type OrderRevenueRow } from '@/app/analytics/analytics-actions';
import { FlagCell, MarginCell } from '@/components/analytics/report/ReportCells';
import { ReportView } from '@/components/analytics/report/ReportView';
import { SplitRevenueToggle } from '@/components/analytics/report/SplitRevenueToggle';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { DateRangeFields } from '@/components/ui/DateRangeFields';
import { SearchField } from '@/components/ui/SearchField';
import { StackedCell } from '@/components/ui/TableCells';
import { APP_CONFIG } from '@/config/constants';
import { useReportTable } from '@/hooks/useReportTable';
import { getLastYearEnd, getLastYearStart } from '@/lib/dateUtils';
import type { ExcelColumn } from '@/lib/excel';
import { formatCurrency, formatHours } from '@/lib/format';
import { APP_COPY } from '@/locales';

interface Filters {
    commessa: string;
    client: string;
    dateFrom: string;
    dateTo: string;
    includeAllRevenueForSplit: boolean;
}

const copy = APP_COPY.analytics.orderRevenue;
const common = APP_COPY.analytics.common;
const YEAR = APP_CONFIG.ANALYTICS.FALLBACK_YEAR;

const initialFilters = (): Filters => ({
    commessa: '',
    client: '',
    dateFrom: getLastYearStart(),
    dateTo: getLastYearEnd(),
    includeAllRevenueForSplit: false,
});

const toQuery = (f: Filters) => ({
    commessa: f.commessa || undefined,
    client: f.client || undefined,
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
    includeAllRevenueForSplit: f.includeAllRevenueForSplit,
});

const columns: DataTableColumn<OrderRevenueRow>[] = [
    {
        key: 'commessa',
        header: copy.commessa,
        className: 'w-32',
        cell: (row) => <StackedCell primary={row.commessa_display} secondary={row.order_description} maxWidth="sm" />,
    },
    {
        key: 'client',
        header: copy.client,
        className: 'w-48',
        cell: (row) => <StackedCell tone="muted" primary={row.client_code} secondary={row.client_name} maxWidth="lg" />,
    },
    { key: 'delivered_revenue', header: copy.deliveredValue, variant: 'total', cell: (row) => formatCurrency(row.delivered_revenue) },
    { key: 'cost', header: copy.materialCost, variant: 'number', cell: (row) => formatCurrency(row.material_cost) },
    { key: 'work_time', header: copy.workTime, variant: 'total', cell: (row) => formatHours(row.work_time) },
    { key: 'work_cost', header: copy.laborCost, variant: 'number', cell: (row) => formatCurrency(row.work_cost) },
    { key: 'total_cost', header: common.totalCost, variant: 'total', cell: (row) => formatCurrency(row.full_cost) },
    {
        key: 'margin',
        header: copy.margin,
        align: 'right',
        cell: (row) => <MarginCell revenue={row.delivered_revenue} margin={row.margin} format={formatCurrency} />,
    },
    {
        key: 'split',
        header: '⚠️',
        headerTitle: copy.partialRevenueHint,
        align: 'center',
        compact: true,
        sortable: false,
        className: 'w-12',
        cell: (row) => <FlagCell on={row.has_split_revenue === 1} />,
    },
];

const excelColumns: ExcelColumn<OrderRevenueRow>[] = [
    { header: copy.export.commessa, value: (row) => row.commessa_display, width: 10 },
    { header: copy.export.description, value: (row) => row.order_description || '', width: 40 },
    { header: copy.export.clientCode, value: (row) => row.client_code, width: 15 },
    { header: copy.export.clientName, value: (row) => row.client_name, width: 35 },
    { header: copy.export.quantity, value: (row) => row.total_quantity, width: 12 },
    { header: copy.export.deliveredValue, value: (row) => Number(row.delivered_revenue.toFixed(2)), width: 15 },
    { header: copy.export.materialCost, value: (row) => Number(row.material_cost.toFixed(2)), width: 15 },
    { header: copy.export.workTime, value: (row) => Number(row.work_time.toFixed(2)), width: 12 },
    { header: copy.export.laborCost, value: (row) => Number(row.work_cost.toFixed(2)), width: 15 },
    { header: copy.export.margin, value: (row) => Number(row.margin.toFixed(2)), width: 15 },
    { header: copy.export.partialRevenue, value: (row) => (row.has_split_revenue === 1 ? 'SI' : 'NO'), width: 18 },
];

export function OrderRevenueReport() {
    const report = useReportTable<Filters, OrderRevenueRow>({
        initialFilters,
        defaultSort: { column: 'delivered_revenue', direction: 'desc' },
        fetchPage: ({ filters, page, limit, sort }) =>
            getOrderRevenueDataAction(YEAR, page, limit, toQuery(filters), sort ?? undefined),
    });
    const { filters, updateFilters } = report;

    return (
        <ReportView
            report={report}
            columns={columns}
            filterColumns={4}
            filters={
                <>
                    <DateRangeFields dateFrom={filters.dateFrom} dateTo={filters.dateTo} onChange={updateFilters} />
                    <SearchField label={copy.commessa} value={filters.commessa} onChange={(commessa) => updateFilters({ commessa })} />
                    <SearchField label={common.client} value={filters.client} onChange={(client) => updateFilters({ client })} />
                </>
            }
            filterButtons={
                <SplitRevenueToggle
                    active={filters.includeAllRevenueForSplit}
                    onToggle={() => updateFilters({ includeAllRevenueForSplit: !filters.includeAllRevenueForSplit })}
                />
            }
            excel={{
                columns: excelColumns,
                sheetName: 'Order Revenue',
                fileName: (f) => `order_revenue_${f.dateFrom}_${f.dateTo}.xlsx`,
            }}
        />
    );
}
