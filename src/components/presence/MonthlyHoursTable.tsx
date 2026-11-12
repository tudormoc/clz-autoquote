'use client';

import { Spinner } from '@/components/ui/Spinner';
import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { getMonthlyHoursAction, getPresenceRulesAction, updateHoursDistributionAction } from '@/app/presence/hours-actions';
import { byOperatorName, monthlyHoursCardTitle, monthlyHoursColumns, monthlyHoursSortColumns } from '@/components/presence/monthlyHoursColumns';
import { PrefillConfirmDialog } from '@/components/presence/PrefillConfirmDialog';
import { Button } from '@/components/ui/Button';
import { CardField } from '@/components/ui/CardField';
import { columnLabel } from '@/components/ui/DataCards';
import { DataTable } from '@/components/ui/DataTable';
import { DateRangeFields } from '@/components/ui/DateRangeFields';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { LoadState } from '@/components/ui/LoadState';
import { RecordCount } from '@/components/ui/RecordCount';
import { SearchField } from '@/components/ui/SearchField';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TableCell, TableRow } from '@/components/ui/Table';
import { MissingValue } from '@/components/ui/TableCells';
import { ToggleChips } from '@/components/ui/ToggleChips';
import { useAddress } from '@/hooks/useAddress';
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
    rulesForOperator,
    toHours,
    type PresenceRulesConfig,
} from '@/lib/presence';
import { listParam } from '@/lib/address';
import { defaultReportPeriod, getTodayDate } from '@/lib/dateUtils';
import { notify } from '@/lib/notify';
import { errorMessage, toggleInSet } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';
import type { HoursDistributionField, OperatorHoursRow } from '@/types';
import { useCanEdit } from '@/components/auth/AccessProvider';

interface Filters {
    dateFrom: string;
    dateTo: string;
    operator: string;
}

/** Row status filter: anomaly = past working day not fully covered; ok = everything else */
type RowStatusKey = 'anomaly' | 'ok';
const ALL_STATUSES: readonly RowStatusKey[] = ['anomaly', 'ok'];

/** The chips switched on, in the address */
const VIEW = { categories: listParam(DEFAULT_ACTIVE_CATEGORY_KEYS), statuses: listParam(ALL_STATUSES) };
const VIEW_NAMES = Object.keys(VIEW);

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
    const todayStr = useMemo(() => getTodayDate(), []);
    const [rules, setRules] = useState<PresenceRulesConfig>(DEFAULT_PRESENCE_RULES);
    // Why the stored rules could not be read: the page then shows that instead of hours judged by the defaults
    const [rulesError, setRulesError] = useState<string | null>(null);
    const view = useAddress(VIEW);
    const activeCategories = useMemo(() => new Set(view.values.categories), [view.values.categories]);
    const activeStatuses = useMemo(() => new Set(view.values.statuses), [view.values.statuses]);

    useEffect(() => {
        getPresenceRulesAction()
            .then((res) => (res.success ? setRules(res.rules) : setRulesError(res.error)))
            .catch((err: unknown) => setRulesError(errorMessage(err)));
    }, []);

    const list = useListQuery({
        initialFilters: (): Filters => ({ ...defaultReportPeriod(), operator: '' }),
        load: (f: Filters) => getMonthlyHoursAction(f.dateFrom, f.dateTo, f.operator || undefined),
        clears: VIEW_NAMES,
    });
    const { rows, setRows } = list;
    const canEdit = useCanEdit();

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
            // One save: the cell and the cells that must follow it (permesso clears ferie …) are decided and written
            // together by the server; the row shows what it says it saved
            const res = await updateHoursDistributionAction(row.operatore, row.data, field, value);
            if (!res.success) return fail(res.error);

            setRows((prev) =>
                prev.map((r) => (r.operatore === row.operatore && r.data === row.data ? ({ ...r, ...res.saved } as OperatorHoursRow) : r))
            );
            return true;
        } catch (err) {
            return fail(err);
        }
    };

    const columns = monthlyHoursColumns({ rules, todayStr, onSave: saveHours });

    // One total per column after the label, shown as the table's last row and as the phone totals card
    const totals = FOOTER_CELLS.map((cell, i) => ({
        column: columns[LABEL_COLUMNS + i],
        value: typeof cell === 'string'
            ? cell
            : normalizeHours(displayed.reduce((sum, row) => sum + toHours(cell.total(row, rules)), 0)).toFixed(cell.decimals ?? 1),
    }));
    const totalsLabel = (
        <>
            {copy.totals.label}
            <span className="ml-2 font-normal text-fg-subtle">
                ({displayed.length} {APP_COPY.common.records})
            </span>
        </>
    );

    const footer = (
        <TableRow className="text-xs font-semibold hover:bg-transparent">
            <TableCell colSpan={LABEL_COLUMNS} className="py-2 text-fg-muted">
                {totalsLabel}
            </TableCell>
            {totals.map(({ value }, i) => (
                <TableCell key={i} className="py-2 text-right font-mono text-fg">
                    {value === 'missing' ? <MissingValue /> : value === 'blank' ? null : value}
                </TableCell>
            ))}
        </TableRow>
    );

    const mobileFooter = (
        <div className="px-3 py-3 bg-muted/50 text-sm">
            <p className="mb-1.5 font-semibold text-fg-muted">{totalsLabel}</p>
            <dl className="space-y-1">
                {totals
                    .filter(({ value }) => value !== 'blank' && value !== 'missing')
                    .map(({ column, value }) => (
                        <CardField key={column.key} label={columnLabel(column)} variant="number">
                            {value}
                        </CardField>
                    ))}
            </dl>
        </div>
    );

    // Statuses, totals and what an edit clears all come from the rules: without them nothing here would be right
    if (rulesError) return <LoadState loading={false} error={fmt(copy.rulesNotRead, { error: rulesError })} />;

    return (
        <div className="flex flex-col gap-4 lg:h-full">
            <FilterPanel
                columns={3}
                activeCount={list.activeFilterCount}
                onApply={list.apply}
                onClear={list.clear}
                buttons={
                    canEdit && <>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={prefill.check}
                            disabled={prefill.checking || prefill.prefilling || list.loading || list.applied === null}
                            className="border-warning-500/40 text-warning-300 hover:bg-warning-500/20"
                        >
                            {prefill.checking || prefill.prefilling ? <Spinner size={16} /> : <CalendarCheck size={16} />}
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
                            onToggle={(key) => view.set({ categories: [...toggleInSet(activeCategories, key)] }, 'replace')}
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
                            onToggle={(key) => view.set({ statuses: [...toggleInSet(activeStatuses, key)] }, 'replace')}
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
                fill
                emptyMessage={list.applied ? APP_COPY.analytics.common.noResults : APP_COPY.analytics.applyFiltersHint}
                footer={footer}
                mobileTitle={monthlyHoursCardTitle}
                mobileFooter={mobileFooter}
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
