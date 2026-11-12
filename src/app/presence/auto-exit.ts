/**
 * Daily auto-exit, run by the scheduler through /api/auto-exit. Deliberately not a server action file: the browser
 * cannot call it, only that route can (after checking the scheduler's key or the superadmin).
 */

import { errorMessage } from '@/lib/utils';
import { queryMSSQL, withTransactions } from '@/lib/mssql';
import { APP_CONFIG } from '@/config/constants';
import { dbDateTimeParts, toLocalDateTime } from '@/lib/dateUtils';
import { APP_COPY, fmt } from '@/locales';
import {
    PRESENCE_ENTRY,
    PRESENCE_EXIT,
    USUAL_EXIT_SETTINGS,
    chooseExit,
    clockToSeconds,
    exitGuesses,
    getDayKind,
    lastStamps,
    minutesToTime,
    othersSlot,
    pastExitsOf,
    realExits,
    secondsToClock,
    timeToMinutes,
    type DayStamp,
    type ExitChoice,
    type ExitReason,
    type PastExit,
} from '@/lib/presence';
import { addPresenceEvent, lastPresenceEvent, loadPresenceRules, type PausedWork } from './presence-db';

const CONFIG = APP_CONFIG.PRESENCE;
const copy = APP_COPY.analytics.presence;
const reasons = APP_COPY.log.entries.autoExitReasons;

/** Who NetPro shows as the writer of an automatic exit */
const AUTO_EXIT_USER = 'AUTO';

export interface AutoExitOptions {
    /** Only this operator (for testing) */
    operator?: string;
    /** Decide and report, write nothing */
    preview?: boolean;
    /** With `preview`: everybody with past exits, not only who is still in (what would each get if they forgot today?) */
    everyone?: boolean;
    /** With `preview`: decide as if the check ran at this time of today ("HH:MM" or "HH:MM:SS") instead of now */
    at?: string;
}

/** A time of day as typed in the address: "19:00" or "19:00:00" */
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/** What the automatic exit decided for one person */
export interface AutoExitDecision {
    operator: string;
    name: string | null;
    /** Still in at the moment of the check (a preview of everybody also lists who already left) */
    stillIn: boolean;
    /** "HH:MM:SS" the exit is dated at; null when no time is possible yet (entered or started work a moment ago) */
    exitTime: string | null;
    reason: ExitReason | null;
    /** The reason in words, as the Registro shows it */
    why: string;
    /** The person's last real exits the choice was read from, newest first, each with the time the others left that day */
    lastExits: { day: string; time: string; others: string | null }[];
    /** Written for real: false in a preview, when the person badged out in the meantime, and when the write failed */
    written: boolean;
    /** The write of this person's exit failed (the error's text): nothing of it is in NetPro, the others got theirs */
    error?: string;
    /** The phases paused by the exit */
    paused: PausedWork[];
}

/** How many of these exits are in NetPro, and how many could not be written */
function countOf(decisions: readonly AutoExitDecision[]) {
    return {
        processed: decisions.filter((decision) => decision.written).length,
        failed: decisions.filter((decision) => decision.error !== undefined).length,
    };
}

/** The presence events of the days the rule reads: the lookback and today */
async function loadStamps(today: string): Promise<DayStamp[]> {
    const result = await queryMSSQL<DayStamp>(`
        SELECT E.OGGETTO AS operator, CONVERT(VARCHAR(10), E.ORA_EVENTO, 120) AS day, CONVERT(VARCHAR(8), E.ORA_EVENTO, 108) AS time,
               E.EVENTO AS evento, ISNULL(E.UTENTE, '') AS writer, E.PROGRESSIVO AS progressivo
        FROM EVENTI E WITH (NOLOCK)
        WHERE E.TASK = 'presenza' AND E.TIPO_OGGETTO = 'OPE'
          AND E.ORA_EVENTO >= DATEADD(DAY, -@days, CAST(@today AS DATETIME)) AND E.ORA_EVENTO < DATEADD(DAY, 1, CAST(@today AS DATETIME))
    `, { today, days: CONFIG.USUAL_EXIT.LOOKBACK_DAYS }, 'NETPRO');
    return result.recordset;
}

