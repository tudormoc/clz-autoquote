'use client';

import React from 'react';
import { Landmark, ArrowUpRight, ArrowDownRight, Scale } from 'lucide-react';
import { APP_COPY } from '@/locales';
import { BankAccountBalance } from '@/app/cashflow/cashflow-actions';
import { CASHFLOW_CONFIG } from '@/config/cashflowConfig';

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

const formatEUR = (val: number) => {
    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
    }).format(val);
};

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
            <div className="bg-card border border-zinc-800 hover:border-zinc-700/80 transition-all rounded-xl p-4 shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                        {kpi.currentLiquidity}
                    </span>
                    <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg group-hover:scale-105 transition-transform">
                        <Landmark size={18} />
                    </div>
                </div>

                <div className="text-2xl font-bold font-mono text-sky-300 tracking-tight">
                    {loading ? '...' : formatEUR(totalBankBalance)}
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-500 mt-2 pt-2 border-t border-zinc-800/80">
                    <span>{kpi.currentLiquiditySubtitle}</span>
                    <span className="font-mono text-zinc-400 text-[10px]">
                        +{formatEUR(attivoSum)} / {formatEUR(passivoSum)}
                    </span>
                </div>
            </div>

            {/* 2. Total Incomes (Cash In) */}
            <div className="bg-card border border-zinc-800 hover:border-zinc-700/80 transition-all rounded-xl p-4 shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                        {kpi.totalIncomes}
                    </span>
                    <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:scale-105 transition-transform">
                        <ArrowUpRight size={18} />
                    </div>
                </div>

                <div className="text-2xl font-bold font-mono text-emerald-300 tracking-tight">
                    {loading ? '...' : formatEUR(grandTotalIncome)}
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-500 mt-2 pt-2 border-t border-zinc-800/80">
                    <span>{kpi.incomesSubtitle}</span>
                    <span className="font-mono text-emerald-400/90 text-[10px]">
                        {totalIncomeInvoicesCount} fatture
                    </span>
                </div>
            </div>

            {/* 3. Total Expenses (Cash Out) */}
            <div className="bg-card border border-zinc-800 hover:border-zinc-700/80 transition-all rounded-xl p-4 shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                        {kpi.totalExpenses}
                    </span>
                    <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg group-hover:scale-105 transition-transform">
                        <ArrowDownRight size={18} />
                    </div>
                </div>

                <div className="text-2xl font-bold font-mono text-rose-300 tracking-tight">
                    {loading ? '...' : formatEUR(totalOutflows)}
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-500 mt-2 pt-2 border-t border-zinc-800/80">
                    <span>{kpi.expensesSubtitle}</span>
                    <span className="font-mono text-rose-400/90 text-[10px]">
                        {totalExpenseInvoicesCount} fornitori
                    </span>
                </div>
            </div>

            {/* 4. Net Cashflow */}
            <div className="bg-card border border-zinc-800 hover:border-zinc-700/80 transition-all rounded-xl p-4 shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                        {kpi.netCashflow}
                    </span>
                    <div className={`p-2 rounded-lg group-hover:scale-105 transition-transform ${
                        isNetPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                        <Scale size={18} />
                    </div>
                </div>

                <div className={`text-2xl font-bold font-mono tracking-tight ${
                    isNetPositive ? 'text-emerald-300' : 'text-rose-300'
                }`}>
                    {loading ? '...' : (isNetPositive ? `+${formatEUR(grandNetCashflow)}` : formatEUR(grandNetCashflow))}
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-500 mt-2 pt-2 border-t border-zinc-800/80">
                    <span>{kpi.netSubtitle}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        isNetPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                        {isNetPositive ? 'Surplus' : 'Deficit'}
                    </span>
                </div>
            </div>
        </div>
    );
};
