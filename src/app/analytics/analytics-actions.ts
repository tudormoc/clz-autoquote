/**
 * ============================================================================
 * ANALYTICS SERVER ACTIONS
 * ============================================================================
 * 
 * This file serves as the main export point for all analytics queries.
 * 
 * ARCHITECTURE:
 * - Each report has its own action function
 * - All queries use NOLOCK hints for read-only operations
 * - Pagination is handled consistently (100 rows per page)
 * - Date filters are applied to limit data scope
 * 
 * DATABASES USED:
 * - BUSINESS: Revenue, costs, client data (dwarehe, anagra, commess tables)
 * - NETPRO: Production tracking data (SITUAZIONI, ORDINI, JOBSET tables)
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
 * FILE ORGANIZATION:
 * - queries/netpro-queries.ts: Production and Order Summary reports (NETPRO only)
 * - queries/business-queries.ts: Client Summary and Order Revenue (BUSINESS + NETPRO)
 * - queries/debug-queries.ts: Inspection and testing utilities
 * - queries/shared/: Reusable filter builders, query utils, and work time fetcher
 * 
 * ============================================================================
 */

'use server'

// Import all query functions
import {
    getProductionDataAction as getProductionData,
    getOrderSummaryDataAction as getOrderSummaryData
} from './queries/netpro-queries';

import {
    getClientSummaryDataAction as getClientSummaryData,
    getOrderRevenueDataAction as getOrderRevenueData
} from './queries/business-queries';

import {
    inspectSituazioniAction as inspectSituazioni,
    inspectOrdiniAction as inspectOrdini,
    inspectCommessAction as inspectCommess,
    inspectCommessaDataAction as inspectCommessaData,
    testSpecificQuery as testSpecific
} from './queries/debug-queries';

// Re-export with proper async wrappers for 'use server'
export const getProductionDataAction = getProductionData;
export const getOrderSummaryDataAction = getOrderSummaryData;
export const getClientSummaryDataAction = getClientSummaryData;
export const getOrderRevenueDataAction = getOrderRevenueData;
export const inspectSituazioniAction = inspectSituazioni;
export const inspectOrdiniAction = inspectOrdini;
export const inspectCommessAction = inspectCommess;
export const inspectCommessaDataAction = inspectCommessaData;
export const testSpecificQuery = testSpecific;

/**
 * Placeholder action for generic analytics data fetching
 * Can be implemented for specific use cases as needed
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
 * MAINTENANCE NOTES
 * ============================================================================
 * 
 * ADDING A NEW REPORT:
 * 1. Determine which database(s) it uses:
 *    - NETPRO only → Add to queries/netpro-queries.ts
 *    - BUSINESS only → Add to queries/business-queries.ts
 *    - Both databases → Add to queries/business-queries.ts
 * 2. Use shared utilities from queries/shared/ for:
 *    - Filter building (filter-builders.ts)
 *    - Pagination and sorting (query-utils.ts)
 *    - Work time fetching (work-time-fetcher.ts)
 * 3. Follow naming pattern: get[ReportName]DataAction
 * 4. Include standard parameters: year, page, limit, filters, sort, exportAll
 * 5. Use NOLOCK hints on all queries
 * 6. Return standard format: { success, data, pagination, error? }
 * 7. Export the new function from this file
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
