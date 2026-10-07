/**
 * Shared Filter Building Utilities
 * 
 * Reusable logic for building WHERE conditions and parameters
 * for analytics queries. Handles comma-separated filters with
 * fuzzy search for single values and exact match for multiple.
 */
import type { SqlParams } from '@/lib/mssql';


/**
 * Build commessa filter for NETPRO database
 * Uses SUBSTRING(ORD.COMMESSA, 4, 4) to extract 4-digit core
 */
export function buildCommessaFilterNETPRO(
    commessaInput: string | undefined,
    conditions: string[],
    params: SqlParams
) {
    if (!commessaInput) return;

    const commessaCodes = commessaInput.split(',').map(c => c.trim()).filter(c => c);
    if (commessaCodes.length > 1) {
        // Multiple codes: exact match on codes only
        const placeholders = commessaCodes.map((_, i) => `@commessa${i}`).join(', ');
        conditions.push(`SUBSTRING(ORD.COMMESSA, 4, 4) IN (${placeholders})`);
        commessaCodes.forEach((code, i) => {
            params[`commessa${i}`] = code;
        });
    } else if (commessaCodes.length === 1) {
        // Single term: search both code and description
        conditions.push('(SUBSTRING(ORD.COMMESSA, 4, 4) LIKE @commessa OR ORD.DESCRIZIONE LIKE @commessa)');
        params.commessa = `%${commessaCodes[0]}%`;
    }
}

/**
 * Build commessa filter for BUSINESS database
 * Uses RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) to extract 4-digit core
 * 
 * @param skipSingleTermFilter - If true, don't add filter for single term (used when description search happens post-CTE)
 */
export function buildCommessaFilterBUSINESS(
    commessaInput: string | undefined,
    conditions: string[],
    params: SqlParams,
    skipSingleTermFilter: boolean = false
) {
    if (!commessaInput) return;

    const commessaTerms = commessaInput.split(',').map(c => c.trim()).filter(c => c);
    if (commessaTerms.length > 1) {
        // Multiple codes: exact match on 4-digit cores
        const placeholders = commessaTerms.map((_, i) => `@commessa${i}`).join(', ');
        conditions.push(`RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) IN (${placeholders})`);
        commessaTerms.forEach((code, i) => {
            params[`commessa${i}`] = code;
        });
    } else if (commessaTerms.length === 1 && !skipSingleTermFilter) {
        // Single term: search on 4-digit core only (description filter will be applied after CTE)
        conditions.push('RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) LIKE @commessa');
        params.commessa = `%${commessaTerms[0]}%`;
    }
}

/**
 * Build machine filter
 * Searches both machine code and machine name
 */
export function buildMachineFilter(
    machineInput: string | undefined,
    conditions: string[],
    params: SqlParams
) {
    if (!machineInput) return;

    const machineCodes = machineInput.split(',').map(m => m.trim()).filter(m => m);
    if (machineCodes.length > 1) {
        // Multiple codes: exact match on codes only
        const placeholders = machineCodes.map((_, i) => `@machine${i}`).join(', ');
        conditions.push(`SIT.MACCHINA IN (${placeholders})`);
        machineCodes.forEach((code, i) => {
            params[`machine${i}`] = code;
        });
    } else if (machineCodes.length === 1) {
        // Single term: search both code and name
        conditions.push('(SIT.MACCHINA LIKE @machine OR MAC.DESCRIZIONE LIKE @machine)');
        params.machine = `%${machineCodes[0]}%`;
    }
}

/**
 * Build operator filter
 * Searches both operator code and operator name
 */
export function buildOperatorFilter(
    operatorInput: string | undefined,
    conditions: string[],
    params: SqlParams
) {
    if (!operatorInput) return;

    const operatorCodes = operatorInput.split(',').map(o => o.trim()).filter(o => o);
    if (operatorCodes.length > 1) {
        // Multiple codes: exact match on codes only
        const placeholders = operatorCodes.map((_, i) => `@operator${i}`).join(', ');
        conditions.push(`SIT.OGGETTO IN (${placeholders})`);
        operatorCodes.forEach((code, i) => {
            params[`operator${i}`] = code;
        });
    } else if (operatorCodes.length === 1) {
        // Single term: search both code and name
        conditions.push('(SIT.OGGETTO LIKE @operator OR OPE.NOME LIKE @operator)');
        params.operator = `%${operatorCodes[0]}%`;
    }
}

/**
 * Build client filter for BUSINESS database
 * Searches both client code and client name
 */
export function buildClientFilter(
    clientInput: string | undefined,
    conditions: string[],
    params: SqlParams
) {
    if (!clientInput) return;

    const clientTerms = clientInput.split(',').map(c => c.trim()).filter(c => c);
    if (clientTerms.length > 1) {
        // Multiple codes: exact match on codes only
        const placeholders = clientTerms.map((_, i) => `@client${i}`).join(', ');
        conditions.push(`an.an_conto IN (${placeholders})`);
        clientTerms.forEach((code, i) => {
            params[`client${i}`] = code;
        });
    } else if (clientTerms.length === 1) {
        // Single term: search both code and name
        conditions.push('(an.an_conto LIKE @client OR an.an_descr1 LIKE @client)');
        params.client = `%${clientTerms[0]}%`;
    }
}

/**
 * Build client filter for order revenue queries
 * Special handling: only filters client rows, not supplier rows
 */
export function buildClientFilterForOrderRevenue(
    clientInput: string | undefined,
    conditions: string[],
    params: SqlParams
) {
    if (!clientInput) return;

    const clientTerms = clientInput.split(',').map(c => c.trim()).filter(c => c);
    if (clientTerms.length > 1) {
        // Multiple codes: exact match on codes only - only filter client rows, not suppliers
        const placeholders = clientTerms.map((_, i) => `@client${i}`).join(', ');
        conditions.push(`(an.an_tipo != 'C' OR an.an_conto IN (${placeholders}))`);
        clientTerms.forEach((code, i) => {
            params[`client${i}`] = code;
        });
    } else if (clientTerms.length === 1) {
        // Single term: search both code and name - only filter client rows, not suppliers
        conditions.push(`(an.an_tipo != 'C' OR an.an_conto LIKE @client OR an.an_descr1 LIKE @client)`);
        params.client = `%${clientTerms[0]}%`;
    }
}
