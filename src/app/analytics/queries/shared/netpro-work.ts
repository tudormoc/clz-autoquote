/**
 * Shared parts of the NetPro work reports (production-queries.ts, area-queries.ts):
 *
 * - SITUAZIONI: time tracking (TIPO 'WORK'; TIPO_OGGETTO 'OPE' operator time, 'MAC' machine time)
 * - JOBSET → ORDINI: the order of each task; MACCHINE, OPERATORI: names
 * - Machine areas: APP_CONFIG.ANALYTICS.MACHINE_AREAS, in production order
 */

import { APP_CONFIG } from '@/config/constants';
import { netproOrderCore } from './query-utils';

export const MACHINE_AREAS = APP_CONFIG.ANALYTICS.MACHINE_AREAS as Record<string, readonly string[]>;
export const ORDER_CORE = netproOrderCore('ORD.COMMESSA');
export const MIN_ORDER_CORE = netproOrderCore('MIN(ORD.COMMESSA)');

export const WORK_ROWS = `
    FROM SITUAZIONI SIT WITH (NOLOCK)
    LEFT JOIN JOBSET JST WITH (NOLOCK) ON SIT.TASK = JST.TASK
    LEFT JOIN ORDINI ORD WITH (NOLOCK) ON JST.ORDINE = ORD.ORDINE`;
export const MACHINE_JOIN = 'LEFT JOIN MACCHINE MAC WITH (NOLOCK) ON SIT.MACCHINA = MAC.MACCHINA';
export const OPERATOR_JOIN = 'LEFT JOIN OPERATORI OPE WITH (NOLOCK) ON SIT.OGGETTO = OPE.OPERATORE';

/** Area of each machine code: its name and its position in MACHINE_AREAS */
export const AREA_OF_MACHINE = new Map(
    Object.entries(MACHINE_AREAS).flatMap(([name, codes], index) => codes.map((code) => [code, { name, index }] as const))
);

/** Work rows of the period (default: from 1 January of `year` for two years) for operator or machine time */
export function workFilter(year: number, tipoOggetto: 'OPE' | 'MAC', dates?: { dateFrom?: string; dateTo?: string }) {
    const conditions = ['SIT.DATA >= @startDate', 'SIT.DATA <= @endDate', 'SIT.TIPO = @tipo', 'SIT.TIPO_OGGETTO = @tipoOggetto'];
    const params: Record<string, unknown> = {
        startDate: dates?.dateFrom || `${year}-01-01`,
        endDate: dates?.dateTo || `${year + 2}-01-01`,
        tipo: 'WORK',
        tipoOggetto,
    };
    return { conditions, params };
}
