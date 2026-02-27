/**
 * Work Time Fetcher
 * 
 * Shared logic for fetching work time data from NETPRO database.
 * Used by multiple reports that need to calculate labor costs.
 * 
 * IMPORTANT: This queries NETPRO.SITUAZIONI table which tracks
 * operator work time per commessa (order).
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
 * 1. Get all commessas for the given clients from BUSINESS database
 * 2. Fetch work times for those commessas from NETPRO database
 * 
 * @param clientCodes - Array of client codes
 * @param year - Year filter
 * @param startDate - Start date filter
 * @param endDate - End date filter
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

    // First get all commessas for these clients
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

    // Get commessas for these clients
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
          AND dw.dw_valfatt > 0
          AND dw.dw_commeca > 0
          AND an.an_conto IN (${clientPlaceholders})
    `, commessaParams, 'BUSINESS');

    // Get unique commessa codes
    const commessaSet = new Set(commessasResult.recordset.map(row => row.commessa_display));
    const commessaCodes = Array.from(commessaSet);

    if (commessaCodes.length === 0) {
        return {};
    }

    // Fetch work times for these commessas
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
