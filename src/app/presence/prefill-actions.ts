'use server'

/**
 * Calcolo Ore Mensile → "Precompila e Distribuisci Ore": fills the hours distribution of past working days that have
 * none yet, with the same counted hours as the monthly table (hours-actions.ts). Rules: docs/PRESENCE.md.
 */

import { errorMessage } from '@/lib/utils';
import { queryMSSQL } from '@/lib/mssql';
import { APP_COPY, fmt } from '@/locales';
import {
    rulesForOperator,
    computeCountedDay,
    getDayKind,
    prefillRepartiSql,
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
import { CLOCK_COLUMNS, clockOf, loadPresenceRules, loadDistributionMap, type ClockRow } from './presence-db';
import { authorize } from '@/lib/auth/access';

const copy = APP_COPY.analytics.monthlySummary.prefill;

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
    await authorize('edit', '/presence/monthly-summary');
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
                message: copy.noPastWorkdays,
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
            operatore: r.OPERATORE,
            profile: profileFromReparto(r.ENTITA),
        }));
        if (operators.length === 0) {
            return { success: true, ...EMPTY_PREFILL, dryRun, rules };
        }

        // 3. Worked hours per operator-day (same formula as the dashboard) + existing distributions
        const [sitResult, existingDist] = await Promise.all([
            queryMSSQL<ClockRow & { operatore: string }>(
                `SELECT
                    SIT.OGGETTO AS operatore,
                    ${CLOCK_COLUMNS}
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
            const { operatore, data } = r;
            const profile = profileByOperator.get(operatore) ?? 'standard';
            const opRules = rulesForOperator(operatore, rules);
            const day = computeCountedDay(clockOf(r), opRules, getDayKind(data, opRules), profile);
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
                error: fmt(copy.ruleBroken, {
                    h: broken.rules.workdayHours,
                    operator: broken.operatore,
                    date: broken.data,
                    covered: proposalCoveredHours(broken.proposal, broken.rules),
                }),
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
