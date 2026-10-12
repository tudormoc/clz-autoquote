/**
 * Settings pages — metadata only: id, label, icon, group.
 * The Settings area in the sidebar, its overview page and the /settings/[pageId] pages are built from this list.
 *
 * To add a page:
 * 1. Its component: a table editor config in src/components/admin/recordTables.tsx (columns, how values are typed
 *    and shown), or a component of its own for a page that is not a plain table
 * 2. One entry in SETTINGS_COMPONENTS (src/components/admin/settingsComponents.ts)
 * 3. One entry here (label and description in it.ts → admin.pages)
 */

import { CalendarOff, Clock, Database, Euro, FolderTree, KeyRound, Layers, Maximize2, Tags, Target, UsersRound, type LucideIcon } from 'lucide-react';
import { APP_COPY } from '@/locales';

/** Groups of the Settings area, in display order: the area each setting belongs to */
export const SETTINGS_CATEGORIES = ['quotes', 'analytics', 'presence', 'tasks', 'access', 'tools'] as const;
export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number];

export interface SettingsPageConfig {
    id: string;
    label: string;
    icon: LucideIcon;
    category: SettingsCategory;
    description?: string;
    /** Changes data: a group can be given "modifica" on it */
    editable?: boolean;
    /** Only the superadmin sees it */
    superadminOnly?: boolean;
}

const pages = APP_COPY.admin.pages;

/** All settings pages; the order is the display order within each group */
export const SETTINGS_PAGES: SettingsPageConfig[] = [
    { id: 'pricing-configs', ...pages.pricingConfigs, icon: Target, category: 'quotes', editable: true },
    { id: 'discount-tiers', ...pages.discountTiers, icon: Tags, category: 'quotes', editable: true },
    { id: 'format-surcharges', ...pages.formatSurcharges, icon: Maximize2, category: 'quotes', editable: true },
    { id: 'signature-types', ...pages.signatureTypes, icon: Layers, category: 'quotes', editable: true },
    { id: 'labour-cost', ...pages.labourCost, icon: Euro, category: 'analytics', editable: true },
    { id: 'presence', ...pages.presence, icon: Clock, category: 'presence', editable: true },
    { id: 'task-areas', ...pages.taskAreas, icon: FolderTree, category: 'tasks', editable: true },
    { id: 'closed-days', ...pages.closedDays, icon: CalendarOff, category: 'tasks', editable: true },
    { id: 'users', ...pages.users, icon: KeyRound, category: 'access', superadminOnly: true },
    { id: 'groups', ...pages.groups, icon: UsersRound, category: 'access', superadminOnly: true },
    { id: 'database', ...pages.database, icon: Database, category: 'tools', superadminOnly: true },
];

export function getSettingsPage(id: string): SettingsPageConfig | undefined {
    return SETTINGS_PAGES.find((page) => page.id === id);
}
