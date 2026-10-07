'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { getClientSummaryDataAction, getClientSummaryStatsAction, type ClientSummaryRow } from '@/app/analytics/analytics-actions';
import { generateClientSummaryPDFAction } from '@/app/analytics/pdf-actions';
import { MonthSelectorModal } from '@/components/analytics/MonthSelectorModal';
import { FlagCell, MarginCell } from '@/components/analytics/report/ReportCells';
import { ReportView } from '@/components/analytics/report/ReportView';
import { SplitRevenueToggle } from '@/components/analytics/report/SplitRevenueToggle';
import { Button } from '@/components/ui/Button';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { DateRangeFields } from '@/components/ui/DateRangeFields';
import { SearchField } from '@/components/ui/SearchField';
import { StackedCell } from '@/components/ui/TableCells';
import { APP_CONFIG } from '@/config/constants';
import { useReportTable } from '@/hooks/useReportTable';
import { getLastYearEnd, getLastYearStart } from '@/lib/dateUtils';
import { downloadBase64File } from '@/lib/download';
import type { ExcelColumn } from '@/lib/excel';
import { formatCurrencyRounded } from '@/lib/format';
import { APP_COPY } from '@/locales';

interface Filters {
    client: string;
    dateFrom: string;
    dateTo: string;
    includeAllRevenueForSplit: boolean;
}

interface Stats {
    total_value: number;
}

const copy = APP_COPY.analytics.clientSummary;
const common = APP_COPY.analytics.common;
const YEAR = APP_CONFIG.ANALYTICS.FALLBACK_YEAR;

const initialFilters = (): Filters => ({
    client: '',
    dateFrom: getLastYearStart(),
    dateTo: getLastYearEnd(),
    includeAllRevenueForSplit: false,
});

const toQuery = (f: Filters) => ({
    client: f.client || undefined,
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
    includeAllRevenueForSplit: f.includeAllRevenueForSplit,
});

const columns: DataTableColumn<ClientSummaryRow>[] = [
    {
        key: 'client',
        header: copy.headers.client,
        className: 'w-48',
        cell: (row) => <StackedCell primary={row.client_code} secondary={row.client_name} maxWidth="lg" />,
    },
    { key: 'revenue', header: copy.headers.revenue, variant: 'total', cell: (row) => formatCurrencyRounded(row.total_revenue) },
    { key: 'cost', header: copy.headers.materialCost, variant: 'number', cell: (row) => formatCurrencyRounded(row.material_cost) },
    { key: 'work_cost', header: copy.headers.laborCost, variant: 'number', cell: (row) => formatCurrencyRounded(row.work_cost) },
    { key: 'total_cost', header: common.totalCost, variant: 'total', cell: (row) => formatCurrencyRounded(row.full_cost) },
    {
        key: 'margin',
        header: copy.headers.margin,
        align: 'right',
        cell: (row) => <MarginCell revenue={row.total_revenue} margin={row.margin} format={formatCurrencyRounded} />,
    },
    {
        key: 'split',
        header: '⚠️',
        headerTitle: copy.headers.splitWarning,
        align: 'center',
        compact: true,
        sortable: false,
        className: 'w-12',
        cell: (row) => <FlagCell on={row.split_orders_count > 0} />,
    },
];

const excelColumns: ExcelColumn<ClientSummaryRow>[] = [
    { header: copy.export.clientCode, value: (row) => row.client_code, width: 15 },
    { header: copy.export.clientName, value: (row) => row.client_name, width: 35 },
    { header: copy.export.totalOrders, value: (row) => row.total_orders, width: 12 },
    { header: copy.export.revenue, value: (row) => Math.round(row.total_revenue), width: 15 },
    { header: copy.export.materialCost, value: (row) => Math.round(row.material_cost), width: 15 },
    { header: copy.export.laborCost, value: (row) => Math.round(row.work_cost), width: 15 },
    { header: common.totalCost, value: (row) => Math.round(row.full_cost), width: 15 },
    { header: copy.export.margin, value: (row) => Math.round(row.margin), width: 15 },
    { header: copy.export.quantity, value: (row) => row.total_quantity, width: 10 },
    { header: copy.export.splitWarning, value: (row) => row.split_orders_count, width: 28 },
];

export function ClientSummaryReport() {
    const [showPdfModal, setShowPdfModal] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);

    const report = useReportTable<Filters, ClientSummaryRow, Stats>({
        initialFilters,
        defaultSort: { column: 'revenue', direction: 'desc' },
        fetchPage: ({ filters, page, limit, sort }) =>
            getClientSummaryDataAction(YEAR, page, limit, toQuery(filters), sort ?? undefined),
        fetchSummary: (filters) => getClientSummaryStatsAction(YEAR, toQuery(filters)),
    });
    const { filters, updateFilters } = report;

    const handleGeneratePDF = async (year: number, months: number[], _separateByArea: boolean, format: 'A4' | 'A3') => {
        // The PDF follows the applied filters, or the ones being edited before the first search
        const active = report.applied ?? filters;
        setPdfLoading(true);
        try {
            const result = await generateClientSummaryPDFAction(year, months, active.client || undefined, active.includeAllRevenueForSplit, format);
            if (result.success && result.pdf) {
                downloadBase64File(result.pdf, result.filename || 'report.pdf');
                setShowPdfModal(false);
            } else {
                console.error('Failed to generate PDF:', result.error);
                alert(APP_COPY.analytics.pdfError);
            }
        } catch (err) {
            console.error('PDF Generation Error:', err);
            alert(APP_COPY.analytics.pdfError);
        } finally {
            setPdfLoading(false);
        }
    };

    return (
        <ReportView
            report={report}
            columns={columns}
            filterColumns={3}
            filters={
                <>
                    <DateRangeFields dateFrom={filters.dateFrom} dateTo={filters.dateTo} onChange={updateFilters} />
                    <SearchField label={common.client} value={filters.client} onChange={(client) => updateFilters({ client })} />
                </>
            }
            filterButtons={
                <SplitRevenueToggle
                    active={filters.includeAllRevenueForSplit}
                    onToggle={() => updateFilters({ includeAllRevenueForSplit: !filters.includeAllRevenueForSplit })}
                />
            }
            actions={
                <Button type="button" variant="secondary" onClick={() => setShowPdfModal(true)} disabled={pdfLoading}>
                    <FileText size={16} />
                    {copy.pdfButton}
                </Button>
            }
            excel={{
                columns: excelColumns,
                sheetName: 'Client Summary',
                fileName: (f) => `client_summary_${f.dateFrom}_${f.dateTo}.xlsx`,
            }}
            summary={{
                items: (stats) => [{ label: common.totalRevenue, value: formatCurrencyRounded(stats.total_value), subItems: [] }],
            }}
        >
            <MonthSelectorModal
                isOpen={showPdfModal}
                onClose={() => setShowPdfModal(false)}
                onGenerate={handleGeneratePDF}
                loading={pdfLoading}
                title={copy.pdfTitle}
                hideSeparateToggle
                hideFormatSelector
            />
        </ReportView>
    );
}
