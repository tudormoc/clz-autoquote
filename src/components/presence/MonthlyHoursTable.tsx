'use client';

import { useState, useMemo, useEffect } from 'react';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Search, X, ArrowUpDown, ArrowUp, ArrowDown, CalendarCheck, Loader2 } from 'lucide-react';
import { getTodayDate } from '@/lib/dateUtils';
import {
    getMonthlyHoursAction,
    updateHoursDistributionAction,
    getPresencePresetsAction,
    prefillAbsencesAction,
} from '@/app/presence/presence-actions';
import type { OperatorHoursRow, HoursDistributionField } from '@/types';
import { APP_COPY } from '@/locales';
import { EditableHoursCell } from './EditableHoursCell';
import { PresetSelectCell } from './PresetSelectCell';

type SortColumn = keyof OperatorHoursRow | 'controllo_8h';

interface SortConfig {
    column: SortColumn;
    direction: 'asc' | 'desc';
}

interface Filters {
    dateFrom: string;
    dateTo: string;
    operator: string;
}

interface PrefillSummary {
    totalCount: number;
    absencesCount: number;
    partialCount: number;
    fullCount: number;
    bancaOreCount: number;
}

const BASE_CATEGORIES = [
    { key: '2', label: 'CLZ Produzione' },
    { key: '1001', label: 'Interinali' },
    { key: '3', label: 'CLZ Ufficio' },
];

const DEFAULT_ACTIVE_CATEGORIES = new Set(['2', '1001']);

function normalizeReparto(reparto: string | null): string {
    const r = (reparto ?? '').trim();
    if (r === '2' || r === '3' || r === '1001') return r;
    return 'altro';
}

/** Check if date YYYY-MM-DD falls on Saturday or Sunday */
export function isWeekend(dateStr: string): boolean {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const day = dt.getDay();
    return day === 0 || day === 6;
}

/**
 * Calculates total covered hours for standard 8h workday (Ordinarie + Ferie + Permesso + Malattia).
 */
