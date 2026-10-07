/** Shapes returned by the cashflow server actions (src/app/cashflow/cashflow-actions.ts). */
import type { CashflowPayrollConfig } from '@/config/cashflowConfig';

/** Amount per month, keyed 1–12 */
export type MonthlyAmounts = Record<number, number>;

export interface MonthlyBankBreakdownItem {
    accountCode: number;
    name: string;
    opening: number;
    closing: number;
}

export interface ClientMonthlyBreakdownItem {
    accountCode: number;
    name: string;
    monthlyAmounts: MonthlyAmounts;
    totalAmount: number;
}

export interface PayrollMonthlyBreakdown {
    /** pn_conto account code */
    accountCode: number;
    /** Locale key of the label in APP_COPY.cashflow.macro */
    localeKey: CashflowPayrollConfig['localeKey'];
    /** Monthly cash-out amounts */
    monthlyAmounts: MonthlyAmounts;
    totalAmount: number;
}

export interface ExtraExpenseCategoryBreakdown {
    key: string;
    label: string;
    monthlyAmounts: MonthlyAmounts;
    totalAmount: number;
    accounts: {
        accountCode: number;
        label: string;
        monthlyAmounts: MonthlyAmounts;
        totalAmount: number;
    }[];
}

/** Supplier invoices grouped by their default cost account (an_controp → cost account name) */
export interface SupplierCostGroupBreakdown {
    /** Cost account code (an_controp); 0 = not mapped ("Altri Fornitori") */
    costAccountCode: number;
    /** Cost account name from anagra */
    label: string;
    monthlyAmounts: MonthlyAmounts;
    totalAmount: number;
}

export interface MonthlyFinancialItem {
    month: number;
    monthName: string;
    incomeAmount: number;
    /** Supplier expenses (scaden) */
    expenseAmount: number;
    /** Payroll cash-out from prinot */
    payrollAmount: number;
    /** Other cash-out (taxes, financing, fees, leasing) */
    extraExpenseAmount: number;
    /** income − expenses − payroll − extra expenses */
    netAmount: number;
    /** Opening balance + net flow (net flow alone when there is no bank data) */
    cashFlow: number;
    openingBalance?: number | null;
    closingBalance?: number | null;
    hasBankData?: boolean;
    bankBreakdown?: MonthlyBankBreakdownItem[];
}

export interface BankAccountBalance {
    accountCode: number;
    name: string;
    balance: number;
}

export interface CashflowDataResult {
    success: boolean;
    year: number;
    // Bank balances (General Ledger / prinot)
    bankBalances: BankAccountBalance[];
    totalBankBalance: number;
    // Incomes (clients, scaden)
    grandTotalIncome: number;
    totalIncomeInvoicesCount: number;
    // Expenses (suppliers, scaden)
    grandTotalExpense: number;
    totalExpenseInvoicesCount: number;
    // Payroll (prinot)
    grandTotalPayroll: number;
    payrollMonthlyBreakdown: PayrollMonthlyBreakdown[];
    // Extra expenses (taxes, financing, fees, leasing)
    grandTotalExtraExpenses: number;
    extraExpenseBreakdown: ExtraExpenseCategoryBreakdown[];
    // Suppliers grouped by ERP cost account (an_controp)
    supplierCostGroupBreakdown: SupplierCostGroupBreakdown[];
    grandNetCashflow: number;
    monthlyBreakdown: MonthlyFinancialItem[];
    clientMonthlySummary: ClientMonthlyBreakdownItem[];
    error?: string;
}

export interface BankTransactionItem {
    id: string;
    /** "YYYY-MM-DD" */
    date: string;
    formattedDate: string;
    month: number;
    regNum: number;
    rowNum: number;
    docNum: number;
    docSeries: string;
    description: string;
    dare: number;
    avere: number;
    /** Signed amount: positive = Dare, negative = Avere */
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
