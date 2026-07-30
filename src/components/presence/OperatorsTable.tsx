'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Search, X, ArrowUpDown, ArrowUp, ArrowDown, Save, X as XIcon } from 'lucide-react';
import { getOperatorsAction, updateOperatorAction, type OperatorRow } from '@/app/presence/presence-actions';
import { APP_COPY } from '@/locales';

// Column keys that can be sorted
type SortColumn = keyof OperatorRow;

interface SortConfig {
    column: SortColumn;
    direction: 'asc' | 'desc';
}

interface EditingCell {
    operatore: string;
    colName: 'BADGE' | 'NOME' | 'STATO_FISICO';
}

export function OperatorsTable() {
    const [search, setSearch] = useState('');
    const [appliedSearch, setAppliedSearch] = useState<string | undefined>(undefined);
    const [data, setData] = useState<OperatorRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        column: 'OPERATORE',
        direction: 'asc',
    });
    // Set of active STATO_FISICO values — all active by default after load
    const [activeStati, setActiveStati] = useState<Set<string | null>>(new Set());
    const [allStati, setAllStati] = useState<string[]>([]);

    // Editing cell state
    const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
    const [editValue, setEditValue] = useState('');
    const [saving, setSaving] = useState(false);

    const copy = APP_COPY.analytics.operators;

    // ── Derived: visible rows after stato filter ───────────────────────────────

    const visibleRows = useMemo(
        () => data.filter((r) => activeStati.has(r.STATO_FISICO)),
        [data, activeStati]
    );

    // ── Data fetching ──────────────────────────────────────────────────────────

    const handleApplyFilters = async () => {
        setLoading(true);
        setAppliedSearch(search);
        setError(null);

        try {
            const result = await getOperatorsAction(search || undefined);
            if (result.success) {
                const sorted = sortData(result.data, sortConfig);
                setData(sorted);
                if (result.allStati.length > 0) {
                    setAllStati(result.allStati);
                    // Only initialize activeStati if empty (first load)
                    if (activeStati.size === 0) {
                        setActiveStati(new Set(result.allStati));
                    }
                }
            } else {
                setError(result.error ?? 'Errore sconosciuto');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClearFilters = () => {
        setSearch('');
        setAppliedSearch(undefined);
        setData([]);
        setActiveStati(new Set());
        setError(null);
        setEditingCell(null);
    };

    // ── Editing cell ────────────────────────────────────────────────────────────

    const handleEditCell = (operatore: string, colName: 'BADGE' | 'NOME' | 'STATO_FISICO', currentValue: string | null) => {
        setEditingCell({ operatore, colName });
        setEditValue(currentValue ?? '');
    };

    const handleSaveCell = async () => {
        if (!editingCell) return;
        setSaving(true);
        const result = await updateOperatorAction(
            editingCell.operatore,
            editingCell.colName,
            editValue.trim() || null
        );

        if (result.success) {
            setEditingCell(null);
            handleApplyFilters();
        } else {
            alert(`Error: ${result.error}`);
        }
        setSaving(false);
    };

    const handleCancelEdit = () => {
        setEditingCell(null);
        setEditValue('');
    };

    // ── Stato toggle ───────────────────────────────────────────────────────────

    const toggleStato = (stato: string | null) => {
        setActiveStati((prev) => {
            const next = new Set(prev);
            next.has(stato) ? next.delete(stato) : next.add(stato);
            return next;
        });
    };

    // ── Sorting ────────────────────────────────────────────────────────────────

    const sortData = (rows: OperatorRow[], config: SortConfig): OperatorRow[] =>
        [...rows].sort((a, b) => {
            const aVal = a[config.column] ?? '';
            const bVal = b[config.column] ?? '';
            const cmp = String(aVal).localeCompare(String(bVal));
            return config.direction === 'asc' ? cmp : -cmp;
        });

    const handleSort = (column: SortColumn) => {
        const next: SortConfig = {
            column,
            direction: sortConfig.column === column && sortConfig.direction === 'asc' ? 'desc' : 'asc',
        };
        setSortConfig(next);
        setData(sortData(data, next));
    };

    const SortIcon = ({ column }: { column: SortColumn }) => {
        if (sortConfig.column !== column) return <ArrowUpDown size={14} className="opacity-40" />;
        return sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    if (error) {
        return (
            <div className="text-center py-12 text-destructive">
                {APP_COPY.analytics.error}: {error}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="bg-card border border-zinc-800 rounded-lg p-4">
                <form onSubmit={(e) => { e.preventDefault(); handleApplyFilters(); }}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-zinc-400 mb-2">
                                {APP_COPY.analytics.common.search}
                            </label>
                            <Input
                                type="text"
                                placeholder={copy.searchPlaceholder}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Stato Fisico toggle buttons — shown only after data is loaded */}
                    {allStati.length > 0 && (
                        <div className="mt-4">
                            <label className="block text-xs font-medium text-zinc-400 mb-2">
                                {copy.headers.statoFisico}
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {allStati.map((stato) => {
                                    const isActive = activeStati.has(stato);
                                    const label = stato ?? '—';
                                    return (
                                        <button
                                            key={label}
                                            type="button"
                                            onClick={() => toggleStato(stato)}
                                            className={`px-3 py-1 rounded text-xs font-medium transition-colors border ${
                                                isActive
                                                    ? 'bg-primary/10 border-primary/40 text-primary'
                                                    : 'bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2 mt-4">
                        <Button type="submit" className="flex items-center gap-2">
                            <Search size={16} />
                            {APP_COPY.analytics.common.apply}
                        </Button>
                        <Button
                            type="button"
                            onClick={handleClearFilters}
                            variant="secondary"
                            className="flex items-center gap-2"
                        >
                            <X size={16} />
                            {APP_COPY.analytics.common.clear}
                        </Button>
                    </div>
                </form>
            </div>

            {/* Row count & info */}
            {appliedSearch !== undefined && visibleRows.length > 0 && (
                <div className="flex items-center justify-between text-sm text-zinc-400">
                    <span>
                        {APP_COPY.analytics.common.showing}{' '}
                        <strong className="text-primary">{visibleRows.length}</strong>{' '}
                        {APP_COPY.analytics.common.records}
                    </span>
                    <span className="text-xs text-zinc-500">
                        Click on Badge, Nome, or Stato Fisico cells to edit
                    </span>
                </div>
            )}

            {/* Table */}
            {appliedSearch !== undefined && (
                <div className="bg-card border border-zinc-800 rounded-lg">
                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : visibleRows.length === 0 ? (
                        <div className="p-8 text-center text-zinc-500">
                            {copy.noResults}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-zinc-900/50 border-b border-zinc-800">
                                    <tr>
                                        {/* Operatore (ID) */}
                                        <th
                                            onClick={() => handleSort('OPERATORE')}
                                            className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors w-32"
                                        >
                                            <div className="flex items-center gap-2">
                                                {copy.headers.id}
                                                <SortIcon column="OPERATORE" />
                                            </div>
                                        </th>
                                        {/* Badge */}
                                        <th
                                            onClick={() => handleSort('BADGE')}
                                            className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors w-56"
                                        >
                                            <div className="flex items-center gap-2">
                                                {copy.headers.badge}
                                                <SortIcon column="BADGE" />
                                            </div>
                                        </th>
                                        {/* Nome */}
                                        <th
                                            onClick={() => handleSort('NOME')}
                                            className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                {copy.headers.nome}
                                                <SortIcon column="NOME" />
                                            </div>
                                        </th>
                                        {/* Stato Fisico */}
                                        <th
                                            onClick={() => handleSort('STATO_FISICO')}
                                            className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors w-44"
                                        >
                                            <div className="flex items-center gap-2">
                                                {copy.headers.statoFisico}
                                                <SortIcon column="STATO_FISICO" />
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800">
                                    {visibleRows.map((row) => {
                                        const isEditingBadge = editingCell?.operatore === row.OPERATORE && editingCell?.colName === 'BADGE';
                                        const isEditingNome = editingCell?.operatore === row.OPERATORE && editingCell?.colName === 'NOME';
                                        const isEditingStato = editingCell?.operatore === row.OPERATORE && editingCell?.colName === 'STATO_FISICO';

                                        return (
                                            <tr key={row.OPERATORE} className="hover:bg-zinc-900/30">
                                                <td className="px-4 py-3 text-sm font-mono text-zinc-300">
                                                    {row.OPERATORE}
                                                </td>
                                                {/* BADGE */}
                                                <td className="px-4 py-3 text-sm font-mono text-zinc-300">
                                                    {isEditingBadge ? (
                                                        <div className="flex items-center gap-1">
                                                            <Input
                                                                type="text"
                                                                value={editValue}
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                className="h-8 text-xs font-mono w-48"
                                                                autoFocus
                                                            />
                                                            <Button onClick={handleSaveCell} disabled={saving} size="sm" className="h-8 w-8 p-0">
                                                                <Save size={14} />
                                                            </Button>
                                                            <Button onClick={handleCancelEdit} disabled={saving} variant="secondary" size="sm" className="h-8 w-8 p-0">
                                                                <XIcon size={14} />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <span
                                                            onClick={() => handleEditCell(row.OPERATORE, 'BADGE', row.BADGE)}
                                                            className="cursor-pointer hover:bg-zinc-800 px-2 py-1 rounded transition-colors inline-block"
                                                            title="Click to edit"
                                                        >
                                                            {row.BADGE ?? <span className="text-zinc-600 italic">—</span>}
                                                        </span>
                                                    )}
                                                </td>
                                                {/* NOME */}
                                                <td className="px-4 py-3 text-sm text-zinc-300">
                                                    {isEditingNome ? (
                                                        <div className="flex items-center gap-1">
                                                            <Input
                                                                type="text"
                                                                value={editValue}
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                className="h-8 text-xs"
                                                                autoFocus
                                                            />
                                                            <Button onClick={handleSaveCell} disabled={saving} size="sm" className="h-8 w-8 p-0">
                                                                <Save size={14} />
                                                            </Button>
                                                            <Button onClick={handleCancelEdit} disabled={saving} variant="secondary" size="sm" className="h-8 w-8 p-0">
                                                                <XIcon size={14} />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <span
                                                            onClick={() => handleEditCell(row.OPERATORE, 'NOME', row.NOME)}
                                                            className="cursor-pointer hover:bg-zinc-800 px-2 py-1 rounded transition-colors inline-block"
                                                            title="Click to edit"
                                                        >
                                                            {row.NOME ?? <span className="text-zinc-600 italic">N/A</span>}
                                                        </span>
                                                    )}
                                                </td>
                                                {/* STATO FISICO */}
                                                <td className="px-4 py-3 text-sm text-zinc-300">
                                                    {isEditingStato ? (
                                                        <div className="flex items-center gap-1">
                                                            <Select
                                                                value={editValue}
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                options={allStati.map((s) => ({ label: s, value: s }))}
                                                                className="h-8 text-xs w-36"
                                                                autoFocus
                                                            />
                                                            <Button onClick={handleSaveCell} disabled={saving} size="sm" className="h-8 w-8 p-0">
                                                                <Save size={14} />
                                                            </Button>
                                                            <Button onClick={handleCancelEdit} disabled={saving} variant="secondary" size="sm" className="h-8 w-8 p-0">
                                                                <XIcon size={14} />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <span
                                                            onClick={() => handleEditCell(row.OPERATORE, 'STATO_FISICO', row.STATO_FISICO)}
                                                            className="cursor-pointer hover:bg-zinc-800 px-2 py-1 rounded transition-colors inline-block"
                                                            title="Click to edit"
                                                        >
                                                            {row.STATO_FISICO ?? <span className="text-zinc-600 italic">—</span>}
                                                        </span>
                                                    )}
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
    );
}
