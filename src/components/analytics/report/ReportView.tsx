'use client';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { FilterPanel, type FilterColumns } from '@/components/ui/FilterPanel';
import { Pagination } from '@/components/ui/Pagination';
import { ExportExcelButton } from '@/components/ui/ExportExcelButton';
import { SummaryCards, type SummaryItem } from '@/components/analytics/SummaryCards';
import { copyToClipboard } from '@/lib/clipboard';
import type { ExcelColumn } from '@/lib/excel';
import type { ReportTable } from '@/hooks/useReportTable';
import { APP_COPY } from '@/locales';

interface ReportViewProps<F, R, S> {
    /** State from useReportTable */
    report: ReportTable<F, R, S>;
    columns: DataTableColumn<R>[];
    getRowKey?: (row: R, index: number) => React.Key;
    /** Filter fields (DateRangeFields, SearchField …) */
    filters: React.ReactNode;
    filterColumns?: FilterColumns;
    /** Buttons between "Applica" and "Pulisci" */
    filterButtons?: React.ReactNode;
    /** Buttons on the right of the filter panel, after "Esporta Excel" (PDF …) */
    actions?: React.ReactNode;
    excel?: {
        columns: ExcelColumn<R>[];
        sheetName: string;
        fileName: (filters: F) => string;
    };
    summary?: {
        items: (data: S) => SummaryItem[];
        /** Text placed on the clipboard by "Copia" */
        copyText?: (data: S) => string;
    };
    /** Dialogs of the report (PDF options …) */
    children?: React.ReactNode;
}

/** A complete paginated report: filters, optional summary, paging, sortable table and Excel export. */
export function ReportView<F, R, S>({
    report,
    columns,
    getRowKey,
    filters,
    filterColumns,
    filterButtons,
    actions,
    excel,
    summary,
    children,
}: ReportViewProps<F, R, S>) {
    const { applied } = report;
    const summaryData = report.summary.data;

    return (
        <div className="space-y-4">
            <FilterPanel
                columns={filterColumns}
                onApply={report.apply}
                onClear={report.clear}
                buttons={filterButtons}
                actions={
                    (excel || actions) && (
                        <>
                            {excel && (
                                <ExportExcelButton
                                    getRows={report.fetchAll}
                                    columns={excel.columns}
                                    sheetName={excel.sheetName}
                                    fileName={applied ? excel.fileName(applied) : ''}
                                    disabled={!applied}
                                />
                            )}
                            {actions}
                        </>
                    )
                }
            >
                {filters}
            </FilterPanel>

            {summary && (
                <SummaryCards
                    items={summaryData ? summary.items(summaryData) : []}
                    status={report.summary.status}
                    onLoad={report.summary.load}
                    onCopy={
                        summary.copyText && summaryData
                            ? () => copyToClipboard(summary.copyText!(summaryData)).catch((err) => console.error('Copy failed:', err))
                            : undefined
                    }
                    disabled={!applied}
                />
            )}

            <Pagination
                page={report.page}
                totalPages={report.totalPages}
                total={report.total}
                pageSize={report.pageSize}
                onPageChange={report.setPage}
                disabled={report.loading}
            />

            <DataTable
                columns={columns}
                rows={report.rows}
                getRowKey={getRowKey}
                sort={report.sort}
                onSort={report.toggleSort}
                loading={report.loading}
                error={report.error}
                emptyMessage={applied ? APP_COPY.analytics.empty : APP_COPY.analytics.applyFiltersHint}
            />

            {children}
        </div>
    );
}
