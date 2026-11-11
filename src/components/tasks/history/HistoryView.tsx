'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { getHistoryAction } from '@/app/tasks/task-actions';
import { OccurrenceStatusBadge } from '@/components/tasks/shared/TaskBadges';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { DateRangeFields } from '@/components/ui/DateRangeFields';
import { ExportExcelButton } from '@/components/ui/ExportExcelButton';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { MissingValue } from '@/components/ui/TableCells';
import { ToggleChips } from '@/components/ui/ToggleChips';
import { LINKS } from '@/config/navigation';
import { useAppliedQuery } from '@/hooks/useAppliedQuery';
import { useClientSort } from '@/hooks/useClientSort';
import { getTodayDate } from '@/lib/dateUtils';
import { reportFileName } from '@/lib/download';
import type { ExcelColumn } from '@/lib/excel';
import type { RowSortColumns } from '@/lib/sort';
import { daysBetween } from '@/lib/tasks/dates';
import { formatIsoDate, formatMoment } from '@/lib/tasks/describe';
import type { HistoryRow } from '@/lib/tasks/db/views';
import type { OccurrenceStatus } from '@/lib/tasks/types';
import { toggleInSet } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.tasks;
const columnsCopy = copy.history.columns;
const CLOSED: OccurrenceStatus[] = ['done', 'skipped', 'cancelled', 'replaced'];

interface Filters {
    dateFrom: string;
    dateTo: string;
    statuses: OccurrenceStatus[];
}

/** This month so far, without the occurrences replaced by another date */
const initialFilters = (): Filters => {
    const today = getTodayDate();
    return { dateFrom: `${today.slice(0, 7)}-01`, dateTo: today, statuses: ['done', 'skipped', 'cancelled'] };
};

/** Days late (positive) or early (negative) of a done occurrence; null for the others */
function lateness(row: HistoryRow): number | null {
    if (row.status !== 'done' || !row.dueDate) return null;
    return daysBetween(row.dueDate, row.closedAt.slice(0, 10));
}

function timingText(row: HistoryRow): string {
    const days = lateness(row);
    if (days === null) return '';
    if (days > 0) return fmt(copy.history.late, { n: days });
    return days < 0 ? fmt(copy.history.early, { n: -days }) : copy.history.onTime;
}

const SORT_COLUMNS: RowSortColumns<HistoryRow> = {
    date: (row) => row.dueDate,
    task: (row) => row.title,
    area: (row) => row.areaName,
    status: (row) => CLOSED.indexOf(row.status),
    doneAt: (row) => row.closedAt,
    doneBy: (row) => row.closedBy,
    note: (row) => row.note,
};

const EXCEL_COLUMNS: ExcelColumn<HistoryRow>[] = [
    { header: columnsCopy.date, value: (row) => formatIsoDate(row.dueDate), width: 12 },
    { header: columnsCopy.task, value: (row) => row.title, width: 40 },
    { header: columnsCopy.area, value: (row) => row.areaName, width: 18 },
    { header: columnsCopy.status, value: (row) => copy.status[row.status], width: 12 },
    { header: columnsCopy.doneAt, value: (row) => formatMoment(row.closedAt), width: 18 },
    { header: columnsCopy.doneBy, value: (row) => row.closedBy, width: 18 },
    { header: copy.history.timing, value: timingText, width: 18 },
    { header: columnsCopy.note, value: (row) => row.note, width: 50 },
];

const NO_ROWS: HistoryRow[] = [];

/** "Storico": what was closed in a period (loads on "Applica" or from a link with a period, like the reports), with its outcome; Excel */
export function HistoryView() {
    const query = useAppliedQuery({
        initialFilters,
        load: (filters: Filters) => getHistoryAction(filters.dateFrom, filters.dateTo, filters.statuses),
    });
    const { filters, updateFilters, applied } = query;
    const statuses = useMemo(() => new Set(filters.statuses), [filters.statuses]);
    const rows = query.result?.success ? query.result.rows : NO_ROWS;
    const { sorted, sort, toggleSort } = useClientSort(rows, SORT_COLUMNS, { column: 'doneAt', direction: 'desc' });

    const columns: DataTableColumn<HistoryRow>[] = [
        {
            key: 'date',
            header: columnsCopy.date,
            cell: (row) => (
                <span className="whitespace-nowrap font-mono text-fg-secondary">
                    {formatIsoDate(row.dueDate)}
                    {row.originalDate && row.originalDate !== row.dueDate && <span className="block text-2xs text-fg-faint">{fmt(copy.detail.originalDate, { date: formatIsoDate(row.originalDate) })}</span>}
                </span>
            ),
        },
        {
            key: 'task',
            header: columnsCopy.task,
            mobileHidden: true,
            cell: (row) => (
                <Link href={`${LINKS.tasks.list}/${row.taskId}`} className="font-medium text-fg-strong hover:text-primary">
                    {row.title}
                </Link>
            ),
        },
        { key: 'area', header: columnsCopy.area, cell: (row) => row.areaName ?? <MissingValue /> },
        {
            key: 'status',
            header: columnsCopy.status,
            cell: (row) => (
                <span className="inline-flex flex-col gap-0.5">
                    <OccurrenceStatusBadge status={row.status} />
                    {timingText(row) && <span className={(lateness(row) ?? 0) > 0 ? 'text-2xs text-warning-300' : 'text-2xs text-fg-subtle'}>{timingText(row)}</span>}
                </span>
            ),
        },
        { key: 'doneAt', header: columnsCopy.doneAt, cellClassName: 'whitespace-nowrap font-mono text-fg-secondary', cell: (row) => formatMoment(row.closedAt) },
        { key: 'doneBy', header: columnsCopy.doneBy, cell: (row) => row.closedBy ?? <MissingValue /> },
        { key: 'note', header: columnsCopy.note, cellClassName: 'max-w-md text-fg-secondary whitespace-pre-line', cell: (row) => row.note ?? '' },
    ];

    return (
        <div className="flex flex-col gap-4 lg:h-full">
            <FilterPanel
                columns={4}
                onApply={query.apply}
                onClear={query.clear}
                activeCount={query.activeFilterCount}
                below={
                    <ToggleChips
                        label={copy.history.statusFilter}
                        options={CLOSED.map((status) => ({ key: status, label: copy.status[status] }))}
                        active={statuses}
                        onToggle={(status) => {
                            const chosen = toggleInSet(statuses, status);
                            updateFilters({ statuses: CLOSED.filter((each) => chosen.has(each)) });
                        }}
                    />
                }
                actions={
                    <ExportExcelButton
                        getRows={async () => sorted}
                        columns={EXCEL_COLUMNS}
                        sheetName={copy.pages.history.label}
                        fileName={applied ? reportFileName(copy.pages.history.label, [applied.dateFrom, applied.dateTo], 'xlsx') : ''}
                        disabled={sorted.length === 0}
                    />
                }
            >
                <DateRangeFields dateFrom={filters.dateFrom} dateTo={filters.dateTo} onChange={updateFilters} />
            </FilterPanel>
            <DataTable
                fill
                columns={columns}
                rows={sorted}
                getRowKey={(row) => row.occurrenceId}
                sort={sort}
                onSort={toggleSort}
                loading={query.loading}
                error={query.error}
                emptyMessage={applied === null ? copy.history.hint : copy.history.empty}
                mobileTitle={(row) => (
                    <Link href={`${LINKS.tasks.list}/${row.taskId}`} className="font-medium text-fg-strong">
                        {row.title}
                    </Link>
                )}
            />
        </div>
    );
}
