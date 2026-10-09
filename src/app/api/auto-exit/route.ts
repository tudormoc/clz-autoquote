import { runAutoExit } from '@/app/presence/auto-exit';
import { getAccess } from '@/lib/auth/access';
import { sameText, schedulerKey } from '@/lib/auth/secrets';

/** Header with which scripts/scheduler.js proves it is the scheduler (a key derived from AUTH_SECRET) */
const SCHEDULER_HEADER = 'x-scheduler-key';

/**
 * GET /api/auto-exit
 * Triggered by the scheduler at the configured TRIGGER_HOUR; otherwise only the superadmin may run it.
 * Finds operators with ENT but no EXT today and creates an EXT event at the configured time.
 *
 * Optional query param: ?operator=98  — limits the run to a single operator (for testing)
 */
export async function GET(request: Request) {
    const key = request.headers.get(SCHEDULER_HEADER);
    let allowed = false;
    try {
        allowed = key ? sameText(key, schedulerKey()) : (await getAccess())?.superadmin === true;
    } catch {
        allowed = false;
    }
    if (!allowed) return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const operator = searchParams.get('operator') ?? undefined;
    const result = await runAutoExit(operator);
    return Response.json(result);
}
