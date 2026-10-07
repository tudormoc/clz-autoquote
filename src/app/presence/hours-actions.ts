'use server'

/** Calcolo Ore Mensile: presence rules, monthly hours, hours distribution, prefill. */

import { errorMessage } from '@/lib/utils';
import { APP_CONFIG } from '@/config/constants';
import { queryMSSQL } from '@/lib/mssql';
import type { OperatorHoursRow, HoursDistributionField } from '@/types';
import {
    rulesForOperator,
    computeCountedDay,
    getDayKind,
    trackedRepartiSql,
    prefillRepartiSql,
    categoriaFromReparto,
    profileFromReparto,
    eachDateInRange,
    isPrefillableDay,
    todayLocal,
    distributeDay,
    hasAnyDistribution,
    assertCoversWorkday,
    proposalCoveredHours,
    type PresenceRulesConfig,
    type HourField,
    type DistributionProposal,
} from '@/lib/presence';
import { loadPresenceRules, buildOperatorSearch, loadDistributionMap } from './presence-db';

/** One operator-day from the clock-in query (rows are also made up for days without clock-ins) */
interface AttendanceRow {
    operatore: string;
    matricola: string | null;
    nome: string;
    gruppo: string | null;
    reparto: string | null;
    data: string;
    ora_inizio: string | null;
    ora_fine: string | null;
    sessioni_count: number;
    minuti_sessioni: number | null;
    ore_lavoro: number;
}

type OperatorRow = Pick<AttendanceRow, 'operatore' | 'matricola' | 'nome' | 'gruppo' | 'reparto'>;

/** Effective presence rules for client components (config-driven badges, side effects, presets). */
export async function getPresenceRulesAction() {
    const rules = await loadPresenceRules();
    return { success: true as const, rules };
}

