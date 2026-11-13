'use client';

import { getClientDeliveriesDataAction, getClientDeliveriesStatsAction, type ClientDeliveryRow } from '@/app/analytics/analytics-actions';
import { ReportView } from '@/components/analytics/report/ReportView';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { DateRangeFields } from '@/components/ui/DateRangeFields';
import { SearchField } from '@/components/ui/SearchField';
import { StackedCell } from '@/components/ui/TableCells';
import { APP_CONFIG } from '@/config/constants';
import { useReportTable } from '@/hooks/useReportTable';
import { defaultReportPeriod } from '@/lib/dateUtils';
import type { ExcelColumn } from '@/lib/excel';
import { formatCurrencyRounded, formatNumber } from '@/lib/format';
import { APP_COPY } from '@/locales';

interface Filters {
    client: string;
    dateFrom: string;
    dateTo: string;
}

interface Stats {
    total_value: number;
}

const copy = APP_COPY.analytics.clientDeliveries;
const YEAR = APP_CONFIG.ANALYTICS.FALLBACK_YEAR;

const initialFilters = (): Filters => ({ client: '', ...defaultReportPeriod() });

const toQuery = (f: Filters) => ({
    client: f.client || undefined,
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
});

const columns: DataTableColumn<ClientDeliveryRow>[] = [
    {
        key: 'client',
        header: copy.headers.client,
        cell: (row) => <StackedCell primary={row.client_code} secondary={row.client_name} />,
    },
    {
        key: 'delivered_value',
        header: copy.headers.deliveredValue,
        variant: 'total',
        cell: (row) => formatCurrencyRounded(row.delivered_value),
    },
    { key: 'orders', header: copy.headers.orders, variant: 'number', cell: (row) => formatNumber(row.orders) },
];

const excelColumns: ExcelColumn<ClientDeliveryRow>[] = [
    { header: copy.export.clientCode, value: (row) => row.client_code, width: 15 },
    { header: copy.export.clientName, value: (row) => row.client_name, width: 35 },
    { header: copy.export.deliveredValue, value: (row) => Number(row.delivered_value.toFixed(2)), width: 18 },
    { header: copy.export.orders, value: (row) => row.orders, width: 10 },
];

export function ClientDeliveriesReport() {
    const report = useReportTable<Filters, ClientDeliveryRow, Stats>({
        initialFilters,
        defaultSort: { column: 'delivered_value', direction: 'desc' },
        fetchPage: ({ filters, page, limit, sort }) =>
            getClientDeliveriesDataAction(YEAR, page, limit, toQuery(filters), sort ?? undefined),
        fetchSummary: (filters) => getClientDeliveriesStatsAction(YEAR, toQuery(filters)),
    });
    const { filters, updateFilters } = report;

    return (
        <ReportView
            report={report}
            columns={columns}
            filterColumns={3}
            filters={
                <>
                    <DateRangeFields dateFrom={filters.dateFrom} dateTo={filters.dateTo} onChange={updateFilters} />
                    <SearchField label={APP_COPY.analytics.common.client} value={filters.client} onChange={(client) => updateFilters({ client })} />
                </>
            }
            excel={{
                columns: excelColumns,
                name: APP_COPY.analytics.reports.clientDeliveries,
                fileParts: (f) => [f.dateFrom, f.dateTo],
            }}
            summary={{
                items: (stats) => [{ label: copy.summary, value: formatCurrencyRounded(stats.total_value), subItems: [] }],
            }}
        />
    );
}
