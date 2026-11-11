'use client';

import { Wallet } from 'lucide-react';
import { APP_COPY } from '@/locales';
import { PageHeader } from '@/components/layout/PageHeader';
import { CashflowMonthlyMatrix, MATRIX_VIEW_NAMES } from '@/components/cashflow/CashflowMonthlyMatrix';
import { CashflowKpiCards } from '@/components/cashflow/CashflowKpiCards';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { YearField } from '@/components/ui/YearField';
import { getCashflowMonthlyDataAction } from '@/app/cashflow/cashflow-actions';
import { useAppliedQuery } from '@/hooks/useAppliedQuery';
import { recentYears } from '@/lib/dateUtils';

const thisYear = () => recentYears(1)[0];

/**
 * Flusso Monetario: the year's KPI cards and month-by-month table, loaded for the chosen year on "Applica" or from a
 * link that names the year (a page opened bare loads nothing).
 */
export function CashflowDashboard() {
    const copy = APP_COPY.cashflow;
    const query = useAppliedQuery({
        initialFilters: () => ({ year: thisYear() }),
        load: (filters: { year: number }) => getCashflowMonthlyDataAction(filters.year),
        clears: MATRIX_VIEW_NAMES,
    });
    const { error, loading: isPending } = query;
    /** The year on screen; null before "Applica" */
    const applied = query.applied?.year ?? null;
    // The numbers belong to the year on screen: while another year loads, or after an error, none are shown
    const cashflowData = !error && query.result?.year === applied ? query.result : null;

    return (
        <>
            <PageHeader icon={Wallet} title={copy.title} subtitle={copy.subtitle} />

            <div className="space-y-4">
                <FilterPanel onApply={query.apply} onClear={query.clear} activeCount={query.activeFilterCount}>
                    <YearField value={query.filters.year} onChange={(year) => query.updateFilters({ year })} />
                </FilterPanel>

                {applied === null ? (
                    <EmptyState title={APP_COPY.analytics.applyFiltersHint} />
                ) : error ? (
                    <EmptyState title={APP_COPY.common.loadError} description={error} />
                ) : (
                    <>
                        <CashflowKpiCards
                            totalBankBalance={cashflowData?.totalBankBalance ?? 0}
                            bankBalances={cashflowData?.bankBalances ?? []}
                            grandTotalIncome={cashflowData?.grandTotalIncome ?? 0}
                            totalIncomeInvoicesCount={cashflowData?.totalIncomeInvoicesCount ?? 0}
                            grandTotalExpense={cashflowData?.grandTotalExpense ?? 0}
                            grandTotalPayroll={cashflowData?.grandTotalPayroll ?? 0}
                            grandTotalExtraExpenses={cashflowData?.grandTotalExtraExpenses ?? 0}
                            totalExpenseInvoicesCount={cashflowData?.totalExpenseInvoicesCount ?? 0}
                            grandNetCashflow={cashflowData?.grandNetCashflow ?? 0}
                            loading={isPending}
                        />
                        <CashflowMonthlyMatrix data={cashflowData} year={applied} loading={isPending} />
                    </>
                )}
            </div>
        </>
    );
}