export async function getMonthlyHoursAction(
    dateFrom: string,
    dateTo: string,
    operatorFilter?: string
) {
    try {
        const rules = await loadPresenceRules();

        // --- Clock-in aggregates per operator-day (first entry / last exit; hours are computed by the rules) ---
        const params: Record<string, unknown> = { dateFrom, dateTo };
        const conditions: string[] = [
            "SIT.TIPO_OGGETTO = 'OPE'",
            "SIT.TIPO = 'CLCK'",
            'CAST(SIT.DATA AS DATE) >= @dateFrom',
            'CAST(SIT.DATA AS DATE) <= @dateTo',
        ];
        const sitSearch = buildOperatorSearch(operatorFilter, ['SIT.OGGETTO', 'OPE.NOME', 'OPE.MATRICOLA'], 'operator', params);
        if (sitSearch) conditions.push(sitSearch);

        const query = `
            SELECT
                SIT.OGGETTO AS operatore,
                ISNULL(NULLIF(LTRIM(RTRIM(OPE.MATRICOLA)), ''), NULL) AS matricola,
                ISNULL(OPE.NOME, SIT.OGGETTO) AS nome,
                ISNULL(NULLIF(LTRIM(RTRIM(OPE.GRUPPO)), ''), NULL) AS gruppo,
                ISNULL(NULLIF(LTRIM(RTRIM(OPE.ENTITA)), ''), NULL) AS reparto,
                CONVERT(VARCHAR(10), CAST(SIT.DATA AS DATE), 120) AS data,
                CONVERT(VARCHAR(8), MIN(SIT.ORA_INIZIO), 108) AS ora_inizio,
                CONVERT(VARCHAR(8), MAX(SIT.ORA_FINE), 108) AS ora_fine,
                COUNT(*) AS sessioni_count,
                SUM(DATEDIFF(MINUTE, SIT.ORA_INIZIO, SIT.ORA_FINE)) AS minuti_sessioni,
                ROUND(SUM(ISNULL(SIT.LAVORO, 0)), 2) AS ore_lavoro
            FROM SITUAZIONI SIT WITH (NOLOCK)
            LEFT JOIN OPERATORI OPE WITH (NOLOCK) ON SIT.OGGETTO = OPE.OPERATORE
            WHERE ${conditions.join(' AND ')}
            GROUP BY SIT.OGGETTO, OPE.MATRICOLA, OPE.NOME, OPE.GRUPPO, OPE.ENTITA, CAST(SIT.DATA AS DATE)
            ORDER BY data DESC, SIT.OGGETTO ASC
        `;

        // --- All tracked operators, so everyone appears even with 0 hours ---
        const opeParams: Record<string, unknown> = {};
        const opeConditions: string[] = [trackedRepartiSql('OPE.ENTITA')];
        const opeSearch = buildOperatorSearch(operatorFilter, ['OPE.OPERATORE', 'OPE.NOME', 'OPE.MATRICOLA'], 'opeFilter', opeParams);
        if (opeSearch) opeConditions.push(opeSearch);

        const opeQuery = `
            SELECT
                OPE.OPERATORE AS operatore,
                ISNULL(NULLIF(LTRIM(RTRIM(OPE.MATRICOLA)), ''), NULL) AS matricola,
                ISNULL(OPE.NOME, OPE.OPERATORE) AS nome,
                ISNULL(NULLIF(LTRIM(RTRIM(OPE.GRUPPO)), ''), NULL) AS gruppo,
                ISNULL(NULLIF(LTRIM(RTRIM(OPE.ENTITA)), ''), NULL) AS reparto
            FROM OPERATORI OPE WITH (NOLOCK)
            WHERE ${opeConditions.join(' AND ')}
            ORDER BY OPE.NOME ASC
        `;

        const [sitResult, opeResult, distMap] = await Promise.all([
            queryMSSQL<AttendanceRow>(query, params, 'NETPRO'),
            queryMSSQL<OperatorRow>(opeQuery, opeParams, 'NETPRO'),
            loadDistributionMap(dateFrom, dateTo),
        ]);

        const records = [...sitResult.recordset];

        // Ensure every operator has a row for every calendar day in range
        const existingPairs = new Set(records.map((r) => `${String(r.operatore)}_${String(r.data)}`));
        for (const dateStr of eachDateInRange(dateFrom, dateTo)) {
            for (const op of opeResult.recordset) {
                const key = `${String(op.operatore)}_${dateStr}`;
                if (existingPairs.has(key)) continue;
                records.push({
                    operatore: op.operatore,
                    matricola: op.matricola,
                    nome: op.nome,
                    gruppo: op.gruppo,
                    reparto: op.reparto,
                    data: dateStr,
                    ora_inizio: null,
                    ora_fine: null,
                    sessioni_count: 0,
                    minuti_sessioni: null,
                    ore_lavoro: 0,
                });
                existingPairs.add(key);
            }
        }

        // Keep consistent sorting by date ASC, then operator name ASC
        records.sort((a, b) => {
            if (a.data !== b.data) return a.data.localeCompare(b.data);
            const nameA = String(a.nome || a.operatore).toLowerCase();
            const nameB = String(b.nome || b.operatore).toLowerCase();
            return nameA.localeCompare(nameB);
        });

        const num = (v: unknown): number | null => (v != null ? Number(v) : null);
        const str = (v: unknown): string | null => (v ? String(v) : null);

        // Enrich each row with the counted day (rules) and hours distributions
        const rows: OperatorHoursRow[] = records.map((row) => {
            const isSpecial = (row.gruppo ?? '').trim().toUpperCase() === APP_CONFIG.PRESENCE.TURNO2_GROUP;
            const reparto = row.reparto ? String(row.reparto).trim() : null;
            const opRules = rulesForOperator(String(row.operatore), rules);
            const clock = {
                firstEntry: row.ora_inizio,
                lastExit: row.ora_fine,
                sessions: Number(row.sessioni_count ?? 0),
                sessionMinutes: row.minuti_sessioni != null ? Number(row.minuti_sessioni) : null,
            };
            const day = computeCountedDay(clock, opRules, getDayKind(row.data, opRules), profileFromReparto(reparto));

            const dist = distMap.get(`${row.operatore}_${row.data}`);

            return {
                operatore: row.operatore,
                matricola: row.matricola ?? null,
                nome: row.nome,
                gruppo: row.gruppo ?? null,
                reparto,
                categoria: categoriaFromReparto(reparto),
                turno: isSpecial ? 'TURNO2' : 'STD',
                data: row.data,
                ora_inizio: row.ora_inizio ?? null,
                ora_fine: row.ora_fine ?? null,
                sessioni_count: row.sessioni_count ?? 0,
                ore_lavoro: Number(row.ore_lavoro ?? 0),
                ore_totali: day.workedHours,
                turno_inizio: day.shiftStart,
                inizio_conteggiato: day.countedStart,
                fine_conteggiata: day.countedEnd,
                ore_ordinarie: num(dist?.ore_ordinarie),
                ore_straordinarie: num(dist?.ore_straordinarie),
                ore_ferie: num(dist?.ore_ferie),
                causale_ferie: str(dist?.causale_ferie),
                ore_permesso: num(dist?.ore_permesso),
                causale_permesso: str(dist?.causale_permesso),
                ore_malattia: num(dist?.ore_malattia),
                banca_ore: num(dist?.banca_ore),
                banca_ore_mese_n1: num(dist?.banca_ore_mese_n1),
                banca_ore_mese_n: num(dist?.banca_ore_mese_n),
            } satisfies OperatorHoursRow;
        });

        return { success: true, data: rows };
    } catch (err) {
        return {
            success: false,
            error: errorMessage(err),
            data: [] as OperatorHoursRow[],
        };
    }
}

