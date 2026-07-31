'use server'

import { queryMSSQL } from '@/lib/mssql';
import { CASHFLOW_CONFIG, CashflowPayrollConfig } from '@/config/cashflowConfig';

export interface MonthlyBankBreakdownItem {
    accountCode: number;
    name: string;
    opening: number;
    closing: number;
}

export interface ClientMonthlyBreakdownItem {
    accountCode: number;
    name: string;
    monthlyAmounts: Record<number, number>; // month 1-12 -> amount
    totalAmount: number;
}

export interface PayrollMonthlyBreakdown {
    /** pn_conto account code */
    accountCode: number;
    /** Locale key to resolve label from APP_COPY.cashflow.macro */
    localeKey: CashflowPayrollConfig['localeKey'];
    /** Monthly cash-out amounts keyed by month 1-12 */
    monthlyAmounts: Record<number, number>;
    totalAmount: number;
}

export interface ExtraExpenseCategoryBreakdown {
    key: string;
    label: string;
    monthlyAmounts: Record<number, number>;
    totalAmount: number;
    accounts: {
        accountCode: number;
        label: string;
        monthlyAmounts: Record<number, number>;
        totalAmount: number;
    }[];
}

/** Supplier invoices grouped by their default cost account (an_controp → cost account name) */
export interface SupplierCostGroupBreakdown {
    /** Cost account code (an_controp) — 0 means unmapped ("Altri Fornitori") */
    costAccountCode: number;
    /** Cost account name from anagra */
    label: string;
    monthlyAmounts: Record<number, number>;
    totalAmount: number;
}

export interface MonthlyFinancialItem {
    month: number;
    monthName: string;
    incomeAmount: number;
    /** Total supplier expenses (scaden) */
    expenseAmount: number;
    /** Payroll cash-out from prinot for that month */
    payrollAmount: number;
    /** Extra non-vendor cash-out (taxes, financing, fees, leasing) for that month */
    extraExpenseAmount: number;
    netAmount: number;
    incomeCount: number;
    expenseCount: number;
    openingBalance?: number | null;
    closingBalance?: number | null;
    hasBankData?: boolean;
    bankBreakdown?: MonthlyBankBreakdownItem[];
}

export interface CounterpartySummary {
    accountCode: number;
    name: string;
    totalAmount: number;
    openAmount: number;
    count: number;
}

export interface BankAccountBalance {
    accountCode: number;
    name: string;
    balance: number;
    lastEntryDate: string;
}

export interface CashflowDataResult {
    success: boolean;
    year: number;
    // Bank Balances (from General Ledger / prinot)
    bankBalances: BankAccountBalance[];
    totalBankBalance: number;
    // Incomes
    grandTotalIncome: number;
    grandOpenIncome: number;
    totalIncomeInvoicesCount: number;
    // Expenses (suppliers from scaden)
    grandTotalExpense: number;
    grandOpenExpense: number;
    totalExpenseInvoicesCount: number;
    // Payroll (from prinot)
    grandTotalPayroll: number;
    payrollMonthlyBreakdown: PayrollMonthlyBreakdown[];
    // Extra Expenses (taxes, financing, fees, leasing)
    grandTotalExtraExpenses: number;
    extraExpenseBreakdown: ExtraExpenseCategoryBreakdown[];
    // Suppliers grouped by ERP cost account (an_controp)
    supplierCostGroupBreakdown: SupplierCostGroupBreakdown[];
    // Net Result
    grandNetCashflow: number;
    // Breakdowns
    monthlyBreakdown: MonthlyFinancialItem[];
    clientMonthlySummary: ClientMonthlyBreakdownItem[];
    topClients: CounterpartySummary[];
    topSuppliers: CounterpartySummary[];
    error?: string;
}

const MONTH_NAMES = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

/**
 * Server Action to fetch monthly Incomes (Clienti an_tipo='C') & Expenses (Fornitori an_tipo='F') from BUSINESS database.
 * @param year Target year (default 2026)
 */
