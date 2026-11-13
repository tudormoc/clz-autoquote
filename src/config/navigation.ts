/**
 * Navigation — single source of truth for the app's areas and their pages.
 * The sidebar, the phone menu, the home page cards and each area's overview page are built from NAV_AREAS.
 *
 * Adding a page:
 *   - a new area → add it to NAV_AREAS (label in it.ts → nav.areas)
 *   - a page inside an area → add it to that area's groups
 * Analytics reports (src/config/analyticsSections.ts) and settings pages (src/config/settingsPages.ts) appear here automatically.
 */
import {
    BarChart3,
    BookOpen,
    Calendar,
    CalendarCheck,
    CalendarDays,
    CalendarRange,
    ClipboardList,
    Clock,
    Contact,
    FileText,
    History,
    ListChecks,
    ListTodo,
    Settings,
    Users,
    Wallet,
    Workflow,
    type LucideIcon,
} from '@/components/ui/icons';
import { APP_COPY } from '@/locales';
import { ANALYTICS_CATEGORIES, ANALYTICS_SECTIONS } from '@/config/analyticsSections';
import { SETTINGS_CATEGORIES, SETTINGS_PAGES } from '@/config/settingsPages';

/** Something a page can do that a group is given on its own, apart from "modifica" on the page (Riallinea) */
export interface NavFunction {
    /** Its name under the page ("riallinea"): with the page's id, the key of the grant in a group's pages */
    name: string;
    /** The page's link + '#' + the name: the link of its access checks (authorize, useCanUse) */
    href: string;
    label: string;
    description?: string;
}

export interface NavItem {
    id: string;
    href: string;
    label: string;
    icon: LucideIcon;
    description?: string;
    /** The page changes data: a group can be given "modifica" on it, not only "vede" (src/lib/auth/permissions.ts) */
    editable?: boolean;
    /** Only the superadmin sees the page (users, groups, database): groups cannot be given it, nor see its entries in the Registro */
    superadminOnly?: boolean;
    /** Its functions given one by one in Gruppi (a named light each), each needing "modifica" on the page as well */
    functions?: NavFunction[];
}

/** The link of a page's function: the page's link, '#', its name */
export const functionHref = (pageHref: string, name: string) => `${pageHref}#${name}`;

/** A page's function for NAV_AREAS: its name, its link, its texts (it.ts → nav.functions) */
const pageFunction = (pageHref: string, name: string, texts: { label: string; description?: string }): NavFunction => ({
    name,
    href: functionHref(pageHref, name),
    ...texts,
});

/** The links of pages listed under a base path, by id: linksOf(ANALYTICS_SECTIONS, '/analytics')['client-summary'] */
function linksOf<T extends readonly { id: string }[]>(pages: T, basePath: string): { readonly [Id in T[number]['id']]: string } {
    return Object.fromEntries(pages.map((page) => [page.id, `${basePath}/${page.id}`])) as { [Id in T[number]['id']]: string };
}

/**
 * Every page link, by area and page — the one place a link is written. Access checks (authorize, canOpen, useCanUse),
 * pages and links use these, never a string: moving or renaming a page is then one change here, and a mistyped
 * page does not compile. npm run access:check refuses a literal link in an access check.
 */
export const LINKS = {
    quotes: '/quotes',
    workProgress: '/work-progress',
    cashflow: '/cashflow',
    analytics: linksOf(ANALYTICS_SECTIONS, '/analytics'),
    presence: {
        operators: '/presence/operators',
        dailyEvents: '/presence/daily-events',
        monthlySummary: '/presence/monthly-summary',
        myHours: '/presence/my-hours',
        officeHours: '/presence/office-hours',
    },
    tasks: {
        todo: '/tasks/todo',
        calendar: '/tasks/calendar',
        list: '/tasks/list',
        guides: '/tasks/guides',
        contacts: '/tasks/contacts',
        history: '/tasks/history',
    },
    settings: linksOf(SETTINGS_PAGES, '/settings'),
} as const;

export interface NavGroup {
    label?: string;
    items: NavItem[];
}

export type NavAreaId = 'quotes' | 'work-progress' | 'analytics' | 'presence' | 'cashflow' | 'tasks' | 'settings';

export interface NavArea extends NavItem {
    id: NavAreaId;
    /** Pages of the area: listed under it in the sidebar and as cards on its overview page (href) */
    groups?: NavGroup[];
    /** Placed at the bottom of the sidebar, apart from the work areas, and left off the home page */
    pinnedBottom?: boolean;
}

/** Pages drawn without the sidebar: a window of their own, the login */
export const FRAMELESS_ROUTES = ['/blueprint', '/login'];

/** Login page (src/app/login) */
export const LOGIN_PATH = '/login';
/** The home (nav cards): where a person goes after the login */
export const HOME_PATH = '/';
/** Shown instead of a page the logged-in user may not open */
export const NO_ACCESS_PATH = '/no-access';

interface CategorisedPage<C extends string> extends Omit<NavItem, 'href' | 'functions'> {
    category: C;
    /** The page's functions without their links: built here, from the page's own link */
    functions?: readonly Omit<NavFunction, 'href'>[];
}

