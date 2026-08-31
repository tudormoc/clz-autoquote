/**
 * Cashflow-specific configuration and account filters.
 * Single Source of Truth for cashflow metrics and bank account inclusion/exclusion.
 */

export interface CashflowBankConfig {
    /** Database Account Code (pn_conto) */
    accountCode: number;
    /** Human-readable label for UI */
    label: string;
    /** Set to false if you want to temporarily or permanently exclude this account from totals/breakdowns */
    enabled: boolean;
}

export interface CashflowPayrollConfig {
    /** Database Account Code (pn_conto) — dot-format e.g. 020.10.0001 → 20100001 */
    accountCode: number;
    /** Locale key suffix, maps to APP_COPY.cashflow.macro.payroll* */
    localeKey: 'payrollInps' | 'payrollFondoSalute' | 'payrollIrpef' | 'payrollDipendenti';
}

export const CASHFLOW_CONFIG = {
    /**
     * List of Bank Account Codes from ERP General Ledger (prinot / anagra).
     * Exact verified codes from database:
     * - 9020021  : BANCA POP. ETICA SBF
     * - 9020037  : BANCO POPOLARE C/SBF
     * - 12010001 : BANCA POPOLARE ETICA SCPA C/C
     * - 12010002 : BANCA POP. ETICA C/DEPOSITO
     * - 12010003 : BANCO POPOLARE C/C 1629
     * - 12010004 : CREDEM C/C
     * - 20110015 : BANCA POP.ETICA C/ANT.FATTURE
     * 
     * To exclude any account from cashflow calculations, simply set `enabled: false`.
     */
    BANKS: [
        { accountCode: 9020021,  label: 'BANCA POP. ETICA SBF', enabled: true },
        { accountCode: 9020037,  label: 'BANCO POPOLARE C/SBF', enabled: true },
        { accountCode: 12010001, label: 'BANCA POPOLARE ETICA SCPA C/C', enabled: true },
        { accountCode: 12010002, label: 'BANCA POP. ETICA C/DEPOSITO', enabled: false },
        { accountCode: 12010003, label: 'BANCO POPOLARE C/C 1629', enabled: true },
        { accountCode: 12010004, label: 'CREDEM C/C', enabled: true },
        { accountCode: 20110015, label: 'BANCA POP.ETICA C/ANT.FATTURE', enabled: false },
    ] as CashflowBankConfig[],

    /** Helper function to get only enabled bank account codes for SQL queries */
    getEnabledAccountCodes(): number[] {
        return this.BANKS.filter(b => b.enabled).map(b => b.accountCode);
    },

    /**
     * Payroll liability accounts from ERP General Ledger (prinot).
     * Dot-format → numeric: 020.10.0001 → 20100001
     * - 20100001 : DEBITI V/INPS
     * - 20100009 : DEBITI V/FONDO SALUTE SEMPRE
     * - 20090003 : ERARIO C/RITENUTE LAV.DIPEND.
     * - 20110004 : DEBITI VERSO DIPENDENTI
     */
    PAYROLL_ACCOUNTS: [
        { accountCode: 20100001, localeKey: 'payrollInps' },
        { accountCode: 20100009, localeKey: 'payrollFondoSalute' },
        { accountCode: 20090003, localeKey: 'payrollIrpef' },
        { accountCode: 20110004, localeKey: 'payrollDipendenti' },
    ] as CashflowPayrollConfig[],

    /** Helper to get payroll account codes for SQL queries */
    getPayrollAccountCodes(): number[] {
        return this.PAYROLL_ACCOUNTS.map(p => p.accountCode);
    },

    /**
     * Additional non-vendor cash-out categories from ERP General Ledger (prinot).
     * Grouped by category so they can be toggled on/off individually.
     */
    EXTRA_EXPENSE_CATEGORIES: [
        {
            key: 'taxes',
            label: 'Imposte, Fisco & Contributi (F24/IVA)',
            enabled: true,
            accounts: [
                { accountCode: 15010001, label: 'IVA c/Acquisti' },
                { accountCode: 15010005, label: 'IVA c/Erario' },
                { accountCode: 15010009, label: 'IVA da Mod. TR in Comp.' },
            ]
        },
        {
            key: 'financing',
            label: 'Mutui & Finanziamenti',
            enabled: false,
            accounts: [
                { accountCode: 20020018, label: 'Mutuo CFI EX DM 04/01/2021' },
            ]
        },
        {
            key: 'leasing',
            label: 'Leasing & Canoni',
            enabled: false,
            accounts: [
                { accountCode: 62010021, label: 'Alba Leasing' },
            ]
        },
        {
            key: 'bankFees',
            label: 'Spese & Oneri Bancari',
            enabled: true,
            accounts: [
                { accountCode: 71020002, label: 'Interessi Passivi Bancari' },
                { accountCode: 71020003, label: 'Interessi Passivi su Mutui' },
                { accountCode: 68020015, label: 'Spese Bancarie Diverse' },
            ]
        }
    ],

    /** Helper to get all enabled extra expense account codes */
    getEnabledExtraExpenseCodes(): number[] {
        return this.EXTRA_EXPENSE_CATEGORIES
            .filter(c => c.enabled)
            .flatMap(c => c.accounts.map(a => a.accountCode));
    }
};
