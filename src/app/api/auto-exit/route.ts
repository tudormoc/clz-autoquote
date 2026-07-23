import { runAutoExitAction } from '@/app/presence/presence-actions';

/**
 * GET /api/auto-exit
 * Triggered by the scheduler at the configured TRIGGER_HOUR.
 * Finds operators with ENT but no EXT today and creates an EXT event at the configured time.
 */
export async function GET() {
    const result = await runAutoExitAction();
    return Response.json(result);
}
