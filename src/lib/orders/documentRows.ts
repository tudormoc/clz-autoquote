/**
 * The two document rows behind an edition (server only, read query): the production order row (movord H) and the impegno
 * cliente row that generated it (movord R with the same commessa and article: the truth for the quantities and the
 * article data). Shared by the Quantità and Articolo tabs (quantityData.ts, articleData.ts). See docs/ORDER_PROCESS.md.
 */
import { BUSINESS_COMPANY } from '@/config/constants';
import { queryMSSQL } from '@/lib/mssql';
import type { BusinessOrderRef } from '@/lib/orders/management';

export interface DocumentRow {
    tipork: 'R' | 'H';
    anno: number;
    numord: number;
    riga: number;
    quant: number;
    colli: number;
    /** The title (Titolo/Descrizione of the row) */
    descr: string;
    /** Composizione */
    matric: string;
    /** Base, altezza, number of pages */
    misura1: number;
    misura2: number;
    misura3: number;
    netpid: string;
}

export interface DocumentRows {
    impegno?: DocumentRow;
    odp?: DocumentRow;
}

/** "2026/9999": how a Business document is named */
export const docRef = (row: { anno: number; numord: number }) => `${row.anno}/${row.numord}`;

export async function loadDocumentRows(order: BusinessOrderRef): Promise<DocumentRows> {
    const res = await queryMSSQL<DocumentRow>(`
        SELECT mo_tipork AS tipork, mo_anno AS anno, mo_numord AS numord, mo_riga AS riga, mo_quant AS quant, mo_colli AS colli,
               ISNULL(RTRIM(mo_descr), '') AS descr, ISNULL(RTRIM(mo_matric), '') AS matric, mo_misura1 AS misura1, mo_misura2 AS misura2, mo_misura3 AS misura3,
               ISNULL(RTRIM(mo_netpid), '') AS netpid
        FROM movord WITH (NOLOCK)
        WHERE codditt = '${BUSINESS_COMPANY}'
          AND (
            (mo_tipork = 'H' AND mo_anno = @anno AND mo_numord = @numord AND mo_riga = @riga)
            OR (mo_tipork = 'R' AND mo_commeca = @commeca AND mo_codart = @codart)
          )
        ORDER BY mo_tipork, mo_anno DESC, mo_numord DESC, mo_riga
    `, { anno: order.anno, numord: order.numord, riga: order.riga, commeca: order.commeca, codart: order.codart }, 'BUSINESS');
    return { impegno: res.recordset.find((row) => row.tipork === 'R'), odp: res.recordset.find((row) => row.tipork === 'H') };
}
