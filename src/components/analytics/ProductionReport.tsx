'use client';

import { getProductionDataAction } from '@/app/analytics/analytics-actions';
import { ReportView } from '@/components/analytics/report/ReportView';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { DateRangeFields } from '@/components/ui/DateRangeFields';
import { SearchField } from '@/components/ui/SearchField';
import { StackedCell } from '@/components/ui/TableCells';
import { APP_CONFIG } from '@/config/constants';
import { useReportTable } from '@/hooks/useReportTable';
import { getLastYearEnd, getLastYearStart } from '@/lib/dateUtils';
import type { ExcelColumn } from '@/lib/excel';
import { formatDate, formatHours, formatNumber } from '@/lib/format';
import { APP_COPY } from '@/locales';

interface ProductionRow {
    date: string;
    machine: string;
    machine_name: string;
    operator: string;
    operator_name: string;
    work_time: number;
    qty_completed: number;
    qty_requested: number;
    commessa_full: string;
    commessa_display: string;
    order_description: string;
}

interface Filters {
    commessa: string;
    machine: string;
    operator: string;
    dateFrom: string;
    dateTo: string;
}

const copy = APP_COPY.analytics.production;
const YEAR = APP_CONFIG.ANALYTICS.FALLBACK_YEAR;

const initialFilters = (): Filters => ({
    commessa: '',
    machine: '',
    operator: '',
    dateFrom: getLastYearStart(),
    dateTo: getLastYearEnd(),
});

const toQuery = (f: Filters) => ({
    commessa: f.commessa || undefined,
    machine: f.machine || undefined,
    operator: f.operator || undefined,
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
});

/** Calendar day of a row, without the time (Excel shows it as a date) */
const dayOf = (value: string) => {
    const date = new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const columns: DataTableColumn<ProductionRow>[] = [
    { key: 'date', header: copy.headers.date, className: 'w-28', cellClassName: 'text-fg-secondary', cell: (row) => formatDate(row.date) },
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
    {
        key: 'operator',
        header: copy.headers.operator,
        className: 'w-32',
        cell: (row) => <StackedCell tone="muted" primary={row.operator} secondary={row.operator_name} maxWidth="sm" />,
    },
    { key: 'time', header: copy.headers.time, variant: 'total', cell: (row) => formatHours(row.work_time) },
    { key: 'qty_requested', header: copy.headers.qtyReq, variant: 'number', cell: (row) => formatNumber(row.qty_requested) },
    { key: 'qty', header: copy.headers.qtyDone, variant: 'number', cell: (row) => formatNumber(row.qty_completed) },
];

const excelColumns: ExcelColumn<ProductionRow>[] = [
    { header: copy.export.date, value: (row) => dayOf(row.date), width: 12, format: 'date' },
    { header: copy.export.commessa, value: (row) => Number(row.commessa_display), width: 10, format: 'integer' },
    { header: copy.export.description, value: (row) => row.order_description, width: 30 },
    { header: copy.export.machine, value: (row) => Number(row.machine), width: 10, format: 'integer' },
    { header: copy.export.machineName, value: (row) => row.machine_name, width: 25 },
    { header: copy.export.operator, value: (row) => Number(row.operator), width: 10, format: 'integer' },
    { header: copy.export.operatorName, value: (row) => row.operator_name, width: 25 },
    { header: copy.export.workTime, value: (row) => Number(row.work_time.toFixed(2)), width: 12 },
    { header: copy.export.qtyRequested, value: (row) => row.qty_requested || 0, width: 15 },
    { header: copy.export.qtyCompleted, value: (row) => row.qty_completed, width: 15 },
];

export function ProductionReport() {
    const report = useReportTable<Filters, ProductionRow>({
        initialFilters,
        defaultSort: { column: 'date', direction: 'asc' },
        fetchPage: ({ filters, page, limit, sort, exportAll }) =>
            getProductionDataAction(YEAR, page, limit, toQuery(filters), sort ?? undefined, exportAll),
    });
    const { filters, updateFilters } = report;

    return (
        <ReportView
            report={report}
            columns={columns}
            filterColumns={5}
            filters={
                <>
                    <DateRangeFields dateFrom={filters.dateFrom} dateTo={filters.dateTo} onChange={updateFilters} />
                    <SearchField label={copy.headers.commessa} value={filters.commessa} onChange={(commessa) => updateFilters({ commessa })} />
                    <SearchField label={copy.headers.machine} value={filters.machine} onChange={(machine) => updateFilters({ machine })} />
                    <SearchField label={copy.headers.operator} value={filters.operator} onChange={(operator) => updateFilters({ operator })} />
                </>
            }
            excel={{
                columns: excelColumns,
                sheetName: 'Produzione',
                fileName: (f) => `produzione_${f.dateFrom || 'start'}_${f.dateTo || 'end'}.xlsx`,
            }}
        />
    );
}
