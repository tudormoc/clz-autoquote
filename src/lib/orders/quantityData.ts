/**
 * Reads the quantities of one edition where Business and NetPro store them (server only, read queries), for the
 * "Quantità" tab: the ordered quantity and the maximum quantity to produce of the impegno cliente row (the truth),
 * of the Business production order (its row and its phases) and of the NetPro order (the order, its operations, tasks
 * and jobset). Compared by documentFacts.ts with the rules of quantities.ts; facts in docs/ORDER_PROCESS.md → Quantities.
 */
import { BUSINESS_COMPANY } from '@/config/constants';
import { queryMSSQL } from '@/lib/mssql';
import { PLACEHOLDER_MATERIAL } from '@/lib/orders/compare';
import { docRef, type DocumentRow, type DocumentRows } from '@/lib/orders/documentRows';
import type { BusinessOrderRef } from '@/lib/orders/management';
import type { DocumentPlace, DocumentSide, OrderQuantities, OrderQuantityRow, PlaceValue } from '@/types';

/** A distinct value of a per-record place and how many records hold it */
interface GroupedRow {
    place: string;
    value: number;
    n: number;
}

const num = (value: unknown) => Number(value) || 0;
const one = (value: number): PlaceValue<number>[] => [{ value, rows: 1 }];
/** The distinct values of one grouped place, the most frequent first */
const grouped = (rows: GroupedRow[], place: string): PlaceValue<number>[] =>
    rows.filter((row) => row.place === place).map((row) => ({ value: num(row.value), rows: num(row.n) })).sort((a, b) => b.rows - a.rows);
/** A place with its values, or nothing when the table has no records (an order without phases) */
const place = (table: string, column: string, values: PlaceValue<number>[]): DocumentPlace<number>[] => (values.length ? [{ table, column, values }] : []);

/**
 * Quantity of the phases of the production order (attivit) and "per pieces" of the DiBa's material rows (movdis: Riallinea
 * sets it to the ordered quantity; the MP_FITTIZIA placeholder's row is left out), as distinct values
 */
function loadBusinessQuantities(order: BusinessOrderRef) {
    return queryMSSQL<GroupedRow>(`
        SELECT 'phases' AS place, at_qtapr AS value, COUNT(*) AS n
        FROM attivit WITH (NOLOCK)
        WHERE codditt = '${BUSINESS_COMPANY}' AND at_tipork = 'H' AND at_anno = @anno AND at_numord = @numord AND at_riga = @riga
        GROUP BY at_qtapr
        UNION ALL
        SELECT 'perpz', md_perpz, COUNT(*)
        FROM movdis WITH (NOLOCK)
        WHERE codditt = '${BUSINESS_COMPANY}' AND md_coddb = @codart AND md_codfigli <> @placeholder
        GROUP BY md_perpz
    `, { anno: order.anno, numord: order.numord, riga: order.riga, codart: order.codart, placeholder: PLACEHOLDER_MATERIAL }, 'BUSINESS');
}

/** The NetPro production order's quantity, and those of its operations, tasks and jobset as distinct values */
function loadNetproQuantities(make: string) {
    return queryMSSQL<GroupedRow>(`
        SELECT 'order' AS place, QTA_RICHIESTA AS value, 1 AS n FROM ORDINI WITH (NOLOCK) WHERE ORDINE = @make
        UNION ALL
        SELECT 'operBase', QTA_BASE, COUNT(*) FROM OPERAZIONI WITH (NOLOCK) WHERE ORDINE = @make GROUP BY QTA_BASE
        UNION ALL
        SELECT 'operRichiesta', QTA_RICHIESTA, COUNT(*) FROM OPERAZIONI WITH (NOLOCK) WHERE ORDINE = @make GROUP BY QTA_RICHIESTA
        UNION ALL
        SELECT 'tasks', T.QTA_RICHIESTA, COUNT(*) FROM TASKS T WITH (NOLOCK)
          INNER JOIN JOBSET J WITH (NOLOCK) ON J.TASK = T.TASK WHERE J.ORDINE = @make GROUP BY T.QTA_RICHIESTA
        UNION ALL
        SELECT 'jobset', QTA_RICHIESTA, COUNT(*) FROM JOBSET WITH (NOLOCK) WHERE ORDINE = @make GROUP BY QTA_RICHIESTA
    `, { make }, 'NETPRO');
}

/**
 * The two quantities of the edition in its three documents. `netproMake` is the NetPro production order (mo_netpid of
 * the H row, else the one the operations were read from).
 */
export async function loadOrderQuantities({ impegno, odp }: DocumentRows, order: BusinessOrderRef | undefined, netproMake: string): Promise<OrderQuantities> {
    const [business, netpro] = await Promise.all([
        order ? loadBusinessQuantities(order).then((res) => res.recordset) : [],
        netproMake ? loadNetproQuantities(netproMake).then((res) => res.recordset) : [],
    ]);
    const netOrder = grouped(netpro, 'order');

    /** A document row's column, followed by the other places of the document that repeat it */
    const rowSide = (row: DocumentRow | undefined, column: 'mo_quant' | 'mo_colli', others: DocumentPlace<number>[] = []): DocumentSide<number> | undefined => {
        if (!row) return undefined;
        const value = num(column === 'mo_quant' ? row.quant : row.colli);
        return { value, places: [{ table: 'movord', column, values: one(value) }, ...others] };
    };

    const ordered: OrderQuantityRow = {
        key: 'ordered',
        impegno: rowSide(impegno, 'mo_quant'),
        bus: rowSide(odp, 'mo_quant', [...place('attivit', 'at_qtapr', grouped(business, 'phases')), ...place('movdis', 'md_perpz', grouped(business, 'perpz'))]),
        net: netOrder.length
            ? {
                  value: netOrder[0].value,
                  places: [
                      { table: 'ORDINI', column: 'QTA_RICHIESTA', values: netOrder },
                      ...place('OPERAZIONI', 'QTA_BASE', grouped(netpro, 'operBase')),
                      ...place('OPERAZIONI', 'QTA_RICHIESTA', grouped(netpro, 'operRichiesta')),
                      ...place('TASKS', 'QTA_RICHIESTA', grouped(netpro, 'tasks')),
                      ...place('JOBSET', 'QTA_RICHIESTA', grouped(netpro, 'jobset')),
                  ],
              }
            : undefined,
    };
    // The maximum quantity to produce lives on the Business rows only: NetPro has no column for it
    const maxProduction: OrderQuantityRow = {
        key: 'maxProduction',
        impegno: rowSide(impegno, 'mo_colli'),
        bus: rowSide(odp, 'mo_colli'),
        net: netOrder.length ? { places: [] } : undefined,
    };

    return { impegnoRef: impegno ? docRef(impegno) : undefined, rows: [ordered, maxProduction] };
}
