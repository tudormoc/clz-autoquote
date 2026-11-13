'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Plus } from '@/components/ui/icons';
import { getGuidesAction } from '@/app/tasks/guide-actions';
import { useCanEdit } from '@/components/auth/AccessProvider';
import { ReviewBadge } from '@/components/tasks/guides/ReviewBadge';
import { LoadState } from '@/components/ui/LoadState';
import { TaskFilters, matchesFilters } from '@/components/tasks/shared/TaskFilters';
import { buttonClasses } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { MissingValue } from '@/components/ui/TableCells';
import { LINKS } from '@/config/navigation';
import { useActionData } from '@/hooks/useActionData';
import { useAddress } from '@/hooks/useAddress';
import { useClientSort } from '@/hooks/useClientSort';
import { useTaskFilters } from '@/hooks/useTaskFilters';
import { flagParam } from '@/lib/address';
import type { RowSortColumns } from '@/lib/sort';
import { formatMoment } from '@/lib/tasks/describe';
import type { GuideSummary } from '@/lib/tasks/types';
import { APP_COPY } from '@/locales';
import { Surface } from '@/components/ui/Surface';
import { linkClasses } from '@/components/ui/linkLook';

const copy = APP_COPY.tasks.guides;

const SORT_COLUMNS: RowSortColumns<GuideSummary> = {
    title: (guide) => guide.title,
    area: (guide) => guide.areaName,
    updated: (guide) => guide.updatedAt,
    review: (guide) => (guide.toReview ? 0 : 1),
    tasks: (guide) => guide.taskCount,
};

/** "Mostra archiviate" switched on, in the address */
const VIEW = { archived: flagParam() };

/** "Procedure": the library of how things are done, filtered on screen; "Nuova procedura" */
export function GuidesListView() {
    const { data, loading, error } = useActionData(getGuidesAction);
    const canEdit = useCanEdit();
    const [filters, setFilters] = useTaskFilters();
    const view = useAddress(VIEW);
    const showArchived = view.values.archived;
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
                <Link href={`${LINKS.tasks.guides}/${guide.id}`} className={linkClasses('name')}>
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
            <Surface className="p-4">
                <TaskFilters values={filters} onChange={setFilters} areas={data.areas} people={[]}>
                    <div className="pb-2">
                        <Checkbox id="guides-archived" label={copy.showArchived} checked={showArchived} onChange={(e) => view.set({ archived: e.target.checked }, 'replace')} />
                    </div>
                    {canEdit && (
                        <Link href={`${LINKS.tasks.guides}/new`} className={buttonClasses({ className: 'sm:ml-auto' })}>
                            <Plus size={16} />
                            {copy.new}
                        </Link>
                    )}
                </TaskFilters>
            </Surface>
            <DataTable
                fill
                columns={columns}
                rows={sorted}
                getRowKey={(guide) => guide.id}
                sort={sort}
                onSort={toggleSort}
                emptyMessage={data.guides.length === 0 ? copy.empty : copy.noMatch}
                mobileTitle={(guide) => (
                    <Link href={`${LINKS.tasks.guides}/${guide.id}`} className={linkClasses('name')}>
                        {guide.title}
                    </Link>
                )}
            />
        </div>
    );
}
