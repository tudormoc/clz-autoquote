'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { deleteEventsAction, getDailyEventsAction, updateEventAction } from '@/app/presence/events-actions';
import { AddEventForm } from '@/components/presence/AddEventForm';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { DatePicker } from '@/components/ui/DatePicker';
import { DateRangeFields } from '@/components/ui/DateRangeFields';
import { EditableCell } from '@/components/ui/EditableCell';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { Input } from '@/components/ui/Input';
import { RecordCount } from '@/components/ui/RecordCount';
import { SearchField } from '@/components/ui/SearchField';
import { MissingValue } from '@/components/ui/TableCells';
import { useClientSort } from '@/hooks/useClientSort';
import { useListQuery } from '@/hooks/useListQuery';
import { confirmDelete } from '@/lib/confirm';
import { dbDateTimeParts, getTodayDate } from '@/lib/dateUtils';
import { formatDbDateTime } from '@/lib/format';
import type { RowSortColumns } from '@/lib/sort';
import { notify } from '@/lib/notify';
import { toggleInSet } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';
import type { PresenceEventRow } from '@/types';
import { useCanEdit } from '@/components/auth/AccessProvider';

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
    ORA_EVENTO: (row) => row.ORA_EVENTO.getTime(),
};

/** What names one event of the list: operator, event, time and NetPro's counter */
const eventKey = (row: PresenceEventRow) => `${row.OGGETTO}|${row.EVENTO}|${row.ORA_EVENTO.getTime()}|${row.PROGRESSIVO}`;

/** One event in a message: who, ENT / EXT, when */
const eventLabel = (row: PresenceEventRow) => fmt(copy.delete.event, { operator: row.operator_name || row.OGGETTO, event: row.EVENTO, time: formatDbDateTime(row.ORA_EVENTO) });

export function DailyEventsTable() {
    const list = useListQuery({
        initialFilters,
        load: (f: Filters) => getDailyEventsAction(f.dateFrom, f.dateTo, f.operator),
    });
    const { sorted, sort, toggleSort } = useClientSort(list.rows, SORT_COLUMNS, { column: 'ORA_EVENTO', direction: 'asc' });
    const [showAddForm, setShowAddForm] = useState(false);
    const canEdit = useCanEdit();
    /** The events ticked for "Elimina"; one that left the list no longer counts */
    const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
    const [deleting, setDeleting] = useState(false);
    const picked = sorted.filter((row) => ticked.has(eventKey(row)));
    /** A new search starts with nothing ticked */
    const untick = () => setTicked(new Set());
    const applyFilters = () => {
        untick();
        list.apply();
    };
    const clearFilters = () => {
        untick();
        list.clear();
    };

    const saveTime = (row: PresenceEventRow) => async ({ date, time }: { date: string; time: string }) => {
        // Date and time go to the database as typed, no timezone conversion
        const result = await updateEventAction(row.OGGETTO, row.ORA_EVENTO, 'ORA_EVENTO', `${date} ${time}`);
        if (!result.success) {
            notify.failure(result.error);
            return false;
        }
        await list.reload();
        return true;
    };

    const removePicked = async () => {
        if (!(await confirmDelete(fmt(copy.delete.confirm, { count: picked.length, list: picked.map(eventLabel).join('; ') })))) return;
        setDeleting(true);
        try {
            const result = await deleteEventsAction(
                picked.map((row) => ({ oggetto: row.OGGETTO, evento: row.EVENTO, oraEvento: row.ORA_EVENTO, progressivo: row.PROGRESSIVO }))
            );
            if (!result.success) {
                notify.failure(result.error);
                return;
            }
            notify.success(fmt(copy.delete.done, { count: picked.length }));
            untick();
            await list.reload();
        } finally {
            setDeleting(false);
        }
    };

    const columns: DataTableColumn<PresenceEventRow>[] = [
        ...(canEdit
            ? [
                  {
                      key: 'select',
                      header: '',
                      sortable: false,
                      compact: true,
                      className: 'w-10',
                      mobileLabel: copy.delete.select,
                      cell: (row: PresenceEventRow) => (
                          <Checkbox
                              checked={ticked.has(eventKey(row))}
                              onChange={() => setTicked((current) => toggleInSet(current, eventKey(row)))}
                              aria-label={fmt(copy.delete.selectEvent, { event: eventLabel(row) })}
                          />
                      ),
                  },
              ]
            : []),
        // Code and name make up the title of a phone card (cardTitle below)
        { key: 'OGGETTO', header: copy.headers.oggetto, cellClassName: 'font-mono text-fg-secondary', mobileHidden: true, cell: (row) => row.OGGETTO },
        { key: 'operator_name', header: copy.headers.operatorName, cellClassName: 'text-fg-secondary', mobileHidden: true, cell: (row) => row.operator_name || <MissingValue /> },
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
                        <div className="flex items-center gap-1">
                            <div className="w-36">
                                <DatePicker value={draft.date} onChange={(date) => setDraft({ ...draft, date })} autoFocus />
                            </div>
                            <div className="w-28">
                                <Input type="time" step="1" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} className="font-mono" />
                            </div>
                        </div>
                    )}
                    onSave={saveTime(row)}
                />
            ),
        },
    ];

    return (
        <div className="flex flex-col gap-4 lg:h-full">
            <FilterPanel columns={3} onApply={applyFilters} onClear={clearFilters} activeCount={list.activeFilterCount}>
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
                        applyFilters();
                    }}
                    onCancel={() => setShowAddForm(false)}
                />
            )}

            <RecordCount count={sorted.length}>
                <div className="flex items-center gap-3">
                    {canEdit && sorted.length > 0 && <span className="hidden sm:inline text-xs text-fg-subtle">{copy.editHint}</span>}
                    {canEdit && picked.length > 0 && (
                        <Button type="button" variant="danger" onClick={removePicked} disabled={deleting}>
                            <Trash2 size={16} />
                            {fmt(copy.delete.button, { count: picked.length })}
                        </Button>
                    )}
                    {canEdit && (
                        <Button type="button" variant="outline" onClick={() => setShowAddForm(!showAddForm)}>
                            <Plus size={16} />
                            {copy.add.button}
                        </Button>
                    )}
                </div>
            </RecordCount>

            <DataTable
                columns={columns}
                rows={sorted}
                getRowKey={eventKey}
                mobileTitle={(row) => (
                    <>
                        <span className="font-medium text-fg-strong">{row.operator_name || row.OGGETTO}</span>{' '}
                        <span className="font-mono text-xs text-fg-muted">{row.OGGETTO}</span>
                    </>
                )}
                sort={sort}
                onSort={toggleSort}
                loading={list.loading}
                error={list.error}
                fill
                emptyMessage={list.applied ? APP_COPY.analytics.common.noResults : APP_COPY.analytics.applyFiltersHint}
            />

        </div>
    );
}
