'use server'

/**
 * Cashflow page: monthly incomes / expenses / payroll / extra expenses and bank balances for a year, and the
 * movements of one bank account. SQL in cashflow-sql.ts, arithmetic in src/lib/cashflow/aggregate.ts.
 */

import { errorMessage } from '@/lib/utils';
import { queryMSSQL } from '@/lib/mssql';
import { CASHFLOW_CONFIG } from '@/config/cashflowConfig';
import {
    MONTHS,
    addMonths,
    buildMonths,
    cashOutByAccount,
    dueByMonth,
    emptyCashflow,
    groupMonthly,
    totalOf,
} from '@/lib/cashflow/aggregate';
import type {
    BankAccountDetailsResult,
    BankMonthSummary,
    BankTransactionItem,
    CashflowDataResult,
    ClientMonthlyBreakdownItem,
    ExtraExpenseCategoryBreakdown,
    MonthlyAmounts,
    PayrollMonthlyBreakdown,
    SupplierCostGroupBreakdown,
} from '@/lib/cashflow/types';
import { formatDate, monthName } from '@/lib/format';
import { APP_COPY, fmt } from '@/locales';
import {
    CLIENTS,
    SUPPLIERS,
    type AccountNameRow,
    type BankBalanceRow,
    type BankMonthChangeRow,
    type BankMonthRow,
    type BankOpeningRow,
    type CashOutRow,
    type ClientMonthRow,
    type CostGroupMonthRow,
    type DueMonthRow,
    type LastBankMonthRow,
    type MovementRow,
    type OpeningRow,
    accountMovementsSql,
    accountNameSql,
    accountOpeningSql,
    bankBalancesSql,
    bankOpeningSql,
    cashOutByAccountSql,
    clientMonthlySql,
    lastBankMonthSql,
    monthlyBankSql,
    monthlyDueSql,
    perBankMonthlySql,
    perBankOpeningSql,
    supplierCostGroupSql,
} from './cashflow-sql';
import { authorize } from '@/lib/auth/access';
import { LINKS } from '@/config/navigation';

const labels = APP_COPY.cashflow.labels;
const NO_ROWS = Promise.resolve({ recordset: [] as CashOutRow[] });
const round2 = (value: number) => Number(value.toFixed(2));

