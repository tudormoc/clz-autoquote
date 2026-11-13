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
/** How many orders the grouped `dw` rows belong to: the editions of one order count once, a row with no commessa for none */
export const ORDER_COUNT = `COUNT(DISTINCT CASE WHEN dw.dw_commeca > 0 THEN ${ORDER_CORE} END)`;

const ADVANCE = APP_CONFIG.ANALYTICS.ADVANCE_ROWS;
const sqlText = (text: string) => `'${text.replace(/'/g, "''")}'`;

/**
 * Condition on a `dw` row: it is not about an advance (APP_CONFIG.ANALYTICS.ADVANCE_ROWS). A delivery note that
 * deducts the advance already invoiced ("a dedurre ns. fattura di acconto") carries the goods at their whole value
 * and the advance as a negative row: the delivered value is the first alone, so Consegne Clienti and Report Clienti
 * read their rows with this condition. Ricavo Ordini counts only the positive rows and needs none.
 */
export const NOT_ADVANCE_ROW = `(
    dw.dw_controp NOT IN (${ADVANCE.CONTROPARTITA_CODES.join(', ')})
    AND dw.dw_codart NOT IN (${ADVANCE.ARTICLE_CODES.map(sqlText).join(', ')})
    AND NOT (dw.dw_valore < 0 AND (${ADVANCE.TEXTS.map((text) => `ISNULL(dw.dw_descr, '') LIKE ${sqlText(`%${text}%`)}`).join(' OR ')}))
)`;
