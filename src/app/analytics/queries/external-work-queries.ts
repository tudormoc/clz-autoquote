/**
 * EXTERNAL WORK QUERIES (Lavorazioni Esterne)
 *
 * External work bought from suppliers, per order (commessa) and supplier, from BUSINESS:
 * dwarehe (purchase value dw_acqvalore on the contropartita codes of APP_CONFIG.ANALYTICS.SUPPLIER_CONTROPARTITA_CODES),
 * anagra (supplier names, an_tipo = 'F'), commess (order descriptions).
 */

'use server'

import { errorMessage } from '@/lib/utils';
import { queryMSSQL } from '@/lib/mssql';
import { APP_CONFIG, BUSINESS_COMPANY } from '@/config/constants';
import { readLabourRates } from './shared/labour-rates';
import { buildPaginationResult, businessOrderCore, calculateOffset, failedPage, ownEntry, sqlDirection, type SortConfig } from './shared/query-utils';
import { authorize } from '@/lib/auth/access';
import { LINKS } from '@/config/navigation';

interface SupplierFilters {
    commessa?: string;
    supplier?: string;
    dateFrom?: string;
    dateTo?: string;
}

export interface ExternalWorkRow {
    commessa_display: string;
    commessa_full: number;
    order_description: string | null;
    supplier_code: number;
    supplier_name: string;
    total_value: number;
}

const ORDER_CORE = businessOrderCore('dw.dw_commeca');

const SUPPLIER_ROWS = `
    FROM dwarehe dw WITH (NOLOCK)
    INNER JOIN anagra an WITH (NOLOCK)
        ON dw.dw_conto = an.an_conto
        AND dw.codditt = an.codditt`;

/** UI sort key → ORDER BY; ties end in order / supplier code so pages are stable */
const ORDER_BY: Record<string, (direction: string) => string> = {
    commessa: (d) => `commessa_display ${d}, commessa_full, supplier_code`,
    supplier: (d) => `supplier_name ${d}, commessa_full, supplier_code`,
    value: (d) => `total_value ${d}, commessa_full, supplier_code`,
};
const DEFAULT_ORDER_BY = 'supplier_name ASC, commessa_display DESC, commessa_full, supplier_code';

/** WHERE clause and parameters shared by the table and its summary */
function externalWorkFilter(year: number, filters?: SupplierFilters) {
    const params: Record<string, unknown> = { year };
    const conditions: string[] = [
        'dw.dw_scenario = 1',
        `dw.codditt = '${BUSINESS_COMPANY}'`,
        'dw.dw_anno >= @year',
        "an.an_tipo = 'F'",
        'dw.dw_acqvalore <> 0',
        `dw.dw_controp IN (${APP_CONFIG.ANALYTICS.SUPPLIER_CONTROPARTITA_CODES.join(', ')})`
    ];

    if (filters?.dateFrom) {
        conditions.push('dw.dw_datmov >= @dateFrom');
        params.dateFrom = filters.dateFrom;
    }
    if (filters?.dateTo) {
        conditions.push('dw.dw_datmov <= @dateTo');
        params.dateTo = filters.dateTo;
    }
    // Order number contains the term (4-digit number)
    if (filters?.commessa) {
        conditions.push(`${ORDER_CORE} LIKE @commessaTerm`);
        params.commessaTerm = `%${filters.commessa}%`;
    }
    // Supplier code or name contains the term
    if (filters?.supplier) {
        conditions.push('(an.an_conto LIKE @supplierTerm OR an.an_descr1 LIKE @supplierTerm)');
        params.supplierTerm = `%${filters.supplier}%`;
    }

    return { where: conditions.join(' AND '), params };
}

/** External work per order and supplier (one order can have several suppliers) */
export async function getExternalWorkDataAction(
    year: number,
    page: number = 1,
    limit: number = 100,
    filters?: SupplierFilters,
    sortConfig?: SortConfig
) {
    await authorize('view', LINKS.analytics['external-work']);
    try {
        const { where, params } = externalWorkFilter(year, filters);
        const orderColumns = ownEntry(ORDER_BY, sortConfig?.column);
        const orderBy = orderColumns ? orderColumns(sqlDirection(sortConfig?.direction)) : DEFAULT_ORDER_BY;

        const countResult = await queryMSSQL<{ total: number }>(`
            SELECT COUNT(*) as total
            FROM (
                SELECT dw.dw_commeca, dw.dw_conto
                ${SUPPLIER_ROWS}
                WHERE ${where}
                GROUP BY ${ORDER_CORE}, dw.dw_commeca, dw.dw_conto, an.an_descr1
            ) as subquery
        `, params, 'BUSINESS');
        const total = countResult.recordset[0].total;

        const result = await queryMSSQL<ExternalWorkRow>(`
            SELECT
                ${ORDER_CORE} as commessa_display,
                dw.dw_commeca as commessa_full,
                dw.dw_conto as supplier_code,
                an.an_descr1 as supplier_name,
                SUM(dw.dw_acqvalore) as total_value,
                co.co_descr1 as order_description
            ${SUPPLIER_ROWS}
            LEFT JOIN commess co WITH (NOLOCK)
                ON dw.dw_commeca = co.co_comme
                AND dw.codditt = co.codditt
            WHERE ${where}
            GROUP BY ${ORDER_CORE}, dw.dw_commeca, dw.dw_conto, an.an_descr1, co.co_descr1
            ORDER BY ${orderBy}
            OFFSET @offset ROWS
            FETCH NEXT @limit ROWS ONLY
        `, { ...params, offset: calculateOffset(page, limit), limit }, 'BUSINESS');

        return { success: true, data: result.recordset, pagination: buildPaginationResult(page, limit, total) };
    } catch (err) {
        return failedPage<ExternalWorkRow>(err, page, limit);
    }
}

/** Summary: total value and the value per supplier, largest first */
export async function getExternalWorkStatsAction(year: number, filters?: SupplierFilters) {
    await authorize('view', LINKS.analytics['external-work']);
    try {
        const { where, params } = externalWorkFilter(year, filters);
        const [result, rates] = await Promise.all([
            queryMSSQL<{ supplier_name: string; total_value: number }>(`
                SELECT
                    an.an_descr1 as supplier_name,
                    SUM(dw.dw_acqvalore) as total_value
                ${SUPPLIER_ROWS}
                WHERE ${where}
                GROUP BY an.an_descr1
                ORDER BY total_value DESC
            `, params, 'BUSINESS'),
            readLabourRates(),
        ]);

        const totalValue = result.recordset.reduce((sum, row) => sum + row.total_value, 0);
        // The external cost as hours of internal work at the partial rate
        const equivalentHours = Math.round(totalValue / rates.partial);
        return { success: true, data: { total_value: totalValue, equivalent_hours: equivalentHours, suppliers: result.recordset } };
    } catch (err) {
        return { success: false, error: errorMessage(err), data: { total_value: 0, equivalent_hours: 0, suppliers: [] } };
    }
}
