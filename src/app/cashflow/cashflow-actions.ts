'use server'

import { queryMSSQL } from '@/lib/mssql';

export interface MonthlyBankBreakdownItem {
    accountCode: number;
    name: string;
    opening: number;
    closing: number;
}

export interface MonthlyFinancialItem {
    month: number;
    monthName: string;
    incomeAmount: number;
    expenseAmount: number;
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
    // Expenses
    grandTotalExpense: number;
    grandOpenExpense: number;
    totalExpenseInvoicesCount: number;
    // Net Result
    grandNetCashflow: number;
    // Breakdowns
    monthlyBreakdown: MonthlyFinancialItem[];
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
              AND p.pn_conto IN (12010001, 12010002, 12010003, 12010004, 9020021, 9020037, 20110015)
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
              AND p.pn_conto IN (12010001, 12010002, 12010003, 12010004, 9020021, 9020037, 20110015)
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
              AND p.pn_conto IN (12010001, 12010002, 12010003, 12010004, 9020021, 9020037, 20110015)
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
              AND p.pn_conto IN (12010001, 12010002, 12010003, 12010004, 9020021, 9020037, 20110015)
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
              AND p.pn_conto IN (12010001, 12010002, 12010003, 12010004, 9020021, 9020037, 20110015)
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
              AND p.pn_conto IN (12010001, 12010002, 12010003, 12010004, 9020021, 9020037, 20110015)
              AND YEAR(p.pn_datreg) = @year
            GROUP BY p.pn_conto, MONTH(p.pn_datreg)
        `;
        const perBankMonthlyRes = await queryMSSQL(perBankMonthlyQuery, { year }, 'BUSINESS');
        const perBankMonthlyChanges = new Map<string, number>();
        perBankMonthlyRes.recordset.forEach((row: any) => {
            perBankMonthlyChanges.set(`${row.account_code}_${row.month_num}`, Number(row.net_change || 0));
        });

        // 3. Combine into monthly 12-month array
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
            const netAmount = incomeAmt - expenseAmt;

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
                netAmount: netAmount,
                incomeCount: incData.count,
                expenseCount: expData.count,
                openingBalance: monthOpening,
                closingBalance: monthClosing,
                hasBankData: hasBankData,
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
            grandNetCashflow: grandTotalIncome - grandTotalExpense,
            monthlyBreakdown,
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
            grandNetCashflow: 0,
            monthlyBreakdown: [],
            topClients: [],
            topSuppliers: [],
            error: err.message || 'Failed to fetch cashflow data',
        };
    }
}
