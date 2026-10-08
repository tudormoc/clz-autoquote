/**
 * SQL of the cashflow page (Business database, read only). Built here, run by cashflow-actions.ts.
 *
 * - scaden: due dates of client (D / an_tipo C) and supplier (A / an_tipo F) invoices, by sc_datsca
 * - prinot: General Ledger movements of bank, payroll and extra-expense accounts (pn_importo is signed)
 * Parameter @year everywhere; client / supplier name prefixes and the "other suppliers" label as parameters.
 */
import { BUSINESS_COMPANY } from '@/config/constants';

/** Which side of scaden: clients (incomes) or suppliers (expenses) */
export interface ScadenSide {
    darave: 'D' | 'A';
    anTipo: 'C' | 'F';
}
export const CLIENTS: ScadenSide = { darave: 'D', anTipo: 'C' };
export const SUPPLIERS: ScadenSide = { darave: 'A', anTipo: 'F' };

const scadenRows = (side: ScadenSide) => `
    FROM scaden sc WITH (NOLOCK)
    INNER JOIN anagra an WITH (NOLOCK)
        ON sc.sc_conto = an.an_conto
       AND sc.codditt = an.codditt
    WHERE sc.codditt = '${BUSINESS_COMPANY}'
      AND sc.sc_darave = '${side.darave}'
      AND an.an_tipo = '${side.anTipo}'
      AND YEAR(sc.sc_datsca) = @year`;

/** prinot rows of the company on these accounts */
const prinotOn = (codes: number[]) => `p.codditt = '${BUSINESS_COMPANY}' AND p.pn_conto IN (${codes.join(',')})`;

/** An amount of one month (month_num 1–12) */
export interface MonthAmountRow {
    month_num: number;
    total_amount: number;
}

/** Due amounts and invoice count per month */
export interface DueMonthRow extends MonthAmountRow {
    invoice_count: number;
}
export const monthlyDueSql = (side: ScadenSide) => `
    SELECT
        MONTH(sc.sc_datsca) as month_num,
        COUNT(*) as invoice_count,
        ISNULL(SUM(sc.sc_importo), 0) as total_amount
    ${scadenRows(side)}
    GROUP BY MONTH(sc.sc_datsca)
    ORDER BY month_num ASC`;

/** Due amounts per client and month; @namePrefix names clients without a description */
export interface ClientMonthRow extends MonthAmountRow {
    account_code: number;
    name: string;
}
export const clientMonthlySql = () => `
    SELECT
        sc.sc_conto as account_code,
        ISNULL(an.an_descr1, @namePrefix + CAST(sc.sc_conto AS VARCHAR)) as name,
        MONTH(sc.sc_datsca) as month_num,
        ABS(ISNULL(SUM(sc.sc_importo), 0)) as total_amount
    ${scadenRows(CLIENTS)}
    GROUP BY sc.sc_conto, an.an_descr1, MONTH(sc.sc_datsca)
    ORDER BY sc.sc_conto, month_num`;

/** Supplier due amounts per month, grouped by the supplier's default cost account; @otherSuppliers labels unmapped ones */
export interface CostGroupMonthRow extends MonthAmountRow {
    cost_account_code: number;
    cost_account_name: string;
}
export const supplierCostGroupSql = () => `
    SELECT
        ISNULL(sup.an_controp, 0) AS cost_account_code,
        ISNULL(ca.an_descr1, @otherSuppliers) AS cost_account_name,
        MONTH(sc.sc_datsca) AS month_num,
        ABS(ISNULL(SUM(sc.sc_importo), 0)) AS total_amount
    FROM scaden sc WITH (NOLOCK)
    INNER JOIN anagra sup WITH (NOLOCK)
        ON sc.sc_conto = sup.an_conto AND sc.codditt = sup.codditt
    LEFT JOIN anagra ca WITH (NOLOCK)
        ON sup.an_controp = ca.an_conto AND sup.codditt = ca.codditt
    WHERE sc.codditt = '${BUSINESS_COMPANY}'
      AND sc.sc_darave = '${SUPPLIERS.darave}'
      AND sup.an_tipo = '${SUPPLIERS.anTipo}'
      AND YEAR(sc.sc_datsca) = @year
    GROUP BY ISNULL(sup.an_controp, 0), ca.an_descr1, MONTH(sc.sc_datsca)
    ORDER BY cost_account_code, month_num`;

/** Current balance of each bank account (all movements) */
export interface BankBalanceRow {
    account_code: number;
    name: string;
    balance: number;
}
export const bankBalancesSql = (codes: number[]) => `
    SELECT
        p.pn_conto AS account_code,
        a.an_descr1 AS name,
        ISNULL(SUM(p.pn_importo), 0) AS balance
    FROM prinot p WITH (NOLOCK)
    JOIN anagra a WITH (NOLOCK)
      ON p.pn_conto = a.an_conto AND p.codditt = a.codditt
    WHERE ${prinotOn(codes)}
    GROUP BY p.pn_conto, a.an_descr1
    ORDER BY p.pn_conto`;

