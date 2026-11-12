'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { getOrderAreaSummaryDataAction, type OrderAreaRow } from '@/app/analytics/analytics-actions';
import { generateOrderAreaSummaryPDFAction } from '@/app/analytics/pdf-actions';
import { MonthSelectorModal } from '@/components/analytics/MonthSelectorModal';
import { ReportView } from '@/components/analytics/report/ReportView';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { DateRangeFields } from '@/components/ui/DateRangeFields';
import { SearchField } from '@/components/ui/SearchField';
import { StackedCell, TagCell } from '@/components/ui/TableCells';
import { APP_CONFIG } from '@/config/constants';
import { EXPORT_LIMIT, useReportTable, type PageResult } from '@/hooks/useReportTable';
import { defaultReportPeriod } from '@/lib/dateUtils';
import { DOWNLOAD_GAP_MS, downloadBase64File, wait } from '@/lib/download';
import type { ExcelColumn } from '@/lib/excel';
import { calcExpectedHours } from '@/lib/expectedHours';
import { EMPTY_VALUE, formatHours, formatNumber } from '@/lib/format';
import { notify } from '@/lib/notify';
import { sumOrderHours, type OrderHours } from '@/lib/orderAreaHours';
import { APP_COPY } from '@/locales';

interface Filters {
    commessa: string;
    area: string;
    dateFrom: string;
    dateTo: string;
    complexOnly: boolean;
}

const copy = APP_COPY.analytics.orderAreaSummary;
const common = APP_COPY.analytics.common;
const YEAR = APP_CONFIG.ANALYTICS.FALLBACK_YEAR;

const initialFilters = (): Filters => ({
    commessa: '',
    area: '',
    ...defaultReportPeriod(),
    complexOnly: false,
});

const toQuery = (f: Filters) => ({
    commessa: f.commessa || undefined,
    area: f.area || undefined,
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
    complexOnly: f.complexOnly,
});

const expectedHours = (row: OrderAreaRow) => calcExpectedHours(row.area_name, row.qty_requested, row.fogli);

/** "Ore Lavoro: 12:30 | Ore Attese: 10:00" */
const hoursLine = (time: number, expected: number | null) =>
    `${copy.stats.timeWorked}: ${formatHours(time)} | ${copy.stats.timeExpected}: ${expected != null ? formatHours(expected) : EMPTY_VALUE}`;

/**
 * The summary: one entry per order with its hours worked and expected, in total and per area. The same sum as the PDF
 * (src/lib/orderAreaHours.ts; owner, 2026-11-12): every area counts, the expected hours of an area once. By order number.
 */
const summarizeByCommessa = (rows: OrderAreaRow[]): OrderHours[] => sumOrderHours(rows).sort((a, b) => a.display.localeCompare(b.display));

const columns: DataTableColumn<OrderAreaRow>[] = [
    {
        key: 'commessa',
        header: copy.headers.commessa,
        className: 'w-40',
        cell: (row) => <StackedCell primary={row.commessa_display} secondary={row.order_description} maxWidth="md" />,
    },
    {
        key: 'client_name',
        header: common.client,
        cellClassName: 'text-fg-secondary',
        cell: (row) => <div className="truncate max-w-48" title={row.client_name ?? ''}>{row.client_name ?? EMPTY_VALUE}</div>,
    },
    { key: 'area', header: copy.headers.area, cell: (row) => <TagCell>{row.area_name}</TagCell> },
    {
        key: 'composition',
        header: copy.headers.composition,
        cellClassName: 'text-fg-secondary',
        cell: (row) => <div className="text-xs truncate max-w-48" title={row.composition ?? ''}>{row.composition ?? EMPTY_VALUE}</div>,
    },
    { key: 'fogli', header: copy.headers.fogli, variant: 'number', cell: (row) => formatNumber(row.fogli) },
    { key: 'pages', header: copy.headers.pages, variant: 'number', cell: (row) => row.pages ?? EMPTY_VALUE },
    {
        key: 'time_expected',
        header: copy.headers.timeExpected,
        variant: 'number',
        sortable: false,
        cellClassName: 'text-fg-muted',
        cell: (row) => formatHours(expectedHours(row)),
    },
    { key: 'time', header: copy.headers.time, variant: 'total', cell: (row) => formatHours(row.work_time) },
    { key: 'qty_requested', header: copy.headers.qtyReq, variant: 'number', cell: (row) => formatNumber(row.qty_requested) },
];

