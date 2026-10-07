/**
 * Cashflow arithmetic on the query rows (no database): monthly totals, per-account amounts and the
 * month-by-month bank progression. Rules: docs/CASHFLOW.md.
 */
import { monthName } from '@/lib/format';
import type {
    CashflowDataResult,
    MonthlyAmounts,
    MonthlyBankBreakdownItem,
    MonthlyFinancialItem,
} from '@/lib/cashflow/types';

type Row = Record<string, unknown>;

const num = (value: unknown) => Number(value || 0);

export const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** Sum of a month → amount record */
export const totalOf = (amounts: MonthlyAmounts) => Object.values(amounts).reduce((sum, v) => sum + v, 0);

/** Adds each month of `amounts` into `into` */
export function addMonths(into: Map<number, number>, amounts: MonthlyAmounts) {
    for (const [month, value] of Object.entries(amounts)) {
        into.set(Number(month), (into.get(Number(month)) || 0) + value);
    }
}

/** Due rows per month → { count, total } with the total as a positive amount */
export function dueByMonth(rows: Row[]): Map<number, { count: number; total: number }> {
    return new Map(rows.map((row) => [num(row.month_num), { count: num(row.invoice_count), total: Math.abs(num(row.total_amount)) }]));
}

/** Rows (account_code, month_num, cash_out) → account → month → amount */
export function cashOutByAccount(rows: Row[]): Map<number, MonthlyAmounts> {
    const byAccount = new Map<number, MonthlyAmounts>();
    for (const row of rows) {
        const monthly = byAccount.get(num(row.account_code)) ?? {};
        monthly[num(row.month_num)] = num(row.cash_out);
        byAccount.set(num(row.account_code), monthly);
    }
    return byAccount;
}

/** Rows (key, name, month_num, total_amount) → one entry per key with its monthly amounts and total */
export function groupMonthly<K, E extends { monthlyAmounts: MonthlyAmounts; totalAmount: number }>(
    rows: Row[],
    keyOf: (row: Row) => K,
    entry: (row: Row, key: K) => E
): E[] {
    const groups = new Map<K, E>();
    for (const row of rows) {
        const key = keyOf(row);
        const group = groups.get(key) ?? entry(row, key);
        const month = num(row.month_num);
        const amount = num(row.total_amount);
        group.monthlyAmounts[month] = (group.monthlyAmounts[month] || 0) + amount;
        group.totalAmount += amount;
        groups.set(key, group);
    }
    return Array.from(groups.values());
}

interface MonthInputs {
    incomes: Map<number, { count: number; total: number }>;
    expenses: Map<number, { count: number; total: number }>;
    payrollByMonth: Map<number, number>;
    extraExpenseByMonth: Map<number, number>;
    /** Net bank change and row count per month */
    bankByMonth: Map<number, { netChange: number; count: number }>;
    /** Last month of the year with bank movements (0 = none) */
    lastBankMonth: number;
    /** Balance of all banks before the year */
    openingBalance: number;
    /** Balance of each bank before the year; updated month by month */
    perBankOpening: Map<number, { name: string; balance: number }>;
    /** Net change of each bank in a month, keyed "account_month" */
    perBankChange: Map<string, number>;
}

/**
 * The 12 months: incomes, expenses, payroll, extra expenses and net flow; for months with bank movements also
 * opening / closing balance (each month opens with the previous closing) and the same per bank.
 */
export function buildMonths(input: MonthInputs): MonthlyFinancialItem[] {
    let opening = input.openingBalance;

    return MONTHS.map((m) => {
        const income = input.incomes.get(m)?.total ?? 0;
        const expense = input.expenses.get(m)?.total ?? 0;
        const payroll = input.payrollByMonth.get(m) || 0;
        const extra = input.extraExpenseByMonth.get(m) || 0;
        const netAmount = income - expense - payroll - extra;

        const bank = input.bankByMonth.get(m);
        const hasBankData = m <= input.lastBankMonth && input.lastBankMonth > 0 && !!bank && bank.count > 0;

        let openingBalance: number | null = null;
        let closingBalance: number | null = null;
        let bankBreakdown: MonthlyBankBreakdownItem[] | undefined;

        if (hasBankData && bank) {
            openingBalance = opening;
            closingBalance = opening + bank.netChange;
            opening = closingBalance;

            bankBreakdown = Array.from(input.perBankOpening.entries()).map(([accountCode, info]) => {
                const open = info.balance;
                const close = open + (input.perBankChange.get(`${accountCode}_${m}`) || 0);
                info.balance = close;
                return { accountCode, name: info.name, opening: open, closing: close };
            });
        }

        return {
            month: m,
            monthName: monthName(m),
            incomeAmount: income,
            expenseAmount: expense,
            payrollAmount: payroll,
            extraExpenseAmount: extra,
            netAmount,
            cashFlow: openingBalance !== null ? openingBalance + netAmount : netAmount,
            openingBalance,
            closingBalance,
            hasBankData,
            bankBreakdown,
        };
    });
}

/** Result with no data (no bank accounts enabled, or an error) */
export function emptyCashflow(year: number, success: boolean, error?: string): CashflowDataResult {
    return {
        success,
        year,
        bankBalances: [],
        totalBankBalance: 0,
        grandTotalIncome: 0,
        totalIncomeInvoicesCount: 0,
        grandTotalExpense: 0,
        totalExpenseInvoicesCount: 0,
        grandTotalPayroll: 0,
        payrollMonthlyBreakdown: [],
        grandTotalExtraExpenses: 0,
        extraExpenseBreakdown: [],
        supplierCostGroupBreakdown: [],
        grandNetCashflow: 0,
        monthlyBreakdown: [],
        clientMonthlySummary: [],
        ...(error !== undefined && { error }),
    };
}
