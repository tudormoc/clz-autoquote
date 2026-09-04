'use client';

import { useState } from 'react';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Search, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { getTodayDate } from '@/lib/dateUtils';
import { getMonthlyHoursAction } from '@/app/presence/presence-actions';
import type { OperatorHoursRow } from '@/types';
import { APP_COPY } from '@/locales';

type SortColumn = keyof OperatorHoursRow;

interface SortConfig {
    column: SortColumn;
    direction: 'asc' | 'desc';
}

interface Filters {
    dateFrom: string;
    dateTo: string;
    operator: string;
}

/** Turno badge: STD or TURNO2 */
function TurnoBadge({ turno }: { turno: 'STD' | 'TURNO2' }) {
    if (turno === 'TURNO2') {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-950/50 border border-blue-700/50 text-blue-300">
                TURNO2
            </span>
        );
    }
    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-800 border border-zinc-700 text-zinc-400">
            STD
        </span>
    );
}

export function MonthlyHoursTable() {
    const copy = APP_COPY.analytics.monthlySummary;

    const [filters, setFilters] = useState<Filters>({
        dateFrom: getTodayDate(),
        dateTo: getTodayDate(),
        operator: '',
    });
    const [appliedFilters, setAppliedFilters] = useState<Filters | null>(null);
    const [data, setData] = useState<OperatorHoursRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        column: 'data',
        direction: 'desc',
    });

    const handleApplyFilters = async () => {
        setLoading(true);
        setAppliedFilters(filters);
        setError(null);

        try {
            const result = await getMonthlyHoursAction(
                filters.dateFrom,
                filters.dateTo,
                filters.operator || undefined
            );

            if (result.success) {
                setData(result.data);
            } else {
                setError(result.error ?? 'Errore nel caricamento dati');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClearFilters = () => {
        const today = getTodayDate();
        setFilters({ dateFrom: today, dateTo: today, operator: '' });
        setAppliedFilters(null);
        setData([]);
        setError(null);
    };

    const handleSort = (column: SortColumn) => {
        setSortConfig((prev) => {
            if (prev.column === column) {
                return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { column, direction: 'asc' };
        });
    };

    const sortedData = [...data].sort((a, b) => {
        const valA = a[sortConfig.column];
        const valB = b[sortConfig.column];

        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
            return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return sortConfig.direction === 'asc'
            ? strA.localeCompare(strB)
            : strB.localeCompare(strA);
    });

    const getSortIcon = (column: SortColumn) => {
        if (sortConfig.column !== column) {
            return <ArrowUpDown size={14} className="text-zinc-600" />;
        }
        return sortConfig.direction === 'asc' ? (
            <ArrowUp size={14} className="text-primary" />
        ) : (
            <ArrowDown size={14} className="text-primary" />
        );
    };

    return (
        <div className="space-y-6">
            {/* Filters Form */}
            <div className="bg-card border border-zinc-800 rounded-lg p-6">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleApplyFilters();
                    }}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-2">
                                {APP_COPY.analytics.common.dateFrom}
                            </label>
                            <DatePicker
                                value={filters.dateFrom}
                                onChange={(value) => setFilters({ ...filters, dateFrom: value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-2">
                                {APP_COPY.analytics.common.dateTo}
                            </label>
                            <DatePicker
                                value={filters.dateTo}
                                onChange={(value) => setFilters({ ...filters, dateTo: value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-2">
                                {copy.headers.operator}
                            </label>
                            <Input
                                type="text"
                                placeholder={APP_COPY.analytics.operators.searchPlaceholder}
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

            {/* Error Message */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Row count info */}
            {appliedFilters !== null && data.length > 0 && (
                <div className="flex items-center justify-between text-sm text-zinc-400">
                    <span>
                        {APP_COPY.analytics.common.showing}{' '}
                        <strong className="text-primary">{data.length}</strong>{' '}
                        {APP_COPY.analytics.common.records}
                    </span>
                </div>
            )}

            {/* Table */}
            {appliedFilters !== null && (
                <div className="bg-card border border-zinc-800 rounded-lg">
                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : data.length === 0 ? (
                        <div className="p-8 text-center text-zinc-500">
                            {APP_COPY.analytics.common.noResults}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-zinc-900/50 border-b border-zinc-800">
                                    <tr>
                                        <th
                                            onClick={() => handleSort('operatore')}
                                            className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                {copy.headers.id}
                                                {getSortIcon('operatore')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('nome')}
                                            className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                {copy.headers.operator}
                                                {getSortIcon('nome')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('turno')}
                                            className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                Turno
                                                {getSortIcon('turno')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('data')}
                                            className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                {copy.headers.date}
                                                {getSortIcon('data')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('ora_inizio')}
                                            className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                {copy.headers.firstEntry}
                                                {getSortIcon('ora_inizio')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('ora_fine')}
                                            className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                {copy.headers.lastExit}
                                                {getSortIcon('ora_fine')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('ore_totali')}
                                            className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center justify-end gap-2">
                                                {copy.headers.diffHours}
                                                {getSortIcon('ore_totali')}
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800">
                                    {sortedData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-zinc-900/30">
                                            <td className="px-4 py-3 text-sm text-zinc-300 font-mono">
                                                {row.operatore}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-zinc-300">
                                                {row.nome || <span className="text-zinc-600 italic">N/A</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <TurnoBadge turno={row.turno} />
                                            </td>
                                            <td className="px-4 py-3 text-sm text-zinc-300 font-mono">
                                                {row.data}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono">
                                                <div className="flex flex-col">
                                                    <span className="text-zinc-300">{row.ora_inizio}</span>
                                                    <span className="text-[11px] text-zinc-600">att. {row.inizio_atteso}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono">
                                                <div className="flex flex-col">
                                                    <span className="text-zinc-300">{row.ora_fine}</span>
                                                    <span className="text-[11px] text-zinc-600">att. {row.fine_attesa}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-zinc-100 font-mono font-semibold text-right">
                                                {row.ore_totali.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
