'use client';

import { getRimanenzeLaborDataAction, getRimanenzeLaborStatsAction } from '@/app/analytics/analytics-actions';
import { ReportView } from '@/components/analytics/report/ReportView';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { SearchField } from '@/components/ui/SearchField';
import { StackedCell } from '@/components/ui/TableCells';
import { APP_CONFIG } from '@/config/constants';
import { useReportTable } from '@/hooks/useReportTable';
import type { ExcelColumn } from '@/lib/excel';
import { formatCurrencyRounded, formatHours } from '@/lib/format';
import { APP_COPY } from '@/locales';

interface RimanenzeLaborRow {
    commessa_display: string;
    commessa_full: string;
    order_description: string;
    work_time: number;
    work_cost: number;
}

interface Filters {
    commessa: string;
}

interface Stats {
    total_labor_cost: number;
    total_work_time: number;
    total_orders: number;
}

const copy = APP_COPY.analytics.rimanenze;
const YEAR = APP_CONFIG.ANALYTICS.FALLBACK_YEAR;

const initialFilters = (): Filters => ({ commessa: '' });

const toQuery = (f: Filters) => ({ commessa: f.commessa || undefined });

const columns: DataTableColumn<RimanenzeLaborRow>[] = [
    {
        key: 'commessa',
        header: copy.headers.commessa,
        cell: (row) => <StackedCell primary={row.commessa_display} secondary={row.order_description} />,
    },
    { key: 'work_time', header: copy.headers.workTime, variant: 'total', cell: (row) => formatHours(row.work_time) },
    { key: 'work_cost', header: copy.headers.laborCost, variant: 'total', cell: (row) => formatCurrencyRounded(row.work_cost) },
];

const excelColumns: ExcelColumn<RimanenzeLaborRow>[] = [
    { header: copy.export.commessa, value: (row) => row.commessa_display, width: 10 },
    { header: copy.export.description, value: (row) => row.order_description || '', width: 40 },
    { header: copy.export.workTime, value: (row) => Number(row.work_time.toFixed(2)), width: 12 },
    { header: copy.export.laborCost, value: (row) => Math.round(row.work_cost), width: 15 },
];

export function RimanenzeLaborReport() {
    const report = useReportTable<Filters, RimanenzeLaborRow, Stats>({
        initialFilters,
        defaultSort: { column: 'work_cost', direction: 'desc' },
        autoApply: true,
        fetchPage: ({ filters, page, limit, sort, exportAll }) =>
            getRimanenzeLaborDataAction(YEAR, page, limit, toQuery(filters), sort ?? undefined, exportAll),
        fetchSummary: (filters) => getRimanenzeLaborStatsAction(YEAR, toQuery(filters)),
    });
    const { filters, updateFilters } = report;

    return (
        <ReportView
            report={report}
            columns={columns}
            filterColumns={1}
            filters={<SearchField label={copy.filters.commessa} value={filters.commessa} onChange={(commessa) => updateFilters({ commessa })} />}
            excel={{ columns: excelColumns, sheetName: 'Rimanenze Lavoro', fileName: () => 'rimanenze_lavoro_ordini_attivi.xlsx' }}
            summary={{
                items: (stats) => [
                    {
                        label: copy.laborSummary.totalValue,
                        value: formatCurrencyRounded(stats.total_labor_cost),
                        subItems: [
                            { label: copy.laborSummary.totalHours, value: formatHours(stats.total_work_time) },
                            { label: copy.laborSummary.totalOrders, value: stats.total_orders.toString() },
                        ],
                    },
                ],
            }}
        />
    );
}