/** The second of today each person started the work they have in progress (NetPro's list, ATTIVITA) */
async function loadWorkStarts(today: string): Promise<Map<string, number>> {
    const result = await queryMSSQL<{ operator: string; started: Date | null }>(
        `SELECT OPERATORE AS operator, MAX(DATA_INIZIO) AS started FROM ATTIVITA WITH (NOLOCK) WHERE TIPO_OGGETTO = 'OPE' GROUP BY OPERATORE`,
        {},
        'NETPRO'
    );
    const starts = new Map<string, number>();
    for (const row of result.recordset) {
        const parts = row.started ? dbDateTimeParts(row.started) : null;
        if (parts?.date === today) starts.set(row.operator, clockToSeconds(parts.time));
    }
    return starts;
}

async function loadNames(): Promise<Map<string, string | null>> {
    const result = await queryMSSQL<{ OPERATORE: string; NOME: string | null }>(`SELECT OPERATORE, NOME FROM OPERATORI WITH (NOLOCK)`, {}, 'NETPRO');
    return new Map(result.recordset.map((row) => [row.OPERATORE, row.NOME]));
}

/** The reason of a choice in words (it.ts → log.entries.autoExitReasons) */
function reasonText(choice: ExitChoice | null, past: PastExit[]): string {
    if (!choice) return reasons.tooEarly;
    const time = minutesToTime(Math.floor(choice.second / 60));
    const slot = Math.floor(choice.second / 60);
    switch (choice.reason) {
        case 'withOthers':
            return fmt(reasons.withOthers, { time });
        case 'lastExits':
            return fmt(reasons.lastExits, { count: USUAL_EXIT_SETTINGS.sameLastExits, time });
        case 'recentExits': {
            const recent = past.slice(0, USUAL_EXIT_SETTINGS.recentExits);
            return fmt(reasons.recentExits, { agree: recent.filter((exit) => exit.slot === slot).length, count: recent.length, time });
        }
        case 'othersToday':
            return fmt(reasons.othersToday, { time });
        case 'standard':
            return fmt(reasons.standard, { time });
        case 'now':
            return fmt(reasons.now, { time });
    }
}

/**
 * Auto-exit: who is still in (the last presence event of today is an entry) gets an exit, written like an exit made
 * in NetPro (addPresenceEvent: the work in progress paused one second before, the EXT row, the operator OUT). The
 * exit is dated at the person's usual exit time, read from the last real exits (src/lib/presence/usualExit.ts), with
 * the day's standard time when nothing can be learned; never before the person's entry or the start of the work in
 * progress, never in the future. Days that are not worked (the presence rules' calendar) are skipped. One transaction
 * per operator: an exit that cannot be written is that person's alone (`error` on their line, counted in `failed`),
 * the others still get theirs. The answer always lists what was written, also when the run breaks off: the
 * scheduler tries again on `failed` or on no success, and a second run only finds who is still in.
 */
