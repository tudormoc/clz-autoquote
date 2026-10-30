'use client';

import { useState, useTransition } from 'react';
import { Wallet } from 'lucide-react';
import { APP_COPY } from '@/locales';
import { PageHeader } from '@/components/layout/PageHeader';
import { CashflowMonthlyMatrix } from '@/components/cashflow/CashflowMonthlyMatrix';
import { CashflowKpiCards } from '@/components/cashflow/CashflowKpiCards';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { YearField } from '@/components/ui/YearField';
import { getCashflowMonthlyDataAction } from '@/app/cashflow/cashflow-actions';
import { recentYears } from '@/lib/dateUtils';
import type { CashflowDataResult } from '@/lib/cashflow/types';

const thisYear = () => recentYears(1)[0];

/** Flusso Monetario: the year's KPI cards and month-by-month table, loaded for the chosen year on "Applica". */
export function CashflowDashboard() {
    const copy = APP_COPY.cashflow;
    const [year, setYear] = useState(thisYear);
    /** The year on screen; null before "Applica" (nothing loads on its own) */
    const [applied, setApplied] = useState<number | null>(null);
    const [isPending, startTransition] = useTransition();
    const [cashflowData, setCashflowData] = useState<CashflowDataResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = (chosen: number) => {
        setApplied(chosen);
        setError(null);
        startTransition(async () => {
            const res = await getCashflowMonthlyDataAction(chosen);
            if (res.success) {
                setCashflowData(res);
            } else {
                setCashflowData(null);
                setError(res.error || APP_COPY.common.loadError);
            }
        });
    };

    const clear = () => {
        setYear(thisYear());
        setApplied(null);
        setCashflowData(null);
        setError(null);
    };

    return (
        <>
            <PageHeader icon={Wallet} title={copy.title} subtitle={copy.subtitle} />

            <div className="space-y-4">
                <FilterPanel onApply={() => load(year)} onClear={clear} activeCount={applied !== null && applied !== thisYear() ? 1 : 0}>
                    <YearField value={year} onChange={setYear} />
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
