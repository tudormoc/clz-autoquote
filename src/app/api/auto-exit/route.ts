import { runAutoExit } from '@/app/presence/auto-exit';
import { LINKS } from '@/config/navigation';
import { getAccess } from '@/lib/auth/access';
import { sameText, schedulerKey } from '@/lib/auth/secrets';
import { SCHEDULER, logEvent, personOf, type LogPerson } from '@/lib/log/log';
import { APP_COPY, fmt } from '@/locales';

/** Header with which scripts/scheduler.js proves it is the scheduler (a key derived from AUTH_SECRET) */
const SCHEDULER_HEADER = 'x-scheduler-key';

const log = APP_COPY.log.entries;

/**
 * GET /api/auto-exit
 * Triggered by the scheduler at the configured TRIGGER_HOUR; otherwise only the superadmin may run it.
 * Who is still in (an entry today and no exit after it) gets an exit dated at their usual exit time
 * (src/app/presence/auto-exit.ts). Every run is written in the log (Registro), as the Scheduler's or the
 * superadmin's, with one line per person: the time used and why.
 *
 * Optional query params:
 *   ?operator=98   limits the run to a single operator (for testing)
 *   ?preview=1     decides and answers, writes nothing and logs nothing: what would happen right now
 *   ?everyone=1    with preview: everybody with past exits, not only who is still in
 *   ?at=19:00      with preview: as if the check ran at that time of today
 */
export async function GET(request: Request) {
    const key = request.headers.get(SCHEDULER_HEADER);
    let who: LogPerson | null = null;
    try {
        if (key) {
            if (sameText(key, schedulerKey())) who = SCHEDULER;
        } else {
            const access = await getAccess();
            if (access?.superadmin) who = personOf(access);
        }
    } catch {
        who = null;
    }
    if (!who) return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const preview = searchParams.has('preview');
    const result = await runAutoExit({
        operator: searchParams.get('operator') ?? undefined,
        preview,
        everyone: searchParams.has('everyone'),
        at: searchParams.get('at') ?? undefined,
    });
    if (preview) return Response.json(result);

    await logEvent(who, {
        page: LINKS.presence.dailyEvents,
        action: 'auto-exit',
        entityKind: 'presence-event',
        summary: result.success ? fmt(log.autoExit, { count: result.processed }) : log.autoExitFailed,
        details: result,
        outcome: result.success ? 'ok' : 'error',
        error: 'error' in result ? result.error : undefined,
    });
    // One line per person: the time the exit was dated at and why, or why none was written
    for (const exit of result.exits) {
        const person = { operator: exit.operator, name: exit.name ?? '' };
        await logEvent(who, {
            page: LINKS.presence.dailyEvents,
            action: exit.written ? 'created' : 'auto-exit',
            entityKind: 'presence-event',
            entityId: exit.operator,
            summary: exit.written
                ? fmt(log.autoExitOperator, { ...person, time: exit.exitTime ?? '', why: exit.why })
                : fmt(log.autoExitNotWritten, { ...person, why: exit.exitTime ? log.autoExitReasons.leftMeanwhile : exit.why }),
            details: { after: exit },
            outcome: exit.written ? 'ok' : 'refused',
        });
    }
    return Response.json(result);
}
