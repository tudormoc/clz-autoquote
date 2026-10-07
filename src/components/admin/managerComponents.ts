/**
 * Manager component for each settings table id (see src/config/adminTables.ts).
 * Kept apart from the table list so the sidebar does not bundle every manager.
 */
import { DiscountTiersEditor, FormatSurchargesEditor, PricingRulesEditor, SignatureTypesEditor } from '@/components/admin/recordTables';
import { SettingsManager } from '@/components/admin/SettingsManager';

export const MANAGER_COMPONENTS: Record<string, React.ComponentType> = {
    'general': SettingsManager,
    'pricing-configs': PricingRulesEditor,
    'discount-tiers': DiscountTiersEditor,
    'format-surcharges': FormatSurchargesEditor,
    'signature-types': SignatureTypesEditor,
};
