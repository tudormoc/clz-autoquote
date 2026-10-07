'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Loader2 } from 'lucide-react';
import {
    getMonthlyHoursAction,
    getPresenceRulesAction,
    updateHoursDistributionAction,
} from '@/app/presence/presence-actions';
import { byOperatorName, monthlyHoursColumns, monthlyHoursSortColumns } from '@/components/presence/monthlyHoursColumns';
import { PrefillConfirmDialog } from '@/components/presence/PrefillConfirmDialog';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { DateRangeFields } from '@/components/ui/DateRangeFields';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { RecordCount } from '@/components/ui/RecordCount';
import { SearchField } from '@/components/ui/SearchField';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TableCell, TableRow } from '@/components/ui/Table';
import { MissingValue } from '@/components/ui/TableCells';
import { ToggleChips } from '@/components/ui/ToggleChips';
import { useClientSort } from '@/hooks/useClientSort';
import { useListQuery } from '@/hooks/useListQuery';
import { usePrefillAbsences } from '@/hooks/usePrefillAbsences';
import {
    DEFAULT_ACTIVE_CATEGORY_KEYS,
    DEFAULT_PRESENCE_RULES,
    EMPLOYEE_CATEGORIES,
    OTHER_CATEGORY,
    OTHER_CATEGORY_KEY,
    getCoveredHours,
    getDayStatus,
    isCoverageAnomaly,
    normalizeHours,
    normalizeReparto,
    resolveEditSideEffects,
    rulesForOperator,
    toHours,
    todayLocal,
    type PresenceRulesConfig,
} from '@/lib/presence';
import { notify } from '@/lib/notify';
import { toggleInSet } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';
import type { HoursDistributionField, OperatorHoursRow } from '@/types';

interface Filters {
    dateFrom: string;
    dateTo: string;
    operator: string;
}

/** Row status filter: anomaly = past working day not fully covered; ok = everything else */
type RowStatusKey = 'anomaly' | 'ok';
const ALL_STATUSES: readonly RowStatusKey[] = ['anomaly', 'ok'];

const copy = APP_COPY.analytics.monthlySummary;

/** Footer cell under each column after the label: a total, an empty cell (causali) or the not-yet-available mark */
type FooterCell = { total: (row: OperatorHoursRow, rules: PresenceRulesConfig) => number | string | null; decimals?: number } | 'blank' | 'missing';

/** In table order; text presets such as 'FESTA' count as 0 */
const FOOTER_CELLS: FooterCell[] = [
    { total: (row) => row.ore_ferie },
    'blank',
    { total: (row) => row.ore_permesso },
    'blank',
    { total: (row) => row.ore_malattia },
    { total: (row) => row.ore_ordinarie },
    { total: (row) => row.ore_totali, decimals: 2 },
    { total: (row, rules) => getCoveredHours(row, rulesForOperator(row.operatore, rules)) },
    { total: (row) => row.ore_straordinarie },
    { total: (row) => row.banca_ore },
    'missing',
    'missing',
];
/** Columns spanned by the "Totale" label (operator, codes, shift, date, times) */
const LABEL_COLUMNS = 7;