/** Monthly cashflow of a year (all queries run in parallel) */
export async function getCashflowMonthlyDataAction(year: number = new Date().getFullYear()): Promise<CashflowDataResult> {
    await authorize('view', LINKS.cashflow);
    try {
        const bankCodes = CASHFLOW_CONFIG.getEnabledAccountCodes();
        if (bankCodes.length === 0) return emptyCashflow(year, true);

        const payrollCodes = CASHFLOW_CONFIG.getPayrollAccountCodes();
        const extraCodes = CASHFLOW_CONFIG.getEnabledExtraExpenseCodes();
        const run = <T>(sql: string, params: Record<string, unknown> = { year }) => queryMSSQL<T>(sql, params, 'BUSINESS');

        const [banks, incomes, expenses, lastBankMonth, monthlyBank, opening, perBankOpening, perBankMonthly, payroll, extra, clientMonthly, costGroups] =
            await Promise.all([
                run<BankBalanceRow>(bankBalancesSql(bankCodes), {}),
                run<DueMonthRow>(monthlyDueSql(CLIENTS)),
                run<DueMonthRow>(monthlyDueSql(SUPPLIERS)),
                run<LastBankMonthRow>(lastBankMonthSql(bankCodes)),
                run<BankMonthRow>(monthlyBankSql(bankCodes)),
                run<OpeningRow>(bankOpeningSql(bankCodes)),
                run<BankOpeningRow>(perBankOpeningSql(bankCodes)),
                run<BankMonthChangeRow>(perBankMonthlySql(bankCodes)),
                run<CashOutRow>(cashOutByAccountSql(payrollCodes)),
                extraCodes.length > 0 ? run<CashOutRow>(cashOutByAccountSql(extraCodes)) : NO_ROWS,
                run<ClientMonthRow>(clientMonthlySql(), { year, namePrefix: labels.clientPrefix }),
                run<CostGroupMonthRow>(supplierCostGroupSql(), { year, otherSuppliers: labels.otherSuppliers }),
            ]);

        // Bank balances today
        const bankBalances = banks.recordset.map((row) => ({
            accountCode: row.account_code,
            name: row.name.trim(),
            balance: row.balance,
        }));

        // Payroll per account (labels from config order)
        const payrollByAccount = cashOutByAccount(payroll.recordset);
        const payrollMonthlyBreakdown: PayrollMonthlyBreakdown[] = CASHFLOW_CONFIG.PAYROLL_ACCOUNTS.map((acc) => {
            const monthlyAmounts = payrollByAccount.get(acc.accountCode) || {};
            return { accountCode: acc.accountCode, localeKey: acc.localeKey, monthlyAmounts, totalAmount: totalOf(monthlyAmounts) };
        });
        const payrollByMonth = new Map<number, number>();
        payrollMonthlyBreakdown.forEach((acc) => addMonths(payrollByMonth, acc.monthlyAmounts));

        // Extra expenses per category and account
        const extraByAccount = cashOutByAccount(extra.recordset);
        const extraExpenseBreakdown: ExtraExpenseCategoryBreakdown[] = CASHFLOW_CONFIG.EXTRA_EXPENSE_CATEGORIES
            .filter((cat) => cat.enabled)
            .map((cat) => {
                const categoryByMonth = new Map<number, number>();
                const accounts = cat.accounts.map((acc) => {
                    const monthlyAmounts = extraByAccount.get(acc.accountCode) || {};
                    addMonths(categoryByMonth, monthlyAmounts);
                    return { accountCode: acc.accountCode, label: acc.label, monthlyAmounts, totalAmount: totalOf(monthlyAmounts) };
                });
                const monthlyAmounts: MonthlyAmounts = Object.fromEntries(categoryByMonth);
                return { key: cat.key, label: cat.label, monthlyAmounts, totalAmount: totalOf(monthlyAmounts), accounts };
            });
        const extraExpenseByMonth = new Map<number, number>();
        extraExpenseBreakdown.forEach((cat) => addMonths(extraExpenseByMonth, cat.monthlyAmounts));

        // Incomes per client, largest first
        const clientMonthlySummary: ClientMonthlyBreakdownItem[] = groupMonthly(
            clientMonthly.recordset,
            (row) => row.account_code,
            (row, accountCode) => ({ accountCode, name: row.name.trim(), monthlyAmounts: {}, totalAmount: 0 })
        ).sort((a, b) => b.totalAmount - a.totalAmount);

        // Supplier costs per cost account: named groups by total, unmapped ("Altri Fornitori", code 0) last
        const supplierCostGroupBreakdown: SupplierCostGroupBreakdown[] = groupMonthly(
            costGroups.recordset,
            (row) => row.cost_account_code,
            (row, costAccountCode) => ({ costAccountCode, label: row.cost_account_name.trim(), monthlyAmounts: {}, totalAmount: 0 })
        ).sort((a, b) => (a.costAccountCode === 0 ? 1 : b.costAccountCode === 0 ? -1 : b.totalAmount - a.totalAmount));

        const incomesByMonth = dueByMonth(incomes.recordset);
        const expensesByMonth = dueByMonth(expenses.recordset);
        const monthlyBreakdown = buildMonths({
            incomes: incomesByMonth,
            expenses: expensesByMonth,
            payrollByMonth,
            extraExpenseByMonth,
            bankByMonth: new Map(monthlyBank.recordset.map((row) => [row.month_num, { netChange: row.net_change, count: row.row_count }])),
            lastBankMonth: lastBankMonth.recordset[0]?.max_month ?? 0,
            openingBalance: opening.recordset[0]?.start_balance ?? 0,
            perBankOpening: new Map(perBankOpening.recordset.map((row) => [row.account_code, { name: row.name.trim(), balance: row.start_balance }])),
            perBankChange: new Map(perBankMonthly.recordset.map((row) => [`${row.account_code}_${row.month_num}`, row.net_change])),
        });

        const sumMonths = (pick: (m: number) => number) => MONTHS.reduce((sum, m) => sum + pick(m), 0);
        const grandTotalIncome = sumMonths((m) => incomesByMonth.get(m)?.total ?? 0);
        const grandTotalExpense = sumMonths((m) => expensesByMonth.get(m)?.total ?? 0);
        const grandTotalPayroll = payrollMonthlyBreakdown.reduce((sum, acc) => sum + acc.totalAmount, 0);
        const grandTotalExtraExpenses = extraExpenseBreakdown.reduce((sum, cat) => sum + cat.totalAmount, 0);

        return {
            success: true,
            year,
            bankBalances,
            totalBankBalance: bankBalances.reduce((sum, bank) => sum + bank.balance, 0),
            grandTotalIncome,
            totalIncomeInvoicesCount: sumMonths((m) => incomesByMonth.get(m)?.count ?? 0),
            grandTotalExpense,
            totalExpenseInvoicesCount: sumMonths((m) => expensesByMonth.get(m)?.count ?? 0),
            grandTotalPayroll,
            payrollMonthlyBreakdown,
            grandTotalExtraExpenses,
            extraExpenseBreakdown,
            supplierCostGroupBreakdown,
            grandNetCashflow: grandTotalIncome - grandTotalExpense - grandTotalPayroll - grandTotalExtraExpenses,
            monthlyBreakdown,
            clientMonthlySummary,
        };
    } catch (err) {
        console.error('Error fetching cashflow monthly data:', err);
        return emptyCashflow(year, false, errorMessage(err) || APP_COPY.common.loadError);
    }
}

