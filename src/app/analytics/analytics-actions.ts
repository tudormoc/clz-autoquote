'use server'

import { queryMSSQL, MSSQL_DB } from '@/lib/mssql';

/**
 * ============================================================================
 * ANALYTICS SERVER ACTIONS
 * ============================================================================
 * 
 * This file contains all server actions for analytics reports.
 * 
 * ARCHITECTURE:
 * - Each report has its own action function
 * - All queries use NOLOCK hints for read-only operations
 * - Pagination is handled consistently (100 rows per page)
 * - Date filters are applied to limit data scope
 * 
 * DATABASES USED:
 * - BUSINESS: Revenue, costs, client data (dwarehe, anagra, commess tables)
 * - NETPRO: Production time tracking (SITUAZIONI, ORDINI, JOBSET tables)
 * 
 * PERFORMANCE NOTES:
 * - Work time queries are separate due to cross-database limitations
 * - CTEs are used to separate client revenue from supplier costs
 * - All numeric columns use proper aggregation (SUM, MIN, MAX)
 * 
 * COST CALCULATION LOGIC:
 * - Material costs: From supplier rows (an_tipo='F') using dw_acqvalore
 * - Labor costs: Work hours from NETPRO × hourly rate from config
 * - Costs include ALL historical data for each commessa (not date-filtered)
 * - Revenue is date-filtered to show only invoices in selected period
 * 
 * ============================================================================
 */

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
 * ============================================================================
 * PRODUCTION REPORT
 * ============================================================================
 * 
 * Shows operator work time by date, machine, and commessa.
 * 
 * DATA SOURCE: NETPRO database
 * - SITUAZIONI: Time tracking records
 * - ORDINI: Order information
 * - JOBSET: Links tasks to orders
 * - MACCHINE: Machine details
 * - OPERATORI: Operator details
 * 
 * FILTERS:
 * - Date range (required)
 * - Commessa code or description (fuzzy search)
 * - Machine code or name (fuzzy search)
 * - Operator code or name (fuzzy search)
 * 
 * GROUPING: By date + machine + operator + commessa (4-digit display code)
 * 
 * PERFORMANCE: Fast - single database, indexed columns
 * ============================================================================
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
 * ============================================================================
 * CLIENT SUMMARY REPORT
 * ============================================================================
 * 
 * Shows aggregated revenue, costs, and margin per client.
 * 
 * DATA SOURCES:
 * - BUSINESS.dwarehe: Revenue and material costs
 * - BUSINESS.anagra: Client information
 * - NETPRO.SITUAZIONI: Work time tracking
 * 
 * CALCULATION LOGIC:
 * 1. Get client revenue from date-filtered invoices (an_tipo='C')
 * 2. Get ALL material costs for those commessas (an_tipo='F', no date filter)
 * 3. Get work times from NETPRO for those commessas
 * 4. Calculate: Margin = Revenue - Material Cost - Labor Cost
 * 
 * WHY NO DATE FILTER ON COSTS:
 * If an order was invoiced in 2025 but materials were purchased in 2024,
 * we still need to include those 2024 costs to calculate true profitability.
 * 
 * PERFORMANCE: Moderate - requires 3 queries (revenue, costs, work times)
 * 
 * OPTIMIZATION OPPORTUNITIES:
 * - Could cache work times if they don't change frequently
 * - Could pre-aggregate costs in a materialized view
 * ============================================================================
 */
