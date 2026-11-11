'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { getTaskListAction } from '@/app/tasks/task-actions';
import { LoadState } from '@/components/ui/LoadState';
import { PriorityBadge, TaskStateBadge } from '@/components/tasks/shared/TaskBadges';
import { TaskFilters, matchesFilters } from '@/components/tasks/shared/TaskFilters';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { ExportExcelButton } from '@/components/ui/ExportExcelButton';
import { MissingValue } from '@/components/ui/TableCells';
import { ToggleChips } from '@/components/ui/ToggleChips';
import { LINKS } from '@/config/navigation';
import { useActionData } from '@/hooks/useActionData';
import { useAddress } from '@/hooks/useAddress';
import { useClientSort } from '@/hooks/useClientSort';
import { useTaskFilters } from '@/hooks/useTaskFilters';
import { listParam } from '@/lib/address';
import { getTodayDate } from '@/lib/dateUtils';
import { reportFileName } from '@/lib/download';
import type { ExcelColumn } from '@/lib/excel';
import { describeRepeat, formatIsoDate, formatShortDay, relativeDay } from '@/lib/tasks/describe';
import { TASK_STATES, type TaskState, type TaskSummary } from '@/lib/tasks/types';
import type { RowSortColumns } from '@/lib/sort';
import { toggleInSet } from '@/lib/utils';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.tasks;
const columnsCopy = copy.list.columns;
type Kind = 'once' | 'repeat';
const KINDS: readonly Kind[] = ['once', 'repeat'];
const USUAL_STATES: readonly TaskState[] = ['active', 'paused'];

/** The chips switched on, in the address */
const VIEW = { states: listParam(USUAL_STATES), kinds: listParam(KINDS) };

/** "Ogni mese, il 16" / "Una volta, 16/11/2026" / "Senza data" */
const whenText = (task: TaskSummary) =>
    task.repeat ? describeRepeat(task.repeat) : task.dueDate ? `${copy.repeat.once}, ${formatIsoDate(task.dueDate)}` : copy.repeat.noDate;

const SORT_COLUMNS: RowSortColumns<TaskSummary> = {
    title: (task) => task.title,
    area: (task) => task.areaName,
    repeat: (task) => whenText(task),
    next: (task) => task.nextDue,
    lastDone: (task) => task.lastDone,
    assignee: (task) => task.assigneeName,
    priority: (task) => -task.priority,
    state: (task) => TASK_STATES.indexOf(task.state),
};

const EXCEL_COLUMNS: ExcelColumn<TaskSummary>[] = [
    { header: columnsCopy.title, value: (task) => task.title, width: 40 },
    { header: columnsCopy.area, value: (task) => task.areaName, width: 18 },
    { header: columnsCopy.repeat, value: whenText, width: 36 },
    { header: columnsCopy.next, value: (task) => formatIsoDate(task.nextDue), width: 12 },
    { header: columnsCopy.lastDone, value: (task) => formatIsoDate(task.lastDone), width: 12 },
    { header: columnsCopy.assignee, value: (task) => task.assigneeName, width: 18 },
    { header: columnsCopy.priority, value: (task) => copy.priority[task.priority], width: 10 },
    { header: columnsCopy.state, value: (task) => copy.states[task.state], width: 12 },
    { header: copy.form.tags, value: (task) => task.tags.join(', '), width: 24 },
];

