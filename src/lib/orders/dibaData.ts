/**
 * The DiBa (Distinta Base) of an article as Business holds it: its phases (cicli) and its materials (movdis). Server.
 *
 * The ONE read of it: the order page compares the orders with these rows (management.ts) and Riallinea writes from
 * them (sync.ts, through its transaction), so what the page shows is what a realign works from. With a query
 * each, a change made to one and forgotten in the other would let the page say "aligned" while a realign wrote
 * something else. See docs/ORDER_PROCESS.md.
 */
import { BUSINESS_COMPANY } from '@/config/constants';
import { queryMSSQL, type SqlRunner } from '@/lib/mssql';
import type { DibaMaterialRow, DibaOperationRow } from '@/types';

/** The phases of the article's DiBa, in the order of their rows (as Business lists them); none without an article */
export async function readDibaPhases(article: string, run: SqlRunner = queryMSSQL): Promise<DibaOperationRow[]> {
    if (!article) return [];
    const result = await run<DibaOperationRow>(`
            SELECT
                dd.dd_riga as riga,
                dd.dd_fase as fase,
                dd.dd_codlavo as codlavo,
                ISNULL(tl.tb_deslavo, '') as descr_lavor,
                CASE WHEN dd.dd_terzista = 'S' THEN 'S' ELSE 'N' END as terzista,
                dd.dd_codcent as codcent,
                ISNULL(tc.tb_descent, '') as descr_centro,
                ISNULL(dd.dd_note, '') as note,
                dd.dd_tempese as tesec,
                dd.dd_perqta as perqta,
                dd.dd_aggcp2 as aggriga
            FROM cicli dd WITH (NOLOCK)
            LEFT JOIN tablavo tl WITH (NOLOCK) ON tl.codditt = dd.codditt AND tl.tb_codlavo = dd.dd_codlavo
            LEFT JOIN tabcent tc WITH (NOLOCK) ON tc.codditt = dd.codditt AND tc.tb_codcent = dd.dd_codcent
            WHERE dd.codditt = '${BUSINESS_COMPANY}'
              AND dd.dd_coddb = @article
            ORDER BY dd.dd_riga ASC
        `, { article }, 'BUSINESS');
    return result.recordset;
}

/**
 * The materials of the article's DiBa, in the order of their rows, the placeholder included (the comparison says
 * when it has to go; Riallinea leaves it out of what it writes); none without an article
 */
export async function readDibaMaterials(article: string, run: SqlRunner = queryMSSQL): Promise<DibaMaterialRow[]> {
    if (!article) return [];
    const result = await run<DibaMaterialRow>(`
            SELECT
                md.md_riga as riga,
                RTRIM(md.md_codfigli) as codfigli,
                ISNULL(RTRIM(ar.ar_descr), RTRIM(md.md_codfigli)) as description,
                RTRIM(ar.ar_desint) as desint,
                md.md_quant as quant,
                ISNULL(md.md_perpz, 1000) as perpz,
                RTRIM(md.md_unmis) as unmis
            FROM movdis md WITH (NOLOCK)
            LEFT JOIN artico ar WITH (NOLOCK) ON ar.codditt = md.codditt AND ar.ar_codart = md.md_codfigli
            WHERE md.codditt = '${BUSINESS_COMPANY}' AND md.md_coddb = @article
            ORDER BY md.md_riga ASC
        `, { article }, 'BUSINESS');
    return result.recordset;
}
