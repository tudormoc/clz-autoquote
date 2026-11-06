/**
 * "Ordini da riallineare": the open production orders that differ from their impegno cliente or their DiBa, and what
 * differs (server only, read queries). One row per article with a DiBa and an open NetPro production order, that is per
 * article of an impegno: its newest open order is compared with the Business order that points to it, the way its Gestione tab
 * does (loadOrderManagement, differences.ts), a few at a time. An article with more than one production order is
 * marked: usually a duplicate. See docs/ORDER_PROCESS.md → Orders to realign.
 */
import { APP_CONFIG, BUSINESS_COMPANY } from '@/config/constants';
import { queryMSSQL } from '@/lib/mssql';
import { compareOrder, orderDifferences } from '@/lib/orders/differences';
import { docRef } from '@/lib/orders/documentRows';
import { loadOrderManagement } from '@/lib/orders/management';
import { businessDb } from '@/lib/orders/sql';
import type { MisalignedOrder, MisalignedOrders, OtherProductionOrder } from '@/lib/orders/types';
import { errorMessage, mapAtOnce } from '@/lib/utils';

const { ROOT_KEY_LENGTH, OPEN_STATES, ALIGNMENT_CHECKS_AT_ONCE } = APP_CONFIG.ORDERS;
const openStates = OPEN_STATES.map((state) => `'${state}'`).join(', ');
const OPEN_ARTICLES = `SELECT PART_NUMBER FROM ORDINI WITH (NOLOCK) WHERE TIPO = 'MAKE' AND STATO IN (${openStates}) AND PART_NUMBER IS NOT NULL`;

/** An open NetPro production order */
interface OpenOrder {
    ordine: string;
    commessa: string;
    article: string;
    stato: string;
    title: string;
    client: string;
}

/** A NetPro production order of an article */
interface NetproArticleOrder {
    ordine: string;
    commessa: string;
    article: string;
    stato: string;
}

/** A Business production order row of an article */
interface BusinessArticleOrder {
    article: string;
    commessa: string;
    anno: number;
    numord: number;
    netpid: string;
}

/** What the marks of a row are read from, for all the open orders at once */
interface OrderMarks {
    /** The production orders of an article, in NetPro (articles with an open order) and in Business (articles with several) */
    netproOrders: Map<string, NetproArticleOrder[]>;
    businessOrders: Map<string, BusinessArticleOrder[]>;
    netproStates: Map<string, string>;
    /** Master orders with production orders of several articles (editions), in Business or in NetPro */
    multiEditionRoots: Set<string>;
}

const rootOf = (commessa: string) => commessa.slice(0, ROOT_KEY_LENGTH);

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
    const groups = new Map<string, T[]>();
    for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
    return groups;
}

/** The NetPro production orders still open (or the one given, if still open), with the commessa's title and client as the search shows them */
async function loadOpenOrders(ordine?: string): Promise<OpenOrder[]> {
    const res = await queryMSSQL<OpenOrder>(`
        SELECT
            RTRIM(ORD.ORDINE) AS ordine,
            RTRIM(ORD.COMMESSA) AS commessa,
            ISNULL(RTRIM(ORD.PART_NUMBER), '') AS article,
            RTRIM(ORD.STATO) AS stato,
            ISNULL(MAX(RTRIM(COM.co_descr1)), ISNULL(RTRIM(MAX(ORD.DESCRIZIONE)), '')) AS title,
            ISNULL(MAX(RTRIM(CCA.descr)), '') AS client
        FROM ORDINI AS ORD WITH (NOLOCK)
        LEFT JOIN ${businessDb()}.dbo.COMMESS AS COM WITH (NOLOCK) ON TRY_CAST(ORD.COMMESSA AS BIGINT) = COM.co_comme
        LEFT JOIN cliente_commessa_attivita AS CCA WITH (NOLOCK) ON ORD.COMMESSA = CCA.commessa
        WHERE ORD.TIPO = 'MAKE' AND ORD.STATO IN (${openStates}) AND ORD.COMMESSA IS NOT NULL
          ${ordine ? 'AND ORD.ORDINE = @ordine' : ''}
        GROUP BY ORD.ORDINE, ORD.COMMESSA, ORD.PART_NUMBER, ORD.STATO
        ORDER BY ORD.COMMESSA DESC, ORD.ORDINE DESC
    `, ordine ? { ordine } : {}, 'NETPRO');
    return res.recordset;
}

