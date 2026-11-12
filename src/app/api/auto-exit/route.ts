import { runAutoExit, type AutoExitDecision } from '@/app/presence/auto-exit';
import { LINKS } from '@/config/navigation';
import { getAccess } from '@/lib/auth/access';
import { sameText, schedulerKey } from '@/lib/auth/secrets';
import { SCHEDULER, logEvent } from '@/lib/log/log';
import { APP_COPY, fmt } from '@/locales';

/** Header with which scripts/scheduler.js proves it is the scheduler (a key derived from AUTH_SECRET) */
const SCHEDULER_HEADER = 'x-scheduler-key';

const log = APP_COPY.log.entries;

/**
 * GET /api/auto-exit
 * Triggered by the scheduler at the configured TRIGGER_HOUR: only its call, with the scheduler's key, writes.
 * Who is still in (an entry today and no exit after it) gets an exit dated at their usual exit time
 * (src/app/presence/auto-exit.ts). Every run is written in the log (Registro) as the Scheduler's, with one line per
 * person: the time used and why, or why no exit was written. An exit that could not be written is counted in
 * `failed`: the scheduler then calls again a few minutes later, and that run only finds who is still in.
 * The superadmin opening this address always gets the preview, whatever the address says: a link only shows, it
 * never writes (README rule 8).
 *
 * Optional query params:
 *   ?operator=98   limits the run to a single operator
 *   ?preview=1     the scheduler's call too only decides and answers, writes nothing and logs nothing
 *   ?everyone=1    with preview: everybody with past exits, not only who is still in
 *   ?at=19:00      with preview: as if the check ran at that time of today
 */
export async function GET(request: Request) {
    const key = request.headers.get(SCHEDULER_HEADER);
    let scheduler = false;
    let allowed = false;
    try {
        if (key) scheduler = allowed = sameText(key, schedulerKey());
        else allowed = (await getAccess())?.superadmin === true;
    } catch {
        allowed = false;
    }
    if (!allowed) return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const preview = !scheduler || searchParams.has('preview');
    const result = await runAutoExit({
        operator: searchParams.get('operator') ?? undefined,
        preview,
        everyone: searchParams.has('everyone'),
        at: searchParams.get('at') ?? undefined,
    });
    if (preview) return Response.json(result);

    const counts = { count: result.processed, failed: result.failed };
    await logEvent(SCHEDULER, {
        page: LINKS.presence.dailyEvents,
        action: 'auto-exit',
        entityKind: 'presence-event',
        summary: runSummary(result.success, counts),
        details: result,
        outcome: result.success && result.failed === 0 ? 'ok' : 'error',
        error: 'error' in result ? result.error : undefined,
    });
    // One line per person: the time the exit was dated at and why, or why none was written
    for (const exit of result.exits) {
        const person = { operator: exit.operator, name: exit.name ?? '' };
        await logEvent(SCHEDULER, {
            page: LINKS.presence.dailyEvents,
            action: exit.written ? 'created' : 'auto-exit',
            entityKind: 'presence-event',
            entityId: exit.operator,
            summary: exit.written
                ? fmt(log.autoExitOperator, { ...person, time: exit.exitTime ?? '', why: exit.why })
                : fmt(log.autoExitNotWritten, { ...person, why: notWrittenWhy(exit) }),
            details: { after: exit },
            outcome: exit.written ? 'ok' : exit.error === undefined ? 'refused' : 'error',
            error: exit.error,
        });
    }
    return Response.json(result);
}

/** The run's line in the Registro: all written, some not written, or broken off (with what it had written by then) */
function runSummary(success: boolean, counts: { count: number; failed: number }): string {
    if (!success) return counts.count > 0 ? fmt(log.autoExitBrokenOff, counts) : log.autoExitFailed;
    return counts.failed > 0 ? fmt(log.autoExitPartly, counts) : fmt(log.autoExit, counts);
}

/** Why a person's exit was not written: the write failed, they badged out in the meantime, or no time was possible */
function notWrittenWhy(exit: AutoExitDecision): string {
    if (exit.error !== undefined) return log.autoExitReasons.writeFailed;
    return exit.exitTime ? log.autoExitReasons.leftMeanwhile : exit.why;
}
