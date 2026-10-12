'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getGuidesAction } from '@/app/tasks/guide-actions';
import { useCanEdit } from '@/components/auth/AccessProvider';
import { ReviewBadge } from '@/components/tasks/guides/ReviewBadge';
import { LoadState } from '@/components/tasks/shared/LoadState';
import { EMPTY_FILTERS, TaskFilters, matchesFilters, type TaskFilterValues } from '@/components/tasks/shared/TaskFilters';
import { buttonClasses } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { MissingValue } from '@/components/ui/TableCells';
import { TASK_PAGES } from '@/config/navigation';
import { useActionData } from '@/hooks/useActionData';
import { useClientSort } from '@/hooks/useClientSort';
import type { RowSortColumns } from '@/lib/sort';
import { formatMoment } from '@/lib/tasks/describe';
import type { GuideSummary } from '@/lib/tasks/types';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.tasks.guides;

const SORT_COLUMNS: RowSortColumns<GuideSummary> = {
    title: (guide) => guide.title,
    area: (guide) => guide.areaName,
    updated: (guide) => guide.updatedAt,
    review: (guide) => (guide.toReview ? 0 : 1),
    tasks: (guide) => guide.taskCount,
};

/** "Procedure": the library of how things are done, filtered on screen; "Nuova procedura" */
export function GuidesListView() {
    const { data, loading, error } = useActionData(getGuidesAction);
    const canEdit = useCanEdit();
    const [filters, setFilters] = useState<TaskFilterValues>(EMPTY_FILTERS);
    const [showArchived, setShowArchived] = useState(false);
    const visible = useMemo(
        () =>
            data
                ? data.guides.filter((guide) => (showArchived || guide.state === 'active') && matchesFilters({ ...guide, assigneeName: null }, filters, data.areas))
                : [],
        [data, filters, showArchived]
    );
    const { sorted, sort, toggleSort } = useClientSort(visible, SORT_COLUMNS, { column: 'title', direction: 'asc' });
    if (!data) return <LoadState loading={loading} error={error} />;

    const columns: DataTableColumn<GuideSummary>[] = [
        {
            key: 'title',
            header: copy.columns.title,
            mobileHidden: true,
            cell: (guide) => (
                <Link href={`${TASK_PAGES.guides}/${guide.id}`} className="font-medium text-fg-strong hover:text-primary">
                    {guide.title}
                    {guide.state === 'archived' && <span className="ml-2 text-2xs font-normal text-fg-faint">{APP_COPY.tasks.states.archived}</span>}
                </Link>
            ),
        },
        { key: 'area', header: copy.columns.area, cell: (guide) => guide.areaName ?? <MissingValue /> },
        { key: 'updated', header: copy.columns.updated, cellClassName: 'whitespace-nowrap font-mono text-fg-secondary', cell: (guide) => formatMoment(guide.updatedAt) },
        { key: 'review', header: copy.columns.review, cell: (guide) => <ReviewBadge guide={guide} /> },
        { key: 'tasks', header: copy.columns.tasks, variant: 'number', cell: (guide) => guide.taskCount },
    ];

    return (
        <div className="flex flex-col gap-4 lg:h-full">
            <div className="bg-card border border-border rounded-lg p-4">
                <TaskFilters values={filters} onChange={setFilters} areas={data.areas} people={[]}>
                    <div className="pb-2">
                        <Checkbox id="guides-archived" label={copy.showArchived} checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                    </div>
                    {canEdit && (
                        <Link href={`${TASK_PAGES.guides}/new`} className={buttonClasses({ className: 'sm:ml-auto' })}>
                            <Plus size={16} />
                            {copy.new}
                        </Link>
                    )}
                </TaskFilters>
            </div>
            <DataTable
                fill
                columns={columns}
                rows={sorted}
                getRowKey={(guide) => guide.id}
                sort={sort}
                onSort={toggleSort}
                emptyMessage={data.guides.length === 0 ? copy.empty : copy.noMatch}
                mobileTitle={(guide) => (
                    <Link href={`${TASK_PAGES.guides}/${guide.id}`} className="font-medium text-fg-strong">
                        {guide.title}
                    </Link>
                )}
            />
        </div>
    );
}
