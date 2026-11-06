/**
 * The Gruppi page as lights. What a group has on a page is a few things that are each on or off: it sees the page,
 * it modifies it, it uses one of the page's functions (Riallinea …). This file turns a click on a light into the
 * stored grants (PagePermissions, src/lib/auth/permissions.ts) and reads them back. The lights follow each other:
 *   - Modifica on switches Vede on; Vede off switches Modifica off
 *   - a page's function needs the page at its highest level (Modifica, or Vede where the page changes no data):
 *     switching it on raises the page, lowering the page switches it off
 * A row of several pages (an area, "Tutte le pagine") switches Vede and Modifica on all its pages that have that
 * light. Functions are never switched on by such a row or by a preset, only one by one.
 * The Registro has no light per page: who sees the Registro page finds there the history of the pages they see
 * (src/lib/log/areas.ts).
 * Pure: examples in npm run permissions:examples.
 */

import { pageFunctions, type NavFunction, type NavItem } from '@/config/navigation';
import { GRANTABLE_PAGES, functionKey, grantKey, type AccessLevel, type PagePermissions } from '@/lib/auth/permissions';

/** The two lights every page row has: it sees the page, it modifies it */
export type LightKind = 'see' | 'modify';
export const LIGHTS: readonly LightKind[] = ['see', 'modify'];

/** A light over one or more pages: "some" when only part of them have it on */
export type LightState = 'on' | 'some' | 'off';

/** The level a page needs for its functions to count: the highest it can have */
const topLevel = (page: NavItem): AccessLevel => (page.editable ? 'edit' : 'view');

/** Modifica exists only where the page changes data */
const hasLight = (page: NavItem, light: LightKind): boolean => light === 'see' || !!page.editable;

const isOn = (pages: PagePermissions, page: NavItem, light: LightKind): boolean =>
    light === 'see' ? pages[grantKey(page)] !== undefined : pages[grantKey(page)] === 'edit';

/** Is this function of the page on? */
export const functionOn = (pages: PagePermissions, page: NavItem, fn: NavFunction): boolean => pages[functionKey(page, fn)] === 'edit';

/** The light over these pages, counting only those that have it; null when none of them has it */
export function lightState(pages: PagePermissions, list: NavItem[], light: LightKind): LightState | null {
    const having = list.filter((page) => hasLight(page, light));
    if (having.length === 0) return null;
    const on = having.filter((page) => isOn(pages, page, light)).length;
    return on === having.length ? 'on' : on > 0 ? 'some' : 'off';
}

/** The page at this level (null = not seen); its functions go off when the level no longer carries them */
function withPageLevel(pages: PagePermissions, page: NavItem, level: AccessLevel | null): PagePermissions {
    const next = { ...pages };
    if (level) next[grantKey(page)] = level;
    else delete next[grantKey(page)];
    if (level !== topLevel(page)) for (const fn of pageFunctions(page)) delete next[functionKey(page, fn)];
    return next;
}

function withPageLight(pages: PagePermissions, page: NavItem, light: LightKind, on: boolean): PagePermissions {
    if (light === 'see') {
        if (!on) return withPageLevel(pages, page, null);
        return isOn(pages, page, 'see') ? pages : withPageLevel(pages, page, 'view');
    }
    if (on) return withPageLevel(pages, page, 'edit');
    return isOn(pages, page, 'modify') ? withPageLevel(pages, page, 'view') : pages;
}

/** A light switched on or off on these pages (those that have it): one page, an area, or all of them */
export function withLight(pages: PagePermissions, list: NavItem[], light: LightKind, on: boolean): PagePermissions {
    return list.filter((page) => hasLight(page, light)).reduce((next, page) => withPageLight(next, page, light, on), pages);
}

/** One of the page's functions switched on (the page rises to the level the function needs) or off */
export function withFunction(pages: PagePermissions, page: NavItem, fn: NavFunction, on: boolean): PagePermissions {
    const next = on ? withPageLevel(pages, page, topLevel(page)) : { ...pages };
    if (on) next[functionKey(page, fn)] = 'edit';
    else delete next[functionKey(page, fn)];
    return next;
}

/** Starting points for a whole group: nothing at all, every page seen and none modified, every page at its highest level */
export type Preset = 'none' | 'read' | 'all';
export const PRESETS: readonly Preset[] = ['none', 'read', 'all'];

/**
 * The group after a preset. "none" switches everything off. "read" and "all" set Vede and Modifica on every page;
 * neither switches a function on ("read" switches off those that need Modifica).
 */
export function withPreset(pages: PagePermissions, preset: Preset): PagePermissions {
    if (preset === 'none') return {};
    if (preset === 'all') return withLight(withLight(pages, GRANTABLE_PAGES, 'see', true), GRANTABLE_PAGES, 'modify', true);
    return withLight(withLight(pages, GRANTABLE_PAGES, 'modify', false), GRANTABLE_PAGES, 'see', true);
}

/** The same grants, in whatever order they are written: a click that changes nothing is not saved */
export function sameGrants(a: PagePermissions, b: PagePermissions): boolean {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

/** How many pages have each light on, and how many functions: a group at a glance */
export function lightCounts(pages: PagePermissions): Record<LightKind | 'functions', number> {
    const count = (light: LightKind) => GRANTABLE_PAGES.filter((page) => isOn(pages, page, light)).length;
    return {
        see: count('see'),
        modify: count('modify'),
        functions: GRANTABLE_PAGES.reduce((total, page) => total + pageFunctions(page).filter((fn) => functionOn(pages, page, fn)).length, 0),
    };
}
