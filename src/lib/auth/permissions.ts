/**
 * Who may open what, from the menu itself (NAV_AREAS): a group gives "vede" (view) or "modifica" (edit) per page,
 * a user gets the highest level of all their groups. A page's function (NavItem.functions, e.g. Riallinea) is given
 * on its own, as "edit".
 * A group's pages are keyed by the page's id ("daily-events", a function "work-progress#riallinea"), not its link:
 * a page can move to another area and keep its grants. The checks take links (LINKS.*) and look the key up.
 * Shared by the server checks (src/lib/auth/access.ts) and the browser (menu, home, edit buttons).
 */

import { NAV_AREAS, findNavLocation, type NavArea, type NavFunction, type NavItem } from '@/config/navigation';

export type AccessLevel = 'view' | 'edit';

/** Grant key (page id, or "page id#function") → level; what is not listed is not visible */
export type PagePermissions = Record<string, AccessLevel>;

/** What a Gruppi row sets: a page, or a function (always editable, given as "edit"), by its grant key */
export interface Grantable {
    key: string;
    editable?: boolean;
}

/** The grant key of a page: its id, which stays when the page moves (ids are unique across areas, checked below) */
export const grantKey = (page: NavItem): string => page.id;
/** The grant key of a page's function */
export const functionKey = (page: NavItem, fn: NavFunction): string => `${page.id}#${fn.name}`;
/** A function's key, as opposed to a page's */
export const isFunctionKey = (key: string) => key.includes('#');

/**
 * Links that pages had before, with the page's id now: a group that was given the old link keeps the page.
 * Add a line here when a page's link changes (see README, "Move or rename a page").
 */
const RENAMED_LINKS: Record<string, string> = {};

/** The logged-in person as the app needs them */
export interface UserAccess {
    /** app_users.id; null for the superadmin */
    id: number | null;
    name: string;
    /** Sees and changes everything, manages users and groups */
    superadmin: boolean;
    pages: PagePermissions;
    /** app_groups ids of the user (none for the superadmin): what a group shares with its members */
    groupIds: number[];
}

/** Pages a group can be given, per area, in menu order (a single-page area is its own page) */
export const ACCESS_AREAS: { area: NavArea; pages: NavItem[] }[] = NAV_AREAS.map((area) => ({
    area,
    pages: area.groups ? area.groups.flatMap((group) => group.items).filter((item) => !item.superadminOnly) : [area],
})).filter((entry) => entry.pages.length > 0);

/** Every page a group can be given, in menu order */
export const GRANTABLE_PAGES = ACCESS_AREAS.flatMap((entry) => entry.pages);
const PAGE_BY_KEY = new Map(GRANTABLE_PAGES.map((page) => [grantKey(page), page]));

const duplicateId = GRANTABLE_PAGES.map(grantKey).find((key, index, all) => all.indexOf(key) !== index);
if (duplicateId) throw new Error(`Two pages share the id "${duplicateId}": page ids must be unique across areas (src/config/navigation.ts)`);

/** Every function a group can be given, with its page and key, in menu order */
export const GRANTABLE_FUNCTIONS: { page: NavItem; fn: NavFunction; key: string }[] = GRANTABLE_PAGES.flatMap((page) =>
    (page.functions ?? []).map((fn) => ({ page, fn, key: functionKey(page, fn) }))
);
const FUNCTION_KEYS = new Set(GRANTABLE_FUNCTIONS.map(({ key }) => key));

/** Link → grant key, for the checks (authorize, canOpen, canUse take links) */
const KEY_BY_HREF = new Map<string, string>([
    ...GRANTABLE_PAGES.map((page): [string, string] => [page.href, grantKey(page)]),
    ...GRANTABLE_FUNCTIONS.map(({ fn, key }): [string, string] => [fn.href, key]),
]);

/** A page or function as a Gruppi row sets it */
export const grantable = (page: NavItem): Grantable => ({ key: grantKey(page), editable: page.editable });

/** Names of the pages given at this level, in menu order */
export const pageLabels = (pages: PagePermissions, level: AccessLevel): string[] =>
    GRANTABLE_PAGES.filter((page) => pages[grantKey(page)] === level).map((page) => page.label);

/** "Page · function" for every function given, in menu order */
export const functionLabels = (pages: PagePermissions): string[] =>
    GRANTABLE_FUNCTIONS.filter(({ key }) => pages[key] === 'edit').map(({ page, fn }) => `${page.label} · ${fn.label}`);

/**
 * Only known pages and functions, "edit" only where a page changes data (stored groups are read through this).
 * A key stored as a link (the form before 2026-10-30, or a link since renamed) becomes the page's key.
 */
export function cleanPermissions(value: unknown): PagePermissions {
    if (!value || typeof value !== 'object') return {};
    const clean: PagePermissions = {};
    for (const [stored, level] of Object.entries(value)) {
        if (level !== 'view' && level !== 'edit') continue;
        const key = PAGE_BY_KEY.has(stored) || FUNCTION_KEYS.has(stored) ? stored : (KEY_BY_HREF.get(stored) ?? RENAMED_LINKS[stored]);
        if (!key) continue;
        const page = PAGE_BY_KEY.get(key);
        if (page) clean[key] = level === 'edit' && page.editable ? 'edit' : 'view';
        else if (FUNCTION_KEYS.has(key) && level === 'edit') clean[key] = 'edit';
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
export function withLevel(pages: PagePermissions, items: Grantable[], level: AccessLevel | null): PagePermissions {
    const next = { ...pages };
    for (const item of items) {
        if (level) next[item.key] = level === 'edit' && !item.editable ? 'view' : level;
        else delete next[item.key];
    }
    return next;
}

/**
 * The one level that gives these pages what they have now (as withLevel would), or "mixed".
 * Pages that cannot be changed count as "edit" too when they are visible, so "Modifica" on an area stays lit.
 */
export function sharedLevel(pages: PagePermissions, items: Grantable[]): AccessLevel | null | 'mixed' {
    const fits = (level: AccessLevel | null) =>
        items.every((item) => {
            const granted = pages[item.key] ?? null;
            return level === 'edit' ? granted === 'edit' || (granted === 'view' && !item.editable) : granted === level;
        });
    if (fits(null)) return null;
    if (fits('view')) return 'view';
    return fits('edit') ? 'edit' : 'mixed';
}

/** May the person open this page (its link from LINKS) at this level? Links of nothing grantable are refused. */
export function canOpen(access: UserAccess, href: string, level: AccessLevel = 'view'): boolean {
    if (access.superadmin) return true;
    const key = KEY_BY_HREF.get(href);
    const granted = key ? access.pages[key] : undefined;
    return level === 'view' ? granted !== undefined : granted === 'edit';
}

/** May the person use this function of a page (its link from NAV_AREAS, e.g. WORK_PROGRESS_FUNCTIONS.riallinea)? */
export const canUse = (access: UserAccess, functionHref: string): boolean => canOpen(access, functionHref, 'edit');

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
