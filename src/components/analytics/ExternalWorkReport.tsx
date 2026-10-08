'use client';

import { getExternalWorkDataAction, getExternalWorkStatsAction, type ExternalWorkRow } from '@/app/analytics/queries/external-work-queries';
import { ReportView } from '@/components/analytics/report/ReportView';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { DateRangeFields } from '@/components/ui/DateRangeFields';
import { SearchField } from '@/components/ui/SearchField';
import { StackedCell } from '@/components/ui/TableCells';
import { APP_CONFIG } from '@/config/constants';
import { useReportTable } from '@/hooks/useReportTable';
import { getLastYearEnd, getLastYearStart } from '@/lib/dateUtils';
import type { ExcelColumn } from '@/lib/excel';
import { formatCurrency, formatCurrencyRounded } from '@/lib/format';
import { APP_COPY } from '@/locales';

interface Filters {
    commessa: string;
    supplier: string;
    dateFrom: string;
    dateTo: string;
}

interface Stats {
    total_value: number;
    suppliers: { supplier_name: string; total_value: number }[];
}

const copy = APP_COPY.analytics.externalWork;
const YEAR = APP_CONFIG.ANALYTICS.FALLBACK_YEAR;

const initialFilters = (): Filters => ({ commessa: '', supplier: '', dateFrom: getLastYearStart(), dateTo: getLastYearEnd() });

const toQuery = (f: Filters) => ({
    commessa: f.commessa || undefined,
    supplier: f.supplier || undefined,
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
});

/** External cost expressed as equivalent internal work hours */
const equivalentHours = (stats: Stats) => Math.round(stats.total_value / APP_CONFIG.ANALYTICS.PARTIAL_LABOR_RATE);

const columns: DataTableColumn<ExternalWorkRow>[] = [
    {
        key: 'supplier',
        header: copy.headers.supplier,
        cell: (row) => <StackedCell tone="muted" primary={row.supplier_code} secondary={row.supplier_name} />,
    },
    {
        key: 'commessa',
        header: copy.headers.commessa,
        cell: (row) => <StackedCell primary={row.commessa_display} secondary={row.order_description} />,
    },
    {
        key: 'value',
        header: copy.headers.cost,
        variant: 'total',
        cell: (row) => formatCurrency(row.total_value),
    },
];

const excelColumns: ExcelColumn<ExternalWorkRow>[] = [
    { header: copy.export.supplierCode, value: (row) => row.supplier_code, width: 18 },
    { header: copy.export.supplierName, value: (row) => row.supplier_name, width: 35 },
    { header: copy.export.commessa, value: (row) => row.commessa_display, width: 10 },
    { header: copy.export.description, value: (row) => row.order_description || '', width: 40 },
    { header: copy.export.cost, value: (row) => Number(row.total_value.toFixed(2)), width: 18 },
];

export function ExternalWorkReport() {
    const report = useReportTable<Filters, ExternalWorkRow, Stats>({
        initialFilters,
        defaultSort: { column: 'supplier', direction: 'asc' },
        fetchPage: ({ filters, page, limit, sort }) =>
            getExternalWorkDataAction(YEAR, page, limit, toQuery(filters), sort ?? undefined),
        fetchSummary: (filters) => getExternalWorkStatsAction(YEAR, toQuery(filters)),
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
                    <SearchField label={copy.headers.supplier} value={filters.supplier} onChange={(supplier) => updateFilters({ supplier })} />
                </>
            }
            excel={{
                columns: excelColumns,
                sheetName: 'External Work',
                fileName: (f) => `external_work_${f.dateFrom}_${f.dateTo}.xlsx`,
            }}
            summary={{
                items: (stats) => [
                    {
                        label: copy.stats.totalCost,
                        value: formatCurrencyRounded(stats.total_value),
                        subItems: stats.suppliers.map((s) => ({ label: s.supplier_name, value: formatCurrencyRounded(s.total_value) })),
                    },
                    {
                        label: copy.stats.workHours,
                        value: `${equivalentHours(stats)} ${APP_COPY.common.hoursUnit}`,
                        subItems: [],
                    },
                ],
                copyText: (stats) =>
                    [
                        `${copy.stats.totalCost}: ${formatCurrencyRounded(stats.total_value)}`,
                        '',
                        ...stats.suppliers.map((s) => `${s.supplier_name}\t${formatCurrencyRounded(s.total_value)}`),
                        '',
                        `${copy.stats.workHours}: ${equivalentHours(stats)} ${APP_COPY.common.hoursUnit}`,
                    ].join('\n'),
            }}
        />
    );
}