/** One group per category (in the given order, empty ones left out), each page linked under basePath */
function groupByCategory<C extends string>(
    categories: readonly C[],
    labels: Record<C, string>,
    pages: readonly CategorisedPage<C>[],
    basePath: string,
): NavGroup[] {
    return categories
        .map((category) => ({
            label: labels[category],
            items: pages
                .filter((page) => page.category === category)
                .map(({ category: _category, functions, ...page }) => {
                    const href = `${basePath}/${page.id}`;
                    return { ...page, href, ...(functions ? { functions: functions.map((fn) => pageFunction(href, fn.name, fn)) } : {}) };
                }),
        }))
        .filter((group) => group.items.length > 0);
}

const areas = APP_COPY.nav.areas;
// it.ts keeps the presence page texts under analytics too
const analytics = APP_COPY.analytics;
const tasks = APP_COPY.tasks.pages;
const timesheet = APP_COPY.timesheet.pages;

/** Functions of Avanzamento Lavori; their links are also the access checks of their server actions */
export const WORK_PROGRESS_FUNCTIONS = {
    riallinea: functionHref(LINKS.workProgress, 'riallinea'),
} as const;

/** Functions of the presence pages given apart in Gruppi: creating and deleting operators in NetPro */
export const PRESENCE_FUNCTIONS = {
    manageOperators: functionHref(LINKS.presence.operators, 'anagrafica'),
} as const;

/**
 * Function of the Registro page: seeing the entries of every page a group can be given. Without it, who opens the
 * Registro sees the entries of the pages they can open (src/lib/log/areas.ts).
 */
export const LOG_FUNCTIONS = {
    all: functionHref(LINKS.settings.log, 'tutto'),
} as const;

/** A page's functions as Gruppi lists them, named lights on its row (most pages have none) */
export const pageFunctions = (page: NavItem): NavFunction[] => page.functions ?? [];

/** The app's areas, in sidebar order */
export const NAV_AREAS: NavArea[] = [
    { id: 'quotes', href: LINKS.quotes, ...areas.quotes, icon: FileText, editable: true },
    {
        id: 'work-progress',
        href: LINKS.workProgress,
        ...areas.workProgress,
        icon: Workflow,
        editable: true,
        functions: [pageFunction(LINKS.workProgress, 'riallinea', APP_COPY.nav.functions.riallinea)],
    },
    {
        id: 'analytics',
        href: '/analytics',
        ...areas.analytics,
        icon: BarChart3,
        groups: groupByCategory(ANALYTICS_CATEGORIES, analytics.categories, ANALYTICS_SECTIONS, '/analytics'),
    },
    {
        id: 'presence',
        href: '/presence',
        ...areas.presence,
        icon: Users,
        groups: [
            {
                items: [
                    {
                        id: 'operators',
                        href: LINKS.presence.operators,
                        label: analytics.operators.title,
                        description: analytics.operators.subtitle,
                        icon: Users,
                        editable: true,
                        functions: [pageFunction(LINKS.presence.operators, 'anagrafica', APP_COPY.nav.functions.manageOperators)],
                    },
                    { id: 'daily-events', href: LINKS.presence.dailyEvents, label: analytics.dailyEvents.title, description: analytics.dailyEvents.subtitle, icon: Calendar, editable: true },
                    { id: 'monthly-summary', href: LINKS.presence.monthlySummary, label: analytics.monthlySummary.title, description: analytics.monthlySummary.subtitle, icon: CalendarDays, editable: true },
                ],
            },
            {
                items: [
                    { id: 'my-hours', href: LINKS.presence.myHours, ...timesheet.myHours, icon: Clock, editable: true },
                    { id: 'office-hours', href: LINKS.presence.officeHours, ...timesheet.officeHours, icon: ClipboardList, editable: true },
                ],
            },
        ],
    },
    { id: 'cashflow', href: LINKS.cashflow, ...areas.cashflow, icon: Wallet },
    {
        id: 'tasks',
        href: '/tasks',
        ...areas.tasks,
        icon: CalendarCheck,
        groups: [
            {
                items: [
                    { id: 'todo', href: LINKS.tasks.todo, ...tasks.todo, icon: ListTodo, editable: true },
                    { id: 'calendar', href: LINKS.tasks.calendar, ...tasks.calendar, icon: CalendarRange, editable: true },
                    { id: 'list', href: LINKS.tasks.list, ...tasks.list, icon: ListChecks, editable: true },
                    { id: 'guides', href: LINKS.tasks.guides, ...tasks.guides, icon: BookOpen, editable: true },
                    { id: 'contacts', href: LINKS.tasks.contacts, ...tasks.contacts, icon: Contact, editable: true },
                    { id: 'history', href: LINKS.tasks.history, ...tasks.history, icon: History },
                ],
            },
        ],
    },
    {
        id: 'settings',
        href: '/settings',
        ...areas.settings,
        icon: Settings,
        groups: groupByCategory(SETTINGS_CATEGORIES, APP_COPY.admin.categories, SETTINGS_PAGES, '/settings'),
        pinnedBottom: true,
    },
];

export function getNavArea(id: NavAreaId): NavArea {
    const area = NAV_AREAS.find((candidate) => candidate.id === id);
    if (!area) throw new Error(`Unknown navigation area: ${id}`);
    return area;
}

/** The path is this link's page or one below it */
export function isWithin(pathname: string, href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
}

/** Area and page the path belongs to (both undefined on the home page) */
export function findNavLocation(pathname: string): { area?: NavArea; page?: NavItem } {
    const area = NAV_AREAS.find((candidate) => isWithin(pathname, candidate.href));
    const page = area?.groups?.flatMap((group) => group.items).find((item) => isWithin(pathname, item.href));
    return { area, page };
}
