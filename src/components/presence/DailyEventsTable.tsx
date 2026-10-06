'use client';

import { useState } from 'react';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Search, X, ArrowUpDown, ArrowUp, ArrowDown, Save, X as XIcon, Trash2, Plus } from 'lucide-react';
import { getTodayDate } from '@/lib/dateUtils';
import { getDailyEventsAction, updateEventAction, getConnectedEventsAction, deleteEventsAction, createEventAction } from '@/app/presence/presence-actions';
import { APP_COPY } from '@/locales';

interface EventRow {
    OGGETTO: string;
    operator_name: string;
    EVENTO: string;
    ORA_EVENTO: string;
}

interface Filters {
    dateFrom: string;
    dateTo: string;
    operator: string;
}

interface SortConfig {
    column: 'OGGETTO' | 'operator_name' | 'EVENTO' | 'ORA_EVENTO';
    direction: 'asc' | 'desc';
}

interface EditingCell {
    rowIdx: number;
    colName: 'ORA_EVENTO';
}

export function DailyEventsTable() {
    const [filters, setFilters] = useState<Filters>({
        dateFrom: getTodayDate(),
        dateTo: getTodayDate(),
        operator: ''
    });
    const [appliedFilters, setAppliedFilters] = useState<Filters | null>(null);
    const [data, setData] = useState<EventRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        column: 'ORA_EVENTO',
        direction: 'asc'
    });
    const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
    const [editValue, setEditValue] = useState('');
    const [editDateValue, setEditDateValue] = useState('');
    const [editTimeValue, setEditTimeValue] = useState('');
    const [saving, setSaving] = useState(false);

    // Delete modal state
    interface DeleteModalItem {
        label: string;
        oraEvento: string;
        oggetto: string;
        task: string;
        tipoOggetto: string;
        evento: string;
    }
    const [deleteModal, setDeleteModal] = useState<{ items: DeleteModalItem[]; checked: boolean[] } | null>(null);
    const [deleting, setDeleting] = useState(false);

    // New event state
    const [showAddForm, setShowAddForm] = useState(false);
    const [newOggetto, setNewOggetto] = useState('98');
    const [newEvento, setNewEvento] = useState('EXT');
    const [newDate, setNewDate] = useState(getTodayDate());
    const [newTime, setNewTime] = useState('17:35:00');
    const [creating, setCreating] = useState(false);

    const handleCreateEvent = async () => {
        if (!newOggetto.trim() || !newEvento.trim() || !newDate || !newTime) return;
        setCreating(true);
        const fullDateTime = `${newDate} ${newTime}`;
        const result = await createEventAction(newOggetto.trim(), newEvento.trim(), fullDateTime);
        if (result.success) {
            setShowAddForm(false);
            handleApplyFilters();
        } else {
            alert(`Error: ${result.error}`);
        }
        setCreating(false);
    };

    const handleApplyFilters = async () => {
        setLoading(true);
        setAppliedFilters(filters);
        setError(null);
        
        try {
            const result = await getDailyEventsAction(
                filters.dateFrom, 
                filters.dateTo, 
                filters.operator
            );
            
            if (result.success) {
                setData(sortData(result.data, sortConfig));
            } else {
                setError(result.error);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClearFilters = () => {
        const clearedFilters = {
            dateFrom: getTodayDate(),
            dateTo: getTodayDate(),
            operator: ''
        };
        setFilters(clearedFilters);
        setAppliedFilters(null);
        setData([]);
    };

    const handleSort = (column: SortConfig['column']) => {
        const newSortConfig: SortConfig = {
            column,
            direction: sortConfig.column === column && sortConfig.direction === 'asc' ? 'desc' : 'asc'
        };
        setSortConfig(newSortConfig);
        setData(sortData([...data], newSortConfig));
    };

    const sortData = (dataToSort: EventRow[], config: SortConfig): EventRow[] => {
        return dataToSort.sort((a, b) => {
            const aVal = a[config.column];
            const bVal = b[config.column];

            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;

            let comparison: number;
            if (config.column === 'ORA_EVENTO') {
                // Use numeric timestamp comparison — localeCompare breaks on JS Date objects
                comparison = new Date(aVal).getTime() - new Date(bVal).getTime();
            } else {
                comparison = String(aVal).localeCompare(String(bVal));
            }
            return config.direction === 'asc' ? comparison : -comparison;
        });
    };

    const getSortIcon = (column: SortConfig['column']) => {
        if (sortConfig.column !== column) {
            return <ArrowUpDown size={14} className="opacity-50" />;
        }
        return sortConfig.direction === 'asc' ?
            <ArrowUp size={14} /> :
            <ArrowDown size={14} />;
    };

    const handleEditCell = (rowIdx: number, colName: 'ORA_EVENTO', currentValue: any) => {
        setEditingCell({ rowIdx, colName });
        
        // Format datetime for editing
        if (colName === 'ORA_EVENTO' && currentValue) {
            const date = new Date(currentValue);
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            const hours = String(date.getUTCHours()).padStart(2, '0');
            const minutes = String(date.getUTCMinutes()).padStart(2, '0');
            const seconds = String(date.getUTCSeconds()).padStart(2, '0');
            
            setEditDateValue(`${year}-${month}-${day}`);
            setEditTimeValue(`${hours}:${minutes}:${seconds}`);
        } else {
            setEditValue(currentValue !== null ? String(currentValue) : '');
        }
    };

    const handleSaveCell = async () => {
        if (!editingCell) return;

        setSaving(true);
        const row = data[editingCell.rowIdx];
        
        // Combine date and time for ORA_EVENTO without timezone conversion
        let finalValue = editValue;
        if (editingCell.colName === 'ORA_EVENTO') {
            // Simply concatenate date and time as-is (no Date object conversion)
            finalValue = `${editDateValue} ${editTimeValue}`;
        }
        
        const result = await updateEventAction(
            row.OGGETTO,
            row.ORA_EVENTO,
            editingCell.colName,
            finalValue
        );
        
        if (result.success) {
            // Update local data
            const newData = [...data];
            newData[editingCell.rowIdx][editingCell.colName] = finalValue as any;
            setData(newData);
            setEditingCell(null);
            
            // Refresh to see actual database value
            handleApplyFilters();
        } else {
            alert(`Error: ${result.error}`);
        }
        setSaving(false);
    };

    const handleCancelEdit = () => {
        setEditingCell(null);
        setEditValue('');
        setEditDateValue('');
        setEditTimeValue('');
    };

    const handleDeleteEvent = async (row: EventRow) => {
        const rawVal = row.ORA_EVENTO as any;
        const rawStr = rawVal instanceof Date ? rawVal.toISOString() : String(row.ORA_EVENTO);
        const rowDate = rawStr.slice(0, 10);
        const rowTimeMs = new Date(row.ORA_EVENTO).getTime();

        // Find all events for this operator on the same day, sorted chronologically
        const dayEvents = data
            .filter(item => {
                const itemVal = item.ORA_EVENTO as any;
                const itemStr = itemVal instanceof Date ? itemVal.toISOString() : String(item.ORA_EVENTO);
                return item.OGGETTO === row.OGGETTO && itemStr.slice(0, 10) === rowDate;
            })
            .sort((a, b) => new Date(a.ORA_EVENTO).getTime() - new Date(b.ORA_EVENTO).getTime());

        // Find closest partner event
        let partnerEvent: EventRow | undefined = undefined;
        if (row.EVENTO === 'EXT') {
            partnerEvent = dayEvents
                .filter(e => e.EVENTO === 'ENT' && new Date(e.ORA_EVENTO).getTime() <= rowTimeMs)
                .pop();
        } else if (row.EVENTO === 'ENT') {
            partnerEvent = dayEvents
                .find(e => e.EVENTO === 'EXT' && new Date(e.ORA_EVENTO).getTime() >= rowTimeMs);
        }

        // Fetch all connected events in this timeframe from the database
        const res = await getConnectedEventsAction(row.OGGETTO, row.ORA_EVENTO, partnerEvent?.ORA_EVENTO);
        if (res.success && res.data) {
            const items = res.data.map((evt: any) => {
                const isPresenza = evt.TASK === 'presenza';
                const isStato = evt.TASK === 'stato';
                const eventType = String(evt.EVENTO).trim();

                // Build a user-friendly label
                let description = '';
                if (isPresenza) {
                    description = eventType === 'ENT' ? 'Entry' : 'Exit';
                } else if (isStato) {
                    description = `Machine State: ${eventType}`;
                } else {
                    description = `${eventType} (Job: ${evt.TASK})`;
                }

                return {
                    label: `${evt.TASK}  –  ${formatDateTime(evt.ORA_EVENTO)}  –  ${description}`,
                    oraEvento: evt.ORA_EVENTO,
                    oggetto: evt.OGGETTO,
                    task: evt.TASK,
                    tipoOggetto: evt.TIPO_OGGETTO,
                    evento: evt.EVENTO
                };
            });

            setDeleteModal({ items, checked: items.map(() => true) });
        } else {
            // Fallback to simple local items
            const items = [
                {
                    label: `${row.EVENTO}  –  ${formatDateTime(row.ORA_EVENTO)}  –  ${row.EVENTO === 'ENT' ? 'Entry' : 'Exit'}`,
                    oraEvento: row.ORA_EVENTO,
                    oggetto: row.OGGETTO,
                    task: 'presenza',
                    tipoOggetto: 'OPE',
                    evento: row.EVENTO
                }
            ];
            if (partnerEvent) {
                items.push({
                    label: `${partnerEvent.EVENTO}  –  ${formatDateTime(partnerEvent.ORA_EVENTO)}  –  ${partnerEvent.EVENTO === 'ENT' ? 'Entry' : 'Exit'}`,
                    oraEvento: partnerEvent.ORA_EVENTO,
                    oggetto: partnerEvent.OGGETTO,
                    task: 'presenza',
                    tipoOggetto: 'OPE',
                    evento: partnerEvent.EVENTO
                });
            }
            setDeleteModal({ items, checked: items.map(() => true) });
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteModal || !data.length) return;
        setDeleting(true);
        const toDelete = deleteModal.items.filter((_, i) => deleteModal.checked[i]);
        
        // Call batch delete action
        const result = await deleteEventsAction(data[0].OGGETTO, toDelete);
        if (result.success) {
            setDeleteModal(null);
            handleApplyFilters();
        } else {
            alert(`Error: ${result.error}`);
        }
        setDeleting(false);
    };

    const formatDateTime = (dateTime: string) => {
        // Display raw database time without timezone conversion
        const date = new Date(dateTime);
        
        // Get UTC components to avoid timezone conversion
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');
        
        return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
    };

    if (error) {
        return (
            <div className="text-center py-12 text-danger">
                {APP_COPY.analytics.error}: {error}
            </div>
        );
    }

    return (
        <>
        <div className="space-y-4">
            {/* Filters */}
            <div className="bg-card border border-border rounded-lg p-4">
                <form onSubmit={(e) => { e.preventDefault(); handleApplyFilters(); }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-fg-muted mb-2">
                                {APP_COPY.analytics.common.dateFrom}
                            </label>
                            <DatePicker
                                value={filters.dateFrom}
                                onChange={(value) => setFilters({ ...filters, dateFrom: value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-fg-muted mb-2">
                                {APP_COPY.analytics.common.dateTo}
                            </label>
                            <DatePicker
                                value={filters.dateTo}
                                onChange={(value) => setFilters({ ...filters, dateTo: value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-fg-muted mb-2">
                                Operator (Code or Name)
                            </label>
                            <Input
                                type="text"
                                placeholder="e.g. OP01 or Mario, or OP01,OP02"
                                value={filters.operator}
                                onChange={(e) => setFilters({ ...filters, operator: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <Button type="submit" className="flex items-center gap-2">
                            <Search size={16} />
                            {APP_COPY.analytics.common.apply}
                        </Button>
                        <Button type="button" onClick={handleClearFilters} variant="secondary" className="flex items-center gap-2">
                            <X size={16} />
                            {APP_COPY.analytics.common.clear}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => setShowAddForm(!showAddForm)}
                            variant="secondary"
                            className="flex items-center gap-2 border-primary/40 text-primary hover:bg-primary/10 ml-auto"
                        >
                            <Plus size={16} />
                            Add Event
                        </Button>
                    </div>
                </form>

                {/* Add Event Form */}
                {showAddForm && (
                    <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                        <div>
                            <label className="block text-xs font-medium text-fg-muted mb-1">
                                Operator (Oggetto)
                            </label>
                            <Input
                                type="text"
                                value={newOggetto}
                                onChange={(e) => setNewOggetto(e.target.value)}
                                placeholder="e.g. 98"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-fg-muted mb-1">
                                Evento
                            </label>
                            <Select
                                value={newEvento}
                                onChange={(e) => setNewEvento(e.target.value)}
                                options={[
                                    { label: 'ENT', value: 'ENT' },
                                    { label: 'EXT', value: 'EXT' }
                                ]}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-fg-muted mb-1">
                                Date
                            </label>
                            <DatePicker
                                value={newDate}
                                onChange={setNewDate}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-fg-muted mb-1">
                                Time
                            </label>
                            <Input
                                type="time"
                                step="1"
                                value={newTime}
                                onChange={(e) => setNewTime(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleCreateEvent} disabled={creating} className="flex-1">
                                Save
                            </Button>
                            <Button onClick={() => setShowAddForm(false)} variant="secondary">
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Stats */}
            {appliedFilters !== null && data.length > 0 && (
                <div className="flex items-center justify-between text-sm text-fg-muted">
                    <span>
                        {APP_COPY.analytics.common.showing} <strong className="text-primary">{data.length}</strong> {APP_COPY.analytics.common.records}
                    </span>
                    <span className="text-xs text-fg-subtle">
                        Click on ORA_EVENTO cells to edit
                    </span>
                </div>
            )}

            {/* Results */}
            {appliedFilters !== null && (
                <div className="bg-card border border-border rounded-lg">
                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="p-8 text-center text-fg-subtle">
                            {APP_COPY.analytics.common.noResults}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-card/50 border-b border-border">
                                    <tr>
                                        <th 
                                            onClick={() => handleSort('OGGETTO')}
                                            className="px-4 py-3 text-left text-xs font-semibold text-fg-muted uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                Oggetto
                                                {getSortIcon('OGGETTO')}
                                            </div>
                                        </th>
                                        <th 
                                            onClick={() => handleSort('operator_name')}
                                            className="px-4 py-3 text-left text-xs font-semibold text-fg-muted uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                Operator Name
                                                {getSortIcon('operator_name')}
                                            </div>
                                        </th>
                                        <th 
                                            onClick={() => handleSort('EVENTO')}
                                            className="px-4 py-3 text-left text-xs font-semibold text-fg-muted uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                Evento
                                                {getSortIcon('EVENTO')}
                                            </div>
                                        </th>
                                        <th 
                                            onClick={() => handleSort('ORA_EVENTO')}
                                            className="px-4 py-3 text-left text-xs font-semibold text-fg-muted uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                Ora Evento
                                                {getSortIcon('ORA_EVENTO')}
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-fg-muted uppercase tracking-wider w-16">
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {data.map((row, idx) => {
                                        const isEditingOraEvento = editingCell?.rowIdx === idx && editingCell?.colName === 'ORA_EVENTO';

                                        return (
                                            <tr key={idx} className="hover:bg-card/30">
                                                <td className="px-4 py-3 text-sm text-fg-secondary font-mono">
                                                    {row.OGGETTO}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-fg-secondary">
                                                    {row.operator_name || <span className="text-fg-faint italic">N/A</span>}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-fg-secondary">
                                                    {row.EVENTO}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-fg-secondary font-mono">
                                                    {isEditingOraEvento ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex items-center gap-1 bg-card border border-border-strong rounded px-2 py-1">
                                                                <Input
                                                                    type="date"
                                                                    value={editDateValue}
                                                                    onChange={(e) => setEditDateValue(e.target.value)}
                                                                    className="h-7 text-xs border-0 bg-transparent p-0 w-[110px] focus:ring-0"
                                                                    autoFocus
                                                                />
                                                                <span className="text-fg-faint">|</span>
                                                                <Input
                                                                    type="time"
                                                                    step="1"
                                                                    value={editTimeValue}
                                                                    onChange={(e) => setEditTimeValue(e.target.value)}
                                                                    className="h-7 text-xs border-0 bg-transparent p-0 w-[90px] focus:ring-0"
                                                                />
                                                            </div>
                                                            <Button
                                                                onClick={handleSaveCell}
                                                                disabled={saving}
                                                                size="sm"
                                                                className="h-7 w-7 p-0 bg-success-600 hover:bg-success-700"
                                                            >
                                                                <Save size={12} />
                                                            </Button>
                                                            <Button
                                                                onClick={handleCancelEdit}
                                                                disabled={saving}
                                                                variant="secondary"
                                                                size="sm"
                                                                className="h-7 w-7 p-0"
                                                            >
                                                                <XIcon size={12} />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <span
                                                            onClick={() => handleEditCell(idx, 'ORA_EVENTO', row.ORA_EVENTO)}
                                                            className="cursor-pointer hover:bg-muted px-2 py-1 rounded transition-colors inline-block"
                                                            title="Click to edit"
                                                        >
                                                            {formatDateTime(row.ORA_EVENTO)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => handleDeleteEvent(row)}
                                                        className="p-1 text-fg-subtle hover:text-danger hover:bg-danger/10 rounded transition-colors"
                                                        title="Delete event"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Delete confirmation modal */}
        {deleteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/60 backdrop-blur-sm">
                <div className="bg-card border border-border-strong rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
                    <h3 className="text-base font-semibold text-fg-strong mb-1">Delete events</h3>
                    <p className="text-xs text-fg-muted mb-4">Select the events to delete, then press OK.</p>
                    <div className="space-y-2 mb-6">
                        {deleteModal.items.map((item, i) => (
                            <label key={i} className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={deleteModal.checked[i]}
                                    onChange={() => {
                                        const next = [...deleteModal.checked];
                                        next[i] = !next[i];
                                        setDeleteModal({ ...deleteModal, checked: next });
                                    }}
                                    className="w-4 h-4 accent-danger-500 cursor-pointer"
                                />
                                <span className="text-sm text-fg-soft group-hover:text-fg-strong transition-colors font-mono">
                                    {item.label}
                                </span>
                            </label>
                        ))}
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button
                            onClick={() => setDeleteModal(null)}
                            className="px-4 py-2 rounded-lg text-sm text-fg-secondary hover:text-fg-strong hover:bg-muted-strong transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirmDelete}
                            disabled={deleting || deleteModal.checked.every(c => !c)}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-danger-600 hover:bg-danger-500 disabled:opacity-40 disabled:cursor-not-allowed text-fg-strong transition-colors"
                        >
                            {deleting ? 'Deleting...' : 'OK'}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
