/**
 * Who may open what, from the menu itself (NAV_AREAS): a page is identified by its link (href), a group gives
 * "vede" (view) or "modifica" (edit) per page, a user gets the highest level of all their groups.
 * Shared by the server checks (src/lib/auth/access.ts) and the browser (menu, home, edit buttons).
 */

import { NAV_AREAS, findNavLocation, type NavArea, type NavItem } from '@/config/navigation';

export type AccessLevel = 'view' | 'edit';

/** Page link → level; pages not listed are not visible */
export type PagePermissions = Record<string, AccessLevel>;

/** The logged-in person as the app needs them */
export interface UserAccess {
    /** app_users.id; null for the superadmin */
    id: number | null;
    name: string;
    /** Sees and changes everything, manages users and groups */
    superadmin: boolean;
    pages: PagePermissions;
}

/** Pages a group can be given, per area, in menu order (a single-page area is its own page) */
export const ACCESS_AREAS: { area: NavArea; pages: NavItem[] }[] = NAV_AREAS.map((area) => ({
    area,
    pages: area.groups ? area.groups.flatMap((group) => group.items).filter((item) => !item.superadminOnly) : [area],
})).filter((entry) => entry.pages.length > 0);

/** Every page a group can be given, in menu order */
export const GRANTABLE_PAGES = ACCESS_AREAS.flatMap((entry) => entry.pages);
const GRANTABLE = new Map(GRANTABLE_PAGES.map((page) => [page.href, page]));

/** A page groups can be given, by its link (undefined for anything else) */
const grantablePage = (href: string): NavItem | undefined => GRANTABLE.get(href);

/** Names of the pages given at this level, in menu order */
export const pageLabels = (pages: PagePermissions, level: AccessLevel): string[] =>
    GRANTABLE_PAGES.filter((page) => pages[page.href] === level).map((page) => page.label);

/** Only known pages, and "edit" only where a page changes data (stored groups are read through this) */
export function cleanPermissions(value: unknown): PagePermissions {
    if (!value || typeof value !== 'object') return {};
    const clean: PagePermissions = {};
    for (const [href, level] of Object.entries(value)) {
        const page = grantablePage(href);
        if (page && (level === 'view' || level === 'edit')) clean[href] = level === 'edit' && page.editable ? 'edit' : 'view';
    }
    return clean;
}

/** Highest level per page over several groups */
export function mergePermissions(all: PagePermissions[]): PagePermissions {
    const merged: PagePermissions = {};
    for (const pages of all) {
        for (const [href, level] of Object.entries(pages)) {
            if (merged[href] !== 'edit') merged[href] = level;
        }
    }
    return merged;
}

/** A level for several pages at once: "edit" where a page changes data, "view" on the others; null takes them away */
export function withLevel(pages: PagePermissions, items: NavItem[], level: AccessLevel | null): PagePermissions {
    const next = { ...pages };
    for (const item of items) {
        if (level) next[item.href] = level === 'edit' && !item.editable ? 'view' : level;
        else delete next[item.href];
    }
    return next;
}

/**
 * The one level that gives these pages what they have now (as withLevel would), or "mixed".
 * Pages that cannot be changed count as "edit" too when they are visible, so "Modifica" on an area stays lit.
 */
export function sharedLevel(pages: PagePermissions, items: NavItem[]): AccessLevel | null | 'mixed' {
    const fits = (level: AccessLevel | null) =>
        items.every((item) => {
            const granted = pages[item.href] ?? null;
            return level === 'edit' ? granted === 'edit' || (granted === 'view' && !item.editable) : granted === level;
        });
    if (fits(null)) return null;
    if (fits('view')) return 'view';
    return fits('edit') ? 'edit' : 'mixed';
}

/** The level a click moves to: No → Vede → Modifica (where something can be changed) → No; mixed → Vede */
export function nextLevel(current: AccessLevel | null | 'mixed', editable: boolean): AccessLevel | null {
    if (current === null || current === 'mixed') return 'view';
    return current === 'view' && editable ? 'edit' : null;
}

export function canOpen(access: UserAccess, href: string, level: AccessLevel = 'view'): boolean {
    if (access.superadmin) return true;
    const granted = access.pages[href];
    return level === 'view' ? granted !== undefined : granted === 'edit';
}

/** The menu of this person: the areas and pages they may open, nothing else */
export function visibleAreas(access: UserAccess): NavArea[] {
    if (access.superadmin) return NAV_AREAS;
    return NAV_AREAS.flatMap((area) => {
        if (!area.groups) return canOpen(access, area.href) ? [area] : [];
        const groups = area.groups
            .map((group) => ({ ...group, items: group.items.filter((item) => !item.superadminOnly && canOpen(access, item.href)) }))
            .filter((group) => group.items.length > 0);
        return groups.length > 0 ? [{ ...area, groups }] : [];
    });
}

/** Every page of a menu, single-page areas included */
export const menuPages = (areas: NavArea[]): NavItem[] => areas.flatMap((area) => (area.groups ? area.groups.flatMap((group) => group.items) : [area]));

/** The address may be opened: home, an allowed page, or the overview of an area that has one */
export function canOpenPath(access: UserAccess, pathname: string): boolean {
    if (access.superadmin || pathname === '/') return true;
    const { area, page } = findNavLocation(pathname);
    if (page) return !page.superadminOnly && canOpen(access, page.href);
    if (!area) return true; // outside the menu: login, not found …
    if (!area.groups) return canOpen(access, area.href);
    return pathname === area.href && visibleAreas(access).some((visible) => visible.id === area.id);
}
