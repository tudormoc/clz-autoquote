/**
 * Shared parts of the Business revenue / cost reports (order-revenue-queries.ts, client-summary-queries.ts).
 *
 * - Revenue: client rows (an_tipo = 'C') of the selected period.
 * - Material costs: supplier rows of the whole order history (not date-filtered), so an order invoiced this year
 *   keeps the costs it had last year. Labour cost = NETPRO work hours × hourly rate (labour-rates.ts, set in Impostazioni).
 * - Margin = revenue − (material + labour), computed in the report once for the table, Excel and PDF.
 * - Speed: dwarehe has ~15M rows. Each report first reads the period's orders, then their full dw_commeca codes
 *   (#OrderCodes), and joins dwarehe only on those codes through its index. The steps share #temp tables in one batch.
 * - Sorting and paging happen after labour is added (sortAndPage), so labour and margin sort like any other column.
 */

import { APP_CONFIG } from '@/config/constants';
import { businessOrderCore } from './query-utils';

/** dw_tipork of delivery notes, whose dw_valore is the delivered value */
export const DELIVERY_NOTE = 'B';
export const TIMEOUT = APP_CONFIG.ANALYTICS.REPORT_QUERY_TIMEOUT_MS;
export const ORDER_CORE = businessOrderCore('dw.dw_commeca');
