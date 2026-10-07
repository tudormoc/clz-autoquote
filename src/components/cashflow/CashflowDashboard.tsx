'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { Wallet, Calendar, RefreshCw } from 'lucide-react';
import { APP_COPY } from '@/locales';
import { PageHeader } from '@/components/layout/PageHeader';
import { CashflowMonthlyMatrix } from '@/components/cashflow/CashflowMonthlyMatrix';
import { CashflowKpiCards } from '@/components/cashflow/CashflowKpiCards';
import { getCashflowMonthlyDataAction } from '@/app/cashflow/cashflow-actions';
import type { CashflowDataResult } from '@/lib/cashflow/types';

/** Years offered in the selector: the current one and the two before it */
const YEARS_SHOWN = 3;

export function CashflowDashboard() {
    const copy = APP_COPY.cashflow;
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: YEARS_SHOWN }, (_, i) => currentYear - i);

    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [isPending, startTransition] = useTransition();
    const [cashflowData, setCashflowData] = useState<CashflowDataResult | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    const loadData = (year: number) => {
        setLoading(true);
        startTransition(async () => {
            const res = await getCashflowMonthlyDataAction(year);
            if (res.success) {
                setCashflowData(res);
            }
            setLoading(false);
        });
    };

    useEffect(() => {
        loadData(selectedYear);
    }, [selectedYear]);

    return (
        <>
            <PageHeader
                icon={Wallet}
                title={copy.title}
                subtitle={copy.subtitle}
                actions={
                    <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-2">
                        <Calendar size={18} className="text-primary" />
                        <span className="text-xs text-fg-muted font-medium">{copy.yearLabel}</span>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="bg-card border border-border-strong/80 text-fg font-bold text-sm rounded-lg px-3 py-1 focus:outline-none focus:border-primary cursor-pointer"
                        >
                            {years.map((year) => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => loadData(selectedYear)}
                            className="p-1.5 hover:bg-muted rounded-lg text-fg-muted hover:text-primary transition-colors ml-1"
                            title={copy.reload}
                        >
                            <RefreshCw size={16} className={loading || isPending ? 'animate-spin' : ''} />
                        </button>
                    </div>
                }
            />

            {/* Executive KPI Summary Cards */}
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
                loading={loading || isPending}
            />

            {/* Monthly Executive Cashflow Matrix (Gennaio - Dicembre) */}
            <CashflowMonthlyMatrix
                monthlyData={cashflowData?.monthlyBreakdown}
                bankBalances={cashflowData?.bankBalances}
                clientMonthlySummary={cashflowData?.clientMonthlySummary}
                payrollMonthlyBreakdown={cashflowData?.payrollMonthlyBreakdown}
                extraExpenseBreakdown={cashflowData?.extraExpenseBreakdown}
                supplierCostGroupBreakdown={cashflowData?.supplierCostGroupBreakdown}
                grandTotalIncome={cashflowData?.grandTotalIncome}
                grandTotalExpense={cashflowData?.grandTotalExpense}
                grandTotalPayroll={cashflowData?.grandTotalPayroll}
                grandTotalExtraExpenses={cashflowData?.grandTotalExtraExpenses}
                grandNetCashflow={cashflowData?.grandNetCashflow}
                year={selectedYear}
                loading={loading || isPending}
            />
        </>
    );
}
