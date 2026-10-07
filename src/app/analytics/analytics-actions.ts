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
 * - queries/shared/: Reusable filter builders, query utils, and work time fetcher
 * 
 * ============================================================================
 */

'use server'

// Import all query functions
import {
    getProductionDataAction as getProductionData,
    getOrderSummaryDataAction as getOrderSummaryData,
    getAreaSummaryDataAction as getAreaSummaryData,
    getOrderAreaSummaryDataAction as getOrderAreaSummaryData
} from './queries/netpro-queries';

import {
    getClientSummaryDataAction as getClientSummaryData,
    getClientSummaryStatsAction as getClientSummaryStats,
    getOrderRevenueDataAction as getOrderRevenueData
} from './queries/business-queries';

// Re-export with proper async wrappers for 'use server'
export const getProductionDataAction = getProductionData;
export const getOrderSummaryDataAction = getOrderSummaryData;
export const getAreaSummaryDataAction = getAreaSummaryData;
export const getOrderAreaSummaryDataAction = getOrderAreaSummaryData;
export const getClientSummaryDataAction = getClientSummaryData;
export const getClientSummaryStatsAction = getClientSummaryStats;
export const getOrderRevenueDataAction = getOrderRevenueData;

import {
    getClientDeliveriesDataAction as getClientDeliveriesData,
    getClientDeliveriesStatsAction as getClientDeliveriesStats
} from './queries/client-deliveries-queries';

import {
    getPresenceDataAction as getPresenceData,
    getAvailableMonthsAction as getAvailableMonths,
    getMonthlyPresenceDataAction as getMonthlyPresenceData
} from './queries/presence-queries';

// Export Client Deliveries action
export const getClientDeliveriesDataAction = getClientDeliveriesData;
export const getClientDeliveriesStatsAction = getClientDeliveriesStats;

// Export Presence action
export const getPresenceDataAction = getPresenceData;
export const getAvailableMonthsAction = getAvailableMonths;
export const getMonthlyPresenceDataAction = getMonthlyPresenceData;