/**
 * One row per article: its newest open order (owner, 2026-11-05: an article has one production order; of a double
 * one only the new order is shown and realigned, for now). The ids sort by year, then by order number.
 */
function newestPerArticle(orders: OpenOrder[]): OpenOrder[] {
    const newest = new Map<string, OpenOrder>();
    for (const order of orders) {
        const article = order.article || order.ordine;
        const kept = newest.get(article);
        if (!kept || order.ordine > kept.ordine) newest.set(article, order);
    }
    return Array.from(newest.values());
}

/** The production orders of each article and the master orders with several editions, in both programs */
async function loadMarks(): Promise<OrderMarks> {
    const [netproOrders, businessOrders, businessRoots, netproRoots] = await Promise.all([
        queryMSSQL<NetproArticleOrder>(`
            SELECT RTRIM(ORDINE) AS ordine, ISNULL(RTRIM(COMMESSA), '') AS commessa, RTRIM(PART_NUMBER) AS article, RTRIM(STATO) AS stato
            FROM ORDINI WITH (NOLOCK)
            WHERE TIPO = 'MAKE' AND PART_NUMBER IN (${OPEN_ARTICLES})
        `, {}, 'NETPRO'),
        queryMSSQL<BusinessArticleOrder>(`
            SELECT RTRIM(mo_codart) AS article, CAST(mo_commeca AS VARCHAR(20)) AS commessa, mo_anno AS anno, mo_numord AS numord, ISNULL(RTRIM(mo_netpid), '') AS netpid
            FROM movord WITH (NOLOCK)
            WHERE codditt = '${BUSINESS_COMPANY}' AND mo_tipork = 'H'
              AND mo_codart IN (
                SELECT mo_codart FROM movord WITH (NOLOCK)
                WHERE codditt = '${BUSINESS_COMPANY}' AND mo_tipork = 'H'
                GROUP BY mo_codart HAVING COUNT(*) > 1
              )
            ORDER BY mo_anno, mo_numord, mo_riga
        `, {}, 'BUSINESS'),
        queryMSSQL<{ root: string }>(`
            SELECT LEFT(CAST(mo_commeca AS VARCHAR(20)), ${ROOT_KEY_LENGTH}) AS root
            FROM movord WITH (NOLOCK)
            WHERE codditt = '${BUSINESS_COMPANY}' AND mo_tipork = 'H'
            GROUP BY LEFT(CAST(mo_commeca AS VARCHAR(20)), ${ROOT_KEY_LENGTH})
            HAVING COUNT(DISTINCT mo_codart) > 1
        `, {}, 'BUSINESS'),
        queryMSSQL<{ root: string }>(`
            SELECT LEFT(COMMESSA, ${ROOT_KEY_LENGTH}) AS root
            FROM ORDINI WITH (NOLOCK)
            WHERE TIPO = 'MAKE'
            GROUP BY LEFT(COMMESSA, ${ROOT_KEY_LENGTH})
            HAVING COUNT(DISTINCT PART_NUMBER) > 1
        `, {}, 'NETPRO'),
    ]);
    return {
        netproOrders: groupBy(netproOrders.recordset, (order) => order.article),
        businessOrders: groupBy(businessOrders.recordset, (order) => order.article),
        netproStates: new Map(netproOrders.recordset.map((order) => [order.ordine, order.stato])),
        multiEditionRoots: new Set([...businessRoots.recordset, ...netproRoots.recordset].map((row) => row.root)),
    };
}

