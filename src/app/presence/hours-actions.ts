'use server'

/** Calcolo Ore Mensile: presence rules, monthly hours and the hours distribution (prefill: prefill-actions.ts). */

import { errorMessage } from '@/lib/utils';
import { APP_CONFIG } from '@/config/constants';
import { queryMSSQL } from '@/lib/mssql';
import { APP_COPY, fmt } from '@/locales';
import { HOURS_DISTRIBUTION_FIELDS, type OperatorHoursRow, type HoursDistributionField } from '@/types';
import {
    rulesForOperator,
    computeCountedDay,
    getDayKind,
    trackedRepartiSql,
    categoriaFromReparto,
    profileFromReparto,
    eachDateInRange,
} from '@/lib/presence';
import { CLOCK_COLUMNS, clockOf, loadPresenceRules, buildOperatorSearch, loadDistributionMap, type ClockRow } from './presence-db';
import { authorize } from '@/lib/auth/access';
import { LINKS } from '@/config/navigation';
import { logEvent, personOf } from '@/lib/log/log';

/** The lines this file writes in the log (Registro) */
const log = APP_COPY.log.entries;

/** One operator-day from the clock-in query (rows are also made up for days without clock-ins) */
interface AttendanceRow extends ClockRow {
    operatore: string;
    matricola: string | null;
    nome: string;
    gruppo: string | null;
    reparto: string | null;
    ore_lavoro: number;
}

type OperatorRow = Pick<AttendanceRow, 'operatore' | 'matricola' | 'nome' | 'gruppo' | 'reparto'>;

/** Effective presence rules for client components (config-driven badges, side effects, presets). */
export async function getPresenceRulesAction() {
    await authorize('view', LINKS.presence.monthlySummary, LINKS.settings['presence']);
    const rules = await loadPresenceRules();
    return { success: true as const, rules };
}

export async function getMonthlyHoursAction(
    dateFrom: string,
    dateTo: string,
    operatorFilter?: string
) {
    await authorize('view', LINKS.presence.monthlySummary);
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
                ${CLOCK_COLUMNS},
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
        const existingPairs = new Set(records.map((r) => `${r.operatore}_${r.data}`));
        for (const dateStr of eachDateInRange(dateFrom, dateTo)) {
            for (const op of opeResult.recordset) {
                const key = `${op.operatore}_${dateStr}`;
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
            const opRules = rulesForOperator(row.operatore, rules);
            const day = computeCountedDay(clockOf(row), opRules, getDayKind(row.data, opRules), profileFromReparto(reparto));

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
    const access = await authorize('edit', LINKS.presence.monthlySummary);
    try {
        if (!HOURS_DISTRIBUTION_FIELDS.includes(field)) {
            return { success: false, error: APP_COPY.common.notAllowed };
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

        // What the field holds now, for the log (the field's name was checked above)
        const before = await queryMSSQL<{ value: string | number | null }>(
            `SELECT ${field} AS value FROM presence_hours_distribution WITH (NOLOCK) WHERE operatore = @operatore AND data = CAST(@data AS DATE)`,
            { operatore, data },
            'QUOTES'
        );

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

        const previous = before.recordset[0]?.value ?? null;
        await logEvent(personOf(access), {
            page: LINKS.presence.monthlySummary,
            action: 'changed',
            entityKind: 'hours',
            entityId: `${operatore} ${data}`,
            summary: fmt(log.hoursUpdated, { operator: operatore, date: data, field, from: previous ?? '-', value: paramValue ?? '-' }),
            details: { before: { [field]: previous }, after: { [field]: paramValue } },
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: errorMessage(err) };
    }
}