const excelColumns: ExcelColumn<OrderAreaRow>[] = [
    { header: copy.export.commessa, value: (row) => Number(row.commessa_display), width: 10, format: 'integer' },
    { header: copy.export.description, value: (row) => row.order_description, width: 30 },
    { header: common.client, value: (row) => row.client_name ?? '', width: 25 },
    { header: copy.export.area, value: (row) => row.area_name, width: 20 },
    { header: copy.export.composition, value: (row) => row.composition ?? '', width: 20 },
    { header: copy.export.fogli, value: (row) => row.fogli ?? '', width: 10 },
    { header: copy.export.pages, value: (row) => row.pages ?? '', width: 10 },
    {
        header: copy.export.timeExpected,
        value: (row) => {
            const hours = expectedHours(row);
            return hours != null ? Number(hours.toFixed(2)) : '';
        },
        width: 12,
    },
    { header: copy.export.workTime, value: (row) => Number(row.work_time.toFixed(2)), width: 12 },
    { header: copy.export.qtyRequested, value: (row) => row.qty_requested ?? '', width: 15 },
];

export function OrderAreaSummaryReport() {
    const [showPdfModal, setShowPdfModal] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);

    const report = useReportTable<Filters, OrderAreaRow, OrderHours[]>({
        initialFilters,
        // No order until the user picks a column: the query then uses its own default order
        defaultSort: null,
        fetchPage: ({ filters, page, limit, sort }) =>
            getOrderAreaSummaryDataAction(YEAR, page, limit, toQuery(filters), sort ?? undefined) as Promise<
                PageResult<OrderAreaRow>
            >,
        fetchSummary: async (filters) => {
            const result = await getOrderAreaSummaryDataAction(YEAR, 1, EXPORT_LIMIT, toQuery(filters));
            return { success: result.success, data: result.success ? summarizeByCommessa(result.data as OrderAreaRow[]) : null };
        },
    });
    const { filters, updateFilters, applied } = report;

    const handleGeneratePDF = async (year: number, months: number[], separateByArea: boolean, format: 'A4' | 'A3') => {
        if (!applied) return;
        setPdfLoading(true);
        try {
            // "Separate by area" without an area filter: one PDF for each area listed in the results
            const areas = separateByArea && !applied.area
                ? Array.from(new Set(report.rows.map((row) => row.area_name)))
                : [applied.area || undefined];
            for (const area of areas) {
                const result = await generateOrderAreaSummaryPDFAction(year, months, applied.commessa || undefined, area, format, applied.complexOnly);
                if (result.success && result.pdf) {
                    downloadBase64File(result.pdf, result.filename);
                    if (areas.length > 1) await wait(DOWNLOAD_GAP_MS);
                } else {
                    console.error(`PDF generation failed for area ${area}:`, result.error);
                    notify.error(APP_COPY.analytics.pdfError);
                }
            }
            setShowPdfModal(false);
        } catch (err) {
            console.error('PDF generation error:', err);
            notify.error(APP_COPY.analytics.pdfError);
        } finally {
            setPdfLoading(false);
        }
    };

    return (
        <ReportView
            report={report}
            columns={columns}
            filterColumns={4}
            filters={
                <>
                    <DateRangeFields dateFrom={filters.dateFrom} dateTo={filters.dateTo} onChange={updateFilters} />
                    <SearchField label={copy.headers.commessa} value={filters.commessa} onChange={(commessa) => updateFilters({ commessa })} />
                    <SearchField label={copy.headers.area} value={filters.area} onChange={(area) => updateFilters({ area })} />
                    <div className="flex items-center mt-6">
                        <Checkbox
                            id="complexOnly"
                            label={copy.complexOnly}
                            checked={filters.complexOnly}
                            onChange={(e) => updateFilters({ complexOnly: e.target.checked })}
                        />
                    </div>
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
                name: APP_COPY.analytics.reports.orderAreaSummary,
                fileParts: (f) => [f.dateFrom, f.dateTo],
            }}
            summary={{
                items: (groups) =>
                    groups.map((group) => ({
                        label: (
                            <div className="flex flex-col min-w-0">
                                <span className="font-mono text-primary truncate" title={`${group.display}${group.client ? ' - ' + group.client : ''}`}>
                                    {group.display}
                                    {group.client && <span className="font-sans text-fg-muted font-medium ml-2">- {group.client}</span>}
                                </span>
                                <span className="text-3xs text-fg-subtle truncate" title={group.description}>
                                    {group.description}
                                </span>
                            </div>
                        ),
                        value: hoursLine(group.worked, group.expected),
                        subItems: group.areas.map((area) => ({ label: area.label, value: hoursLine(area.worked, area.expected) })),
                    })),
                copyText: (groups) =>
                    `${copy.stats.summary}\n\n` +
                    groups
                        .map((group) =>
                            [
                                `${group.display}${group.client ? ` - ${group.client}` : ''} - ${group.description}`,
                                hoursLine(group.worked, group.expected),
                                ...group.areas.map((area) => `  - ${area.label}:\t${hoursLine(area.worked, area.expected)}`),
                                '',
                            ].join('\n')
                        )
                        .join('\n') +
                    (groups.length ? '\n' : ''),
            }}
        >
            <MonthSelectorModal
                isOpen={showPdfModal}
                onClose={() => setShowPdfModal(false)}
                onGenerate={handleGeneratePDF}
                loading={pdfLoading}
                title={APP_COPY.analytics.reports.orderAreaSummary}
            />
        </ReportView>
    );
}