/** The other production orders of the article: those Business knows (with their NetPro state), then those only NetPro has */
function otherOrders(open: OpenOrder, businessArticle: string, marks: OrderMarks): OtherProductionOrder[] {
    const inBusiness = (marks.businessOrders.get(businessArticle) ?? []).filter((order) => order.netpid !== open.ordine);
    const known = new Set(inBusiness.map((order) => order.netpid));
    const onlyNetpro = (marks.netproOrders.get(open.article) ?? []).filter((order) => order.ordine !== open.ordine && !known.has(order.ordine));
    return [
        ...inBusiness.map((order) => ({ business: docRef(order), netpro: order.netpid || undefined, state: marks.netproStates.get(order.netpid), sameCommessa: order.commessa === open.commessa })),
        ...onlyNetpro.map((order) => ({ netpro: order.ordine, state: order.stato, sameCommessa: order.commessa === open.commessa })),
    ];
}

/**
 * One open order compared with the Business order that points to it; a failed read is told on the row. Null when the
 * article has no phases in the DiBa: the list is about articles with a DiBa, not the internal orders the indirect
 * hours are booked on (owner, 2026-11-06).
 */
async function compareOpenOrder(open: OpenOrder, marks: OrderMarks): Promise<MisalignedOrder | null> {
    const rootCommessaKey = rootOf(open.commessa);
    const row = {
        rootCommessaKey,
        commessa: open.commessa,
        title: open.title,
        client: open.client,
        netproOrder: open.ordine,
        netproState: open.stato,
        multiEdition: marks.multiEditionRoots.has(rootCommessaKey),
    };
    // Riallinea takes an article with one production order on its commessa (the guard of findTarget in sync.ts)
    const marked = (others: OtherProductionOrder[]) => ({ otherOrders: others, canRealign: !others.some((order) => order.sameCommessa) });
    try {
        const data = await loadOrderManagement(rootCommessaKey, open.article, open.commessa, open.ordine);
        if (data.diba_operations.length === 0) return null;
        const { impegno_anno: anno, impegno_numord: numord } = data;
        const article = data.article_father || open.article;
        return {
            ...row,
            article,
            netproArticle: open.article && open.article.toLowerCase() !== article.toLowerCase() ? open.article : undefined,
            impegno: anno && numord ? docRef({ anno, numord }) : undefined,
            businessOrder: data.order_bus_numord,
            ...marked(otherOrders(open, article, marks)),
            syncBlocks: data.sync_blocks ?? [],
            differences: orderDifferences(compareOrder(data)),
        };
    } catch (err) {
        console.error(`Error comparing the production order ${open.ordine}:`, err);
        return { ...row, article: open.article, ...marked(otherOrders(open, open.article, marks)), syncBlocks: [], differences: [], error: errorMessage(err) };
    }
}

/**
 * Compares the newest open order of every article with a DiBa and keeps those that differ or share their article with
 * another order
 */
export async function findMisalignedOrders(): Promise<MisalignedOrders> {
    const [openOrders, marks] = await Promise.all([loadOpenOrders(), loadMarks()]);
    const newest = newestPerArticle(openOrders);
    const compared = (await mapAtOnce(newest, ALIGNMENT_CHECKS_AT_ONCE, (open) => compareOpenOrder(open, marks)))
        .filter((order): order is MisalignedOrder => order !== null);
    return {
        checked: compared.length,
        orders: compared.filter((order) => order.error || order.differences.length > 0 || order.otherOrders.length > 0),
    };
}

/**
 * One row of the list read again (after a change in Business, or a realign); nothing when the order is no longer one
 * of the list (closed, or its article has no DiBa phases any more)
 */
export async function findMisalignedOrder(netproOrder: string): Promise<MisalignedOrder | null> {
    const [openOrders, marks] = await Promise.all([loadOpenOrders(netproOrder), loadMarks()]);
    return openOrders[0] ? compareOpenOrder(openOrders[0], marks) : null;
}
