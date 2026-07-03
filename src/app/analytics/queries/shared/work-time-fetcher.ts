/**
 * Work Time Fetcher
 * 
 * Shared logic for fetching work time data from NETPRO database.
 * Used by multiple reports that need to calculate labor costs.
 * 
 * IMPORTANT: This queries NETPRO.SITUAZIONI table which tracks
 * operator work time per commessa (order).
 * 
 * COST CALCULATION PHILOSOPHY:
 * Work times include ALL historical work for each commessa, regardless of when
 * the work was performed. This matches material cost behavior - if an order was
 * invoiced in 2025 but work was done in 2024, we include that 2024 work to
 * calculate true profitability of the order.
 */

import { queryMSSQL } from '@/lib/mssql';

/**
 * Fetch work times for a list of commessa codes
 * Returns a map of commessa_code -> total_work_time
 * 
 * @param commessaCodes - Array of 4-digit commessa codes (e.g., ['8923', '7621'])
 * @returns Record mapping commessa code to work time in hours
 */
export async function fetchWorkTimesForCommessas(
    commessaCodes: string[]
): Promise<Record<string, number>> {
    if (commessaCodes.length === 0) {
        return {};
    }

    const timeParams: Record<string, any> = {};
    const placeholders = commessaCodes.map((code, i) => {
        timeParams[`code${i}`] = code;
        return `@code${i}`;
    }).join(', ');

    const timeResult = await queryMSSQL(`
        SELECT 
            SUBSTRING(MIN(ORD.COMMESSA), 4, 4) as commessa_code,
            SUM(SIT.LAVORO) as total_work_time
        FROM SITUAZIONI SIT WITH (NOLOCK)
        LEFT JOIN JOBSET JST WITH (NOLOCK) ON SIT.TASK = JST.TASK
        LEFT JOIN ORDINI ORD WITH (NOLOCK) ON JST.ORDINE = ORD.ORDINE
        WHERE SIT.TIPO = 'WORK'
          AND SIT.TIPO_OGGETTO = 'OPE'
          AND ORD.COMMESSA IS NOT NULL
          AND SUBSTRING(ORD.COMMESSA, 4, 4) IN (${placeholders})
        GROUP BY SUBSTRING(ORD.COMMESSA, 4, 4)
    `, timeParams, 'NETPRO');

    const workTimes: Record<string, number> = {};
    timeResult.recordset.forEach(row => {
        workTimes[row.commessa_code] = row.total_work_time || 0;
    });

    return workTimes;
}

/**
 * Fetch work times for commessas linked to specific clients
 * 
 * This is a two-step process:
 * 1. Get all commessas for the given clients from BUSINESS database (date-filtered to get relevant orders)
 * 2. Fetch ALL work times for those commessas from NETPRO database (no date filter)
 * 
 * IMPORTANT: Work times include ALL historical work, not just work in the date range.
 * This matches the material cost behavior - if an order was invoiced in 2025 but work
 * was done in 2024, we still include that 2024 work to calculate true profitability.
 * 
 * @param clientCodes - Array of client codes
 * @param year - Year filter (for finding relevant commessas)
 * @param startDate - Start date filter (for finding relevant commessas)
 * @param endDate - End date filter (for finding relevant commessas)
 * @returns Record mapping client code to total work cost
 */