/** Last month of the year with bank movements (null when there are none) */
export interface LastBankMonthRow {
    max_month: number | null;
}
export const lastBankMonthSql = (codes: number[]) => `
    SELECT MAX(MONTH(p.pn_datreg)) as max_month
    FROM prinot p WITH (NOLOCK)
    WHERE ${prinotOn(codes)}
      AND YEAR(p.pn_datreg) = @year`;

/** Bank movements per month: net change and number of rows */
export interface BankMonthRow {
    month_num: number;
    net_change: number;
    row_count: number;
}
export const monthlyBankSql = (codes: number[]) => `
    SELECT
        MONTH(p.pn_datreg) as month_num,
        ISNULL(SUM(p.pn_importo), 0) as net_change,
        COUNT(*) as row_count
    FROM prinot p WITH (NOLOCK)
    WHERE ${prinotOn(codes)}
      AND YEAR(p.pn_datreg) = @year
    GROUP BY MONTH(p.pn_datreg)
    ORDER BY month_num ASC`;

/** A balance before the year */
export interface OpeningRow {
    start_balance: number;
}

/** Balance of all bank accounts together before the year */
export const bankOpeningSql = (codes: number[]) => `
    SELECT ISNULL(SUM(p.pn_importo), 0) as start_balance
    FROM prinot p WITH (NOLOCK)
    WHERE ${prinotOn(codes)}
      AND YEAR(p.pn_datreg) < @year`;

/** Balance of each bank account before the year */
export interface BankOpeningRow extends OpeningRow {
    account_code: number;
    name: string;
}
export const perBankOpeningSql = (codes: number[]) => `
    SELECT
        p.pn_conto as account_code,
        a.an_descr1 as name,
        ISNULL(SUM(p.pn_importo), 0) as start_balance
    FROM prinot p WITH (NOLOCK)
    JOIN anagra a WITH (NOLOCK) ON p.pn_conto = a.an_conto AND p.codditt = a.codditt
    WHERE ${prinotOn(codes)}
      AND YEAR(p.pn_datreg) < @year
    GROUP BY p.pn_conto, a.an_descr1
    ORDER BY p.pn_conto`;

/** Net change of each bank account per month */
export interface BankMonthChangeRow {
    account_code: number;
    month_num: number;
    net_change: number;
}
export const perBankMonthlySql = (codes: number[]) => `
    SELECT
        p.pn_conto as account_code,
        MONTH(p.pn_datreg) as month_num,
        ISNULL(SUM(p.pn_importo), 0) as net_change
    FROM prinot p WITH (NOLOCK)
    WHERE ${prinotOn(codes)}
      AND YEAR(p.pn_datreg) = @year
    GROUP BY p.pn_conto, MONTH(p.pn_datreg)`;

/** Money paid out of these accounts (negative movements, as a positive amount) per account and month */
export interface CashOutRow {
    account_code: number;
    month_num: number;
    cash_out: number;
}
export const cashOutByAccountSql = (codes: number[]) => `
    SELECT
        p.pn_conto AS account_code,
        MONTH(p.pn_datreg) AS month_num,
        ABS(ISNULL(SUM(CASE WHEN p.pn_importo < 0 THEN p.pn_importo ELSE 0 END), 0)) AS cash_out
    FROM prinot p WITH (NOLOCK)
    WHERE ${prinotOn(codes)}
      AND YEAR(p.pn_datreg) = @year
    GROUP BY p.pn_conto, MONTH(p.pn_datreg)
    ORDER BY account_code, month_num`;

/** Name of one account */
export interface AccountNameRow {
    an_descr1: string;
}
export const accountNameSql = () => `
    SELECT TOP 1 an_descr1
    FROM anagra WITH (NOLOCK)
    WHERE codditt = '${BUSINESS_COMPANY}' AND an_conto = @accountCode`;

/** Balance of one account before the year */
export const accountOpeningSql = () => `
    SELECT ISNULL(SUM(pn_importo), 0) as start_balance
    FROM prinot WITH (NOLOCK)
    WHERE codditt = '${BUSINESS_COMPANY}'
      AND pn_conto = @accountCode
      AND YEAR(pn_datreg) < @year`;

/** Every movement of one account in the year, in registration order */
export interface MovementRow {
    pn_datreg: Date;
    pn_numreg: number;
    pn_riga: number;
    pn_numdoc: number;
    pn_alfdoc: string;
    pn_descr: string;
    pn_dare: number;
    pn_avere: number;
    pn_importo: number;
}
export const accountMovementsSql = () => `
    SELECT
        p.pn_datreg,
        p.pn_numreg,
        p.pn_riga,
        p.pn_numdoc,
        ISNULL(p.pn_alfdoc, '') as pn_alfdoc,
        ISNULL(p.pn_descr, '') as pn_descr,
        ISNULL(p.pn_dare, 0) as pn_dare,
        ISNULL(p.pn_avere, 0) as pn_avere,
        ISNULL(p.pn_importo, 0) as pn_importo
    FROM prinot p WITH (NOLOCK)
    WHERE p.codditt = '${BUSINESS_COMPANY}'
      AND p.pn_conto = @accountCode
      AND YEAR(p.pn_datreg) = @year
    ORDER BY p.pn_datreg ASC, p.pn_numreg ASC, p.pn_riga ASC`;
