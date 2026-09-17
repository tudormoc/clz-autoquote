'use client';

import { useState, useMemo, useEffect } from 'react';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Search, X, ArrowUpDown, ArrowUp, ArrowDown, CalendarCheck, Loader2 } from 'lucide-react';
import {
    getMonthlyHoursAction,
    updateHoursDistributionAction,
    getPresenceRulesAction,
    prefillAbsencesAction,
    type PrefillResult,
} from '@/app/presence/presence-actions';
import type { OperatorHoursRow, HoursDistributionField } from '@/types';
import { APP_COPY, fmt } from '@/locales';
import {
    DEFAULT_PRESENCE_RULES,
    rulesForOperator,
    EMPLOYEE_CATEGORIES,
    OTHER_CATEGORY,
    OTHER_CATEGORY_KEY,
    DEFAULT_ACTIVE_CATEGORY_KEYS,
    PREFILL_CATEGORIES,
    normalizeReparto,
    todayLocal,
    getCoveredHours,
    getDayStatus,
    isCoverageAnomaly,
    resolveEditSideEffects,
    type PresenceRulesConfig,
} from '@/lib/presence';
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

/** Row status filter: anomaly = past working day not fully covered; ok = everything else. */
type RowStatusKey = 'anomaly' | 'ok';
const ALL_STATUSES: readonly RowStatusKey[] = ['anomaly', 'ok'];

type PrefillSummary = Pick<PrefillResult, 'totalCount' | 'absencesCount' | 'partialCount' | 'fullCount' | 'overflowCount' | 'extraCount' | 'fixedCount'>;

function toggleInSet<T>(set: Set<T>, key: T): Set<T> {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
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

const fieldLabelOf = (field: keyof typeof APP_COPY.analytics.monthlySummary.fields) =>
    APP_COPY.analytics.monthlySummary.fields[field] ?? field;

/** Visual status badge for the workday coverage check (rules.coveredFields must sum to rules.workdayHours) */
function CoverageBadge({ row, todayStr, rules: baseRules }: { row: OperatorHoursRow; todayStr: string; rules: PresenceRulesConfig }) {
    const copy = APP_COPY.analytics.monthlySummary.verification;
    const rules = rulesForOperator(row.operatore, baseRules);
    const status = getDayStatus(row, todayStr, rules);
    const covered = status.covered.toFixed(1);
    const expected = rules.workdayHours.toFixed(1);

    if (status.dayKind === 'extra') {
        if (status.kind === 'ok' || (status.kind === 'future' && status.covered > 0)) {
            return (
                <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-950/40 text-blue-300 border border-blue-800/40"
                    title={fmt(copy.badgeExtraOkTitle, { covered, field: fieldLabelOf(rules.extraField) })}
                >
                    {covered}h ✓
                </span>
            );
        }
        if (status.kind === 'empty') {
            return (
                <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-600/70"
                    title={copy.badgeExtraEmptyTitle}
                >
                    ⚠️ 0.0h
                </span>
            );
        }
        return <span className="text-zinc-600 italic">—</span>;
    }

    switch (status.kind) {
        case 'non-working':
            return status.covered > 0 ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-950/40 text-blue-300 border border-blue-800/40">
                    {covered}h
                </span>
            ) : (
                <span className="text-zinc-600 italic">—</span>
            );
        case 'ok':
            return (
                <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-700/60"
                    title={fmt(copy.badgeOkTitle, { h: expected })}
                >
                    {expected}h ✓
                </span>
            );
        case 'mismatch':
            return (
                <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-600/70"
                    title={fmt(copy.badgeMismatchTitle, { covered, h: expected })}
                >
                    ⚠️ {covered}h
                </span>
            );
        case 'empty':
            return (
                <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono text-zinc-500 bg-zinc-900/80 border border-zinc-800"
                    title={copy.badgeEmptyTitle}
                >
                    0.0h
                </span>
            );
        case 'future':
            // Today / future: informational only, never counted as anomaly
            if (status.covered === rules.workdayHours) {
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-700/60">
                        {expected}h ✓
                    </span>
                );
            }
            return status.covered > 0 ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-600/70">
                    {covered}h
                </span>
            ) : (
                <span className="text-zinc-600 italic">—</span>
            );
    }
}

