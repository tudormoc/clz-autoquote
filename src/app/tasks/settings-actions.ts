'use server'

/** Reads of the Agenda's settings tables (Impostazioni → Aree Agenda, Giorni di chiusura); writes go through admin-actions.ts */

import { authorize } from '@/lib/auth/access';
import { listAreaRows, listClosedDayRows, type AreaRow, type ClosedDayRow } from '@/lib/tasks/db/settings';

export async function getTaskAreasAction(): Promise<AreaRow[]> {
    await authorize('view', '/settings/task-areas');
    return listAreaRows();
}

export async function getClosedDaysAction(): Promise<ClosedDayRow[]> {
    await authorize('view', '/settings/closed-days');
    return listClosedDayRows();
}
