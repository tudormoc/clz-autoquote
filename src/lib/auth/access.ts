/**
 * The real access checks (server only), called by every page and every server action:
 * - getAccess(): who is logged in, with the pages of their groups (once per request);
 * - requirePage(): pages — not logged in → login page, not allowed → "no access" page;
 * - authorize() / requireSuperadmin(): server actions — refused with an error, before any data is read or written.
 * src/proxy.ts only checks that a login cookie exists; hiding a link is never the protection.
 */

import { cache } from 'react';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { LOGIN_PATH, NAV_AREAS, NO_ACCESS_PATH, getNavArea, type NavAreaId } from '@/config/navigation';
import { loadAccountAccess } from '@/lib/auth/accounts';
import { canOpen, canOpenPath, menuPages, type AccessLevel, type UserAccess } from '@/lib/auth/permissions';
import { pinFingerprint } from '@/lib/auth/secrets';
import { SESSION_COOKIE, SUPERADMIN, parseSession, superadminAccount, superadminFingerprint } from '@/lib/auth/session';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.auth;

/** Every page link of the menu, to catch a mistyped link in a check */
const KNOWN_PAGES = new Set(menuPages(NAV_AREAS).map((page) => page.href));

/** The person logged in, or null. A deleted or suspended user, or one whose PIN changed since, is not logged in any more. */
export const getAccess = cache(async (): Promise<UserAccess | null> => {
    const session = parseSession((await cookies()).get(SESSION_COOKIE)?.value);
    if (!session) return null;

    if (session.sub === SUPERADMIN) {
        const account = superadminAccount();
        return account && session.pv === superadminFingerprint() ? { id: null, name: account.name, superadmin: true, pages: {} } : null;
    }

    const loaded = await loadAccountAccess(session.sub);
    if (!loaded || loaded.account.suspended || pinFingerprint(loaded.account.pin) !== session.pv) return null;
    return { id: loaded.account.id, name: loaded.account.name, superadmin: false, pages: loaded.pages };
});

/** Link of an area (overview or single page) or of one of its pages; unknown → not found */
function pageHref(areaId: NavAreaId, pageId?: string): string {
    const area = getNavArea(areaId);
    if (!pageId) return area.href;
    const page = area.groups?.flatMap((group) => group.items).find((item) => item.id === pageId);
    if (!page) notFound();
    return page.href;
}

/** Pages: returns the person when they may open this page, otherwise sends them to the login or "no access" page */
export async function requirePage(areaId: NavAreaId, pageId?: string): Promise<UserAccess> {
    const href = pageHref(areaId, pageId);
    const access = await getAccess();
    if (!access) redirect(LOGIN_PATH);
    if (!canOpenPath(access, href)) redirect(NO_ACCESS_PATH);
    return access;
}

/** Pages that are not in the menu (home, no access): only a login is needed */
export async function requireLogin(): Promise<UserAccess> {
    const access = await getAccess();
    if (!access) redirect(LOGIN_PATH);
    return access;
}

/**
 * Server actions: the person may use one of these pages (menu links) at this level — e.g. a read shared by the quote
 * form and a settings page lists both. Otherwise the action stops here with an error.
 */
export async function authorize(level: AccessLevel, ...hrefs: string[]): Promise<UserAccess> {
    const unknown = hrefs.find((href) => !KNOWN_PAGES.has(href));
    if (unknown) throw new Error(`Access check on an unknown page: ${unknown}`);
    const access = await getAccess();
    if (!access) throw new Error(copy.sessionExpired);
    if (!hrefs.some((href) => canOpen(access, href, level))) throw new Error(copy.notAllowed);
    return access;
}

/** Server actions only the superadmin may run (users, groups, database explorer) */
export async function requireSuperadmin(): Promise<UserAccess> {
    const access = await getAccess();
    if (!access) throw new Error(copy.sessionExpired);
    if (!access.superadmin) throw new Error(copy.notAllowed);
    return access;
}
