'use client';

import { getOrderSummaryDataAction, type OrderSummaryRow } from '@/app/analytics/analytics-actions';
import { ReportView } from '@/components/analytics/report/ReportView';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { DateRangeFields } from '@/components/ui/DateRangeFields';
import { SearchField } from '@/components/ui/SearchField';
import { StackedCell } from '@/components/ui/TableCells';
import { APP_CONFIG } from '@/config/constants';
import { useReportTable } from '@/hooks/useReportTable';
import { getLastYearEnd, getLastYearStart } from '@/lib/dateUtils';
import type { ExcelColumn } from '@/lib/excel';
import { formatHours, formatNumber } from '@/lib/format';
import { APP_COPY } from '@/locales';

interface Filters {
    commessa: string;
    machine: string;
    dateFrom: string;
    dateTo: string;
}

const copy = APP_COPY.analytics.orderSummary;
const YEAR = APP_CONFIG.ANALYTICS.FALLBACK_YEAR;

const initialFilters = (): Filters => ({ commessa: '', machine: '', dateFrom: getLastYearStart(), dateTo: getLastYearEnd() });

const toQuery = (f: Filters) => ({
    commessa: f.commessa || undefined,
    machine: f.machine || undefined,
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
});

const columns: DataTableColumn<OrderSummaryRow>[] = [
    {
        key: 'commessa',
        header: copy.headers.commessa,
        className: 'w-40',
        cell: (row) => <StackedCell primary={row.commessa_display} secondary={row.order_description} maxWidth="md" />,
    },
    {
        key: 'machine',
        header: copy.headers.machine,
        className: 'w-32',
        cell: (row) => <StackedCell tone="muted" primary={row.machine} secondary={row.machine_name} maxWidth="sm" />,
    },
    { key: 'time', header: copy.headers.time, variant: 'total', cell: (row) => formatHours(row.work_time) },
    { key: 'qty_requested', header: copy.headers.qtyReq, variant: 'number', cell: (row) => formatNumber(row.qty_requested) },
    { key: 'qty', header: copy.headers.qtyDone, variant: 'number', cell: (row) => formatNumber(row.qty_completed) },
];

const excelColumns: ExcelColumn<OrderSummaryRow>[] = [
    { header: copy.export.commessa, value: (row) => Number(row.commessa_display), width: 10, format: 'integer' },
    { header: copy.export.description, value: (row) => row.order_description, width: 30 },
    { header: copy.export.machine, value: (row) => Number(row.machine), width: 10, format: 'integer' },
    { header: copy.export.machineName, value: (row) => row.machine_name, width: 25 },
    { header: copy.export.workTime, value: (row) => Number(row.work_time.toFixed(2)), width: 12 },
    { header: copy.export.qtyRequested, value: (row) => row.qty_requested || 0, width: 15 },
    { header: copy.export.qtyCompleted, value: (row) => row.qty_completed, width: 15 },
];

export function OrderSummaryReport() {
    const report = useReportTable<Filters, OrderSummaryRow>({
        initialFilters,
        defaultSort: { column: 'commessa', direction: 'asc' },
        fetchPage: ({ filters, page, limit, sort }) =>
            getOrderSummaryDataAction(YEAR, page, limit, toQuery(filters), sort ?? undefined),
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
                    <SearchField label={copy.headers.commessa} value={filters.commessa} onChange={(commessa) => updateFilters({ commessa })} />
                    <SearchField label={copy.headers.machine} value={filters.machine} onChange={(machine) => updateFilters({ machine })} />
                </>
            }
            excel={{
                columns: excelColumns,
                sheetName: 'Order Summary',
                fileName: (f) => `order_summary_${f.dateFrom || 'start'}_${f.dateTo || 'end'}.xlsx`,
            }}
        />
    );
}
