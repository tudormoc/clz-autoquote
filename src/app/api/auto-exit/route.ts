import { runAutoExitAction } from '@/app/presence/presence-actions';

/**
 * GET /api/auto-exit
 * Triggered by the scheduler at the configured TRIGGER_HOUR.
 * Finds operators with ENT but no EXT today and creates an EXT event at the configured time.
 *
 * Optional query param: ?operator=98  — limits the run to a single operator (for testing)
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const operator = searchParams.get('operator') ?? undefined;
    const result = await runAutoExitAction(operator);
    return Response.json(result);
}
