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
    /** Net flow (income - expenses - payroll - extraExpenses) */
    netAmount: number;
    /** Cash flow (opening + net flow) */
    cashFlow: number;
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

        // 1. Prepare all SQL query definitions
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

        const maxBankMonthQuery = `
            SELECT MAX(MONTH(p.pn_datreg)) as max_month
            FROM prinot p WITH (NOLOCK)
            WHERE p.codditt = 'COOPZANARDI'
              AND p.pn_conto IN (${enabledCodes.join(',')})
              AND YEAR(p.pn_datreg) = @year
        `;

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

        const priorBankQuery = `
            SELECT 
                ISNULL(SUM(p.pn_importo), 0) as start_balance
            FROM prinot p WITH (NOLOCK)
            WHERE p.codditt = 'COOPZANARDI'
              AND p.pn_conto IN (${enabledCodes.join(',')})
              AND YEAR(p.pn_datreg) < @year
        `;

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

        const extraExpenseCodes = CASHFLOW_CONFIG.getEnabledExtraExpenseCodes();
        const extraExpenseQuery = extraExpenseCodes.length > 0 ? `
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
        ` : '';

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

        // 2. Execute all 14 database queries in parallel for peak performance
        const [
            bankRes,
            incomesRes,
            expensesRes,
            maxBankMonthRes,
            monthlyBankRes,
            priorBankRes,
            perBankPriorRes,
            perBankMonthlyRes,
            payrollRes,
            extraExpenseRes,
            topSuppliersRes,
            topClientsRes,
            clientMonthlyRes,
            supplierCostGroupRes,
        ] = await Promise.all([
            queryMSSQL(bankQuery, {}, 'BUSINESS'),
            queryMSSQL(incomesQuery, { year }, 'BUSINESS'),
            queryMSSQL(expensesQuery, { year }, 'BUSINESS'),
            queryMSSQL(maxBankMonthQuery, { year }, 'BUSINESS'),
            queryMSSQL(monthlyBankQuery, { year }, 'BUSINESS'),
            queryMSSQL(priorBankQuery, { year }, 'BUSINESS'),
            queryMSSQL(perBankPriorQuery, { year }, 'BUSINESS'),
            queryMSSQL(perBankMonthlyQuery, { year }, 'BUSINESS'),
            queryMSSQL(payrollQuery, { year }, 'BUSINESS'),
            extraExpenseCodes.length > 0 
                ? queryMSSQL(extraExpenseQuery, { year }, 'BUSINESS') 
                : Promise.resolve({ recordset: [] }),
            queryMSSQL(topSuppliersQuerySQL, { year }, 'BUSINESS'),
            queryMSSQL(topClientsQuerySQL, { year }, 'BUSINESS'),
            queryMSSQL(clientMonthlyQuerySQL, { year }, 'BUSINESS'),
            queryMSSQL(supplierCostGroupQuery, { year }, 'BUSINESS'),
        ]);

        // 3. Process Bank Balances
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

        // 4. Process Incomes
        const incomesMap = new Map<number, { count: number; total: number; open: number }>();
        incomesRes.recordset.forEach((row: any) => {
            incomesMap.set(row.month_num, {
                count: Number(row.invoice_count || 0),
                total: Math.abs(Number(row.total_amount || 0)),
                open: Math.abs(Number(row.open_amount || 0)),
            });
        });

        // 5. Process Expenses
        const expensesMap = new Map<number, { count: number; total: number; open: number }>();
        expensesRes.recordset.forEach((row: any) => {
            expensesMap.set(row.month_num, {
                count: Number(row.invoice_count || 0),
                total: Math.abs(Number(row.total_amount || 0)),
                open: Math.abs(Number(row.open_amount || 0)),
            });
        });

        // 6. Process Bank monthly progression & opening balances
        const maxBankMonth = maxBankMonthRes.recordset[0]?.max_month ? Number(maxBankMonthRes.recordset[0].max_month) : 0;

        const monthlyBankData = new Map<number, { cashIn: number; cashOut: number; netChange: number; count: number }>();
        monthlyBankRes.recordset.forEach((row: any) => {
            monthlyBankData.set(Number(row.month_num), {
                cashIn: Number(row.cash_in || 0),
                cashOut: Number(row.cash_out || 0),
                netChange: Number(row.net_change || 0),
                count: Number(row.row_count || 0),
            });
        });

        let currentOpening = Number(priorBankRes.recordset[0]?.start_balance || 0);

        const bankOpeningMap = new Map<number, { name: string; balance: number }>();
        perBankPriorRes.recordset.forEach((row: any) => {
            bankOpeningMap.set(Number(row.account_code), {
                name: String(row.name).trim(),
                balance: Number(row.start_balance || 0),
            });
        });

        const perBankMonthlyChanges = new Map<string, number>();
        perBankMonthlyRes.recordset.forEach((row: any) => {
            perBankMonthlyChanges.set(`${row.account_code}_${row.month_num}`, Number(row.net_change || 0));
        });

        // 7. Process Payroll
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

        const payrollByMonth = new Map<number, number>();
        payrollMonthlyBreakdown.forEach(acc => {
            Object.entries(acc.monthlyAmounts).forEach(([m, v]) => {
                const mn = Number(m);
                payrollByMonth.set(mn, (payrollByMonth.get(mn) || 0) + v);
            });
        });
        const grandTotalPayroll = payrollMonthlyBreakdown.reduce((s, a) => s + a.totalAmount, 0);

        // 8. Process Extra Expenses
        const extraExpenseMap = new Map<number, Record<number, number>>();
        if (extraExpenseRes.recordset) {
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

        // 9. Process Top Suppliers & Clients
        const topSuppliers: CounterpartySummary[] = topSuppliersRes.recordset.map((row: any) => ({
            accountCode: Number(row.account_code),
            name: String(row.name).trim(),
            totalAmount: Number(row.total_amount || 0),
            openAmount: Number(row.open_amount || 0),
            count: Number(row.count || 0),
        }));

        const topClients: CounterpartySummary[] = topClientsRes.recordset.map((row: any) => ({
            accountCode: Number(row.account_code),
            name: String(row.name).trim(),
            totalAmount: Number(row.total_amount || 0),
            openAmount: Number(row.open_amount || 0),
            count: Number(row.count || 0),
        }));

        // 10. Process Client Monthly Summary
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
            // Cash Flow includes opening balance + net inflows/outflows
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

            // Cash Flow = Opening Balance + Net Amount (when bank data available)
            const cashFlow = (monthOpening !== null && monthOpening !== undefined) 
                ? monthOpening + netAmount 
                : netAmount;

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
                cashFlow,
                incomeCount: incData.count,
                expenseCount: expData.count,
                openingBalance: monthOpening,
                closingBalance: monthClosing,
                hasBankData,
                bankBreakdown: monthBankBreakdown,
            });
        }

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

