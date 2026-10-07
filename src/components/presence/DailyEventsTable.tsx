'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { getDailyEventsAction, updateEventAction } from '@/app/presence/presence-actions';
import { AddEventForm } from '@/components/presence/AddEventForm';
import { DeleteEventsDialog } from '@/components/presence/DeleteEventsDialog';
import { Button } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { DateRangeFields } from '@/components/ui/DateRangeFields';
import { EditableCell } from '@/components/ui/EditableCell';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { Input } from '@/components/ui/Input';
import { RecordCount } from '@/components/ui/RecordCount';
import { SearchField } from '@/components/ui/SearchField';
import { MissingValue } from '@/components/ui/TableCells';
import { useClientSort } from '@/hooks/useClientSort';
import { useEventDeletion } from '@/hooks/useEventDeletion';
import { useListQuery } from '@/hooks/useListQuery';
import { dbDateTimeParts, getTodayDate } from '@/lib/dateUtils';
import { formatDbDateTime } from '@/lib/format';
import type { RowSortColumns } from '@/lib/sort';
import { APP_COPY, fmt } from '@/locales';
import type { PresenceEventRow } from '@/types';

interface Filters {
    dateFrom: string;
    dateTo: string;
    operator: string;
}

const copy = APP_COPY.analytics.dailyEvents;

const initialFilters = (): Filters => ({ dateFrom: getTodayDate(), dateTo: getTodayDate(), operator: '' });

const SORT_COLUMNS: RowSortColumns<PresenceEventRow> = {
    OGGETTO: (row) => row.OGGETTO,
    operator_name: (row) => row.operator_name,
    EVENTO: (row) => row.EVENTO,
    ORA_EVENTO: (row) => new Date(row.ORA_EVENTO).getTime(),
};

export function DailyEventsTable() {
    const list = useListQuery({
        initialFilters,
        load: (f: Filters) => getDailyEventsAction(f.dateFrom, f.dateTo, f.operator),
    });
    const { sorted, sort, toggleSort } = useClientSort(list.rows, SORT_COLUMNS, { column: 'ORA_EVENTO', direction: 'asc' });
    const deletion = useEventDeletion(list.reload);
    const [showAddForm, setShowAddForm] = useState(false);

    const saveTime = (row: PresenceEventRow) => async ({ date, time }: { date: string; time: string }) => {
        // Date and time go to the database as typed, no timezone conversion
        const result = await updateEventAction(row.OGGETTO, row.ORA_EVENTO, 'ORA_EVENTO', `${date} ${time}`);
        if (!result.success) {
            alert(fmt(APP_COPY.common.actionError, { error: result.error ?? '' }));
            return false;
        }
        await list.reload();
        return true;
    };

    const columns: DataTableColumn<PresenceEventRow>[] = [
        { key: 'OGGETTO', header: copy.headers.oggetto, cellClassName: 'font-mono text-fg-secondary', cell: (row) => row.OGGETTO },
        { key: 'operator_name', header: copy.headers.operatorName, cellClassName: 'text-fg-secondary', cell: (row) => row.operator_name || <MissingValue /> },
        { key: 'EVENTO', header: copy.headers.evento, cellClassName: 'text-fg-secondary', cell: (row) => row.EVENTO },
        {
            key: 'ORA_EVENTO',
            header: copy.headers.oraEvento,
            cellClassName: 'font-mono text-fg-secondary',
            cell: (row) => (
                <EditableCell
                    display={formatDbDateTime(row.ORA_EVENTO)}
                    startValue={() => dbDateTimeParts(row.ORA_EVENTO) ?? { date: '', time: '' }}
                    renderEditor={(draft, setDraft) => (
                        <div className="flex items-center gap-1 bg-card border border-border-strong rounded px-2 py-1">
                            <Input
                                type="date"
                                value={draft.date}
                                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                                className="h-7 text-xs border-0 bg-transparent p-0 w-28 focus:ring-0"
                                autoFocus
                            />
                            <span className="text-fg-faint">|</span>
                            <Input
                                type="time"
                                step="1"
                                value={draft.time}
                                onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                                className="h-7 text-xs border-0 bg-transparent p-0 w-24 focus:ring-0"
                            />
                        </div>
                    )}
                    onSave={saveTime(row)}
                />
            ),
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            sortable: false,
            className: 'w-16',
            cell: (row) => (
                <button
                    type="button"
                    onClick={() => deletion.open(row, list.rows)}
                    className="p-1 text-fg-subtle hover:text-danger hover:bg-danger/10 rounded transition-colors"
                    title={copy.delete.button}
                >
                    <Trash2 size={16} />
                </button>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <FilterPanel
                columns={3}
                onApply={list.apply}
                onClear={list.clear}
                actions={
                    <Button type="button" variant="outline" onClick={() => setShowAddForm(!showAddForm)}>
                        <Plus size={16} />
                        {copy.add.button}
                    </Button>
                }
            >
                <DateRangeFields dateFrom={list.filters.dateFrom} dateTo={list.filters.dateTo} onChange={list.updateFilters} />
                <SearchField
                    label={copy.operatorFilter}
                    placeholder={APP_COPY.analytics.operators.searchPlaceholder}
                    value={list.filters.operator}
                    onChange={(operator) => list.updateFilters({ operator })}
                />
            </FilterPanel>

            {showAddForm && (
                <AddEventForm
                    onCreated={() => {
                        setShowAddForm(false);
                        list.apply();
                    }}
                    onCancel={() => setShowAddForm(false)}
                />
            )}

            {sorted.length > 0 && (
                <RecordCount count={sorted.length}>
                    <span className="text-xs text-fg-subtle">{copy.editHint}</span>
                </RecordCount>
            )}

            <DataTable
                columns={columns}
                rows={sorted}
                getRowKey={(row, index) => `${row.OGGETTO}-${String(row.ORA_EVENTO)}-${index}`}
                sort={sort}
                onSort={toggleSort}
                loading={list.loading}
                error={list.error}
                emptyMessage={list.applied ? APP_COPY.analytics.common.noResults : APP_COPY.analytics.applyFiltersHint}
            />

            {deletion.pending && (
                <DeleteEventsDialog
                    items={deletion.pending.items}
                    checked={deletion.pending.checked}
                    deleting={deletion.deleting}
                    onToggle={deletion.toggle}
                    onConfirm={deletion.confirm}
                    onClose={deletion.close}
                />
            )}
        </div>
    );
}
