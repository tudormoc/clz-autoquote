/**
 * Component of each settings page id (see src/config/settingsPages.ts).
 * Kept apart from the page list so the sidebar does not bundle every settings screen.
 */
import { DiscountTiersEditor, FormatSurchargesEditor, PricingRulesEditor, SignatureTypesEditor } from '@/components/admin/recordTables';
import { LabourCostSettings } from '@/components/admin/LabourCostSettings';
import { DatabaseExplorer } from '@/components/database/DatabaseExplorer';
import { PresenceSettingsManager } from '@/components/presence/PresenceSettingsManager';

export const SETTINGS_COMPONENTS: Record<string, React.ComponentType> = {
    'pricing-configs': PricingRulesEditor,
    'discount-tiers': DiscountTiersEditor,
    'format-surcharges': FormatSurchargesEditor,
    'signature-types': SignatureTypesEditor,
    'labour-cost': LabourCostSettings,
    'presence': PresenceSettingsManager,
    'database': DatabaseExplorer,
};