export async function getCashflowMonthlyDataAction(year: number = 2026): Promise<CashflowDataResult> {
    try {
        // 0. Fetch real Bank Balances from General Ledger (prinot)
        const enabledCodes = CASHFLOW_CONFIG.getEnabledAccountCodes();
        if (enabledCodes.length === 0) {
            return {
                success: true,
                year,
                bankBalances: [],
                totalBankBalance: 0,
                grandTotalIncome: 0,
                grandOpenIncome: 0,
                totalIncomeInvoicesCount: 0,
                grandTotalExpense: 0,
                grandOpenExpense: 0,
                totalExpenseInvoicesCount: 0,
                grandTotalPayroll: 0,
                payrollMonthlyBreakdown: [],
                grandTotalExtraExpenses: 0,
                extraExpenseBreakdown: [],
                supplierCostGroupBreakdown: [],
                grandNetCashflow: 0,
                monthlyBreakdown: [],
                clientMonthlySummary: [],
                topClients: [],
                topSuppliers: [],
            };
        }

        const bankQuery = `
            SELECT 
                p.pn_conto AS account_code,
                a.an_descr1 AS name,
                ISNULL(SUM(p.pn_importo), 0) AS balance,
                MAX(p.pn_datreg) AS last_entry_date
            FROM prinot p WITH (NOLOCK)
            JOIN anagra a WITH (NOLOCK) 
              ON p.pn_conto = a.an_conto AND p.codditt = a.codditt
            WHERE p.codditt = 'COOPZANARDI'
              AND p.pn_conto IN (${enabledCodes.join(',')})
            GROUP BY p.pn_conto, a.an_descr1
            ORDER BY p.pn_conto
        `;
        const bankRes = await queryMSSQL(bankQuery, {}, 'BUSINESS');
        let totalBankBalance = 0;
        const bankBalances: BankAccountBalance[] = bankRes.recordset.map((row: any) => {
            const bal = Number(row.balance || 0);
            totalBankBalance += bal;
            return {
                accountCode: Number(row.account_code),
                name: String(row.name).trim(),
                balance: bal,
                lastEntryDate: row.last_entry_date ? new Date(row.last_entry_date).toLocaleDateString('it-IT') : '',
            };
        });

        // 1. Fetch Incomes (Attivi - Clienti an_tipo = 'C', sc_darave = 'D')
        const incomesQuery = `
            SELECT 
                MONTH(sc.sc_datsca) as month_num,
                COUNT(*) as invoice_count,
                ISNULL(SUM(sc.sc_importo), 0) as total_amount,
                ISNULL(SUM(sc.sc_importoda), 0) as open_amount
            FROM scaden sc WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK)
                ON sc.sc_conto = an.an_conto
               AND sc.codditt = an.codditt
            WHERE sc.codditt = 'COOPZANARDI'
              AND sc.sc_darave = 'D'
              AND an.an_tipo = 'C'
              AND YEAR(sc.sc_datsca) = @year
            GROUP BY MONTH(sc.sc_datsca)
            ORDER BY month_num ASC
        `;

        const incomesRes = await queryMSSQL(incomesQuery, { year }, 'BUSINESS');
        const incomesMap = new Map<number, { count: number; total: number; open: number }>();
        incomesRes.recordset.forEach((row: any) => {
            incomesMap.set(row.month_num, {
                count: Number(row.invoice_count || 0),
                total: Math.abs(Number(row.total_amount || 0)),
                open: Math.abs(Number(row.open_amount || 0)),
            });
        });

        // 2. Fetch Expenses (Passivi - Fornitori an_tipo = 'F', sc_darave = 'A')
        const expensesQuery = `
            SELECT 
                MONTH(sc.sc_datsca) as month_num,
                COUNT(*) as invoice_count,
                ISNULL(SUM(sc.sc_importo), 0) as total_amount,
                ISNULL(SUM(sc.sc_importoda), 0) as open_amount
            FROM scaden sc WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK)
                ON sc.sc_conto = an.an_conto
               AND sc.codditt = an.codditt
            WHERE sc.codditt = 'COOPZANARDI'
              AND sc.sc_darave = 'A'
              AND an.an_tipo = 'F'
              AND YEAR(sc.sc_datsca) = @year
            GROUP BY MONTH(sc.sc_datsca)
            ORDER BY month_num ASC
        `;

        const expensesRes = await queryMSSQL(expensesQuery, { year }, 'BUSINESS');
        const expensesMap = new Map<number, { count: number; total: number; open: number }>();
        expensesRes.recordset.forEach((row: any) => {
            expensesMap.set(row.month_num, {
                count: Number(row.invoice_count || 0),
                total: Math.abs(Number(row.total_amount || 0)),
                open: Math.abs(Number(row.open_amount || 0)),
            });
        });

        // Check latest registered date in prinot to determine max month with real bank data
        const maxBankMonthQuery = `
            SELECT MAX(MONTH(p.pn_datreg)) as max_month
            FROM prinot p WITH (NOLOCK)
            WHERE p.codditt = 'COOPZANARDI'
              AND p.pn_conto IN (${enabledCodes.join(',')})
              AND YEAR(p.pn_datreg) = @year
        `;
        const maxBankMonthRes = await queryMSSQL(maxBankMonthQuery, { year }, 'BUSINESS');
        const maxBankMonth = maxBankMonthRes.recordset[0]?.max_month ? Number(maxBankMonthRes.recordset[0].max_month) : 0;

        const monthlyBankQuery = `
            SELECT 
                MONTH(p.pn_datreg) as month_num,
                ISNULL(SUM(CASE WHEN p.pn_importo > 0 THEN p.pn_importo ELSE 0 END), 0) as cash_in,
                ISNULL(SUM(CASE WHEN p.pn_importo < 0 THEN ABS(p.pn_importo) ELSE 0 END), 0) as cash_out,
                ISNULL(SUM(p.pn_importo), 0) as net_change,
                COUNT(*) as row_count
            FROM prinot p WITH (NOLOCK)
            WHERE p.codditt = 'COOPZANARDI'
              AND p.pn_conto IN (${enabledCodes.join(',')})
              AND YEAR(p.pn_datreg) = @year
            GROUP BY MONTH(p.pn_datreg)
            ORDER BY month_num ASC
        `;
        const monthlyBankRes = await queryMSSQL(monthlyBankQuery, { year }, 'BUSINESS');
        const monthlyBankData = new Map<number, { cashIn: number; cashOut: number; netChange: number; count: number }>();
        monthlyBankRes.recordset.forEach((row: any) => {
            monthlyBankData.set(Number(row.month_num), {
                cashIn: Number(row.cash_in || 0),
                cashOut: Number(row.cash_out || 0),
                netChange: Number(row.net_change || 0),
                count: Number(row.row_count || 0),
            });
        });

        // Get starting bank balance at start of year (all movements before target year)
        const priorBankQuery = `
            SELECT 
                ISNULL(SUM(p.pn_importo), 0) as start_balance
            FROM prinot p WITH (NOLOCK)
            WHERE p.codditt = 'COOPZANARDI'
              AND p.pn_conto IN (${enabledCodes.join(',')})
              AND YEAR(p.pn_datreg) < @year
        `;
        const priorBankRes = await queryMSSQL(priorBankQuery, { year }, 'BUSINESS');
        let currentOpening = Number(priorBankRes.recordset[0]?.start_balance || 0);

        // Per-bank opening balances prior to @year
        const perBankPriorQuery = `
            SELECT 
                p.pn_conto as account_code,
                a.an_descr1 as name,
                ISNULL(SUM(p.pn_importo), 0) as start_balance
            FROM prinot p WITH (NOLOCK)
            JOIN anagra a WITH (NOLOCK) ON p.pn_conto = a.an_conto AND p.codditt = a.codditt
            WHERE p.codditt = 'COOPZANARDI'
              AND p.pn_conto IN (${enabledCodes.join(',')})
              AND YEAR(p.pn_datreg) < @year
            GROUP BY p.pn_conto, a.an_descr1
            ORDER BY p.pn_conto
        `;
        const perBankPriorRes = await queryMSSQL(perBankPriorQuery, { year }, 'BUSINESS');
        const bankOpeningMap = new Map<number, { name: string; balance: number }>();
        perBankPriorRes.recordset.forEach((row: any) => {
            bankOpeningMap.set(Number(row.account_code), {
                name: String(row.name).trim(),
                balance: Number(row.start_balance || 0),
            });
        });

        // Per-bank monthly changes in @year
        const perBankMonthlyQuery = `
            SELECT 
                p.pn_conto as account_code,
                MONTH(p.pn_datreg) as month_num,
                ISNULL(SUM(p.pn_importo), 0) as net_change
            FROM prinot p WITH (NOLOCK)
            WHERE p.codditt = 'COOPZANARDI'
              AND p.pn_conto IN (${enabledCodes.join(',')})
              AND YEAR(p.pn_datreg) = @year
            GROUP BY p.pn_conto, MONTH(p.pn_datreg)
        `;
        const perBankMonthlyRes = await queryMSSQL(perBankMonthlyQuery, { year }, 'BUSINESS');
        const perBankMonthlyChanges = new Map<string, number>();
        perBankMonthlyRes.recordset.forEach((row: any) => {
            perBankMonthlyChanges.set(`${row.account_code}_${row.month_num}`, Number(row.net_change || 0));
        });

        // 3. Fetch Payroll cash-out from prinot (liability accounts: pn_importo < 0 = payment made)
        const payrollCodes = CASHFLOW_CONFIG.getPayrollAccountCodes();
        const payrollQuery = `
            SELECT
                p.pn_conto AS account_code,
                MONTH(p.pn_datreg) AS month_num,
                ABS(ISNULL(SUM(CASE WHEN p.pn_importo < 0 THEN p.pn_importo ELSE 0 END), 0)) AS cash_out
            FROM prinot p WITH (NOLOCK)
            WHERE p.codditt = 'COOPZANARDI'
              AND p.pn_conto IN (${payrollCodes.join(',')})
              AND YEAR(p.pn_datreg) = @year
            GROUP BY p.pn_conto, MONTH(p.pn_datreg)
            ORDER BY account_code, month_num
        `;
        const payrollRes = await queryMSSQL(payrollQuery, { year }, 'BUSINESS');

        // Build per-account payroll breakdown
        const payrollMap = new Map<number, Record<number, number>>();
        payrollRes.recordset.forEach((row: any) => {
            const code = Number(row.account_code);
            const month = Number(row.month_num);
            const amount = Number(row.cash_out || 0);
            if (!payrollMap.has(code)) payrollMap.set(code, {});
            payrollMap.get(code)![month] = amount;
        });

        const payrollMonthlyBreakdown: PayrollMonthlyBreakdown[] = CASHFLOW_CONFIG.PAYROLL_ACCOUNTS.map(acc => {
            const monthly = payrollMap.get(acc.accountCode) || {};
            const total = Object.values(monthly).reduce((s, v) => s + v, 0);
            return {
                accountCode: acc.accountCode,
                localeKey: acc.localeKey,
                monthlyAmounts: monthly,
                totalAmount: total,
            };
        });

        // Map month → total payroll for that month (sum across all 4 accounts)
        const payrollByMonth = new Map<number, number>();
        payrollMonthlyBreakdown.forEach(acc => {
            Object.entries(acc.monthlyAmounts).forEach(([m, v]) => {
                const mn = Number(m);
                payrollByMonth.set(mn, (payrollByMonth.get(mn) || 0) + v);
            });
        });
        const grandTotalPayroll = payrollMonthlyBreakdown.reduce((s, a) => s + a.totalAmount, 0);

        // 3.5 Fetch Extra Expense Categories (taxes, financing, leasing, bank fees) from prinot
        const extraExpenseCodes = CASHFLOW_CONFIG.getEnabledExtraExpenseCodes();
        const extraExpenseMap = new Map<number, Record<number, number>>();
        if (extraExpenseCodes.length > 0) {
            const extraExpenseQuery = `
                SELECT
                    p.pn_conto AS account_code,
                    MONTH(p.pn_datreg) AS month_num,
                    ABS(ISNULL(SUM(CASE WHEN p.pn_importo < 0 THEN p.pn_importo ELSE 0 END), 0)) AS cash_out
                FROM prinot p WITH (NOLOCK)
                WHERE p.codditt = 'COOPZANARDI'
                  AND p.pn_conto IN (${extraExpenseCodes.join(',')})
                  AND YEAR(p.pn_datreg) = @year
                GROUP BY p.pn_conto, MONTH(p.pn_datreg)
                ORDER BY account_code, month_num
            `;
            const extraExpenseRes = await queryMSSQL(extraExpenseQuery, { year }, 'BUSINESS');
            extraExpenseRes.recordset.forEach((row: any) => {
                const code = Number(row.account_code);
                const month = Number(row.month_num);
                const amount = Number(row.cash_out || 0);
                if (!extraExpenseMap.has(code)) extraExpenseMap.set(code, {});
                extraExpenseMap.get(code)![month] = amount;
            });
        }

        const extraExpenseBreakdown: ExtraExpenseCategoryBreakdown[] = CASHFLOW_CONFIG.EXTRA_EXPENSE_CATEGORIES
            .filter(cat => cat.enabled)
            .map(cat => {
                const catMonthlyAmounts: Record<number, number> = {};
                const accountsBreakdown = cat.accounts.map(acc => {
                    const monthly = extraExpenseMap.get(acc.accountCode) || {};
                    const total = Object.values(monthly).reduce((s, v) => s + v, 0);
                    Object.entries(monthly).forEach(([m, v]) => {
                        const mn = Number(m);
                        catMonthlyAmounts[mn] = (catMonthlyAmounts[mn] || 0) + v;
                    });
                    return {
                        accountCode: acc.accountCode,
                        label: acc.label,
                        monthlyAmounts: monthly,
                        totalAmount: total
                    };
                });
                const catTotal = Object.values(catMonthlyAmounts).reduce((s, v) => s + v, 0);
                return {
                    key: cat.key,
                    label: cat.label,
                    monthlyAmounts: catMonthlyAmounts,
                    totalAmount: catTotal,
                    accounts: accountsBreakdown
                };
            });

        const extraExpenseByMonth = new Map<number, number>();
        extraExpenseBreakdown.forEach(cat => {
            Object.entries(cat.monthlyAmounts).forEach(([m, v]) => {
                const mn = Number(m);
                extraExpenseByMonth.set(mn, (extraExpenseByMonth.get(mn) || 0) + v);
            });
        });
        const grandTotalExtraExpenses = extraExpenseBreakdown.reduce((s, c) => s + c.totalAmount, 0);

        // 4. Combine into monthly 12-month array
        const monthlyBreakdown: MonthlyFinancialItem[] = [];
        let grandTotalIncome = 0;
        let grandOpenIncome = 0;
        let totalIncomeInvoicesCount = 0;

        let grandTotalExpense = 0;
        let grandOpenExpense = 0;
        let totalExpenseInvoicesCount = 0;

        for (let m = 1; m <= 12; m++) {
            const incData = incomesMap.get(m) || { count: 0, total: 0, open: 0 };
            const expData = expensesMap.get(m) || { count: 0, total: 0, open: 0 };

            const realBank = monthlyBankData.get(m);
            const hasBankData = m <= maxBankMonth && maxBankMonth > 0 && !!realBank && realBank.count > 0;

            const incomeAmt = incData.total;
            const expenseAmt = expData.total;
            const payrollAmt = payrollByMonth.get(m) || 0;
            const extraExpenseAmt = extraExpenseByMonth.get(m) || 0;
            // Net Flow includes supplier expenses, payroll, and extra expenses
            const netAmount = incomeAmt - expenseAmt - payrollAmt - extraExpenseAmt;

            let monthOpening: number | null = null;
            let monthClosing: number | null = null;
            let monthBankBreakdown: MonthlyBankBreakdownItem[] | undefined = undefined;

            if (hasBankData && realBank) {
                monthOpening = currentOpening;
                monthClosing = currentOpening + realBank.netChange;
                currentOpening = monthClosing; // carry forward to next month's opening

                monthBankBreakdown = [];
                for (const [code, info] of Array.from(bankOpeningMap.entries())) {
                    const change = perBankMonthlyChanges.get(`${code}_${m}`) || 0;
                    const op = info.balance;
                    const cl = op + change;
                    monthBankBreakdown.push({
                        accountCode: code,
                        name: info.name,
                        opening: op,
                        closing: cl,
                    });
                    info.balance = cl; // update running balance per bank
                }
            }

            grandTotalIncome += incomeAmt;
            grandOpenIncome += incData.open;
            totalIncomeInvoicesCount += incData.count;

            grandTotalExpense += expenseAmt;
            grandOpenExpense += expData.open;
            totalExpenseInvoicesCount += expData.count;

            monthlyBreakdown.push({
                month: m,
                monthName: MONTH_NAMES[m - 1],
                incomeAmount: incomeAmt,
                expenseAmount: expenseAmt,
                payrollAmount: payrollAmt,
                extraExpenseAmount: extraExpenseAmt,
                netAmount,
                incomeCount: incData.count,
                expenseCount: expData.count,
                openingBalance: monthOpening,
                closingBalance: monthClosing,
                hasBankData,
                bankBreakdown: monthBankBreakdown,
            });
        }

        // 4. Fetch top 10 Suppliers (an_tipo = 'F')
        const topSuppliersQuery = `
            SELECT TOP 10
                sc.sc_conto as account_code,
                ISNULL(an.an_descr1, 'FORNITORE ' + CAST(sc.sc_conto AS VARCHAR)) as name,
                COUNT(*) as count,
                ISNULL(SUM(sc.sc_importo), 0) as total_amount,
                ISNULL(SUM(sc.sc_importoda), 0) as open_amount
            FROM scaden sc WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK) 
                ON sc.sc_conto = an.an_conto 
               AND sc.codditt = an.codditt
            WHERE sc.codditt = 'COOPZANARDI'
              AND sc.sc_darave = 'A'
              AND an.an_tipo = 'F'
              AND YEAR(sc.sc_datsca) = @year
            GROUP BY sc.sc_conto, an.an_descr1
            ORDER BY Math.abs(SUM(sc.sc_importo)) DESC
        `;

        // Note: SQL Server math absolute ordering
        const topSuppliersQuerySQL = `
            SELECT TOP 10
                sc.sc_conto as account_code,
                ISNULL(an.an_descr1, 'FORNITORE ' + CAST(sc.sc_conto AS VARCHAR)) as name,
                COUNT(*) as count,
                ABS(ISNULL(SUM(sc.sc_importo), 0)) as total_amount,
                ABS(ISNULL(SUM(sc.sc_importoda), 0)) as open_amount
            FROM scaden sc WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK) 
                ON sc.sc_conto = an.an_conto 
               AND sc.codditt = an.codditt
            WHERE sc.codditt = 'COOPZANARDI'
              AND sc.sc_darave = 'A'
              AND an.an_tipo = 'F'
              AND YEAR(sc.sc_datsca) = @year
            GROUP BY sc.sc_conto, an.an_descr1
            ORDER BY total_amount DESC
        `;

        const topSuppliersRes = await queryMSSQL(topSuppliersQuerySQL, { year }, 'BUSINESS');
        const topSuppliers: CounterpartySummary[] = topSuppliersRes.recordset.map((row: any) => ({
            accountCode: Number(row.account_code),
            name: String(row.name).trim(),
            totalAmount: Number(row.total_amount || 0),
            openAmount: Number(row.open_amount || 0),
            count: Number(row.count || 0),
        }));

        // 5. Fetch top 10 Clients (an_tipo = 'C')
        const topClientsQuerySQL = `
            SELECT TOP 10
                sc.sc_conto as account_code,
                ISNULL(an.an_descr1, 'CLIENTE ' + CAST(sc.sc_conto AS VARCHAR)) as name,
                COUNT(*) as count,
                ABS(ISNULL(SUM(sc.sc_importo), 0)) as total_amount,
                ABS(ISNULL(SUM(sc.sc_importoda), 0)) as open_amount
            FROM scaden sc WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK) 
                ON sc.sc_conto = an.an_conto 
               AND sc.codditt = an.codditt
            WHERE sc.codditt = 'COOPZANARDI'
              AND sc.sc_darave = 'D'
              AND an.an_tipo = 'C'
              AND YEAR(sc.sc_datsca) = @year
            GROUP BY sc.sc_conto, an.an_descr1
            ORDER BY total_amount DESC
        `;

        const topClientsRes = await queryMSSQL(topClientsQuerySQL, { year }, 'BUSINESS');
        const topClients: CounterpartySummary[] = topClientsRes.recordset.map((row: any) => ({
            accountCode: Number(row.account_code),
            name: String(row.name).trim(),
            totalAmount: Number(row.total_amount || 0),
            openAmount: Number(row.open_amount || 0),
            count: Number(row.count || 0),
        }));

        // 6. Fetch all Clients grouped monthly for Matrix expand
        const clientMonthlyQuerySQL = `
            SELECT 
                sc.sc_conto as account_code,
                ISNULL(an.an_descr1, 'CLIENTE ' + CAST(sc.sc_conto AS VARCHAR)) as name,
                MONTH(sc.sc_datsca) as month_num,
                ABS(ISNULL(SUM(sc.sc_importo), 0)) as total_amount
            FROM scaden sc WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK) 
                ON sc.sc_conto = an.an_conto 
               AND sc.codditt = an.codditt
            WHERE sc.codditt = 'COOPZANARDI'
              AND sc.sc_darave = 'D'
              AND an.an_tipo = 'C'
              AND YEAR(sc.sc_datsca) = @year
            GROUP BY sc.sc_conto, an.an_descr1, MONTH(sc.sc_datsca)
            ORDER BY sc.sc_conto, month_num
        `;

        const clientMonthlyRes = await queryMSSQL(clientMonthlyQuerySQL, { year }, 'BUSINESS');
        const clientMap = new Map<number, ClientMonthlyBreakdownItem>();

        clientMonthlyRes.recordset.forEach((row: any) => {
            const accCode = Number(row.account_code);
            const clientName = String(row.name).trim();
            const monthNum = Number(row.month_num);
            const amount = Number(row.total_amount || 0);

            if (!clientMap.has(accCode)) {
                clientMap.set(accCode, {
                    accountCode: accCode,
                    name: clientName,
                    monthlyAmounts: {},
                    totalAmount: 0,
                });
            }

            const item = clientMap.get(accCode)!;
            item.monthlyAmounts[monthNum] = amount;
            item.totalAmount += amount;
        });

        const clientMonthlySummary = Array.from(clientMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);

        // 7. Supplier cost-group breakdown — group scaden (Fornitori) by default cost account (an_controp)
        const supplierCostGroupQuery = `
            SELECT
                ISNULL(sup.an_controp, 0)          AS cost_account_code,
                ISNULL(ca.an_descr1, 'Altri Fornitori') AS cost_account_name,
                MONTH(sc.sc_datsca)                AS month_num,
                ABS(ISNULL(SUM(sc.sc_importo), 0)) AS total_amount
            FROM scaden sc WITH (NOLOCK)
            INNER JOIN anagra sup WITH (NOLOCK)
                ON sc.sc_conto = sup.an_conto AND sc.codditt = sup.codditt
            LEFT JOIN anagra ca WITH (NOLOCK)
                ON sup.an_controp = ca.an_conto AND sup.codditt = ca.codditt
            WHERE sc.codditt = 'COOPZANARDI'
              AND sc.sc_darave = 'A'
              AND sup.an_tipo = 'F'
              AND YEAR(sc.sc_datsca) = @year
            GROUP BY ISNULL(sup.an_controp, 0), ISNULL(ca.an_descr1, 'Altri Fornitori'), MONTH(sc.sc_datsca)
            ORDER BY cost_account_code, month_num
        `;
        const supplierCostGroupRes = await queryMSSQL(supplierCostGroupQuery, { year }, 'BUSINESS');

        // Aggregate into SupplierCostGroupBreakdown[]
        const costGroupMap = new Map<number, SupplierCostGroupBreakdown>();
        supplierCostGroupRes.recordset.forEach((row: any) => {
            const code    = Number(row.cost_account_code || 0);
            const label   = String(row.cost_account_name).trim();
            const month   = Number(row.month_num);
            const amount  = Number(row.total_amount || 0);
            if (!costGroupMap.has(code)) {
                costGroupMap.set(code, { costAccountCode: code, label, monthlyAmounts: {}, totalAmount: 0 });
            }
            const entry = costGroupMap.get(code)!;
            entry.monthlyAmounts[month] = (entry.monthlyAmounts[month] || 0) + amount;
            entry.totalAmount += amount;
        });

        // Sort: named groups first (by total desc), unmapped last
        const supplierCostGroupBreakdown: SupplierCostGroupBreakdown[] = Array.from(costGroupMap.values())
            .sort((a, b) => {
                if (a.costAccountCode === 0) return 1;
                if (b.costAccountCode === 0) return -1;
                return b.totalAmount - a.totalAmount;
            });

        return {
            success: true,
            year,
            bankBalances,
            totalBankBalance,
            grandTotalIncome,
            grandOpenIncome,
            totalIncomeInvoicesCount,
            grandTotalExpense,
            grandOpenExpense,
            totalExpenseInvoicesCount,
            grandTotalPayroll,
            payrollMonthlyBreakdown,
            grandTotalExtraExpenses,
            extraExpenseBreakdown,
            supplierCostGroupBreakdown,
            grandNetCashflow: grandTotalIncome - grandTotalExpense - grandTotalPayroll - grandTotalExtraExpenses,
            monthlyBreakdown,
            clientMonthlySummary,
            topClients,
            topSuppliers,
        };
    } catch (err: any) {
        console.error('Error fetching cashflow monthly data:', err);
        return {
            success: false,
            year,
            bankBalances: [],
            totalBankBalance: 0,
            grandTotalIncome: 0,
            grandOpenIncome: 0,
            totalIncomeInvoicesCount: 0,
            grandTotalExpense: 0,
            grandOpenExpense: 0,
            totalExpenseInvoicesCount: 0,
            grandTotalPayroll: 0,
            payrollMonthlyBreakdown: [],
            grandTotalExtraExpenses: 0,
            extraExpenseBreakdown: [],
            supplierCostGroupBreakdown: [],
            grandNetCashflow: 0,
            monthlyBreakdown: [],
            clientMonthlySummary: [],
            topClients: [],
            topSuppliers: [],
            error: err.message || 'Failed to fetch cashflow data',
        };
    }
}
