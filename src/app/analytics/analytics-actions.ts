'use server'

import { queryMSSQL, MSSQL_DB } from '@/lib/mssql';

/**
 * Analytics Server Actions
 * All data fetching for analytics reports
 */

export async function getAnalyticsDataAction(reportId: string, params?: Record<string, any>) {
    try {
        // Placeholder - will be implemented based on specific report needs
        return {
            success: true,
            data: [],
            message: 'Analytics action ready for implementation'
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message
        };
    }
}

/**
 * Get production data from NETPRO with filters, pagination, and sorting
 */
export async function getProductionDataAction(
    year: number = 2024,
    page: number = 1,
    limit: number = 100,
    filters?: {
        commessa?: string;
        machine?: string;
        operator?: string;
        dateFrom?: string;
        dateTo?: string;
    },
    sort?: {
        column: string;
        direction: 'asc' | 'desc';
    },
    exportAll: boolean = false
) {
    try {
        const offset = (page - 1) * limit;
        const startDate = filters?.dateFrom || `${year}-01-01`;
        const endDate = filters?.dateTo || `${year + 2}-01-01`;

        // Build WHERE conditions
        const conditions: string[] = [
            'SIT.DATA >= @startDate',
            'SIT.DATA <= @endDate',
            'SIT.TIPO = @tipo',
            'SIT.TIPO_OGGETTO = @tipoOggetto',
            'ORD.COMMESSA IS NOT NULL'
        ];

        const params: Record<string, any> = {
            startDate,
            endDate,
            tipo: 'WORK',
            tipoOggetto: 'OPE',
            offset,
            limit
        };

        if (filters?.commessa) {
            const commessaCodes = filters.commessa.split(',').map(c => c.trim()).filter(c => c);
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

        if (filters?.machine) {
            const machineCodes = filters.machine.split(',').map(m => m.trim()).filter(m => m);
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

        if (filters?.operator) {
            const operatorCodes = filters.operator.split(',').map(o => o.trim()).filter(o => o);
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

        const whereClause = conditions.join(' AND ');

        // Build ORDER BY clause
        const sortColumn = sort?.column || 'date';
        const sortDirection = sort?.direction || 'asc';
        
        let orderByClause = '';
        switch (sortColumn) {
            case 'date':
                orderByClause = `SIT.DATA ${sortDirection.toUpperCase()}`;
                break;
            case 'commessa':
                orderByClause = `SUBSTRING(MIN(ORD.COMMESSA), 4, 4) ${sortDirection.toUpperCase()}`;
                break;
            case 'machine':
                orderByClause = `SIT.MACCHINA ${sortDirection.toUpperCase()}`;
                break;
            case 'operator':
                orderByClause = `SIT.OGGETTO ${sortDirection.toUpperCase()}`;
                break;
            case 'time':
                orderByClause = `SUM(SIT.LAVORO) ${sortDirection.toUpperCase()}`;
                break;
            case 'qty':
                orderByClause = `SUM(SIT.QTA_COMPLETATA) ${sortDirection.toUpperCase()}`;
                break;
            case 'qty_requested':
                orderByClause = `MAX(JST.QTA_RICHIESTA) ${sortDirection.toUpperCase()}`;
                break;
            default:
                orderByClause = `SIT.DATA ${sortDirection.toUpperCase()}`;
        }

        // Get total count for pagination (includes all joins needed for filters)
        const countResult = await queryMSSQL(`
            SELECT COUNT(*) as total
            FROM (
                SELECT 1 as dummy
                FROM SITUAZIONI SIT WITH (NOLOCK)
                LEFT JOIN JOBSET JST WITH (NOLOCK) ON SIT.TASK = JST.TASK
                LEFT JOIN ORDINI ORD WITH (NOLOCK) ON JST.ORDINE = ORD.ORDINE
                LEFT JOIN MACCHINE MAC WITH (NOLOCK) ON SIT.MACCHINA = MAC.MACCHINA
                LEFT JOIN OPERATORI OPE WITH (NOLOCK) ON SIT.OGGETTO = OPE.OPERATORE
                WHERE ${whereClause}
                GROUP BY SIT.DATA, SIT.MACCHINA, SIT.OGGETTO, SUBSTRING(ORD.COMMESSA, 4, 4)
            ) AS grouped_data
        `, params, 'NETPRO');

        const total = countResult.recordset[0].total;

        // Get paginated data with grouping by core commessa number
        const result = await queryMSSQL(`
            SELECT 
                SIT.DATA as date,
                SIT.MACCHINA as machine,
                MAX(MAC.DESCRIZIONE) as machine_name,
                SIT.OGGETTO as operator,
                MAX(OPE.NOME) as operator_name,
                SUM(SIT.LAVORO) as work_time,
                SUM(SIT.QTA_COMPLETATA) as qty_completed,
                MAX(JST.QTA_RICHIESTA) as qty_requested,
                MIN(ORD.COMMESSA) as commessa_full,
                SUBSTRING(MIN(ORD.COMMESSA), 4, 4) as commessa_display,
                MIN(ORD.DESCRIZIONE) as order_description
            FROM SITUAZIONI SIT WITH (NOLOCK)
            LEFT JOIN JOBSET JST WITH (NOLOCK) ON SIT.TASK = JST.TASK
            LEFT JOIN ORDINI ORD WITH (NOLOCK) ON JST.ORDINE = ORD.ORDINE
            LEFT JOIN MACCHINE MAC WITH (NOLOCK) ON SIT.MACCHINA = MAC.MACCHINA
            LEFT JOIN OPERATORI OPE WITH (NOLOCK) ON SIT.OGGETTO = OPE.OPERATORE
            WHERE ${whereClause}
            GROUP BY SIT.DATA, SIT.MACCHINA, SIT.OGGETTO, SUBSTRING(ORD.COMMESSA, 4, 4)
            ORDER BY ${orderByClause}
            ${exportAll ? '' : 'OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY'}
        `, params, 'NETPRO');

        return {
            success: true,
            data: result.recordset,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message,
            data: [],
            pagination: { page: 1, limit, total: 0, totalPages: 0 }
        };
    }
}

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
 * Test specific query - Check OGGETTO field
 */
export async function testSpecificQuery() {
    try {
        // Check SITUAZIONI table columns for QTA fields
        const columns = await queryMSSQL(`
            SELECT COLUMN_NAME, DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'SITUAZIONI'
              AND COLUMN_NAME LIKE '%QTA%'
            ORDER BY ORDINAL_POSITION
        `, {}, 'NETPRO');

        // Get sample data with all QTA fields
        const sample = await queryMSSQL(`
            SELECT TOP 10
                SIT.TASK,
                SIT.DATA,
                SIT.MACCHINA,
                SIT.OGGETTO,
                SIT.TIPO_OGGETTO,
                SIT.QTA_COMPLETATA,
                SIT.QTA_RICHIESTA,
                SIT.QTA_SCARTO,
                ORD.COMMESSA
            FROM SITUAZIONI SIT WITH (NOLOCK)
            LEFT JOIN JOBSET JST WITH (NOLOCK) ON SIT.TASK = JST.TASK
            LEFT JOIN ORDINI ORD WITH (NOLOCK) ON JST.ORDINE = ORD.ORDINE
            WHERE SIT.DATA >= '2025-01-01'
              AND SIT.TIPO = 'WORK'
              AND SIT.TIPO_OGGETTO = 'OPE'
              AND ORD.COMMESSA IS NOT NULL
            ORDER BY SIT.DATA DESC
        `, {}, 'NETPRO');

        return {
            success: true,
            columns: columns.recordset,
            sample: sample.recordset,
            message: 'Checking all QTA fields in SITUAZIONI table'
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message
        };
    }
}
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
 * Get order summary data grouped by machine (sums operator time per machine)
 * Uses same data source as Production Report (TIPO_OGGETTO='OPE') but groups by machine
 */
export async function getOrderSummaryDataAction(
    year: number = 2024,
    page: number = 1,
    limit: number = 100,
    filters?: {
        commessa?: string;
        machine?: string;
        dateFrom?: string;
        dateTo?: string;
    },
    sort?: {
        column: string;
        direction: 'asc' | 'desc';
    },
    exportAll: boolean = false
) {
    try {
        const offset = (page - 1) * limit;
        const startDate = filters?.dateFrom || `${year}-01-01`;
        const endDate = filters?.dateTo || `${year + 2}-01-01`;

        // Build WHERE conditions - using OPE data (same as Production Report)
        const conditions: string[] = [
            'SIT.DATA >= @startDate',
            'SIT.DATA <= @endDate',
            'SIT.TIPO = @tipo',
            'SIT.TIPO_OGGETTO = @tipoOggetto',
            'ORD.COMMESSA IS NOT NULL'
        ];

        const params: Record<string, any> = {
            startDate,
            endDate,
            tipo: 'WORK',
            tipoOggetto: 'OPE',
            offset,
            limit
        };

        if (filters?.commessa) {
            const commessaCodes = filters.commessa.split(',').map(c => c.trim()).filter(c => c);
            if (commessaCodes.length > 1) {
                const placeholders = commessaCodes.map((_, i) => `@commessa${i}`).join(', ');
                conditions.push(`SUBSTRING(ORD.COMMESSA, 4, 4) IN (${placeholders})`);
                commessaCodes.forEach((code, i) => {
                    params[`commessa${i}`] = code;
                });
            } else if (commessaCodes.length === 1) {
                conditions.push('(SUBSTRING(ORD.COMMESSA, 4, 4) LIKE @commessa OR ORD.DESCRIZIONE LIKE @commessa)');
                params.commessa = `%${commessaCodes[0]}%`;
            }
        }

        if (filters?.machine) {
            const machineCodes = filters.machine.split(',').map(m => m.trim()).filter(m => m);
            if (machineCodes.length > 1) {
                const placeholders = machineCodes.map((_, i) => `@machine${i}`).join(', ');
                conditions.push(`SIT.MACCHINA IN (${placeholders})`);
                machineCodes.forEach((code, i) => {
                    params[`machine${i}`] = code;
                });
            } else if (machineCodes.length === 1) {
                conditions.push('(SIT.MACCHINA LIKE @machine OR MAC.DESCRIZIONE LIKE @machine)');
                params.machine = `%${machineCodes[0]}%`;
            }
        }

        const whereClause = conditions.join(' AND ');

        // Build ORDER BY clause
        const sortColumn = sort?.column || 'commessa';
        const sortDirection = sort?.direction || 'asc';
        
        let orderByClause = '';
        switch (sortColumn) {
            case 'commessa':
                orderByClause = `SUBSTRING(MIN(ORD.COMMESSA), 4, 4) ${sortDirection.toUpperCase()}`;
                break;
            case 'machine':
                orderByClause = `SIT.MACCHINA ${sortDirection.toUpperCase()}`;
                break;
            case 'time':
                orderByClause = `SUM(SIT.LAVORO) ${sortDirection.toUpperCase()}`;
                break;
            case 'qty':
                orderByClause = `SUM(SIT.QTA_COMPLETATA) ${sortDirection.toUpperCase()}`;
                break;
            case 'qty_requested':
                orderByClause = `MAX(JST.QTA_RICHIESTA) ${sortDirection.toUpperCase()}`;
                break;
            default:
                orderByClause = `SUBSTRING(MIN(ORD.COMMESSA), 4, 4) ${sortDirection.toUpperCase()}`;
        }

        // Get total count for pagination
        const countResult = await queryMSSQL(`
            SELECT COUNT(*) as total
            FROM (
                SELECT 1 as dummy
                FROM SITUAZIONI SIT WITH (NOLOCK)
                LEFT JOIN JOBSET JST WITH (NOLOCK) ON SIT.TASK = JST.TASK
                LEFT JOIN ORDINI ORD WITH (NOLOCK) ON JST.ORDINE = ORD.ORDINE
                LEFT JOIN MACCHINE MAC WITH (NOLOCK) ON SIT.MACCHINA = MAC.MACCHINA
                WHERE ${whereClause}
                GROUP BY SIT.MACCHINA, SUBSTRING(ORD.COMMESSA, 4, 4)
            ) AS grouped_data
        `, params, 'NETPRO');

        const total = countResult.recordset[0].total;

        // Get paginated data grouped by machine + commessa (summing all operators and dates)
        const result = await queryMSSQL(`
            SELECT 
                SIT.MACCHINA as machine,
                MAX(MAC.DESCRIZIONE) as machine_name,
                SUM(SIT.LAVORO) as work_time,
                SUM(SIT.QTA_COMPLETATA) as qty_completed,
                MAX(JST.QTA_RICHIESTA) as qty_requested,
                MIN(ORD.COMMESSA) as commessa_full,
                SUBSTRING(MIN(ORD.COMMESSA), 4, 4) as commessa_display,
                MIN(ORD.DESCRIZIONE) as order_description
            FROM SITUAZIONI SIT WITH (NOLOCK)
            LEFT JOIN JOBSET JST WITH (NOLOCK) ON SIT.TASK = JST.TASK
            LEFT JOIN ORDINI ORD WITH (NOLOCK) ON JST.ORDINE = ORD.ORDINE
            LEFT JOIN MACCHINE MAC WITH (NOLOCK) ON SIT.MACCHINA = MAC.MACCHINA
            WHERE ${whereClause}
            GROUP BY SIT.MACCHINA, SUBSTRING(ORD.COMMESSA, 4, 4)
            ORDER BY ${orderByClause}
            ${exportAll ? '' : 'OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY'}
        `, params, 'NETPRO');

        return {
            success: true,
            data: result.recordset,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message,
            data: [],
            pagination: { page: 1, limit, total: 0, totalPages: 0 }
        };
    }
}
