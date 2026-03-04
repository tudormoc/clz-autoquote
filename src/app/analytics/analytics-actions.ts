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
    getOrderSummaryDataAction as getOrderSummaryData,
    getAreaSummaryDataAction as getAreaSummaryData
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
export const getAreaSummaryDataAction = getAreaSummaryData;
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
