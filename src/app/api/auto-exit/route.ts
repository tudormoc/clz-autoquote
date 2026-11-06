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
 * Finds operators with ENT but no EXT today and creates an EXT event at the configured time.
 * Every run is written in the log (Registro), as the Scheduler's or the superadmin's.
 *
 * Optional query param: ?operator=98  — limits the run to a single operator (for testing)
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
    const operator = searchParams.get('operator') ?? undefined;
    const result = await runAutoExit(operator);
    await logEvent(who, {
        page: LINKS.presence.dailyEvents,
        action: 'auto-exit',
        entityKind: 'presence-event',
        summary: result.success ? fmt(log.autoExit, { count: result.processed }) : log.autoExitFailed,
        details: result,
        outcome: result.success ? 'ok' : 'error',
        error: 'error' in result ? result.error : undefined,
    });
    return Response.json(result);
}