export async function getClientSummaryDataAction(
    year: number = 2024,
    page: number = 1,
    limit: number = 100,
    filters?: {
        client?: string;
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
        const endDate = filters?.dateTo || `${year + 2}-12-31`;

        // Build WHERE conditions
        const conditions: string[] = [
            'dw.dw_scenario = 1',
            'dw.codditt = @codditt',
            'dw.dw_anno >= @year',
            'dw.dw_datmov >= @startDate',
            'dw.dw_datmov <= @endDate'
        ];

        const params: Record<string, any> = {
            codditt: 'COOPZANARDI',
            year,
            startDate,
            endDate,
            offset,
            limit
        };

        if (filters?.client) {
            const clientTerms = filters.client.split(',').map(c => c.trim()).filter(c => c);
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

        const whereClause = conditions.join(' AND ');

        // Build ORDER BY clause
        const sortColumn = sort?.column || 'revenue';
        const sortDirection = sort?.direction || 'desc';
        
        let orderByClause = '';
        switch (sortColumn) {
            case 'client':
                orderByClause = `cr.client_code ${sortDirection.toUpperCase()}`;
                break;
            case 'orders':
                orderByClause = `cr.total_orders ${sortDirection.toUpperCase()}`;
                break;
            case 'revenue':
                orderByClause = `cr.total_revenue ${sortDirection.toUpperCase()}`;
                break;
            case 'cost':
                orderByClause = `ISNULL(SUM(sc.commessa_cost), 0) ${sortDirection.toUpperCase()}`;
                break;
            case 'work_cost':
                orderByClause = `cr.total_revenue ${sortDirection.toUpperCase()}`;
                break;
            case 'margin':
                orderByClause = `(cr.total_revenue - ISNULL(SUM(sc.commessa_cost), 0)) ${sortDirection.toUpperCase()}`;
                break;
            case 'quantity':
                orderByClause = `cr.total_quantity ${sortDirection.toUpperCase()}`;
                break;
            case 'last_order':
                orderByClause = `cr.client_code ${sortDirection.toUpperCase()}`;
                break;
            default:
                orderByClause = `cr.total_revenue ${sortDirection.toUpperCase()}`;
        }

        // Get total count for pagination
        const countResult = await queryMSSQL(`
            SELECT COUNT(DISTINCT an.an_conto) as total
            FROM dwarehe dw WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK) 
                ON dw.dw_conto = an.an_conto 
                AND dw.codditt = an.codditt
            WHERE ${whereClause}
              AND an.an_tipo = 'C'
              AND dw.dw_valfatt > 0
        `, params, 'BUSINESS');

        const total = countResult.recordset[0].total;

        // Get paginated data - first get client revenue, then join with supplier costs by commessa
        const result = await queryMSSQL(`
            WITH ClientRevenue AS (
                SELECT 
                    an.an_conto as client_code,
                    an.an_descr1 as client_name,
                    COUNT(DISTINCT dw.dw_commeca) as total_orders,
                    SUM(dw.dw_valfatt) as total_revenue,
                    SUM(dw.dw_collifatt) as total_quantity
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK) 
                    ON dw.dw_conto = an.an_conto 
                    AND dw.codditt = an.codditt
                WHERE ${whereClause}
                  AND an.an_tipo = 'C'
                  AND dw.dw_valfatt > 0
                GROUP BY an.an_conto, an.an_descr1
            ),
            SupplierCosts AS (
                SELECT 
                    dw.dw_commeca,
                    SUM(dw.dw_acqvalore) as commessa_cost
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK)
                    ON dw.dw_conto = an.an_conto
                    AND dw.codditt = an.codditt
                WHERE dw.dw_scenario = 1
                  AND dw.codditt = @codditt
                  AND an.an_tipo = 'F'
                  AND dw.dw_acqvalore <> 0
                  AND dw.dw_commeca > 0
                GROUP BY dw.dw_commeca
            ),
            ClientCommessas AS (
                SELECT DISTINCT
                    an.an_conto as client_code,
                    dw.dw_commeca
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK)
                    ON dw.dw_conto = an.an_conto
                    AND dw.codditt = an.codditt
                WHERE ${whereClause}
                  AND an.an_tipo = 'C'
                  AND dw.dw_valfatt > 0
                  AND dw.dw_commeca > 0
            )
            SELECT 
                cr.client_code,
                cr.client_name,
                cr.total_orders,
                cr.total_revenue,
                ISNULL(SUM(sc.commessa_cost), 0) as total_cost,
                cr.total_quantity
            FROM ClientRevenue cr
            LEFT JOIN ClientCommessas cc ON cr.client_code = cc.client_code
            LEFT JOIN SupplierCosts sc ON cc.dw_commeca = sc.dw_commeca
            GROUP BY cr.client_code, cr.client_name, cr.total_orders, cr.total_revenue, cr.total_quantity
            ORDER BY ${orderByClause}
            ${exportAll ? '' : 'OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY'}
        `, params, 'BUSINESS');

        // Get work time from NETPRO for all commessas linked to these clients
        const clientCodes = result.recordset.map(row => row.client_code);
        let workCosts: Record<string, number> = {};
        
        if (clientCodes.length > 0) {
            // First get all commessas for these clients
            const commessaParams: Record<string, any> = {
                codditt: 'COOPZANARDI',
                startDate: filters?.dateFrom || `${year}-01-01`,
                endDate: filters?.dateTo || `${year + 2}-12-31`,
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
            const commessaCodes = [...new Set(commessasResult.recordset.map(row => row.commessa_display))];
            
            if (commessaCodes.length > 0) {
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
                
                // Map work times to commessa codes
                const workTimeMap: Record<string, number> = {};
                timeResult.recordset.forEach(row => {
                    workTimeMap[row.commessa_code] = row.total_work_time || 0;
                });
                
                // Sum work costs per client
                const { APP_CONFIG } = await import('@/config/constants');
                const hourlyRate = APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE;
                
                commessasResult.recordset.forEach(row => {
                    const workTime = workTimeMap[row.commessa_display] || 0;
                    const workCost = workTime * hourlyRate;
                    workCosts[row.client_code] = (workCosts[row.client_code] || 0) + workCost;
                });
            }
        }

        // Merge work costs into result
        const enrichedData = result.recordset.map(row => ({
            ...row,
            work_cost: workCosts[row.client_code] || 0
        }));

        return {
            success: true,
            data: enrichedData,
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
 * ============================================================================
 * ORDER REVENUE REPORT
 * ============================================================================
 * 
 * Shows revenue, costs, and margin per order (commessa).
 * 
 * DATA SOURCES:
 * - BUSINESS.dwarehe: Revenue and material costs
 * - BUSINESS.anagra: Client/supplier information
 * - BUSINESS.commess: Order descriptions
 * - NETPRO.SITUAZIONI: Work time tracking
 * 
 * CALCULATION LOGIC:
 * 1. Get revenue per commessa from date-filtered invoices
 * 2. Get ALL material costs for those commessas (no date filter)
 * 3. Get work times from NETPRO
 * 4. Calculate: Margin = Revenue - Material Cost - Labor Cost
 * 
 * GROUPING: By full commessa number (dw_commeca)
 * - This ensures each unique order is a separate row
 * - Display shows 4-digit code for readability
 * 
 * FILTERS:
 * - Date range (applied to revenue only)
 * - Commessa code or description (fuzzy search)
 * - Client code or name (fuzzy search)
 * 
 * PERFORMANCE: Moderate - requires 2 queries (revenue+costs, work times)
 * 
 * OPTIMIZATION OPPORTUNITIES:
 * - Work time query could be cached or pre-aggregated
 * - Could combine with Client Summary to reduce duplicate queries
 * ============================================================================
 */
export async function getOrderRevenueDataAction(
    year: number = 2024,
    page: number = 1,
    limit: number = 100,
    filters?: {
        commessa?: string;
        client?: string;
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
        const endDate = filters?.dateTo || `${year + 2}-12-31`;

        // Build WHERE conditions
        const conditions: string[] = [
            'dw.dw_scenario = 1',
            'dw.codditt = @codditt',
            'dw.dw_anno >= @year',
            'dw.dw_datmov >= @startDate',
            'dw.dw_datmov <= @endDate',
            'dw.dw_commeca > 0'
        ];

        const params: Record<string, any> = {
            codditt: 'COOPZANARDI',
            year,
            startDate,
            endDate,
            offset,
            limit
        };

        if (filters?.commessa) {
            const commessaTerms = filters.commessa.split(',').map(c => c.trim()).filter(c => c);
            if (commessaTerms.length > 1) {
                // Multiple codes: exact match on 4-digit cores
                const placeholders = commessaTerms.map((_, i) => `@commessa${i}`).join(', ');
                conditions.push(`RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) IN (${placeholders})`);
                commessaTerms.forEach((code, i) => {
                    params[`commessa${i}`] = code;
                });
            } else if (commessaTerms.length === 1) {
                // Single term: search on 4-digit core only (description filter will be applied after CTE)
                conditions.push('RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) LIKE @commessa');
                params.commessa = `%${commessaTerms[0]}%`;
            }
        }

        if (filters?.client) {
            const clientTerms = filters.client.split(',').map(c => c.trim()).filter(c => c);
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

        const whereClause = conditions.join(' AND ');

        // Build ORDER BY clause
        const sortColumn = sort?.column || 'revenue';
        const sortDirection = sort?.direction || 'desc';
        
        let orderByClause = '';
        switch (sortColumn) {
            case 'commessa':
                orderByClause = `RIGHT(CAST(MIN(dw.dw_commeca) / 100 AS VARCHAR), 4) ${sortDirection.toUpperCase()}`;
                break;
            case 'client':
                orderByClause = `MIN(CASE WHEN an.an_tipo = 'C' THEN an.an_conto END) ${sortDirection.toUpperCase()}`;
                break;
            case 'revenue':
                orderByClause = `SUM(CASE WHEN an.an_tipo = 'C' THEN dw.dw_valfatt ELSE 0 END) ${sortDirection.toUpperCase()}`;
                break;
            case 'cost':
                orderByClause = `SUM(CASE WHEN an.an_tipo = 'F' THEN dw.dw_acqvalore ELSE 0 END) ${sortDirection.toUpperCase()}`;
                break;
            case 'margin':
                orderByClause = `(SUM(CASE WHEN an.an_tipo = 'C' THEN dw.dw_valfatt ELSE 0 END) - SUM(CASE WHEN an.an_tipo = 'F' THEN dw.dw_acqvalore ELSE 0 END)) ${sortDirection.toUpperCase()}`;
                break;
            case 'quantity':
                orderByClause = `SUM(CASE WHEN an.an_tipo = 'C' THEN dw.dw_collifatt ELSE 0 END) ${sortDirection.toUpperCase()}`;
                break;
            default:
                orderByClause = `SUM(CASE WHEN an.an_tipo = 'C' THEN dw.dw_valfatt ELSE 0 END) ${sortDirection.toUpperCase()}`;
        }

        // Get total count for pagination
        const countResult = await queryMSSQL(`
            SELECT COUNT(DISTINCT dw.dw_commeca) as total
            FROM dwarehe dw WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK) 
                ON dw.dw_conto = an.an_conto 
                AND dw.codditt = an.codditt
            WHERE ${whereClause}
              AND an.an_tipo = 'C'
              AND dw.dw_valfatt > 0
        `, params, 'BUSINESS');

        const total = countResult.recordset[0].total;

        // Store commessa description filter separately for post-CTE filtering
        let postCTEFilter = '';
        if (filters?.commessa) {
            const commessaTerms = filters.commessa.split(',').map(c => c.trim()).filter(c => c);
            if (commessaTerms.length === 1) {
                // Single term: also search in description after CTE
                postCTEFilter = ' WHERE (cr.commessa_display LIKE @commessaDesc OR co.co_descr1 LIKE @commessaDesc)';
                params.commessaDesc = `%${commessaTerms[0]}%`;
            }
        }

        // Get paginated data with revenue AND material costs in one query
        // Use CTE to separate client revenue from supplier costs
        const result = await queryMSSQL(`
            WITH ClientRevenue AS (
                SELECT 
                    RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) as commessa_display,
                    MIN(dw.dw_commeca) as commessa_full,
                    MIN(an.an_conto) as client_code,
                    MAX(an.an_descr1) as client_name,
                    SUM(dw.dw_valfatt) as total_revenue,
                    SUM(dw.dw_collifatt) as total_quantity
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK) 
                    ON dw.dw_conto = an.an_conto 
                    AND dw.codditt = an.codditt
                WHERE ${whereClause}
                  AND an.an_tipo = 'C'
                  AND dw.dw_valfatt > 0
                GROUP BY dw.dw_commeca
            ),
            SupplierCosts AS (
                SELECT 
                    dw.dw_commeca,
                    SUM(dw.dw_acqvalore) as total_cost
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK)
                    ON dw.dw_conto = an.an_conto
                    AND dw.codditt = an.codditt
                WHERE dw.dw_scenario = 1
                  AND dw.codditt = @codditt
                  AND an.an_tipo = 'F'
                  AND dw.dw_acqvalore <> 0
                  AND dw.dw_commeca > 0
                GROUP BY dw.dw_commeca
            )
            SELECT 
                RIGHT(CAST(cr.commessa_full / 100 AS VARCHAR), 4) as commessa_display,
                cr.commessa_full,
                co.co_descr1 as order_description,
                cr.client_code,
                cr.client_name,
                cr.total_revenue,
                ISNULL(sc.total_cost, 0) as total_cost,
                cr.total_quantity
            FROM ClientRevenue cr
            LEFT JOIN SupplierCosts sc ON cr.commessa_full = sc.dw_commeca
            LEFT JOIN commess co WITH (NOLOCK)
                ON cr.commessa_full = co.co_comme
                AND co.codditt = @codditt
            ${postCTEFilter}
            ORDER BY ${orderByClause.replace('MIN(dw.dw_commeca)', 'cr.commessa_full').replace('MIN(CASE WHEN an.an_tipo = \'C\' THEN an.an_conto END)', 'cr.client_code').replace('SUM(CASE WHEN an.an_tipo = \'C\' THEN dw.dw_valfatt ELSE 0 END)', 'cr.total_revenue').replace('SUM(CASE WHEN an.an_tipo = \'F\' THEN dw.dw_acqvalore ELSE 0 END)', 'ISNULL(sc.total_cost, 0)').replace('(SUM(CASE WHEN an.an_tipo = \'C\' THEN dw.dw_valfatt ELSE 0 END) - SUM(CASE WHEN an.an_tipo = \'F\' THEN dw.dw_acqvalore ELSE 0 END))', '(cr.total_revenue - ISNULL(sc.total_cost, 0))').replace('SUM(CASE WHEN an.an_tipo = \'C\' THEN dw.dw_collifatt ELSE 0 END)', 'cr.total_quantity').replace('RIGHT(CAST(MIN(dw.dw_commeca) / 100 AS VARCHAR), 4)', 'RIGHT(CAST(cr.commessa_full / 100 AS VARCHAR), 4)')}
            ${exportAll ? '' : 'OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY'}
        `, params, 'BUSINESS');

        // Get work time from NETPRO for all commessa codes in the result
        const commessaCodesForTime = result.recordset.map(row => row.commessa_display);
        let workTimes: Record<string, number> = {};
        
        if (commessaCodesForTime.length > 0) {
            const timeParams: Record<string, any> = {};
            const placeholders = commessaCodesForTime.map((code, i) => {
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
            
            timeResult.recordset.forEach(row => {
                workTimes[row.commessa_code] = row.total_work_time || 0;
            });
        }

        // Merge work times and calculate work costs
        const { APP_CONFIG } = await import('@/config/constants');
        const hourlyRate = APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE;
        
        const enrichedData = result.recordset.map(row => ({
            ...row,
            work_time: workTimes[row.commessa_display] || 0,
            work_cost: (workTimes[row.commessa_display] || 0) * hourlyRate
        }));

        return {
            success: true,
            data: enrichedData,
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
 * ============================================================================
 * MAINTENANCE NOTES
 * ============================================================================
 * 
 * ADDING A NEW REPORT:
 * 1. Create a new action function following the naming pattern: get[ReportName]DataAction
 * 2. Include standard parameters: year, page, limit, filters, sort, exportAll
 * 3. Use NOLOCK hints on all queries
 * 4. Apply pagination with OFFSET/FETCH NEXT
 * 5. Return standard format: { success, data, pagination, error? }
 * 
 * PERFORMANCE OPTIMIZATION:
 * - Always use WHERE clauses to limit data scope
 * - Use CTEs to separate complex logic
 * - Consider caching frequently accessed data (work times, etc.)
 * - Monitor query execution times in production
 * 
 * COST CALCULATION RULES:
 * - Material costs: Always from supplier rows (an_tipo='F')
 * - Labor costs: Always from NETPRO work time × hourly rate
 * - Revenue: Always from client rows (an_tipo='C')
 * - Date filters: Apply to revenue, NOT to costs (to get full order costs)
 * 
 * COMMESSA NUMBER HANDLING:
 * - BUSINESS DB: 9-digit integer (YYSSSSRRR) → Extract with RIGHT(CAST(dw_commeca/100 AS VARCHAR), 4)
 * - NETPRO DB: 8-char string (YYSSSSRR) → Extract with SUBSTRING(COMMESSA, 4, 4)
 * - Always group by FULL number, display 4-digit code
 * 
 * COMMON PITFALLS:
 * - Don't filter costs by date (you'll miss historical costs for current orders)
 * - Don't group by 4-digit display code (multiple orders can have same code)
 * - Don't forget NOLOCK hints (can cause blocking in production)
 * - Don't forget to exclude general expenses (dw_commeca > 0)
 * 
 * ============================================================================
 */