/**
 * Upsert an hours distribution field for an operator on a specific date in CLZDWHQANDPROG
 */
export async function updateHoursDistributionAction(
    operatore: string,
    data: string,
    field: HoursDistributionField,
    value: number | string | null
) {
    try {
        const allowedFields: HoursDistributionField[] = [
            'ore_ordinarie',
            'ore_straordinarie',
            'ore_ferie',
            'causale_ferie',
            'ore_permesso',
            'causale_permesso',
            'ore_malattia',
            'banca_ore',
            'banca_ore_mese_n1',
            'banca_ore_mese_n',
        ];

        if (!allowedFields.includes(field)) {
            return { success: false, error: 'Campo non valido' };
        }

        const isTextField = field === 'causale_ferie' || field === 'causale_permesso';
        let paramValue: string | number | null = null;

        if (value !== null && value !== undefined && String(value).trim() !== '') {
            if (isTextField) {
                paramValue = String(value).trim();
            } else {
                const num = parseFloat(String(value));
                paramValue = !isNaN(num) ? num : null;
            }
        }

        const query = `
            MERGE presence_hours_distribution AS target
            USING (SELECT @operatore AS operatore, CAST(@data AS DATE) AS data) AS source
            ON (target.operatore = source.operatore AND target.data = source.data)
            WHEN MATCHED THEN
                UPDATE SET ${field} = @value, updated_at = SYSDATETIME()
            WHEN NOT MATCHED THEN
                INSERT (operatore, data, ${field}, created_at, updated_at)
                VALUES (@operatore, CAST(@data AS DATE), @value, SYSDATETIME(), SYSDATETIME());
        `;

        await queryMSSQL(
            query,
            {
                operatore,
                data,
                value: paramValue,
            },
            'QUOTES'
        );

        return { success: true };
    } catch (err) {
        return { success: false, error: errorMessage(err) };
    }
}

/** Columns the prefill may write. Order matters: it is shared by the VALUES clause and the MERGE. */
const PREFILL_COLUMNS: readonly HourField[] = [
    'ore_ordinarie',
    'ore_straordinarie',
    'ore_ferie',
    'ore_permesso',
    'ore_malattia',
    'banca_ore',
];

interface PrefillCandidate {
    operatore: string;
    data: string;
    proposal: DistributionProposal;
    /** Rules the proposal was computed with (per-operator exceptions applied). */
    rules: PresenceRulesConfig;
}

export interface PrefillResult {
    success: boolean;
    error?: string;
    dryRun?: boolean;
    message?: string;
    /** Rows proposed (dry run) or written. */
    totalCount: number;
    absencesCount: number;
    partialCount: number;
    fullCount: number;
    /** Full days that also received an overflow value (e.g. banca ore). */
    overflowCount: number;
    /** Extra days (e.g. Saturday) with records → hours into extraField. */
    extraCount: number;
    /** Fixed-profile working days (e.g. office) → flat workdayHours ordinarie. */
    fixedCount: number;
    /** Snapshot of the rules used, so the UI can describe what was applied. */
    rules?: PresenceRulesConfig;
}

