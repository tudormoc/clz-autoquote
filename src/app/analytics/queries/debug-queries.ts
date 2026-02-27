/**
 * Debug and Inspection Queries
 * 
 * Utility functions for inspecting database tables and testing queries.
 * These are used during development and troubleshooting.
 */

'use server'

import { queryMSSQL } from '@/lib/mssql';

/**
 * Inspect SITUAZIONI table structure
 */
export async function inspectSituazioniAction() {
    try {
        // Get columns
        const cols = await queryMSSQL(`
            SELECT COLUMN_NAME, DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'SITUAZIONI'
            ORDER BY ORDINAL_POSITION
        `, {}, 'NETPRO');

        // Get sample data
        const sample = await queryMSSQL(`
            SELECT TOP 3 * FROM SITUAZIONI 
            WHERE DATA >= '2025-01-01' AND TIPO = 'WORK'
            ORDER BY DATA DESC
        `, {}, 'NETPRO');

        return {
            success: true,
            columns: cols.recordset,
            sample: sample.recordset
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message
        };
    }
}

/**
 * Inspect ORDINI table and test joins
 */
export async function inspectOrdiniAction() {
    try {
        // Get ORDINI columns
        const cols = await queryMSSQL(`
            SELECT COLUMN_NAME, DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'ORDINI'
            ORDER BY ORDINAL_POSITION
        `, {}, 'NETPRO');

        // Get sample orders from 2025
        const orders = await queryMSSQL(`
            SELECT TOP 5 ORDINE, COMMESSA, DESCRIZIONE, QTA_COMPLETATA
            FROM ORDINI 
            WHERE COMMESSA LIKE '25%'
            ORDER BY COMMESSA DESC
        `, {}, 'NETPRO');

        // Get JOBSET to understand the link
        const jobset = await queryMSSQL(`
            SELECT TOP 5 TASK, ORDINE, OPERAZIONE
            FROM JOBSET
            ORDER BY TASK DESC
        `, {}, 'NETPRO');

        // Try to join SITUAZIONI with ORDINI
        const joined = await queryMSSQL(`
            SELECT TOP 5
                SIT.DATA,
                SIT.TASK,
                SIT.MACCHINA,
                SIT.OPERATORE,
                SIT.LAVORO,
                SIT.SETUP,
                SIT.QTA_COMPLETATA,
                JST.ORDINE,
                ORD.COMMESSA,
                ORD.DESCRIZIONE
            FROM SITUAZIONI SIT
            LEFT JOIN JOBSET JST ON SIT.TASK = JST.TASK
            LEFT JOIN ORDINI ORD ON JST.ORDINE = ORD.ORDINE
            WHERE SIT.DATA >= '2025-01-01' 
              AND SIT.TIPO = 'WORK'
              AND ORD.COMMESSA IS NOT NULL
            ORDER BY SIT.DATA DESC
        `, {}, 'NETPRO');

        return {
            success: true,
            ordiniColumns: cols.recordset,
            sampleOrders: orders.recordset,
            jobsetSample: jobset.recordset,
            joinedSample: joined.recordset
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message
        };
    }
}

/**
 * Inspect commess table structure in BUSINESS DB
 */
export async function inspectCommessAction() {
    try {
        // Get columns
        const cols = await queryMSSQL(`
            SELECT COLUMN_NAME, DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'commess'
            ORDER BY ORDINAL_POSITION
        `, {}, 'BUSINESS');

        // Get sample data
        const sample = await queryMSSQL(`
            SELECT TOP 5 *
            FROM commess WITH (NOLOCK)
            WHERE codditt = 'COOPZANARDI'
        `, {}, 'BUSINESS');

        return {
            success: true,
            columns: cols.recordset,
            sample: sample.recordset
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message
        };
    }
}

/**
 * Inspect dwarehe data for a specific commessa to understand client vs supplier
 */
export async function inspectCommessaDataAction(commessaCore: string) {
    try {
        // Get all records for this commessa with detailed info
        const result = await queryMSSQL(`
            SELECT 
                dw.dw_commeca,
                RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) as commessa_display,
                dw.dw_conto,
                an.an_descr1 as account_name,
                an.an_tipo as account_type,
                dw.dw_valfatt as invoiced_value,
                dw.dw_acqvalfatt as acquisition_value,
                dw.dw_colli as delivered_qty,
                dw.dw_collifatt as invoiced_qty,
                dw.dw_valore as delivered_value,
                dw.dw_acqvalore as acquisition_delivered_value,
                dw.dw_tipork as record_type,
                dw.dw_scenario,
                dw.dw_datmov as movement_date,
                co.co_descr1 as order_description
            FROM dwarehe dw WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK)
                ON dw.dw_conto = an.an_conto
                AND dw.codditt = an.codditt
            LEFT JOIN commess co WITH (NOLOCK)
                ON dw.dw_commeca = co.co_comme
                AND dw.codditt = co.codditt
            WHERE dw.codditt = 'COOPZANARDI'
              AND dw.dw_scenario = 1
              AND RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) = @commessaCore
            ORDER BY dw.dw_datmov DESC, dw.dw_valfatt DESC
        `, { commessaCore }, 'BUSINESS');

        // Also get distinct account types to understand the data
        const accountTypes = await queryMSSQL(`
            SELECT DISTINCT an.an_tipo, COUNT(*) as count
            FROM dwarehe dw WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK)
                ON dw.dw_conto = an.an_conto
                AND dw.codditt = an.codditt
            WHERE dw.codditt = 'COOPZANARDI'
              AND dw.dw_scenario = 1
              AND dw.dw_anno >= 2024
            GROUP BY an.an_tipo
        `, {}, 'BUSINESS');

        return {
            success: true,
            data: result.recordset,
            accountTypes: accountTypes.recordset
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message
        };
    }
}

