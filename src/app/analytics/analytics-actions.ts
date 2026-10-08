/**
 * Analytics server actions: the one place the report screens import their queries from.
 * One file per report in queries/ (<report>-queries.ts); shared parts in queries/shared/:
 * netpro-work.ts (NetPro work time), business-report.ts (revenue and costs), query-utils.ts (paging, sorting),
 * filter-builders.ts, work-time-fetcher.ts (NetPro hours for the Business reports). Rules: docs/DATABASE.md.
 */

'use server'

// Import all query functions
import {
    getProductionDataAction as getProductionData,
    getOrderSummaryDataAction as getOrderSummaryData
} from './queries/production-queries';
import {
    getAreaSummaryDataAction as getAreaSummaryData,
    getOrderAreaSummaryDataAction as getOrderAreaSummaryData
} from './queries/area-queries';
import {
    getClientSummaryDataAction as getClientSummaryData,
    getClientSummaryStatsAction as getClientSummaryStats
} from './queries/client-summary-queries';
import { getOrderRevenueDataAction as getOrderRevenueData } from './queries/order-revenue-queries';

export type { OrderSummaryRow, ProductionRow } from './queries/production-queries';
export type { AreaSummaryRow, OrderAreaRow } from './queries/area-queries';
export type { ClientSummaryRow } from './queries/client-summary-queries';
export type { OrderRevenueRow } from './queries/order-revenue-queries';

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

export type { ClientDeliveryRow } from './queries/client-deliveries-queries';

import { getPresenceDataAction as getPresenceData } from './queries/presence-queries';

// Export Client Deliveries action
export const getClientDeliveriesDataAction = getClientDeliveriesData;
export const getClientDeliveriesStatsAction = getClientDeliveriesStats;

// Export Presence action
export const getPresenceDataAction = getPresenceData;
