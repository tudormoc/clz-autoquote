/**
 * Reads the article data of the edition wherever Business and NetPro store them (server only, read queries), for the
 * "Articolo" tab: the title, the composition and the measures (base, altezza, pages) of the impegno cliente row (the
 * truth), of the Business production order (its row and the article master) and of NetPro (the order and the article
 * master, which carry the title only). The document headers and the commessa are NOT places of the title: the impegno
 * header has its own reference text, which Business copies into the commessa. Compared by documentFacts.ts with the
 * rules of article.ts; facts in docs/ORDER_PROCESS.md → Article data.
 */
import { APP_CONFIG, BUSINESS_COMPANY } from '@/config/constants';
import { queryMSSQL } from '@/lib/mssql';
import { measureText } from '@/lib/orders/article';
import { docRef, type DocumentRow, type DocumentRows } from '@/lib/orders/documentRows';
import type { BusinessOrderRef } from '@/lib/orders/management';
import type { ArticleKey, DocumentPlace, DocumentSide, OrderArticle, OrderArticleRow } from '@/types';

const LENGTHS = APP_CONFIG.ORDERS.TITLE_LENGTHS;

/** The Business article master: description and measures */
interface ArticleMasterRow {
    text: string;
    misura1: number | null;
    misura2: number | null;
    misura3: number | null;
}

/** A single text found somewhere, as a place (nothing when the record is not there) */
const place = (table: string, column: string, value: string | undefined, maxLength?: number): DocumentPlace<string>[] =>
    value === undefined ? [] : [{ table, column, values: [{ value, rows: 1 }], maxLength }];

function loadArticleMaster(order: BusinessOrderRef) {
    return queryMSSQL<ArticleMasterRow>(`
        SELECT ISNULL(RTRIM(ar_descr), '') AS text, ar_misura1 AS misura1, ar_misura2 AS misura2, ar_misura3 AS misura3
        FROM artico WITH (NOLOCK) WHERE codditt = '${BUSINESS_COMPANY}' AND ar_codart = @codart
    `, { codart: order.codart }, 'BUSINESS');
}

/** The NetPro production order's description and the NetPro article master's */
function loadNetproTitles(make: string, article: string) {
    return queryMSSQL<{ what: string; text: string }>(`
        SELECT 'order' AS what, ISNULL(RTRIM(DESCRIZIONE), '') AS text FROM ORDINI WITH (NOLOCK) WHERE ORDINE = @make
        UNION ALL
        SELECT 'article', ISNULL(RTRIM(DESCRIZIONE), '') FROM ANAG_MATERIALI WITH (NOLOCK) WHERE PART_NUMBER = @article
    `, { make, article }, 'NETPRO');
}

/** The article data of the edition in its three documents and the two article masters */
export async function loadOrderArticle({ impegno, odp }: DocumentRows, order: BusinessOrderRef | undefined, netproMake: string): Promise<OrderArticle> {
    const article = (order?.codart ?? '').trim();
    const [masters, netpro] = await Promise.all([
        order ? loadArticleMaster(order).then((res) => res.recordset) : [],
        netproMake || article ? loadNetproTitles(netproMake, article).then((res) => res.recordset) : [],
    ]);
    const artico = masters[0];
    const netOrder = netpro.find((row) => row.what === 'order')?.text;
    const netArticle = netpro.find((row) => row.what === 'article')?.text;

    /** A document row's column, followed by the other places that repeat it */
    const rowSide = (row: DocumentRow | undefined, column: string, value: (row: DocumentRow) => string, maxLength?: number, others: DocumentPlace<string>[] = []): DocumentSide<string> | undefined =>
        row ? { value: value(row), places: [...place('movord', column, value(row), maxLength), ...others] } : undefined;

    const name: OrderArticleRow = {
        key: 'name',
        impegno: rowSide(impegno, 'mo_descr', (row) => row.descr, LENGTHS.movord),
        bus: rowSide(odp, 'mo_descr', (row) => row.descr, LENGTHS.movord, place('artico', 'ar_descr', artico?.text, LENGTHS.artico)),
        net:
            netOrder === undefined
                ? undefined
                : {
                      value: netOrder,
                      places: [
                          ...place('ORDINI', 'DESCRIZIONE', netOrder, LENGTHS.netproOrder),
                          ...place('ANAG_MATERIALI', 'DESCRIZIONE', netArticle, LENGTHS.netproArticle),
                      ],
                  },
    };
    // NetPro has no field for the composition and the measures: its column says "non presente" while the order exists
    const netAbsent: DocumentSide<string> | undefined = netOrder === undefined ? undefined : { places: [] };
    const composition: OrderArticleRow = {
        key: 'composition',
        impegno: rowSide(impegno, 'mo_matric', (row) => row.matric, LENGTHS.movord),
        bus: rowSide(odp, 'mo_matric', (row) => row.matric, LENGTHS.movord),
        net: netAbsent,
    };
    /** Base, altezza and pages: the order row and the Business article master */
    const measure = (key: ArticleKey, column: 'mo_misura1' | 'mo_misura2' | 'mo_misura3', pick: (row: { misura1: number | null; misura2: number | null; misura3: number | null }) => number | null): OrderArticleRow => ({
        key,
        impegno: rowSide(impegno, column, (row) => measureText(pick(row))),
        bus: rowSide(odp, column, (row) => measureText(pick(row)), undefined, place('artico', column.replace('mo_', 'ar_'), artico ? measureText(pick(artico)) : undefined)),
        net: netAbsent,
    });

    return {
        impegnoRef: impegno ? docRef(impegno) : undefined,
        rows: [
            name,
            composition,
            measure('width', 'mo_misura1', (row) => row.misura1),
            measure('height', 'mo_misura2', (row) => row.misura2),
            measure('pages', 'mo_misura3', (row) => row.misura3),
        ],
    };
}
