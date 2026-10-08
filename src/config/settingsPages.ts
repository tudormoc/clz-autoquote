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

import { Clock, Database, Euro, Layers, Maximize2, Tags, Target, type LucideIcon } from 'lucide-react';
import { APP_COPY } from '@/locales';

/** Groups of the Settings area, in display order: the area each setting belongs to */
export const SETTINGS_CATEGORIES = ['quotes', 'analytics', 'presence', 'tools'] as const;
export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number];

export interface SettingsPageConfig {
    id: string;
    label: string;
    icon: LucideIcon;
    category: SettingsCategory;
    description?: string;
}

const pages = APP_COPY.admin.pages;

/** All settings pages; the order is the display order within each group */
export const SETTINGS_PAGES: SettingsPageConfig[] = [
    { id: 'pricing-configs', ...pages.pricingConfigs, icon: Target, category: 'quotes' },
    { id: 'discount-tiers', ...pages.discountTiers, icon: Tags, category: 'quotes' },
    { id: 'format-surcharges', ...pages.formatSurcharges, icon: Maximize2, category: 'quotes' },
    { id: 'signature-types', ...pages.signatureTypes, icon: Layers, category: 'quotes' },
    { id: 'labour-cost', ...pages.labourCost, icon: Euro, category: 'analytics' },
    { id: 'presence', ...pages.presence, icon: Clock, category: 'presence' },
    { id: 'database', ...pages.database, icon: Database, category: 'tools' },
];

export function getSettingsPage(id: string): SettingsPageConfig | undefined {
    return SETTINGS_PAGES.find((page) => page.id === id);
}
