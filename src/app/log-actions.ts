'use server'

/**
 * Server actions of the Registro page (Impostazioni → Strumenti): the app-wide log, read only. A person sees the
 * entries of the pages they can open; "Tutto il registro", a function of this page, shows those of every page a group
 * can be given. Logins and the entries of Utenti, Gruppi and Esplora Database are the superadmin's alone
 * (the rule: src/lib/log/areas.ts).
 */

import { buildPaginationResult, calculateOffset, failedPage } from '@/app/analytics/queries/shared/query-utils';
import { LINKS } from '@/config/navigation';
import { authorize } from '@/lib/auth/access';
import { visibleLogAreas } from '@/lib/log/areas';
import { loadLogDetails, loadLogEntries, type LogEntryRow, type LogFilters, type LogSource } from '@/lib/log/entries';
import { errorMessage } from '@/lib/utils';

/** One page of the log, newest first */
export async function getLogEntriesAction(page: number = 1, limit: number = 100, filters: Omit<LogFilters, 'areas'> = {}) {
    const access = await authorize('view', LINKS.settings.log);
    try {
        const { rows, total } = await loadLogEntries({ ...filters, areas: visibleLogAreas(access) }, calculateOffset(page, limit), limit);
        return { success: true, data: rows, pagination: buildPaginationResult(page, limit, total) };
    } catch (error) {
        console.error('Log query error:', error);
        return failedPage<LogEntryRow>(error, page, limit);
    }
}

/** The full record of one entry (JSON text): the values before and after, the rows changed */
export async function getLogDetailsAction(source: LogSource, id: number): Promise<{ success: true; details: string | null } | { success: false; error: string }> {
    const access = await authorize('view', LINKS.settings.log);
    try {
        return { success: true, details: await loadLogDetails(source, Number(id), visibleLogAreas(access)) };
    } catch (error) {
        console.error('Log details query error:', error);
        return { success: false, error: errorMessage(error) };
    }
}