/**
 * Test specific query - Check work time for a specific commessa
 */
export async function testSpecificQuery() {
    try {
        const commessaCode = '8337';

        // Get work time from NETPRO for this commessa
        const workTimeResult = await queryMSSQL(`
            SELECT 
                SUBSTRING(ORD.COMMESSA, 4, 4) as commessa_display,
                MIN(ORD.COMMESSA) as commessa_full,
                MIN(ORD.DESCRIZIONE) as order_description,
                SUM(SIT.LAVORO) as total_work_time,
                COUNT(DISTINCT SIT.DATA) as work_days,
                COUNT(DISTINCT SIT.OGGETTO) as operators_count,
                MIN(SIT.DATA) as first_work_date,
                MAX(SIT.DATA) as last_work_date
            FROM SITUAZIONI SIT WITH (NOLOCK)
            LEFT JOIN JOBSET JST WITH (NOLOCK) ON SIT.TASK = JST.TASK
            LEFT JOIN ORDINI ORD WITH (NOLOCK) ON JST.ORDINE = ORD.ORDINE
            WHERE SIT.TIPO = 'WORK'
              AND SIT.TIPO_OGGETTO = 'OPE'
              AND ORD.COMMESSA IS NOT NULL
              AND SUBSTRING(ORD.COMMESSA, 4, 4) = @commessaCode
            GROUP BY SUBSTRING(ORD.COMMESSA, 4, 4)
        `, { commessaCode }, 'NETPRO');

        // Get detailed breakdown by operator
        const operatorBreakdown = await queryMSSQL(`
            SELECT 
                SIT.OGGETTO as operator_code,
                MAX(OPE.NOME) as operator_name,
                SUM(SIT.LAVORO) as work_time,
                COUNT(DISTINCT SIT.DATA) as work_days
            FROM SITUAZIONI SIT WITH (NOLOCK)
            LEFT JOIN JOBSET JST WITH (NOLOCK) ON SIT.TASK = JST.TASK
            LEFT JOIN ORDINI ORD WITH (NOLOCK) ON JST.ORDINE = ORD.ORDINE
            LEFT JOIN OPERATORI OPE WITH (NOLOCK) ON SIT.OGGETTO = OPE.OPERATORE
            WHERE SIT.TIPO = 'WORK'
              AND SIT.TIPO_OGGETTO = 'OPE'
              AND ORD.COMMESSA IS NOT NULL
              AND SUBSTRING(ORD.COMMESSA, 4, 4) = @commessaCode
            GROUP BY SIT.OGGETTO
            ORDER BY SUM(SIT.LAVORO) DESC
        `, { commessaCode }, 'NETPRO');

        // Get revenue data for this commessa from BUSINESS
        const revenueData = await queryMSSQL(`
            SELECT 
                RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) as commessa_display,
                MIN(dw.dw_commeca) as commessa_full,
                MIN(co.co_descr1) as order_description,
                MIN(an.an_conto) as client_code,
                MAX(an.an_descr1) as client_name,
                SUM(dw.dw_valfatt) as total_revenue,
                MIN(dw.dw_datmov) as first_invoice_date,
                MAX(dw.dw_datmov) as last_invoice_date
            FROM dwarehe dw WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK)
                ON dw.dw_conto = an.an_conto
                AND dw.codditt = an.codditt
            LEFT JOIN commess co WITH (NOLOCK)
                ON dw.dw_commeca = co.co_comme
                AND dw.codditt = co.codditt
            WHERE dw.dw_scenario = 1
              AND dw.codditt = 'COOPZANARDI'
              AND an.an_tipo = 'C'
              AND RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) = @commessaCode
            GROUP BY RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4)
        `, { commessaCode }, 'BUSINESS');

        return {
            success: true,
            data: {
                commessa: commessaCode,
                workTime: workTimeResult.recordset[0] || null,
                operatorBreakdown: operatorBreakdown.recordset,
                revenue: revenueData.recordset[0] || null
            },
            message: `Work time analysis for commessa ${commessaCode}`
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message
        };
    }
}
