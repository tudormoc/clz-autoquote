'use client';

import { Landmark, ArrowUpRight, ArrowDownRight, Scale } from '@/components/ui/icons';
import { KpiCard } from '@/components/cashflow/KpiCard';
import { APP_COPY, fmt } from '@/locales';
import type { BankAccountBalance } from '@/lib/cashflow/types';
import { CASHFLOW_CONFIG } from '@/config/cashflowConfig';
import { PENDING_VALUE, formatCurrencyRounded } from '@/lib/format';

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

/** The four amounts at the top of Flusso Monetario: money in the banks, incomes, outflows, and what is left of the year */
export function CashflowKpiCards({
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
}: CashflowKpiCardsProps) {
    const kpi = APP_COPY.cashflow.kpi;
    const amount = (value: number, sign = '') => (loading ? PENDING_VALUE : `${sign}${formatCurrencyRounded(value)}`);

    // Total outflows = vendor expenses + payroll + taxes/fees
    const totalOutflows = grandTotalExpense + grandTotalPayroll + grandTotalExtraExpenses;

    // The bank balances, Attivo apart from Passivo
    const balanceOf = (attivo: boolean) =>
        bankBalances.filter((bank) => CASHFLOW_CONFIG.isAttivo(bank.accountCode) === attivo).reduce((sum, bank) => sum + bank.balance, 0);

    const isNetPositive = grandNetCashflow >= 0;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
                label={kpi.currentLiquidity}
                icon={Landmark}
                tone="info"
                value={amount(totalBankBalance)}
                note={`+${formatCurrencyRounded(balanceOf(true))} / ${formatCurrencyRounded(balanceOf(false))}`}
            />
            <KpiCard label={kpi.totalIncomes} icon={ArrowUpRight} tone="success" value={amount(grandTotalIncome)} note={fmt(kpi.invoices, { count: totalIncomeInvoicesCount })} />
            <KpiCard label={kpi.totalExpenses} icon={ArrowDownRight} tone="danger" value={amount(totalOutflows)} note={fmt(kpi.suppliers, { count: totalExpenseInvoicesCount })} />
            <KpiCard
                label={kpi.netCashflow}
                icon={Scale}
                tone={isNetPositive ? 'success' : 'danger'}
                value={amount(grandNetCashflow, isNetPositive ? '+' : '')}
                note={isNetPositive ? kpi.surplus : kpi.deficit}
                noteAsBadge
            />
        </div>
    );
}