export function MonthlyHoursTable() {
    const copy = APP_COPY.analytics.monthlySummary;
    const todayStr = useMemo(() => todayLocal(), []);

    const [rules, setRules] = useState<PresenceRulesConfig>(DEFAULT_PRESENCE_RULES);
    const [filters, setFilters] = useState<Filters>({ dateFrom: todayStr, dateTo: todayStr, operator: '' });
    const [appliedFilters, setAppliedFilters] = useState<Filters | null>(null);
    const [data, setData] = useState<OperatorHoursRow[]>([]);
    const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set(DEFAULT_ACTIVE_CATEGORY_KEYS));
    const [loading, setLoading] = useState(false);
    const [checkingPrefill, setCheckingPrefill] = useState(false);
    const [confirmPrefillSummary, setConfirmPrefillSummary] = useState<PrefillSummary | null>(null);
    const [prefilling, setPrefilling] = useState(false);
    const [prefillFeedback, setPrefillFeedback] = useState<string | null>(null);
    const [activeStatuses, setActiveStatuses] = useState<Set<RowStatusKey>>(new Set(ALL_STATUSES));
    const [error, setError] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ column: 'data', direction: 'asc' });

    useEffect(() => {
        getPresenceRulesAction().then((res) => {
            if (res.success) setRules(res.rules);
        });
    }, []);

    const hasAltro = useMemo(
        () => data.some((r) => normalizeReparto(r.reparto) === OTHER_CATEGORY_KEY),
        [data]
    );

    const visibleCategories = useMemo(
        () => (hasAltro ? [...EMPLOYEE_CATEGORIES, OTHER_CATEGORY] : EMPLOYEE_CATEGORIES),
        [hasAltro]
    );

    const toggleCategory = (key: string) => {
        setActiveCategories((prev) => toggleInSet(prev, key));
    };

    const toggleStatus = (key: RowStatusKey) => {
        setActiveStatuses((prev) => toggleInSet(prev, key));
    };

    const loadData = async (f: Filters) => {
        const result = await getMonthlyHoursAction(f.dateFrom, f.dateTo, f.operator || undefined);
        if (result.success) {
            setData(result.data);
        } else {
            setError(result.error ?? 'Errore nel caricamento dati');
        }
    };

    const handleApplyFilters = async () => {
        setLoading(true);
        setAppliedFilters(filters);
        setError(null);
        try {
            await loadData(filters);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClearFilters = () => {
        setFilters({ dateFrom: todayStr, dateTo: todayStr, operator: '' });
        setAppliedFilters(null);
        setData([]);
        setActiveCategories(new Set(DEFAULT_ACTIVE_CATEGORY_KEYS));
        setActiveStatuses(new Set(ALL_STATUSES));
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
            if (!res.success) {
                alert(`Errore: ${res.error}`);
                return false;
            }

            // Side effects (e.g. permesso clears ferie) are decided by the rules module
            const currentRow = data.find((r) => r.operatore === operatore && r.data === dataStr);
            const patch = currentRow ? resolveEditSideEffects(currentRow, field, newValue, rulesForOperator(operatore, rules)) : {};
            for (const [patchField, patchValue] of Object.entries(patch)) {
                await updateHoursDistributionAction(operatore, dataStr, patchField as HoursDistributionField, patchValue ?? null);
            }

            setData((prev) =>
                prev.map((row) =>
                    row.operatore === operatore && row.data === dataStr
                        ? ({ ...row, [field]: newValue, ...patch } as OperatorHoursRow)
                        : row
                )
            );
            return true;
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
            if (!res.success) {
                alert(`Errore: ${res.error}`);
            } else if (res.totalCount > 0) {
                if (res.rules) setRules(res.rules);
                setConfirmPrefillSummary(res);
            } else {
                setPrefillFeedback(res.message ?? copy.prefill.noCandidates);
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
                setPrefillFeedback(`${res.totalCount} ${fmt(copy.prefill.successMessage, { h: rules.workdayHours })}`);
                await loadData(appliedFilters);
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
        const byName = (a: OperatorHoursRow, b: OperatorHoursRow) =>
            String(a.nome || a.operatore).toLowerCase().localeCompare(String(b.nome || b.operatore).toLowerCase());

        return [...filteredData].sort((a, b) => {
            if (sortConfig.column === 'controllo_8h') {
                const sumA = getCoveredHours(a, rules);
                const sumB = getCoveredHours(b, rules);
                if (sumA !== sumB) {
                    return sortConfig.direction === 'asc' ? sumA - sumB : sumB - sumA;
                }
                return byName(a, b);
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
            return byName(a, b);
        });
    }, [filteredData, sortConfig, rules]);

    const isAnomaly = (r: OperatorHoursRow) => isCoverageAnomaly(getDayStatus(r, todayStr, rulesForOperator(r.operatore, rules)));

    const rowStatus = (r: OperatorHoursRow): RowStatusKey => (isAnomaly(r) ? 'anomaly' : 'ok');

    const statusCounts = useMemo(
        () => ({
            anomaly: filteredData.filter(isAnomaly).length,
            ok: filteredData.filter((r) => !isAnomaly(r)).length,
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [filteredData, todayStr, rules]
    );
    const mismatchCount = statusCounts.anomaly;

    const displayedData = useMemo(
        () => sortedData.filter((r) => activeStatuses.has(rowStatus(r))),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [sortedData, activeStatuses, todayStr, rules]
    );

    const workdayLabel = `${rules.workdayHours.toFixed(1)}h`;
    const pauseLabel = rules.pauseMinutes % 60 === 0 ? `${rules.pauseMinutes / 60}h` : `${rules.pauseMinutes}min`;
    const fieldLabel = fieldLabelOf;
    const workingDaysLabel = rules.workingDays.map((d) => copy.weekdays[d - 1]).join(', ');
    const extraDaysLabel = rules.extraDays.map((d) => copy.weekdays[d - 1]).join(', ');
    const standardCategoriesLabel = PREFILL_CATEGORIES.filter((c) => c.profile === 'standard').map((c) => c.label).join(', ');
    const fixedCategories = PREFILL_CATEGORIES.filter((c) => c.profile === 'fixed');
    const fixedCategoriesLabel = fixedCategories.map((c) => c.label).join(', ');

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

                    {/* Stato Giornata Selectors */}
                    <div className="mt-4 pt-4 border-t border-zinc-800/80">
                        <label className="block text-xs font-medium text-zinc-400 mb-2">
                            {copy.statusFilter.label}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {ALL_STATUSES.map((key) => {
                                const isActive = activeStatuses.has(key);
                                const count = data.length > 0 ? statusCounts[key] : null;
                                const label = key === 'anomaly'
                                    ? fmt(copy.statusFilter.anomaly, { h: rules.workdayHours })
                                    : copy.statusFilter.ok;
                                const activeClass = key === 'anomaly'
                                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                                    : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300';

                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => toggleStatus(key)}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-colors border cursor-pointer ${
                                            isActive
                                                ? activeClass
                                                : 'bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                                        }`}
                                    >
                                        {key === 'anomaly' ? '⚠️ ' : '✓ '}{label}
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
                    </span>
                    {mismatchCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-amber-950/40 border border-amber-800/60 text-amber-300">
                            ⚠️ {mismatchCount} {fmt(copy.verification.mismatchesFound, { h: rules.workdayHours })}
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-emerald-950/40 border border-emerald-800/60 text-emerald-300">
                            ✓ {fmt(copy.verification.compliant, { h: rules.workdayHours })}
                        </span>
                    )}
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
                                                {fmt(copy.headers.diffHours, { pause: pauseLabel })}
                                                {getSortIcon('ore_totali')}
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSort('controllo_8h')}
                                            className="px-4 py-3 text-right w-32 cursor-pointer hover:text-primary transition-colors"
                                        >
                                            <div className="flex items-center justify-end gap-2">
                                                {fmt(copy.headers.controllo8h, { h: rules.workdayHours })}
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
                                                    presets={rules.feriePresets}
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
                                                    presets={rules.permessoPresets}
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
                                                <CoverageBadge row={row} todayStr={todayStr} rules={rules} />
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-card border border-zinc-800 rounded-lg shadow-2xl max-w-xl w-full max-h-full flex flex-col overflow-hidden">
                        {/* Header (fixed) */}
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0">
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

                        {/* Content (scrolls when taller than the viewport) */}
                        <div className="p-4 space-y-3 text-sm overflow-y-auto flex-1 min-h-0">
                            <p className="text-zinc-200">
                                Trovate <strong className="text-amber-400 font-bold text-base">{confirmPrefillSummary.totalCount}</strong> {copy.prefill.summaryText}
                            </p>

                            {/* Breakdown cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {/* Presenze complete */}
                                <div className="flex items-center justify-between gap-3 p-2.5 rounded bg-zinc-900/80 border border-zinc-800">
                                    <div>
                                        <div className="font-semibold text-xs text-zinc-200">{fmt(copy.prefill.fullTitle, { h: workdayLabel })}</div>
                                        <div className="text-[11px] text-zinc-400">
                                            {fmt(copy.prefill.fullDetail, { h: workdayLabel })}
                                            {confirmPrefillSummary.overflowCount > 0 && (
                                                <span className="text-amber-400 ml-1">
                                                    ({confirmPrefillSummary.overflowCount} {fmt(copy.prefill.overflowDetail, { min: rules.overflowMinHours, field: fieldLabel(rules.overflowField) })})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="font-mono font-bold text-zinc-100 text-sm bg-zinc-800 px-2 py-0.5 rounded">
                                        {confirmPrefillSummary.fullCount}
                                    </span>
                                </div>

                                {/* Presenze parziali */}
                                <div className="flex items-center justify-between gap-3 p-2.5 rounded bg-zinc-900/80 border border-zinc-800">
                                    <div>
                                        <div className="font-semibold text-xs text-zinc-200">{fmt(copy.prefill.partialTitle, { h: workdayLabel })}</div>
                                        <div className="text-[11px] text-zinc-400">{fmt(copy.prefill.partialDetail, { h: workdayLabel, step: rules.ordinarieRounding.step, field: fieldLabel(rules.partialFillField) })}</div>
                                    </div>
                                    <span className="font-mono font-bold text-zinc-100 text-sm bg-zinc-800 px-2 py-0.5 rounded">
                                        {confirmPrefillSummary.partialCount}
                                    </span>
                                </div>

                                {/* Assenze complete */}
                                <div className="flex items-center justify-between gap-3 p-2.5 rounded bg-zinc-900/80 border border-zinc-800">
                                    <div>
                                        <div className="font-semibold text-xs text-zinc-200">{copy.prefill.absencesTitle}</div>
                                        <div className="text-[11px] text-zinc-400">{fmt(copy.prefill.absencesDetail, { h: workdayLabel, field: fieldLabel(rules.absenceField) })}</div>
                                    </div>
                                    <span className="font-mono font-bold text-zinc-100 text-sm bg-zinc-800 px-2 py-0.5 rounded">
                                        {confirmPrefillSummary.absencesCount}
                                    </span>
                                </div>

                                {/* Ore fisse (profilo fixed, es. ufficio) */}
                                {fixedCategories.length > 0 && (
                                    <div className="flex items-center justify-between gap-3 p-2.5 rounded bg-zinc-900/80 border border-zinc-800">
                                        <div>
                                            <div className="font-semibold text-xs text-zinc-200">{fmt(copy.prefill.fixedTitle, { categories: fixedCategoriesLabel })}</div>
                                            <div className="text-[11px] text-zinc-400">{fmt(copy.prefill.fixedDetail, { h: workdayLabel })}</div>
                                        </div>
                                        <span className="font-mono font-bold text-zinc-100 text-sm bg-zinc-800 px-2 py-0.5 rounded">
                                            {confirmPrefillSummary.fixedCount}
                                        </span>
                                    </div>
                                )}

                                {/* Giorni extra */}
                                {rules.extraDays.length > 0 && (
                                    <div className="flex items-center justify-between gap-3 p-2.5 rounded bg-zinc-900/80 border border-zinc-800">
                                        <div>
                                            <div className="font-semibold text-xs text-zinc-200">{fmt(copy.prefill.extraTitle, { days: extraDaysLabel })}</div>
                                            <div className="text-[11px] text-zinc-400">
                                                {fmt(copy.prefill.extraDetail, { max: rules.extraMaxHours, field: fieldLabel(rules.extraField), step: rules.extraRounding.step })}
                                            </div>
                                        </div>
                                        <span className="font-mono font-bold text-zinc-100 text-sm bg-zinc-800 px-2 py-0.5 rounded">
                                            {confirmPrefillSummary.extraCount}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* 8h Rule Guarantee Badge */}
                            <div className="bg-emerald-950/30 border border-emerald-800/40 rounded p-3 text-xs space-y-1">
                                <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                                    <span>✓</span> {fmt(copy.prefill.ruleTitle, { h: workdayLabel })}
                                </div>
                                <div className="text-emerald-400/90 text-[11px]">
                                    {fmt(copy.prefill.ruleDesc, { h: rules.workdayHours, fields: rules.coveredFields.map(fieldLabel).join(' + ') })}
                                </div>
                            </div>

                            {/* Scope rules */}
                            <div className="bg-zinc-950/60 border border-zinc-800/80 rounded p-3 text-xs text-zinc-300 space-y-1 font-mono">
                                <div className="text-zinc-400 font-sans font-medium text-[11px]">Periodo: <span className="text-zinc-100 font-semibold">{appliedFilters?.dateFrom}</span> &rarr; <span className="text-zinc-100 font-semibold">{appliedFilters?.dateTo}</span></div>
                                <div className="text-zinc-400">&bull; {fmt(copy.prefill.workingDaysOnly, { days: workingDaysLabel })}</div>
                                <div className="text-zinc-400">&bull; {copy.prefill.pastDatesOnly}</div>
                                <div className="text-zinc-400">&bull; {copy.prefill.noOverwrite}</div>
                                <div className="text-zinc-400">&bull; {fmt(copy.prefill.categoriesOnly, { categories: standardCategoriesLabel })}</div>
                            </div>
                        </div>

                        {/* Footer (fixed) */}
                        <div className="flex justify-end gap-2 p-4 border-t border-zinc-800 bg-zinc-900/30 flex-shrink-0">
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
