'use client';

import React from 'react';
import { Landmark, ArrowUpRight, ArrowDownRight, Scale } from 'lucide-react';
import { APP_COPY } from '@/locales';
import type { BankAccountBalance } from '@/lib/cashflow/types';
import { CASHFLOW_CONFIG } from '@/config/cashflowConfig';
import { formatCurrencyRounded } from '@/lib/format';

interface CashflowKpiCardsProps {
    totalBankBalance: number;
    bankBalances: BankAccountBalance[];
    grandTotalIncome: number;
    totalIncomeInvoicesCount: number;
    grandTotalExpense: number;
    grandTotalPayroll: number;
    grandTotalExtraExpenses: number;
    totalExpenseInvoicesCount: number;
    grandNetCashflow: number;
    loading?: boolean;
}

export const CashflowKpiCards: React.FC<CashflowKpiCardsProps> = ({
    totalBankBalance,
    bankBalances,
    grandTotalIncome,
    totalIncomeInvoicesCount,
    grandTotalExpense,
    grandTotalPayroll,
    grandTotalExtraExpenses,
    totalExpenseInvoicesCount,
    grandNetCashflow,
    loading = false,
}) => {
    const kpi = APP_COPY.cashflow.kpi;

    // Total outflows = vendor expenses + payroll + taxes/fees
    const totalOutflows = grandTotalExpense + grandTotalPayroll + grandTotalExtraExpenses;

    // Split bank balances into Attivo vs Passivo
    const attivoSum = bankBalances
        .filter(b => CASHFLOW_CONFIG.isAttivo(b.accountCode))
        .reduce((s, b) => s + b.balance, 0);

    const passivoSum = bankBalances
        .filter(b => !CASHFLOW_CONFIG.isAttivo(b.accountCode))
        .reduce((s, b) => s + b.balance, 0);

    const isNetPositive = grandNetCashflow >= 0;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* 1. Actual Bank Liquidity */}
            <div className="bg-card border border-border hover:border-border-strong/80 transition-all rounded-xl p-4 shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">
                        {kpi.currentLiquidity}
                    </span>
                    <div className="p-2 bg-info-500/10 text-info-400 rounded-lg group-hover:scale-105 transition-transform">
                        <Landmark size={18} />
                    </div>
                </div>

                <div className="text-2xl font-bold font-mono text-info-300 tracking-tight">
                    {loading ? '...' : formatCurrencyRounded(totalBankBalance)}
                </div>

                <div className="flex items-center justify-between text-2xs text-fg-subtle mt-2 pt-2 border-t border-border/80">
                    <span>{kpi.currentLiquiditySubtitle}</span>
                    <span className="font-mono text-fg-muted text-3xs">
                        +{formatCurrencyRounded(attivoSum)} / {formatCurrencyRounded(passivoSum)}
                    </span>
                </div>
            </div>

            {/* 2. Total Incomes (Cash In) */}
            <div className="bg-card border border-border hover:border-border-strong/80 transition-all rounded-xl p-4 shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">
                        {kpi.totalIncomes}
                    </span>
                    <div className="p-2 bg-success-500/10 text-success-400 rounded-lg group-hover:scale-105 transition-transform">
                        <ArrowUpRight size={18} />
                    </div>
                </div>

                <div className="text-2xl font-bold font-mono text-success-300 tracking-tight">
                    {loading ? '...' : formatCurrencyRounded(grandTotalIncome)}
                </div>

                <div className="flex items-center justify-between text-2xs text-fg-subtle mt-2 pt-2 border-t border-border/80">
                    <span>{kpi.incomesSubtitle}</span>
                    <span className="font-mono text-success-400/90 text-3xs">
                        {totalIncomeInvoicesCount} fatture
                    </span>
                </div>
            </div>

            {/* 3. Total Expenses (Cash Out) */}
            <div className="bg-card border border-border hover:border-border-strong/80 transition-all rounded-xl p-4 shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">
                        {kpi.totalExpenses}
                    </span>
                    <div className="p-2 bg-danger-500/10 text-danger-400 rounded-lg group-hover:scale-105 transition-transform">
                        <ArrowDownRight size={18} />
                    </div>
                </div>

                <div className="text-2xl font-bold font-mono text-danger-300 tracking-tight">
                    {loading ? '...' : formatCurrencyRounded(totalOutflows)}
                </div>

                <div className="flex items-center justify-between text-2xs text-fg-subtle mt-2 pt-2 border-t border-border/80">
                    <span>{kpi.expensesSubtitle}</span>
                    <span className="font-mono text-danger-400/90 text-3xs">
                        {totalExpenseInvoicesCount} fornitori
                    </span>
                </div>
            </div>

            {/* 4. Net Cashflow */}
            <div className="bg-card border border-border hover:border-border-strong/80 transition-all rounded-xl p-4 shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">
                        {kpi.netCashflow}
                    </span>
                    <div className={`p-2 rounded-lg group-hover:scale-105 transition-transform ${
                        isNetPositive ? 'bg-success-500/10 text-success-400' : 'bg-danger-500/10 text-danger-400'
                    }`}>
                        <Scale size={18} />
                    </div>
                </div>

                <div className={`text-2xl font-bold font-mono tracking-tight ${
                    isNetPositive ? 'text-success-300' : 'text-danger-300'
                }`}>
                    {loading ? '...' : (isNetPositive ? `+${formatCurrencyRounded(grandNetCashflow)}` : formatCurrencyRounded(grandNetCashflow))}
                </div>

                <div className="flex items-center justify-between text-2xs text-fg-subtle mt-2 pt-2 border-t border-border/80">
                    <span>{kpi.netSubtitle}</span>
                    <span className={`px-1.5 py-0.5 rounded text-4xs font-bold uppercase ${
                        isNetPositive ? 'bg-success-500/10 text-success-400' : 'bg-danger-500/10 text-danger-400'
                    }`}>
                        {isNetPositive ? 'Surplus' : 'Deficit'}
                    </span>
                </div>
            </div>
        </div>
    );
};
