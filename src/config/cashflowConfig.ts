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
        { accountCode: 20110015, label: 'BANCA POP.ETICA C/ANT.FATTURE', enabled: true },
    ] as CashflowBankConfig[],

    /** Helper function to get only enabled bank account codes for SQL queries */
    getEnabledAccountCodes(): number[] {
        return this.BANKS.filter(b => b.enabled).map(b => b.accountCode);
    },
};