export function getRow8hSum(row: OperatorHoursRow): number {
    const ord = typeof row.ore_ordinarie === 'number' ? row.ore_ordinarie : parseFloat(String(row.ore_ordinarie ?? '')) || 0;
    const fer = typeof row.ore_ferie === 'number' ? row.ore_ferie : parseFloat(String(row.ore_ferie ?? '')) || 0;
    const per = typeof row.ore_permesso === 'number' ? row.ore_permesso : parseFloat(String(row.ore_permesso ?? '')) || 0;
    const mal = typeof row.ore_malattia === 'number' ? row.ore_malattia : parseFloat(String(row.ore_malattia ?? '')) || 0;

    return Math.round((ord + fer + per + mal) * 10) / 10;
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

/** Visual status badge for 8.0h sum check (Ordinarie + Ferie + Permesso + Malattia) */
function Check8hBadge({ row, todayStr }: { row: OperatorHoursRow; todayStr: string }) {
    const weekend = isWeekend(row.data);
    const isPastWeekday = !weekend && row.data < todayStr;
    const sum = getRow8hSum(row);

    if (weekend) {
        if (sum > 0) {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-950/40 text-blue-300 border border-blue-800/40">
                    {sum.toFixed(1)}h
                </span>
            );
        }
        return <span className="text-zinc-600 italic">—</span>;
    }

    if (sum === 8.0) {
        return (
            <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-700/60"
                title="8.0h esatte (Ordinarie + Ferie + Permesso + Malattia)"
            >
                8.0h ✓
            </span>
        );
    }

    if (sum > 0) {
        return (
            <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-600/70"
                title={`Totale coperto: ${sum.toFixed(1)}h (atteso: 8.0h)`}
            >
                ⚠️ {sum.toFixed(1)}h
            </span>
        );
    }

    if (isPastWeekday) {
        return (
            <span
                className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono text-zinc-500 bg-zinc-900/80 border border-zinc-800"
                title="Nessuna ora coperta per giorno feriale passato"
            >
                0.0h
            </span>
        );
    }

    return <span className="text-zinc-600 italic">—</span>;
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
    const [activeCategories, setActiveCategories] = useState<Set<string>>(DEFAULT_ACTIVE_CATEGORIES);
    const [loading, setLoading] = useState(false);
    const [checkingPrefill, setCheckingPrefill] = useState(false);
    const [confirmPrefillSummary, setConfirmPrefillSummary] = useState<PrefillSummary | null>(null);
    const [prefilling, setPrefilling] = useState(false);
    const [prefillFeedback, setPrefillFeedback] = useState<string | null>(null);
    const [showMismatchesOnly, setShowMismatchesOnly] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        column: 'data',
        direction: 'asc',
    });
    const [feriePresets, setFeriePresets] = useState<string[]>(['FESTA']);
    const [permessoPresets, setPermessoPresets] = useState<string[]>(['ROL', 'VISITA MEDICA', 'LUTTO']);

    useEffect(() => {
        getPresencePresetsAction().then((res) => {
            if (res.success) {
                if (res.feriePresets) setFeriePresets(res.feriePresets);
                if (res.permessoPresets) setPermessoPresets(res.permessoPresets);
            }
        });
    }, []);

    const hasAltro = useMemo(
        () => data.some((r) => normalizeReparto(r.reparto) === 'altro'),
        [data]
    );

    const visibleCategories = useMemo(() => {
        if (hasAltro) {
            return [...BASE_CATEGORIES, { key: 'altro', label: 'Altro' }];
        }
        return BASE_CATEGORIES;
    }, [hasAltro]);

    const toggleCategory = (key: string) => {
        setActiveCategories((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

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
        setActiveCategories(new Set(DEFAULT_ACTIVE_CATEGORIES));
        setError(null);
    };

    const handleUpdateDistribution = async (
        operatore: string,
        dataStr: string,
        field: HoursDistributionField,
        newValue: number | string | null
    ): Promise<boolean> => {
        try {
            const res = await updateHoursDistributionAction(operatore, dataStr, field, newValue);
            if (res.success) {
                // If entering hours in ore_permesso or ore_malattia, automatically reset ore_ferie and causale_ferie if present
                const isPermessoOrMalattia = field === 'ore_permesso' || field === 'ore_malattia';
                const hasPositiveHours = newValue !== null && newValue !== undefined && Number(newValue) > 0;

                let shouldResetFerie = false;
                if (isPermessoOrMalattia && hasPositiveHours) {
                    const currentRow = data.find((r) => r.operatore === operatore && r.data === dataStr);
                    if (
                        currentRow &&
                        ((currentRow.ore_ferie !== null && currentRow.ore_ferie > 0) || currentRow.causale_ferie)
                    ) {
                        shouldResetFerie = true;
                    }
                }

                // If setting causale_ferie (e.g. 'FESTA') and ore_ferie is null or 0, automatically set ore_ferie to 8.0
                let shouldSetFerieHours = false;
                if (field === 'causale_ferie' && newValue) {
                    const currentRow = data.find((r) => r.operatore === operatore && r.data === dataStr);
                    if (currentRow && (!currentRow.ore_ferie || currentRow.ore_ferie === 0)) {
                        shouldSetFerieHours = true;
                    }
                }

                if (shouldResetFerie) {
                    await updateHoursDistributionAction(operatore, dataStr, 'ore_ferie', null);
                    await updateHoursDistributionAction(operatore, dataStr, 'causale_ferie', null);
                }

                if (shouldSetFerieHours) {
                    await updateHoursDistributionAction(operatore, dataStr, 'ore_ferie', 8.0);
                }

                setData((prev) =>
                    prev.map((row) => {
                        if (row.operatore === operatore && row.data === dataStr) {
                            return {
                                ...row,
                                [field]: newValue,
                                ...(shouldResetFerie ? { ore_ferie: null, causale_ferie: null } : {}),
                                ...(shouldSetFerieHours ? { ore_ferie: 8.0 } : {}),
                            };
                        }
                        return row;
                    })
                );
                return true;
            } else {
                alert(`Errore: ${res.error}`);
                return false;
            }
        } catch (err: any) {
            alert(`Errore di rete: ${err.message}`);
            return false;
        }
    };

    const handleCheckPrefill = async () => {
        if (!appliedFilters || checkingPrefill || prefilling) return;
        setCheckingPrefill(true);
        setPrefillFeedback(null);
        try {
            const res = await prefillAbsencesAction(appliedFilters.dateFrom, appliedFilters.dateTo, true);
            if (res.success) {
                if (res.totalCount && res.totalCount > 0) {
                    setConfirmPrefillSummary({
                        totalCount: res.totalCount,
                        absencesCount: res.absencesCount ?? 0,
                        partialCount: res.partialCount ?? 0,
                        fullCount: res.fullCount ?? 0,
                        bancaOreCount: res.bancaOreCount ?? 0,
                    });
                } else {
                    setPrefillFeedback(copy.prefill.noCandidates);
                }
            } else {
                alert(`Errore: ${res.error}`);
            }
        } catch (err: any) {
            alert(`Errore: ${err.message}`);
        } finally {
            setCheckingPrefill(false);
        }
    };

    const handleExecutePrefill = async () => {
        if (!appliedFilters || prefilling) return;
        setPrefilling(true);
        try {
            const res = await prefillAbsencesAction(appliedFilters.dateFrom, appliedFilters.dateTo, false);
            if (res.success) {
                setConfirmPrefillSummary(null);
                setPrefillFeedback(`${res.totalCount} ${copy.prefill.successMessage}`);
                // Reload data to reflect prefilled entries
                const refreshResult = await getMonthlyHoursAction(
                    appliedFilters.dateFrom,
                    appliedFilters.dateTo,
                    appliedFilters.operator || undefined
                );
                if (refreshResult.success) {
                    setData(refreshResult.data);
                }
            } else {
                alert(`Errore: ${res.error}`);
            }
        } catch (err: any) {
            alert(`Errore: ${err.message}`);
        } finally {
            setPrefilling(false);
        }
    };

    const handleSort = (column: SortColumn) => {
        setSortConfig((prev) => {
            if (prev.column === column) {
                return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { column, direction: 'asc' };
        });
    };

    const filteredData = useMemo(() => {
        return data.filter((row) => activeCategories.has(normalizeReparto(row.reparto)));
    }, [data, activeCategories]);

    const sortedData = useMemo(() => {
        return [...filteredData].sort((a, b) => {
            if (sortConfig.column === 'controllo_8h') {
                const sumA = getRow8hSum(a);
                const sumB = getRow8hSum(b);
                if (sumA !== sumB) {
                    return sortConfig.direction === 'asc' ? sumA - sumB : sumB - sumA;
                }
                const nameA = String(a.nome || a.operatore).toLowerCase();
                const nameB = String(b.nome || b.operatore).toLowerCase();
                return nameA.localeCompare(nameB);
            }

            const valA = a[sortConfig.column as keyof OperatorHoursRow];
            const valB = b[sortConfig.column as keyof OperatorHoursRow];

            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;

            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            }

            const strA = String(valA).toLowerCase();
            const strB = String(valB).toLowerCase();
            if (strA !== strB) {
                return sortConfig.direction === 'asc'
                    ? strA.localeCompare(strB)
                    : strB.localeCompare(strA);
            }
            const nameA = String(a.nome || a.operatore).toLowerCase();
            const nameB = String(b.nome || b.operatore).toLowerCase();
            return nameA.localeCompare(nameB);
        });
    }, [filteredData, sortConfig]);

    const todayStr = useMemo(() => getTodayDate(), []);

    const mismatchCount = useMemo(() => {
        return filteredData.filter((r) => {
            if (isWeekend(r.data) || r.data >= todayStr) return false;
            return getRow8hSum(r) !== 8.0;
        }).length;
    }, [filteredData, todayStr]);

    const displayedData = useMemo(() => {
        if (showMismatchesOnly) {
            return sortedData.filter((r) => !isWeekend(r.data) && r.data < todayStr && getRow8hSum(r) !== 8.0);
        }
        return sortedData;
    }, [sortedData, showMismatchesOnly, todayStr]);

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

                    {/* Categoria Dipendente Selectors */}
                    <div className="mt-4 pt-4 border-t border-zinc-800/80">
                        <label className="block text-xs font-medium text-zinc-400 mb-2">
                            Categoria Dipendente
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {visibleCategories.map((cat) => {
                                const isActive = activeCategories.has(cat.key);
                                const count = data.length > 0
                                    ? data.filter((r) => normalizeReparto(r.reparto) === cat.key).length
                                    : null;

                                return (
                                    <button
                                        key={cat.key}
                                        type="button"
                                        onClick={() => toggleCategory(cat.key)}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-colors border cursor-pointer ${
                                            isActive
                                                ? 'bg-primary/10 border-primary/40 text-primary'
                                                : 'bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                                        }`}
                                    >
                                        {cat.label}
                                        {count !== null && (
                                            <span className="ml-1.5 opacity-70">
                                                ({count})
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-4">
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
                        <Button
                            type="button"
                            onClick={handleCheckPrefill}
                            variant="outline"
                            disabled={checkingPrefill || prefilling || loading || appliedFilters === null}
                            className="flex items-center gap-2 border-amber-500/40 text-amber-300 hover:bg-amber-500/20 cursor-pointer"
                        >
                            {checkingPrefill || prefilling ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <CalendarCheck size={16} />
                            )}
                            {copy.prefill.button}
                        </Button>
                        {prefillFeedback && (
                            <span className="text-xs text-amber-400 font-medium ml-2">
                                {prefillFeedback}
                            </span>
                        )}
                    </div>
                </form>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Row count info & 8h Compliance Bar */}
            {appliedFilters !== null && data.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400">
                    <span>
                        {APP_COPY.analytics.common.showing}{' '}
                        <strong className="text-primary">{displayedData.length}</strong>{' '}
                        {APP_COPY.analytics.common.records}
                        {showMismatchesOnly && (
                            <span className="ml-2 text-xs text-amber-400 font-medium">
                                ({copy.verification.showMismatchesOnly})
                            </span>
                        )}
                    </span>
                    <div className="flex items-center gap-2">
                        {mismatchCount > 0 ? (
                            <button
                                type="button"
                                onClick={() => setShowMismatchesOnly(!showMismatchesOnly)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors border ${
                                    showMismatchesOnly
                                        ? 'bg-amber-500/25 border-amber-500 text-amber-200 shadow-sm'
                                        : 'bg-amber-950/40 border-amber-800/60 text-amber-300 hover:bg-amber-900/50'
                                }`}
                            >
                                <span>⚠️ {mismatchCount} {copy.verification.mismatchesFound}</span>
                                <span className="text-[11px] underline ml-1 font-semibold">
                                    {showMismatchesOnly ? copy.verification.showAll : copy.verification.showMismatchesOnly}
                                </span>
                            </button>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-emerald-950/40 border border-emerald-800/60 text-emerald-300">
                                <span>✓ {copy.verification.compliant}</span>
                            </span>
                        )}
                    </div>
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
                                <thead className="bg-zinc-900/50 border-b border-zinc-800 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                    <tr className="whitespace-nowrap">
                                        <th
                                            onClick={() => handleSort('operatore')}
                                            className="px-4 py-3 text-left w-32 cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                {copy.headers.id}
                                                {getSortIcon('operatore')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('matricola')}
                                            className="px-4 py-3 text-left w-36 cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                {copy.headers.codiceSarpNet}
                                                {getSortIcon('matricola')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('nome')}
                                            className="px-4 py-3 text-left min-w-[220px] cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                {copy.headers.operator}
                                                {getSortIcon('nome')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('turno')}
                                            className="px-4 py-3 text-left w-24 cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                Turno
                                                {getSortIcon('turno')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('data')}
                                            className="px-4 py-3 text-left w-28 cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                {copy.headers.date}
                                                {getSortIcon('data')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('ora_inizio')}
                                            className="px-4 py-3 text-left w-32 cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                {copy.headers.firstEntry}
                                                {getSortIcon('ora_inizio')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('ora_fine')}
                                            className="px-4 py-3 text-left w-32 cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                {copy.headers.lastExit}
                                                {getSortIcon('ora_fine')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('ore_ferie')}
                                            className="px-4 py-3 text-right w-28 cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center justify-end gap-2">
                                                {copy.headers.oreFerie}
                                                {getSortIcon('ore_ferie')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('causale_ferie')}
                                            className="px-4 py-3 text-center min-w-[130px] w-36 cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                {copy.headers.causaleFerie}
                                                {getSortIcon('causale_ferie')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('ore_permesso')}
                                            className="px-4 py-3 text-right w-32 cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center justify-end gap-2">
                                                {copy.headers.orePermesso}
                                                {getSortIcon('ore_permesso')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('causale_permesso')}
                                            className="px-4 py-3 text-center min-w-[150px] w-44 cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                {copy.headers.causalePermesso}
                                                {getSortIcon('causale_permesso')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('ore_malattia')}
                                            className="px-4 py-3 text-right w-32 cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center justify-end gap-2">
                                                {copy.headers.oreMalattia}
                                                {getSortIcon('ore_malattia')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('ore_ordinarie')}
                                            className="px-4 py-3 text-right w-32 cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center justify-end gap-2">
                                                {copy.headers.oreOrdinarie}
                                                {getSortIcon('ore_ordinarie')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('ore_totali')}
                                            className="px-4 py-3 text-right w-36 cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center justify-end gap-2">
                                                {copy.headers.diffHours}
                                                {getSortIcon('ore_totali')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('controllo_8h')}
                                            className="px-4 py-3 text-right w-32 cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center justify-end gap-2">
                                                {copy.headers.controllo8h}
                                                {getSortIcon('controllo_8h')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('ore_straordinarie')}
                                            className="px-4 py-3 text-right w-36 cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center justify-end gap-2">
                                                {copy.headers.oreStraordinarie}
                                                {getSortIcon('ore_straordinarie')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('banca_ore')}
                                            className="px-4 py-3 text-right w-28 cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center justify-end gap-2">
                                                {copy.headers.bancaOre}
                                                {getSortIcon('banca_ore')}
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 text-right w-36 text-zinc-500 font-normal">
                                            <div className="flex items-center justify-end gap-2">
                                                {copy.headers.bancaOreMeseN1}
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 text-right w-36 text-zinc-500 font-normal">
                                            <div className="flex items-center justify-end gap-2">
                                                {copy.headers.bancaOreMeseN}
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800">
                                    {displayedData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-zinc-900/30 whitespace-nowrap">
                                            <td className="px-4 py-3 text-sm text-zinc-300 font-mono">
                                                {row.operatore}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-zinc-300 font-mono">
                                                {row.matricola || <span className="text-zinc-600 italic">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-zinc-300 font-medium">
                                                {row.nome || <span className="text-zinc-600 italic">N/A</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <TurnoBadge turno={row.turno} />
                                            </td>
                                            <td className="px-4 py-3 text-sm text-zinc-300 font-mono">
                                                {row.data}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-zinc-300 font-mono">
                                                {row.ora_inizio || <span className="text-zinc-600 italic">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-zinc-300 font-mono">
                                                {row.ora_fine || <span className="text-zinc-600 italic">—</span>}
                                            </td>
                                            {/* Ore Ferie */}
                                            <td className="px-4 py-2 text-sm w-28">
                                                <EditableHoursCell
                                                    value={row.ore_ferie}
                                                    onSave={(val) =>
                                                        handleUpdateDistribution(row.operatore, row.data, 'ore_ferie', val)
                                                    }
                                                />
                                            </td>
                                            {/* Causale Ferie */}
                                            <td className="px-4 py-2 text-sm min-w-[130px] w-36">
                                                <PresetSelectCell
                                                    value={row.causale_ferie}
                                                    presets={feriePresets}
                                                    onSave={(val) =>
                                                        handleUpdateDistribution(row.operatore, row.data, 'causale_ferie', val)
                                                    }
                                                />
                                            </td>
                                            {/* Ore Permesso */}
                                            <td className="px-4 py-2 text-sm w-32">
                                                <EditableHoursCell
                                                    value={row.ore_permesso}
                                                    onSave={(val) =>
                                                        handleUpdateDistribution(row.operatore, row.data, 'ore_permesso', val)
                                                    }
                                                />
                                            </td>
                                            {/* Causale Permesso */}
                                            <td className="px-4 py-2 text-sm min-w-[150px] w-44">
                                                <PresetSelectCell
                                                    value={row.causale_permesso}
                                                    presets={permessoPresets}
                                                    onSave={(val) =>
                                                        handleUpdateDistribution(row.operatore, row.data, 'causale_permesso', val)
                                                    }
                                                />
                                            </td>
                                            {/* Ore Malattia */}
                                            <td className="px-4 py-2 text-sm">
                                                <EditableHoursCell
                                                    value={row.ore_malattia}
                                                    onSave={(val) =>
                                                        handleUpdateDistribution(row.operatore, row.data, 'ore_malattia', val)
                                                    }
                                                />
                                            </td>
                                            {/* Ore Ordinarie */}
                                            <td className="px-4 py-2 text-sm">
                                                <EditableHoursCell
                                                    value={row.ore_ordinarie}
                                                    onSave={(val) =>
                                                        handleUpdateDistribution(row.operatore, row.data, 'ore_ordinarie', val)
                                                    }
                                                />
                                            </td>
                                            {/* Totale Ore (-1h Pausa) */}
                                            <td className="px-4 py-3 text-sm text-zinc-100 font-mono font-semibold text-right">
                                                {(row.ore_totali ?? 0).toFixed(1)}
                                            </td>
                                            {/* Controllo 8h */}
                                            <td className="px-4 py-3 text-right">
                                                <Check8hBadge row={row} todayStr={todayStr} />
                                            </td>
                                            {/* Ore Straordinarie */}
                                            <td className="px-4 py-2 text-sm">
                                                <EditableHoursCell
                                                    value={row.ore_straordinarie}
                                                    onSave={(val) =>
                                                        handleUpdateDistribution(row.operatore, row.data, 'ore_straordinarie', val)
                                                    }
                                                />
                                            </td>
                                            {/* Banca ore */}
                                            <td className="px-4 py-2 text-sm">
                                                <EditableHoursCell
                                                    value={row.banca_ore}
                                                    onSave={(val) =>
                                                        handleUpdateDistribution(row.operatore, row.data, 'banca_ore', val)
                                                    }
                                                />
                                            </td>
                                            {/* Banca ore n-1 */}
                                            <td className="px-4 py-3 text-sm text-zinc-600 font-mono text-right italic">
                                                —
                                            </td>
                                            {/* Banca ore n */}
                                            <td className="px-4 py-3 text-sm text-zinc-600 font-mono text-right italic">
                                                —
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Confirmation Modal for Precompila e Distribuisci Ore */}
            {confirmPrefillSummary !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-card border border-zinc-800 rounded-lg shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
                            <div className="flex items-center gap-2 text-amber-400">
                                <CalendarCheck size={20} />
                                <h3 className="font-semibold text-zinc-100 text-sm">
                                    {copy.prefill.modalTitle}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setConfirmPrefillSummary(null)}
                                disabled={prefilling}
                                className="text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-5 space-y-4 text-sm">
                            <p className="text-zinc-200">
                                Trovate <strong className="text-amber-400 font-bold text-base">{confirmPrefillSummary.totalCount}</strong> {copy.prefill.summaryText}
                            </p>

                            {/* Breakdown cards */}
                            <div className="grid grid-cols-1 gap-2">
                                {/* Presenze complete */}
                                <div className="flex items-center justify-between p-2.5 rounded bg-zinc-900/80 border border-zinc-800">
                                    <div>
                                        <div className="font-semibold text-xs text-zinc-200">{copy.prefill.fullTitle}</div>
                                        <div className="text-[11px] text-zinc-400">
                                            {copy.prefill.fullDetail}
                                            {confirmPrefillSummary.bancaOreCount > 0 && (
                                                <span className="text-amber-400 ml-1">
                                                    ({confirmPrefillSummary.bancaOreCount} {copy.prefill.bancaOreDetail})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="font-mono font-bold text-zinc-100 text-sm bg-zinc-800 px-2 py-0.5 rounded">
                                        {confirmPrefillSummary.fullCount}
                                    </span>
                                </div>

                                {/* Presenze parziali */}
                                <div className="flex items-center justify-between p-2.5 rounded bg-zinc-900/80 border border-zinc-800">
                                    <div>
                                        <div className="font-semibold text-xs text-zinc-200">{copy.prefill.partialTitle}</div>
                                        <div className="text-[11px] text-zinc-400">{copy.prefill.partialDetail}</div>
                                    </div>
                                    <span className="font-mono font-bold text-zinc-100 text-sm bg-zinc-800 px-2 py-0.5 rounded">
                                        {confirmPrefillSummary.partialCount}
                                    </span>
                                </div>

                                {/* Assenze complete */}
                                <div className="flex items-center justify-between p-2.5 rounded bg-zinc-900/80 border border-zinc-800">
                                    <div>
                                        <div className="font-semibold text-xs text-zinc-200">{copy.prefill.absencesTitle}</div>
                                        <div className="text-[11px] text-zinc-400">{copy.prefill.absencesDetail}</div>
                                    </div>
                                    <span className="font-mono font-bold text-zinc-100 text-sm bg-zinc-800 px-2 py-0.5 rounded">
                                        {confirmPrefillSummary.absencesCount}
                                    </span>
                                </div>
                            </div>

                            {/* 8h Rule Guarantee Badge */}
                            <div className="bg-emerald-950/30 border border-emerald-800/40 rounded p-3 text-xs space-y-1">
                                <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                                    <span>✓</span> {copy.prefill.rule8hTitle}
                                </div>
                                <div className="text-emerald-400/90 text-[11px]">
                                    {copy.prefill.rule8hDesc}
                                </div>
                            </div>

                            {/* Scope rules */}
                            <div className="bg-zinc-950/60 border border-zinc-800/80 rounded p-3 text-xs text-zinc-300 space-y-1 font-mono">
                                <div className="text-zinc-400 font-sans font-medium text-[11px]">Periodo: <span className="text-zinc-100 font-semibold">{appliedFilters?.dateFrom}</span> &rarr; <span className="text-zinc-100 font-semibold">{appliedFilters?.dateTo}</span></div>
                                <div className="text-zinc-400">&bull; {copy.prefill.weekdaysOnly}</div>
                                <div className="text-zinc-400">&bull; {copy.prefill.pastDatesOnly}</div>
                                <div className="text-zinc-400">&bull; {copy.prefill.noOverwrite}</div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-2 p-4 border-t border-zinc-800 bg-zinc-900/30">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setConfirmPrefillSummary(null)}
                                disabled={prefilling}
                            >
                                Annulla
                            </Button>
                            <Button
                                type="button"
                                onClick={handleExecutePrefill}
                                disabled={prefilling}
                                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-medium"
                            >
                                {prefilling ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <CalendarCheck size={16} />
                                )}
                                {copy.prefill.confirmButton} ({confirmPrefillSummary.totalCount})
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