export function MonthlyHoursTable() {
    const todayStr = useMemo(() => todayLocal(), []);
    const [rules, setRules] = useState<PresenceRulesConfig>(DEFAULT_PRESENCE_RULES);
    const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set(DEFAULT_ACTIVE_CATEGORY_KEYS));
    const [activeStatuses, setActiveStatuses] = useState<Set<RowStatusKey>>(new Set(ALL_STATUSES));

    useEffect(() => {
        getPresenceRulesAction().then((res) => {
            if (res.success) setRules(res.rules);
        });
    }, []);

    const list = useListQuery({
        initialFilters: (): Filters => ({ dateFrom: todayLocal(), dateTo: todayLocal(), operator: '' }),
        load: (f: Filters) => getMonthlyHoursAction(f.dateFrom, f.dateTo, f.operator || undefined),
    });
    const { rows, setRows } = list;

    const prefill = usePrefillAbsences({ period: list.applied, rules, onRules: setRules, onDone: list.reload });

    const sortColumns = useMemo(() => monthlyHoursSortColumns(rules), [rules]);
    const { sorted, sort, toggleSort } = useClientSort(rows, sortColumns, { column: 'data', direction: 'asc' }, byOperatorName);

    const isAnomaly = (row: OperatorHoursRow) =>
        isCoverageAnomaly(getDayStatus(row, todayStr, rulesForOperator(row.operatore, rules)));

    const inCategory = sorted.filter((row) => activeCategories.has(normalizeReparto(row.reparto)));
    const anomalyCount = inCategory.filter(isAnomaly).length;
    const statusCounts: Record<RowStatusKey, number> = { anomaly: anomalyCount, ok: inCategory.length - anomalyCount };
    const displayed = inCategory.filter((row) => activeStatuses.has(isAnomaly(row) ? 'anomaly' : 'ok'));

    const hasData = rows.length > 0;
    const hasOther = rows.some((row) => normalizeReparto(row.reparto) === OTHER_CATEGORY_KEY);
    const categories = hasOther ? [...EMPLOYEE_CATEGORIES, OTHER_CATEGORY] : EMPLOYEE_CATEGORIES;

    const saveHours = async (row: OperatorHoursRow, field: HoursDistributionField, value: number | string | null): Promise<boolean> => {
        const fail = (error: unknown) => {
            notify.failure(error);
            return false;
        };
        try {
            const res = await updateHoursDistributionAction(row.operatore, row.data, field, value);
            if (!res.success) return fail(res.error);

            // Side effects (e.g. permesso clears ferie) are decided by the rules module
            const patch = resolveEditSideEffects(row, field, value, rulesForOperator(row.operatore, rules));
            for (const [patchField, patchValue] of Object.entries(patch)) {
                await updateHoursDistributionAction(row.operatore, row.data, patchField as HoursDistributionField, patchValue ?? null);
            }

            setRows((prev) =>
                prev.map((r) =>
                    r.operatore === row.operatore && r.data === row.data ? ({ ...r, [field]: value, ...patch } as OperatorHoursRow) : r
                )
            );
            return true;
        } catch (err) {
            return fail(err);
        }
    };

    const columns = monthlyHoursColumns({ rules, todayStr, onSave: saveHours });

    const footer = (
        <TableRow className="text-xs font-semibold hover:bg-transparent">
            <TableCell colSpan={LABEL_COLUMNS} className="py-2 text-fg-muted">
                {copy.totals.label}
                <span className="ml-2 font-normal text-fg-subtle">
                    ({displayed.length} {APP_COPY.common.records})
                </span>
            </TableCell>
            {FOOTER_CELLS.map((cell, i) => (
                <TableCell key={i} className="py-2 text-right font-mono text-fg">
                    {cell === 'missing' ? (
                        <MissingValue />
                    ) : cell === 'blank' ? null : (
                        normalizeHours(displayed.reduce((sum, row) => sum + toHours(cell.total(row, rules)), 0)).toFixed(cell.decimals ?? 1)
                    )}
                </TableCell>
            ))}
        </TableRow>
    );

    return (
        <div className="space-y-6">
            <FilterPanel
                columns={3}
                onApply={list.apply}
                onClear={() => {
                    list.clear();
                    setActiveCategories(new Set(DEFAULT_ACTIVE_CATEGORY_KEYS));
                    setActiveStatuses(new Set(ALL_STATUSES));
                }}
                buttons={
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={prefill.check}
                            disabled={prefill.checking || prefill.prefilling || list.loading || list.applied === null}
                            className="border-warning-500/40 text-warning-300 hover:bg-warning-500/20"
                        >
                            {prefill.checking || prefill.prefilling ? <Loader2 size={16} className="animate-spin" /> : <CalendarCheck size={16} />}
                            {copy.prefill.button}
                        </Button>
                        {prefill.feedback && <span className="self-center text-xs text-warning-400 font-medium">{prefill.feedback}</span>}
                    </>
                }
                below={
                    <>
                        <ToggleChips
                            label={copy.employeeCategory}
                            options={categories.map((cat) => ({
                                key: cat.key,
                                label: cat.label,
                                count: hasData ? rows.filter((row) => normalizeReparto(row.reparto) === cat.key).length : null,
                            }))}
                            active={activeCategories}
                            onToggle={(key) => setActiveCategories((prev) => toggleInSet(prev, key))}
                        />
                        <ToggleChips
                            label={copy.statusFilter.label}
                            options={ALL_STATUSES.map((key) => ({
                                key,
                                label: key === 'anomaly' ? `⚠️ ${fmt(copy.statusFilter.anomaly, { h: rules.workdayHours })}` : `✓ ${copy.statusFilter.ok}`,
                                count: hasData ? statusCounts[key] : null,
                                tone: key === 'anomaly' ? 'warning' : 'success',
                            }))}
                            active={activeStatuses}
                            onToggle={(key) => setActiveStatuses((prev) => toggleInSet(prev, key))}
                        />
                    </>
                }
            >
                <DateRangeFields dateFrom={list.filters.dateFrom} dateTo={list.filters.dateTo} onChange={list.updateFilters} />
                <SearchField
                    label={copy.headers.operator}
                    placeholder={APP_COPY.analytics.operators.searchPlaceholder}
                    value={list.filters.operator}
                    onChange={(operator) => list.updateFilters({ operator })}
                />
            </FilterPanel>

            {hasData && (
                <RecordCount count={displayed.length}>
                    {anomalyCount > 0 ? (
                        <StatusBadge tone="warning" size="md">
                            ⚠️ {anomalyCount} {fmt(copy.verification.mismatchesFound, { h: rules.workdayHours })}
                        </StatusBadge>
                    ) : (
                        <StatusBadge tone="success" size="md">
                            ✓ {fmt(copy.verification.compliant, { h: rules.workdayHours })}
                        </StatusBadge>
                    )}
                </RecordCount>
            )}

            <DataTable
                columns={columns}
                rows={displayed}
                getRowKey={(row) => `${row.operatore}-${row.data}`}
                nowrap
                sort={sort}
                onSort={toggleSort}
                loading={list.loading}
                error={list.error}
                emptyMessage={list.applied ? APP_COPY.analytics.common.noResults : APP_COPY.analytics.applyFiltersHint}
                footer={footer}
            />

            {prefill.summary && list.applied && (
                <PrefillConfirmDialog
                    summary={prefill.summary}
                    rules={rules}
                    period={list.applied}
                    prefilling={prefill.prefilling}
                    onConfirm={prefill.execute}
                    onClose={prefill.cancel}
                />
            )}
        </div>
    );
}