const EMPTY_PREFILL: Omit<PrefillResult, 'success'> = {
    totalCount: 0,
    absencesCount: 0,
    partialCount: 0,
    fullCount: 0,
    overflowCount: 0,
    extraCount: 0,
    fixedCount: 0,
};

/**
 * Batch pre-populate hours for tracked operators on past working days in the range
 * that have no distribution yet. The formula lives in src/lib/presence/formulas/distribution.ts
 * and every number comes from the presence rules (DB / PRESENCE_RULES defaults).
 *
 * dryRun = true only counts candidates; nothing is written.
 */
export async function prefillAbsencesAction(dateFrom: string, dateTo: string, dryRun: boolean = false): Promise<PrefillResult> {
    try {
        const rules = await loadPresenceRules();
        const todayStr = todayLocal();

        // 1. Working days strictly before today
        const workdays = eachDateInRange(dateFrom, dateTo).filter((d) => isPrefillableDay(d, todayStr, rules));
        if (workdays.length === 0) {
            return {
                success: true,
                ...EMPTY_PREFILL,
                dryRun,
                rules,
                message: 'Nessun giorno lavorativo passato nell’intervallo (oggi e date future escluse)',
            };
        }

        // 2. Operators in the categories the prefill applies to, with their rule profile
        //    (see PRESENCE_RULES.CATEGORIES → profile)
        const opeResult = await queryMSSQL<{ OPERATORE: string; ENTITA: string | null }>(
            `SELECT OPERATORE, ENTITA FROM OPERATORI WITH (NOLOCK) WHERE ${prefillRepartiSql('ENTITA')}`,
            {},
            'NETPRO'
        );
        const operators = opeResult.recordset.map((r) => ({
            operatore: String(r.OPERATORE),
            profile: profileFromReparto(r.ENTITA),
        }));
        if (operators.length === 0) {
            return { success: true, ...EMPTY_PREFILL, dryRun, rules };
        }

        // 3. Worked hours per operator-day (same formula as the dashboard) + existing distributions
        const [sitResult, existingDist] = await Promise.all([
            queryMSSQL<{ operatore: string; data: string; ora_inizio: string | null; ora_fine: string | null; sessioni_count: number; minuti_sessioni: number | null }>(
                `SELECT
                    SIT.OGGETTO AS operatore,
                    CONVERT(VARCHAR(10), CAST(SIT.DATA AS DATE), 120) AS data,
                    CONVERT(VARCHAR(8), MIN(SIT.ORA_INIZIO), 108) AS ora_inizio,
                    CONVERT(VARCHAR(8), MAX(SIT.ORA_FINE), 108) AS ora_fine,
                    COUNT(*) AS sessioni_count,
                    SUM(DATEDIFF(MINUTE, SIT.ORA_INIZIO, SIT.ORA_FINE)) AS minuti_sessioni
                 FROM SITUAZIONI SIT WITH (NOLOCK)
                 WHERE SIT.TIPO_OGGETTO = 'OPE' AND SIT.TIPO = 'CLCK'
                   AND CAST(SIT.DATA AS DATE) >= @dateFrom AND CAST(SIT.DATA AS DATE) <= @dateTo
                 GROUP BY SIT.OGGETTO, CAST(SIT.DATA AS DATE)`,
                { dateFrom, dateTo },
                'NETPRO'
            ),
            loadDistributionMap(dateFrom, dateTo),
        ]);

        // Same formula as the dashboard: counted start/end → worked hours (per day kind + profile)
        const profileByOperator = new Map(operators.map((o) => [o.operatore, o.profile] as const));
        const workedHoursMap = new Map<string, number>();
        for (const r of sitResult.recordset) {
            const operatore = String(r.operatore);
            const data = String(r.data);
            const profile = profileByOperator.get(operatore) ?? 'standard';
            const opRules = rulesForOperator(operatore, rules);
            const clock = {
                firstEntry: r.ora_inizio,
                lastExit: r.ora_fine,
                sessions: Number(r.sessioni_count ?? 0),
                sessionMinutes: r.minuti_sessioni != null ? Number(r.minuti_sessioni) : null,
            };
            const day = computeCountedDay(clock, opRules, getDayKind(data, opRules), profile);
            workedHoursMap.set(`${operatore}_${data}`, day.workedHours);
        }

        // 4. Evaluate each candidate operator-day
        const candidates: PrefillCandidate[] = [];
        const counts = { ...EMPTY_PREFILL };

        for (const data of workdays) {
            const dayKind = getDayKind(data, rules);
            for (const { operatore, profile } of operators) {
                const key = `${operatore}_${data}`;
                if (hasAnyDistribution(existingDist.get(key))) continue; // preserve manual data

                const opRules = rulesForOperator(operatore, rules);
                const proposal = distributeDay(workedHoursMap.get(key) ?? 0, dayKind, opRules, profile);
                if (!proposal) continue; // e.g. extra day without records → stays empty
                candidates.push({ operatore, data, proposal, rules: opRules });

                switch (proposal.category) {
                    case 'absence': counts.absencesCount++; break;
                    case 'partial': counts.partialCount++; break;
                    case 'extra': counts.extraCount++; break;
                    case 'fixed': counts.fixedCount++; break;
                    case 'full':
                        counts.fullCount++;
                        if (proposal.values[rules.overflowField] !== undefined) counts.overflowCount++;
                        break;
                }
            }
        }
        counts.totalCount = candidates.length;

        if (candidates.length === 0 || dryRun) {
            return { success: true, ...counts, dryRun, rules };
        }

        // 5. Invariant: every proposal must cover exactly the workday
        const broken = candidates.find((c) => !assertCoversWorkday(c.proposal, c.rules));
        if (broken) {
            return {
                success: false,
                ...EMPTY_PREFILL,
                error: `Regola ${broken.rules.workdayHours}h violata per ${broken.operatore} il ${broken.data}: copertura ${proposalCoveredHours(broken.proposal, broken.rules)}h. Controllare le impostazioni presenze.`,
            };
        }

        // 6. Batch MERGE in chunks — only rows still empty are touched
        const chunkSize = 50;
        const colList = PREFILL_COLUMNS.join(', ');
        const guard = PREFILL_COLUMNS.map((c) => `target.${c} IS NULL`).join(' AND ') +
            ' AND target.causale_ferie IS NULL AND target.causale_permesso IS NULL';
        const setList = PREFILL_COLUMNS.map((c) => `${c} = source.${c}`).join(', ');
        const srcList = PREFILL_COLUMNS.map((c) => `source.${c}`).join(', ');

        for (let i = 0; i < candidates.length; i += chunkSize) {
            const chunk = candidates.slice(i, i + chunkSize);
            const params: Record<string, unknown> = {};
            const valuesClauses = chunk.map((c, idx) => {
                params[`op${idx}`] = c.operatore;
                params[`dt${idx}`] = c.data;
                const cols = PREFILL_COLUMNS.map((col, ci) => {
                    params[`v${idx}_${ci}`] = c.proposal.values[col] ?? null;
                    return `CAST(@v${idx}_${ci} AS DECIMAL(5,2))`;
                });
                return `(@op${idx}, CAST(@dt${idx} AS DATE), ${cols.join(', ')})`;
            }).join(', ');

            await queryMSSQL(
                `MERGE presence_hours_distribution AS target
                 USING (VALUES ${valuesClauses}) AS source (operatore, data, ${colList})
                 ON (target.operatore = source.operatore AND target.data = source.data)
                 WHEN MATCHED AND ${guard} THEN
                     UPDATE SET ${setList}, updated_at = SYSDATETIME()
                 WHEN NOT MATCHED THEN
                     INSERT (operatore, data, ${colList}, created_at, updated_at)
                     VALUES (source.operatore, source.data, ${srcList}, SYSDATETIME(), SYSDATETIME());`,
                params,
                'QUOTES'
            );
        }

        return { success: true, ...counts, dryRun: false, rules };
    } catch (err) {
        return { success: false, ...EMPTY_PREFILL, error: errorMessage(err) };
    }
}
