/**
 * Component of each settings page id (see src/config/settingsPages.ts).
 * Kept apart from the page list so the sidebar does not bundle every settings screen.
 */
import { GroupsManager } from '@/components/admin/access/GroupsManager';
import { UsersManager } from '@/components/admin/access/UsersManager';
import { ClosedDaysEditor, DiscountTiersEditor, FormatSurchargesEditor, PricingRulesEditor, SignatureTypesEditor, TaskAreasEditor } from '@/components/admin/recordTables';
import { LabourCostSettings } from '@/components/admin/LabourCostSettings';
import { DatabaseExplorer } from '@/components/database/DatabaseExplorer';
import { PresenceSettingsManager } from '@/components/presence/PresenceSettingsManager';
import type { SettingsPageId } from '@/config/settingsPages';

/** One component per settings page: a page without one does not compile */
export const SETTINGS_COMPONENTS: Record<SettingsPageId, React.ComponentType> = {
    'pricing-configs': PricingRulesEditor,
    'discount-tiers': DiscountTiersEditor,
    'format-surcharges': FormatSurchargesEditor,
    'signature-types': SignatureTypesEditor,
    'labour-cost': LabourCostSettings,
    'presence': PresenceSettingsManager,
    'task-areas': TaskAreasEditor,
    'closed-days': ClosedDaysEditor,
    'users': UsersManager,
    'groups': GroupsManager,
    'database': DatabaseExplorer,
};
