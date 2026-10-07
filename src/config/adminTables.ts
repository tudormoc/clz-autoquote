/**
 * Settings (admin) tables — metadata only: id, label, icon, sidebar group.
 * The sidebar (SECTION_NAVS.settings) and the /settings/[tableId] pages are built from this list.
 *
 * To add a table:
 * 1. Manager component in src/components/admin/
 * 2. One entry here (label and description in it.ts → admin.tables)
 * 3. One entry in MANAGER_COMPONENTS (src/components/admin/managerComponents.ts)
 */

import { Layers, Maximize2, Settings, Tags, Target, type LucideIcon } from 'lucide-react';
import { APP_COPY } from '@/locales';

export type AdminCategory = keyof typeof APP_COPY.admin.categories;

export interface AdminTableConfig {
    id: string;
    label: string;
    icon: LucideIcon;
    category: AdminCategory;
    description?: string;
}

const tables = APP_COPY.admin.tables;

/** Sidebar groups, in display order */
export const ADMIN_CATEGORIES: AdminCategory[] = ['settings', 'pricing', 'operations', 'clients', 'materials', 'other'];

/** All settings tables; the order is the sidebar order within each group */
export const ADMIN_TABLES: AdminTableConfig[] = [
    { id: 'general', ...tables.settings, icon: Settings, category: 'settings' },
    { id: 'pricing-configs', ...tables.pricingConfigs, icon: Target, category: 'pricing' },
    { id: 'discount-tiers', ...tables.discountTiers, icon: Tags, category: 'pricing' },
    { id: 'format-surcharges', ...tables.formatSurcharges, icon: Maximize2, category: 'pricing' },
    { id: 'signature-types', ...tables.signatureTypes, icon: Layers, category: 'operations' },
];

export function getAdminTable(id: string): AdminTableConfig | undefined {
    return ADMIN_TABLES.find((table) => table.id === id);
}