export async function fetchWorkCostsForClients(
    clientCodes: string[],
    year: number,
    startDate: string,
    endDate: string,
    hourlyRate: number
): Promise<Record<string, number>> {
    if (clientCodes.length === 0) {
        return {};
    }

    // First get all commessas for these clients that have invoices in the date range
    const commessaParams: Record<string, any> = {
        codditt: 'COOPZANARDI',
        startDate,
        endDate,
        year
    };

    const clientPlaceholders = clientCodes.map((code, i) => {
        commessaParams[`client${i}`] = code;
        return `@client${i}`;
    }).join(', ');

    // Get commessas for these clients (filtered by invoice date to find relevant orders)
    const commessasResult = await queryMSSQL(`
        SELECT DISTINCT
            an.an_conto as client_code,
            RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) as commessa_display
        FROM dwarehe dw WITH (NOLOCK)
        INNER JOIN anagra an WITH (NOLOCK)
            ON dw.dw_conto = an.an_conto
            AND dw.codditt = an.codditt
        WHERE dw.dw_scenario = 1
          AND dw.codditt = @codditt
          AND dw.dw_anno >= @year
          AND dw.dw_datmov >= @startDate
          AND dw.dw_datmov <= @endDate
          AND an.an_tipo = 'C'
          AND dw.dw_valore <> 0
          AND dw.dw_tipork = 'B'
          AND dw.dw_commeca > 0
          AND an.an_conto IN (${clientPlaceholders})
    `, commessaParams, 'BUSINESS');

    // Get unique commessa codes
    const commessaSet = new Set(commessasResult.recordset.map(row => row.commessa_display));
    const commessaCodes = Array.from(commessaSet);

    if (commessaCodes.length === 0) {
        return {};
    }

    // Fetch ALL work times for these commessas (no date filter - includes all historical work)
    // This matches material cost behavior: if order invoiced in 2025 but work done in 2024,
    // we include that 2024 work to calculate true profitability
    const workTimeMap = await fetchWorkTimesForCommessas(commessaCodes);

    // Sum work costs per client
    const workCosts: Record<string, number> = {};
    commessasResult.recordset.forEach(row => {
        const workTime = workTimeMap[row.commessa_display] || 0;
        const workCost = workTime * hourlyRate;
        workCosts[row.client_code] = (workCosts[row.client_code] || 0) + workCost;
    });

    return workCosts;
}

/**
 * Fetch order value statistics (delivered vs billed) from BUSINESS database
 * Returns a map of commessa_code -> { delivered, billed }
 */
export async function fetchOrderValueStats(
    commessaCodes: string[]
): Promise<Record<string, { delivered: number, billed: number }>> {
    if (commessaCodes.length === 0) {
        return {};
    }

    const params: Record<string, any> = { codditt: 'COOPZANARDI' };
    const placeholders = commessaCodes.map((code, i) => {
        params[`code${i}`] = code;
        return `@code${i}`;
    }).join(', ');

    // We use dw_valore for delivered and dw_valfatt for total billed/ordered reference
    const result = await queryMSSQL(`
        SELECT 
            RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) as commessa_code,
            ISNULL(SUM(dw.dw_valore), 0) as delivered,
            ISNULL(SUM(dw.dw_valfatt), 0) as billed
        FROM dwarehe dw WITH (NOLOCK)
        WHERE dw.dw_scenario = 1
          AND dw.codditt = @codditt
          AND dw.dw_commeca > 0
          AND RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) IN (${placeholders})
        GROUP BY RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4)
    `, params, 'BUSINESS');

    const stats: Record<string, { delivered: number, billed: number }> = {};
    result.recordset.forEach(row => {
        stats[row.commessa_code] = {
            delivered: row.delivered || 0,
            billed: row.billed || 0
        };
    });

    return stats;
}

/**
 * Fetch order pages (mo_misura3) and composition (mo_matric) from BUSINESS database
 * Returns a map of commessa_code -> { pages, composition }
 */
export async function fetchOrderBusinessData(
    commessaCodes: string[]
): Promise<Record<string, { pages: number, composition: string }>> {
    if (commessaCodes.length === 0) {
        return {};
    }

    const params: Record<string, any> = { codditt: 'COOPZANARDI' };
    const placeholders = commessaCodes.map((code, i) => {
        params[`code${i}`] = code;
        return `@code${i}`;
    }).join(', ');

    const result = await queryMSSQL(`
        SELECT 
            SUBSTRING(CAST(mo_commeca AS VARCHAR), 4, 4) as commessa_code,
            MAX(mo_misura3) as order_pages,
            MAX(mo_matric) as order_composition
        FROM movord WITH (NOLOCK)
        WHERE codditt = @codditt
          AND mo_commeca > 0
          AND SUBSTRING(CAST(mo_commeca AS VARCHAR), 4, 4) IN (${placeholders})
        GROUP BY SUBSTRING(CAST(mo_commeca AS VARCHAR), 4, 4)
    `, params, 'BUSINESS');

    const dataMap: Record<string, { pages: number, composition: string }> = {};
    result.recordset.forEach(row => {
        dataMap[row.commessa_code] = {
            pages: row.order_pages || 0,
            composition: (row.order_composition || '').trim()
        };
    });

    return dataMap;
}
