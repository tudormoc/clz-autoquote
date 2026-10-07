'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { getAreaSummaryDataAction } from '@/app/analytics/analytics-actions';
import { generateAreaSummaryPDFAction } from '@/app/analytics/pdf-actions';
import { MonthSelectorModal } from '@/components/analytics/MonthSelectorModal';
import { scoreTone } from '@/components/analytics/report/ReportCells';
import { ReportView } from '@/components/analytics/report/ReportView';
import { Button } from '@/components/ui/Button';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { DateRangeFields } from '@/components/ui/DateRangeFields';
import { SearchField } from '@/components/ui/SearchField';
import { StackedCell } from '@/components/ui/TableCells';
import { APP_CONFIG } from '@/config/constants';
import { useReportTable } from '@/hooks/useReportTable';
import { getLastYearEnd, getLastYearStart, getTodayDate } from '@/lib/dateUtils';
import { DOWNLOAD_GAP_MS, downloadBase64File, wait } from '@/lib/download';
import type { ExcelColumn } from '@/lib/excel';
import { formatHours, formatNumber } from '@/lib/format';
import { APP_COPY } from '@/locales';

interface AreaSummaryRow {
    area_name: string;
    work_time: number;
    requested_quantity: number;
    velocity: number;
    target_velocity: number;
    efficiency: number;
}

interface Filters {
    area: string;
    dateFrom: string;
    dateTo: string;
}

const copy = APP_COPY.analytics.areaSummary;
const YEAR = APP_CONFIG.ANALYTICS.FALLBACK_YEAR;
const { EXCELLENT, ACCEPTABLE } = APP_CONFIG.ANALYTICS.EFFICIENCY_THRESHOLDS;

const initialFilters = (): Filters => ({ area: '', dateFrom: getLastYearStart(), dateTo: getLastYearEnd() });

const toQuery = (f: Filters) => ({
    machine: f.area || undefined, // the query still calls the area filter "machine"
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
});

const columns: DataTableColumn<AreaSummaryRow>[] = [
    { key: 'area_name', header: copy.headers.area, cell: (row) => <StackedCell tone="plain" primary={row.area_name} /> },
    {
        key: 'requested_quantity',
        header: copy.headers.quantity,
        variant: 'number',
        cellClassName: 'text-fg-strong',
        cell: (row) => formatNumber(row.requested_quantity),
    },
    { key: 'work_time', header: copy.headers.workTime, variant: 'number', cellClassName: 'text-fg-strong', cell: (row) => formatHours(row.work_time) },
    {
        key: 'velocity',
        header: copy.headers.velocity,
        variant: 'number',
        cellClassName: 'text-fg-strong',
        cell: (row) => (
            <>
                <div>{row.velocity.toFixed(1)}</div>
                <div className="text-xs text-fg-subtle">/ {row.target_velocity}</div>
            </>
        ),
    },
    {
        key: 'efficiency',
        header: copy.headers.efficiency,
        align: 'right',
        cell: (row) => (
            <span className={`font-mono font-semibold ${scoreTone(row.efficiency, EXCELLENT, ACCEPTABLE)}`}>{row.efficiency.toFixed(0)}%</span>
        ),
    },
];

const excelColumns: ExcelColumn<AreaSummaryRow>[] = [
    { header: copy.export.area, value: (row) => row.area_name },
    { header: copy.export.quantity, value: (row) => row.requested_quantity },
    { header: copy.export.workTime, value: (row) => Number(row.work_time.toFixed(2)) },
    { header: copy.export.velocity, value: (row) => Number(row.velocity.toFixed(1)) },
    { header: copy.export.target, value: (row) => row.target_velocity },
    { header: copy.export.efficiency, value: (row) => Number(row.efficiency.toFixed(0)) },
];

export function AreaSummaryReport() {
    const [showPdfModal, setShowPdfModal] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);

    const report = useReportTable<Filters, AreaSummaryRow>({
        initialFilters,
        defaultSort: { column: 'display_order', direction: 'asc' },
        fetchPage: ({ filters, page, limit, sort, exportAll }) =>
            getAreaSummaryDataAction(YEAR, page, limit, toQuery(filters), sort ?? undefined, exportAll),
    });
    const { filters, updateFilters, applied } = report;

    const handleGeneratePDF = async (
        year: number,
        months: number[],
        separateByArea: boolean,
        _format: 'A4' | 'A3',
        mode: 'months' | 'weeks' = 'months',
        weeks: number[] = []
    ) => {
        if (!applied) return;
        setPdfLoading(true);
        try {
            // "Separate by area" without an area filter: one PDF for each area listed in the results
            const areas = separateByArea && !applied.area ? report.rows.map((row) => row.area_name) : [applied.area || undefined];
            for (const area of areas) {
                const result = await generateAreaSummaryPDFAction(year, months, area, mode, weeks);
                if (result.success && result.pdf) {
                    downloadBase64File(result.pdf, result.filename);
                    if (areas.length > 1) await wait(DOWNLOAD_GAP_MS);
                } else {
                    console.error(`PDF generation failed for area ${area}:`, result.error);
                }
            }
            setShowPdfModal(false);
        } catch (err) {
            console.error('PDF generation error:', err);
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
                    <SearchField label={copy.headers.area} value={filters.area} onChange={(area) => updateFilters({ area })} />
                </>
            }
            actions={
                <Button type="button" variant="secondary" onClick={() => setShowPdfModal(true)} disabled={!applied || pdfLoading}>
                    <FileText size={16} />
                    {copy.pdfButton}
                </Button>
            }
            excel={{
                columns: excelColumns,
                sheetName: 'Area Summary',
                fileName: () => `area-summary-${getTodayDate()}.xlsx`,
            }}
        >
            <MonthSelectorModal
                isOpen={showPdfModal}
                onClose={() => setShowPdfModal(false)}
                onGenerate={handleGeneratePDF}
                loading={pdfLoading}
                showWeekMode
            />
        </ReportView>
    );
}
