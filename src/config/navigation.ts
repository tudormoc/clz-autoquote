/**
 * Navigation — single source of truth for the app's areas and their pages.
 * The sidebar, the phone menu, the home page cards and each area's overview page are built from NAV_AREAS.
 *
 * Adding a page:
 *   - a new area → add it to NAV_AREAS (label and description in it.ts → nav.areas)
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
} from 'lucide-react';
import { APP_COPY } from '@/locales';
import { ANALYTICS_CATEGORIES, ANALYTICS_SECTIONS } from '@/config/analyticsSections';
import { SETTINGS_CATEGORIES, SETTINGS_PAGES } from '@/config/settingsPages';

export interface NavItem {
    id: string;
    href: string;
    label: string;
    icon: LucideIcon;
    description?: string;
    /** The page changes data: a group can be given "modifica" on it, not only "vede" (src/lib/auth/permissions.ts) */
    editable?: boolean;
    /** Only the superadmin sees the page (users, groups, database); groups cannot be given it */
    superadminOnly?: boolean;
}

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
/** Shown instead of a page the logged-in user may not open */
export const NO_ACCESS_PATH = '/no-access';

interface CategorisedPage<C extends string> extends Omit<NavItem, 'href'> {
    category: C;
}

/** One group per category (in the given order, empty ones left out), each page linked under basePath */
function groupByCategory<C extends string>(
    categories: readonly C[],
    labels: Record<C, string>,
    pages: CategorisedPage<C>[],
    basePath: string,
): NavGroup[] {
    return categories
        .map((category) => ({
            label: labels[category],
            items: pages
                .filter((page) => page.category === category)
                .map(({ category: _category, ...page }) => ({ ...page, href: `${basePath}/${page.id}` })),
        }))
        .filter((group) => group.items.length > 0);
}

const areas = APP_COPY.nav.areas;
// it.ts keeps the presence page texts under analytics too
const analytics = APP_COPY.analytics;
const tasks = APP_COPY.tasks.pages;

/** The Agenda's pages (src/app/tasks); their links are also the access checks of its server actions */
export const TASK_PAGES = {
    todo: '/tasks/todo',
    calendar: '/tasks/calendar',
    list: '/tasks/list',
    guides: '/tasks/guides',
    contacts: '/tasks/contacts',
    history: '/tasks/history',
} as const;

/** The app's areas, in sidebar order */
export const NAV_AREAS: NavArea[] = [
    { id: 'quotes', href: '/quotes', ...areas.quotes, icon: FileText, editable: true },
    { id: 'work-progress', href: '/work-progress', ...areas.workProgress, icon: Workflow, editable: true },
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
                    { id: 'operators', href: '/presence/operators', label: analytics.operators.title, description: analytics.operators.subtitle, icon: Users, editable: true },
                    { id: 'daily-events', href: '/presence/daily-events', label: analytics.dailyEvents.title, description: analytics.dailyEvents.subtitle, icon: Calendar, editable: true },
                    { id: 'monthly-summary', href: '/presence/monthly-summary', label: analytics.monthlySummary.title, description: analytics.monthlySummary.subtitle, icon: CalendarDays, editable: true },
                ],
            },
        ],
    },
    { id: 'cashflow', href: '/cashflow', ...areas.cashflow, icon: Wallet },
    {
        id: 'tasks',
        href: '/tasks',
        ...areas.tasks,
        icon: CalendarCheck,
        groups: [
            {
                items: [
                    { id: 'todo', href: TASK_PAGES.todo, ...tasks.todo, icon: ListTodo, editable: true },
                    { id: 'calendar', href: TASK_PAGES.calendar, ...tasks.calendar, icon: CalendarRange, editable: true },
                    { id: 'list', href: TASK_PAGES.list, ...tasks.list, icon: ListChecks, editable: true },
                    { id: 'guides', href: TASK_PAGES.guides, ...tasks.guides, icon: BookOpen, editable: true },
                    { id: 'contacts', href: TASK_PAGES.contacts, ...tasks.contacts, icon: Contact, editable: true },
                    { id: 'history', href: TASK_PAGES.history, ...tasks.history, icon: History },
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