/** "Attività": every task the person sees, filtered on screen by text, area, person, state and kind; sortable; Excel */
export function TaskListView() {
    const { data, loading, error } = useActionData(getTaskListAction);
    const [filters, setFilters] = useTaskFilters();
    const view = useAddress(VIEW);
    const states = useMemo<ReadonlySet<string>>(() => new Set(view.values.states), [view.values.states]);
    const kinds = useMemo<ReadonlySet<string>>(() => new Set(view.values.kinds), [view.values.kinds]);

    const tasks = data?.tasks ?? [];
    const visible = useMemo(
        () =>
            data
                ? data.tasks.filter(
                      (task) =>
                          states.has(task.state) &&
                          kinds.has(task.repeat ? 'repeat' : 'once') &&
                          matchesFilters({ ...task, text: task.tags.join(' ') }, filters, data.areas)
                  )
                : [],
        [data, states, kinds, filters]
    );
    const { sorted, sort, toggleSort } = useClientSort(visible, SORT_COLUMNS, { column: 'next', direction: 'asc' });
    const people = useMemo(() => (data ? data.people.filter((person) => data.tasks.some((task) => task.assignee === person.key)) : []), [data]);

    if (!data) return <LoadState loading={loading} error={error} />;
    const today = getTodayDate();

    const columns: DataTableColumn<TaskSummary>[] = [
        {
            key: 'title',
            header: columnsCopy.title,
            mobileHidden: true,
            cell: (task) => (
                <div className="min-w-0">
                    <Link href={`${LINKS.tasks.list}/${task.id}`} className="font-medium text-fg-strong hover:text-primary">
                        {task.title}
                    </Link>
                    {task.tags.length > 0 && <div className="text-2xs text-fg-subtle">{task.tags.join(' · ')}</div>}
                </div>
            ),
        },
        { key: 'area', header: columnsCopy.area, cell: (task) => task.areaName ?? <MissingValue /> },
        { key: 'repeat', header: columnsCopy.repeat, cellClassName: 'text-fg-secondary', cell: whenText },
        {
            key: 'next',
            header: columnsCopy.next,
            cell: (task) =>
                task.nextDue ? (
                    <span className="whitespace-nowrap">
                        <span className={task.nextDue < today ? 'font-mono text-danger-400' : 'font-mono text-fg-secondary'}>{formatShortDay(task.nextDue)}</span>
                        <span className="block text-2xs text-fg-subtle">{relativeDay(task.nextDue, today)}</span>
                    </span>
                ) : (
                    <MissingValue />
                ),
        },
        { key: 'lastDone', header: columnsCopy.lastDone, cell: (task) => (task.lastDone ? <span className="font-mono text-fg-secondary">{formatIsoDate(task.lastDone)}</span> : <MissingValue />) },
        { key: 'assignee', header: columnsCopy.assignee, mobileHidden: people.length <= 1, cell: (task) => task.assigneeName ?? <MissingValue /> },
        { key: 'priority', header: columnsCopy.priority, cell: (task) => <PriorityBadge priority={task.priority} /> },
        { key: 'state', header: columnsCopy.state, cell: (task) => <TaskStateBadge state={task.state} /> },
    ];

    return (
        <div className="flex flex-col gap-4 lg:h-full">
            <div className="bg-card border border-border rounded-lg p-4 space-y-4">
                <TaskFilters values={filters} onChange={setFilters} areas={data.areas} people={people}>
                    <div className="sm:ml-auto">
                        <ExportExcelButton
                            getRows={async () => sorted}
                            columns={EXCEL_COLUMNS}
                            sheetName={copy.pages.list.label}
                            fileName={reportFileName(copy.pages.list.label, [today], 'xlsx')}
                            disabled={sorted.length === 0}
                        />
                    </div>
                </TaskFilters>
                <div className="flex flex-wrap gap-x-8 gap-y-3">
                    <ToggleChips
                        label={copy.filters.state}
                        options={TASK_STATES.map((state) => ({ key: state, label: copy.states[state], count: tasks.filter((task) => task.state === state).length }))}
                        active={states}
                        onToggle={(state) => view.set({ states: [...toggleInSet(states, state)] }, 'replace')}
                    />
                    <ToggleChips
                        label={copy.filters.kind}
                        options={KINDS.map((kind) => ({ key: kind, label: copy.kinds[kind] }))}
                        active={kinds}
                        onToggle={(kind) => view.set({ kinds: [...toggleInSet(kinds, kind)] }, 'replace')}
                    />
                </div>
            </div>
            <DataTable
                fill
                columns={columns}
                rows={sorted}
                getRowKey={(task) => task.id}
                sort={sort}
                onSort={toggleSort}
                emptyMessage={tasks.length === 0 ? copy.list.empty : copy.list.noMatch}
                mobileTitle={(task) => (
                    <Link href={`${LINKS.tasks.list}/${task.id}`} className="font-medium text-fg-strong">
                        {task.title}
                    </Link>
                )}
            />
        </div>
    );
}