/**
 * Every General Ledger movement (prinot) of one bank account in the year, with the running balance and monthly
 * summaries, so the final balance can be checked step by step against the bilancio.
 */
export async function getBankAccountTransactionsAction(
    accountCode: number,
    year: number = new Date().getFullYear()
): Promise<BankAccountDetailsResult> {
    await authorize('view', LINKS.cashflow);
    try {
        // Only the bank accounts switched on for this page (CASHFLOW_CONFIG.BANKS): the code comes from the address,
        // and any other number would read the movements of that ledger account of Business, whatever it is
        if (!CASHFLOW_CONFIG.getEnabledAccountCodes().includes(accountCode)) {
            throw new Error(fmt(labels.accountNotEnabled, { code: String(accountCode).slice(0, 20) }));
        }
        const [nameRes, openingRes, movementsRes] = await Promise.all([
            queryMSSQL<AccountNameRow>(accountNameSql(), { accountCode }, 'BUSINESS'),
            queryMSSQL<OpeningRow>(accountOpeningSql(), { accountCode, year }, 'BUSINESS'),
            queryMSSQL<MovementRow>(accountMovementsSql(), { accountCode, year }, 'BUSINESS'),
        ]);
        const accountName = nameRes.recordset[0]?.an_descr1.trim() || fmt(labels.account, { code: accountCode });
        const openingBalanceYear = openingRes.recordset[0]?.start_balance ?? 0;

        let running = openingBalanceYear;
        let totalDareYear = 0;
        let totalAvereYear = 0;

        const transactions: BankTransactionItem[] = movementsRes.recordset.map((row) => {
            const { pn_dare: dare, pn_avere: avere, pn_importo: importo } = row;
            running += importo;
            totalDareYear += dare;
            totalAvereYear += avere;

            const regDate = row.pn_datreg;
            return {
                id: `${row.pn_datreg}_${row.pn_numreg}_${row.pn_riga}`,
                date: regDate.toISOString().split('T')[0],
                formattedDate: formatDate(regDate),
                month: regDate.getMonth() + 1,
                regNum: row.pn_numreg,
                rowNum: row.pn_riga,
                docNum: row.pn_numdoc,
                docSeries: row.pn_alfdoc.trim(),
                description: row.pn_descr.trim(),
                dare,
                avere,
                importo,
                runningBalance: round2(running),
            };
        });

        // Each month opens with the previous month's closing balance
        let monthOpening = openingBalanceYear;
        const monthlySummaries: BankMonthSummary[] = MONTHS.map((m) => {
            const inMonth = transactions.filter((t) => t.month === m);
            const net = inMonth.reduce((sum, t) => sum + t.importo, 0);
            const summary = {
                month: m,
                monthName: monthName(m),
                openingBalance: round2(monthOpening),
                totalDare: round2(inMonth.reduce((sum, t) => sum + t.dare, 0)),
                totalAvere: round2(inMonth.reduce((sum, t) => sum + t.avere, 0)),
                netChange: round2(net),
                closingBalance: round2(monthOpening + net),
                transactionCount: inMonth.length,
            };
            monthOpening += net;
            return summary;
        });

        return {
            success: true,
            accountCode,
            accountName,
            year,
            openingBalanceYear: round2(openingBalanceYear),
            closingBalanceYear: round2(running),
            totalDareYear: round2(totalDareYear),
            totalAvereYear: round2(totalAvereYear),
            transactions,
            monthlySummaries,
        };
    } catch (err) {
        console.error('Error fetching bank account transactions:', err);
        return {
            success: false,
            accountCode,
            accountName: '',
            year,
            openingBalanceYear: 0,
            closingBalanceYear: 0,
            totalDareYear: 0,
            totalAvereYear: 0,
            transactions: [],
            monthlySummaries: [],
            error: errorMessage(err) || APP_COPY.common.loadError,
        };
    }
}
