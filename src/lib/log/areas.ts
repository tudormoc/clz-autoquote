/**
 * Whose entries of the Registro a person sees (pure; examples in npm run permissions:examples). Who opens the Registro
 * page finds there what was done on the pages they can open, nothing else: the history follows the pages, there is no
 * grant per page. "Tutto il registro", a function of the Registro page, shows every page a group can be given.
 * Logins and the entries of Utenti, Gruppi and Esplora Database are the superadmin's alone.
 */

import { LINKS, LOG_FUNCTIONS } from '@/config/navigation';
import { GRANTABLE_PAGES, canOpen, canUse, type UserAccess } from '@/lib/auth/permissions';

/** The Agenda's and the timesheet's own logs follow a page: Storico and Ore Ufficio */
const OTHER_AREAS: [area: string, pageHref: string][] = [
    ['tasks', LINKS.tasks.history],
    ['timesheet', LINKS.presence.officeHours],
];

/** The areas of the log this person may see (page ids, tasks, timesheet); undefined = all of them, which only the superadmin gets */
export function visibleLogAreas(access: UserAccess): string[] | undefined {
    if (access.superadmin) return undefined;
    const all = canUse(access, LOG_FUNCTIONS.all);
    const seen = (pageHref: string) => all || canOpen(access, pageHref);
    return [...GRANTABLE_PAGES.filter((page) => seen(page.href)).map((page) => page.id), ...OTHER_AREAS.filter(([, pageHref]) => seen(pageHref)).map(([area]) => area)];
}
