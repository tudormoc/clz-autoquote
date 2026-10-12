/**
 * The Agenda's settings tables: areas (tsk_areas) and company closed days (tsk_closed_days).
 * Read here; changed through the settings pages (src/config/editableTables.ts → src/app/admin-actions.ts).
 */

import type { ClosedDay } from '@/lib/tasks/closedDays';
import type { NamedItem } from '@/lib/tasks/types';
import { DATE_SQL, rows } from '@/lib/tasks/db/shared';

export interface AreaRow {
    id: number;
    name: string;
    sort_order: number;
}

export interface ClosedDayRow {
    id: number;
    closed_on: string;
    name: string;
    every_year: boolean;
}

export async function listAreaRows(): Promise<AreaRow[]> {
    return rows<AreaRow>(`SELECT id, name, sort_order FROM tsk_areas WITH (NOLOCK) ORDER BY sort_order, name`);
}

export async function listAreas(): Promise<NamedItem[]> {
    return (await listAreaRows()).map(({ id, name }) => ({ id, name }));
}

export async function listClosedDayRows(): Promise<ClosedDayRow[]> {
    return rows<ClosedDayRow>(`SELECT id, ${DATE_SQL('closed_on')} AS closed_on, name, every_year FROM tsk_closed_days WITH (NOLOCK) ORDER BY closed_on`);
}

export async function listClosedDays(): Promise<ClosedDay[]> {
    return (await listClosedDayRows()).map((row) => ({ id: row.id, closedOn: row.closed_on, name: row.name, everyYear: Boolean(row.every_year) }));
}