export interface BankTransactionItem {
    id: string;
    date: string;
    formattedDate: string;
    valueDate: string | null;
    month: number;
    regNum: number;
    rowNum: number;
    docNum: number;
    docSeries: string;
    docDate: string | null;
    description: string;
    dare: number;
    avere: number;
    importo: number;
    runningBalance: number;
}

export interface BankMonthSummary {
    month: number;
    monthName: string;
    openingBalance: number;
    totalDare: number;
    totalAvere: number;
    netChange: number;
    closingBalance: number;
    transactionCount: number;
}

export interface BankAccountDetailsResult {
    success: boolean;
    accountCode: number;
    accountName: string;
    year: number;
    openingBalanceYear: number;
    closingBalanceYear: number;
    totalDareYear: number;
    totalAvereYear: number;
    transactions: BankTransactionItem[];
    monthlySummaries: BankMonthSummary[];
    error?: string;
}

/**
 * Server Action to fetch all General Ledger movements (prinot) for a specific bank account.
 * Computes progressive running balances and monthly summaries so the user can verify
 * how the final balance (e.g. 1.054.715,60) was reached step-by-step.
 */
export async function getBankAccountTransactionsAction(
    accountCode: number,
    year: number = 2026
): Promise<BankAccountDetailsResult> {
    try {
        // 1. Get bank name from anagra
        const nameQuery = `
            SELECT TOP 1 an_descr1 
            FROM anagra WITH (NOLOCK) 
            WHERE codditt = 'COOPZANARDI' AND an_conto = @accountCode
        `;
        const nameRes = await queryMSSQL(nameQuery, { accountCode }, 'BUSINESS');
        const accountName = nameRes.recordset[0]?.an_descr1 
            ? String(nameRes.recordset[0].an_descr1).trim() 
            : `Conto ${accountCode}`;

        // 2. Get opening balance prior to year
        const priorQuery = `
            SELECT ISNULL(SUM(pn_importo), 0) as start_balance
            FROM prinot WITH (NOLOCK)
            WHERE codditt = 'COOPZANARDI'
              AND pn_conto = @accountCode
              AND YEAR(pn_datreg) < @year
        `;
        const priorRes = await queryMSSQL(priorQuery, { accountCode, year }, 'BUSINESS');
        const openingBalanceYear = Number(priorRes.recordset[0]?.start_balance || 0);

        // 3. Fetch all transactions for this account in the target year
        const transactionsQuery = `
            SELECT 
                p.pn_datreg,
                p.pn_dtvaluta,
                p.pn_numreg,
                p.pn_riga,
                p.pn_numdoc,
                ISNULL(p.pn_alfdoc, '') as pn_alfdoc,
                p.pn_datdoc,
                ISNULL(p.pn_descr, '') as pn_descr,
                ISNULL(p.pn_dare, 0) as pn_dare,
                ISNULL(p.pn_avere, 0) as pn_avere,
                ISNULL(p.pn_importo, 0) as pn_importo
            FROM prinot p WITH (NOLOCK)
            WHERE p.codditt = 'COOPZANARDI'
              AND p.pn_conto = @accountCode
              AND YEAR(p.pn_datreg) = @year
            ORDER BY p.pn_datreg ASC, p.pn_numreg ASC, p.pn_riga ASC
        `;
        const txRes = await queryMSSQL(transactionsQuery, { accountCode, year }, 'BUSINESS');

        let running = openingBalanceYear;
        let totalDareYear = 0;
        let totalAvereYear = 0;

        const transactions: BankTransactionItem[] = txRes.recordset.map((row: any) => {
            const dare = Number(row.pn_dare || 0);
            const avere = Number(row.pn_avere || 0);
            const importo = Number(row.pn_importo || 0);
            running += importo;
            totalDareYear += dare;
            totalAvereYear += avere;

            const regDate = new Date(row.pn_datreg);
            const m = regDate.getMonth() + 1;

            return {
                id: `${row.pn_datreg}_${row.pn_numreg}_${row.pn_riga}`,
                date: regDate.toISOString().split('T')[0],
                formattedDate: regDate.toLocaleDateString('it-IT'),
                valueDate: row.pn_dtvaluta ? new Date(row.pn_dtvaluta).toLocaleDateString('it-IT') : null,
                month: m,
                regNum: Number(row.pn_numreg || 0),
                rowNum: Number(row.pn_riga || 0),
                docNum: Number(row.pn_numdoc || 0),
                docSeries: String(row.pn_alfdoc || '').trim(),
                docDate: row.pn_datdoc ? new Date(row.pn_datdoc).toLocaleDateString('it-IT') : null,
                description: String(row.pn_descr || '').trim(),
                dare,
                avere,
                importo,
                runningBalance: Number(running.toFixed(2)),
            };
        });

        // 4. Compute monthly summaries
        const monthlySummaries: BankMonthSummary[] = [];
        let curMonthOpening = openingBalanceYear;

        for (let m = 1; m <= 12; m++) {
            const mTx = transactions.filter(t => t.month === m);
            const mDare = mTx.reduce((s, t) => s + t.dare, 0);
            const mAvere = mTx.reduce((s, t) => s + t.avere, 0);
            const mNet = mTx.reduce((s, t) => s + t.importo, 0);
            const mClosing = curMonthOpening + mNet;

            monthlySummaries.push({
                month: m,
                monthName: MONTH_NAMES[m - 1],
                openingBalance: Number(curMonthOpening.toFixed(2)),
                totalDare: Number(mDare.toFixed(2)),
                totalAvere: Number(mAvere.toFixed(2)),
                netChange: Number(mNet.toFixed(2)),
                closingBalance: Number(mClosing.toFixed(2)),
                transactionCount: mTx.length,
            });

            curMonthOpening = mClosing;
        }

        return {
            success: true,
            accountCode,
            accountName,
            year,
            openingBalanceYear: Number(openingBalanceYear.toFixed(2)),
            closingBalanceYear: Number(running.toFixed(2)),
            totalDareYear: Number(totalDareYear.toFixed(2)),
            totalAvereYear: Number(totalAvereYear.toFixed(2)),
            transactions,
            monthlySummaries,
        };
    } catch (err: any) {
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
            error: err.message || 'Failed to fetch bank transactions',
        };
    }
}
