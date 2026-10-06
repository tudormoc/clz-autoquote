/**
 * Navigation — single source of truth for the app's areas and section sidebars.
 *
 * Adding a page:
 *   - a new top-level area → add it to MAIN_NAV (header icon + home card)
 *   - a page inside a section → add it to that section in SECTION_NAVS (sidebar link)
 * Analytics reports are listed in src/config/analyticsSections.ts and appear here automatically.
 */
import {
    BarChart3,
    Calendar,
    CalendarDays,
    Database,
    FileText,
    Settings,
    Users,
    Wallet,
    Workflow,
    type LucideIcon,
} from 'lucide-react';
import { APP_COPY } from '@/locales';
import { ANALYTICS_CATEGORIES, ANALYTICS_SECTIONS } from '@/config/analyticsSections';

export interface NavItem {
    id: string;
    href: string;
    label: string;
    icon: LucideIcon;
    description?: string;
}

export interface NavGroup {
    label?: string;
    items: NavItem[];
}

export interface SectionNav {
    title: string;
    groups: NavGroup[];
    /** Links pinned to the bottom of the sidebar (e.g. section settings) */
    footer?: NavItem[];
}

const home = APP_COPY.home.cards;

/** Main areas, in display order: header icons and home page cards */
export const MAIN_NAV: (NavItem & { showOnHome: boolean })[] = [
    { id: 'quotes', href: '/quotes', label: home.quotes.title, description: home.quotes.description, icon: FileText, showOnHome: true },
    { id: 'work-progress', href: '/work-progress', label: home.workProgress.title, description: home.workProgress.description, icon: Workflow, showOnHome: true },
    { id: 'analytics', href: '/analytics', label: home.analytics.title, description: home.analytics.description, icon: BarChart3, showOnHome: true },
    { id: 'presence', href: '/presence', label: home.presence.title, description: home.presence.description, icon: Users, showOnHome: true },
    { id: 'cashflow', href: '/cashflow', label: home.cashflow.title, description: home.cashflow.description, icon: Wallet, showOnHome: true },
    { id: 'settings', href: '/settings', label: APP_COPY.admin.title, description: APP_COPY.admin.subtitle, icon: Settings, showOnHome: false },
    { id: 'database', href: '/db-test', label: home.database.title, description: home.database.description, icon: Database, showOnHome: true },
];

const presence = APP_COPY.analytics;

export type SectionNavId = 'analytics' | 'presence';

export const SECTION_NAVS: Record<SectionNavId, SectionNav> = {
    analytics: {
        title: APP_COPY.analytics.sidebar.title,
        groups: ANALYTICS_CATEGORIES
            .map((category) => ({
                label: APP_COPY.analytics.categories[category],
                items: ANALYTICS_SECTIONS
                    .filter((section) => section.category === category)
                    .map((section) => ({
                        id: section.id,
                        href: `/analytics/${section.id}`,
                        label: section.label,
                        icon: section.icon,
                        description: section.description,
                    })),
            }))
            .filter((group) => group.items.length > 0),
    },
    presence: {
        title: presence.presenceSidebar.heading,
        groups: [
            {
                items: [
                    { id: 'operators', href: '/presence/operators', label: presence.operators.title, icon: Users },
                    { id: 'daily-events', href: '/presence/daily-events', label: presence.dailyEvents.title, icon: Calendar },
                    { id: 'monthly-summary', href: '/presence/monthly-summary', label: presence.monthlySummary.title, icon: CalendarDays },
                ],
            },
        ],
        footer: [
            { id: 'settings', href: '/presence/settings', label: presence.presenceSidebar.settings, icon: Settings },
        ],
    },
};