export async function runAutoExit(options: AutoExitOptions = {}) {
    // Outside the try: a run that breaks off still says which exits it had written
    const decisions: AutoExitDecision[] = [];
    try {
        const rules = await loadPresenceRules();
        const preview = options.preview === true;
        const [today, rightNow] = toLocalDateTime(new Date()).split(' ');
        const clock = preview && options.at && CLOCK.test(options.at) ? secondsToClock(clockToSeconds(options.at)) : rightNow;
        const kind = getDayKind(today, rules);
        if (kind === 'off') return { success: true as const, skipped: true as const, reason: copy.autoExitSunday, processed: 0, failed: 0, exits: decisions };

        const standard = timeToMinutes(kind === 'extra' ? CONFIG.AUTO_EXIT_TIME_SATURDAY : CONFIG.AUTO_EXIT_TIME_WEEKDAY);
        const now = clockToSeconds(clock);

        const stamps = await loadStamps(today);
        const exits = realExits(stamps);
        const lastToday = lastStamps(stamps.filter((stamp) => stamp.day === today));
        const entries = new Map(lastToday.filter((stamp) => stamp.evento === PRESENCE_ENTRY).map((stamp) => [stamp.operator, clockToSeconds(stamp.time)]));

        // Who is decided for: who is still in; a preview may also ask for one operator or for everybody
        let operators = [...entries.keys()];
        if (preview && options.everyone) operators = [...new Set([...operators, ...exits.map((exit) => exit.operator)])];
        if (options.operator) operators = preview ? [options.operator] : operators.filter((operator) => operator === options.operator);
        operators.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        const workStarts = operators.length > 0 ? await loadWorkStarts(today) : new Map<string, number>();
        const names = operators.length > 0 ? await loadNames() : new Map<string, string | null>();
        const sameKind = (day: string) => getDayKind(day, rules) === kind;
        // "The time the others left today" is known only once the day is over, from the hour of the daily check on:
        // earlier (a run by hand, a preview at midday) the last exit of most people is the one of lunch
        const dayOver = clockToSeconds(rightNow) >= CONFIG.TRIGGER_HOUR * 3600;
        const othersToday = (operator?: string) =>
            dayOver ? othersSlot(exits.filter((exit) => exit.day === today && exit.operator !== operator).map((exit) => exit.slot)) : null;

        for (const operator of operators) {
            const stillIn = entries.has(operator);
            const past = pastExitsOf(operator, exits, today, sameKind);
            // The exit comes after the person's entry and after the start of the work in progress
            const after = stillIn ? Math.max(entries.get(operator) ?? 0, workStarts.get(operator) ?? 0) : 0;
            const choice = chooseExit(exitGuesses(past, othersToday(operator), standard), after, now);
            const exitTime = choice ? secondsToClock(choice.second) : null;

            let written = false;
            let paused: PausedWork[] = [];
            let error: string | undefined;
            if (!preview && stillIn && exitTime) {
                try {
                    const result = await withTransactions(['NETPRO'], async (run) => {
                        // Badged out in the meantime: nothing to do
                        if ((await lastPresenceEvent(run, operator)) !== PRESENCE_ENTRY) return null;
                        return addPresenceEvent(run, operator, PRESENCE_EXIT, `${today} ${exitTime}`, AUTO_EXIT_USER);
                    });
                    written = result !== null;
                    paused = result?.paused ?? [];
                } catch (err) {
                    // The transaction took back whatever it had written for this person: on to the next one
                    error = errorMessage(err);
                }
            }

            decisions.push({
                operator,
                name: names.get(operator) ?? null,
                stillIn,
                exitTime,
                reason: choice?.reason ?? null,
                why: reasonText(choice, past),
                lastExits: past.map((exit) => ({ day: exit.day, time: minutesToTime(exit.slot), others: exit.others === null ? null : minutesToTime(exit.others) })),
                written,
                ...(error === undefined ? {} : { error }),
                paused,
            });
        }

        const everyoneOut = othersToday();
        return {
            success: true as const,
            skipped: false as const,
            preview,
            date: today,
            checkedAt: clock,
            /** The day's standard time, and the time most people left today (null: the day is not over, or too few left) */
            standardTime: minutesToTime(standard),
            othersToday: everyoneOut === null ? null : minutesToTime(everyoneOut),
            /** Exits written (a preview writes none), and exits that could not be written */
            ...countOf(decisions),
            exits: decisions,
        };
    } catch (err) {
        return {
            success: false as const,
            error: errorMessage(err),
            ...countOf(decisions),
            exits: decisions,
        };
    }
}
