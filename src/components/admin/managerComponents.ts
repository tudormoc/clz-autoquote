/**
 * Manager component for each settings table id (see src/config/adminTables.ts).
 * Kept apart from the table list so the sidebar does not bundle every manager.
 */
import { DiscountTiersManager } from '@/components/admin/DiscountTiersManager';
import { FormatSurchargesManager } from '@/components/admin/FormatSurchargesManager';
import { PricingConfigsManager } from '@/components/admin/PricingConfigsManager';
import { SettingsManager } from '@/components/admin/SettingsManager';
import { SignaturesManager } from '@/components/admin/SignaturesManager';

export const MANAGER_COMPONENTS: Record<string, React.ComponentType> = {
    'general': SettingsManager,
    'pricing-configs': PricingConfigsManager,
    'signature-types': SignaturesManager,
    'discount-tiers': DiscountTiersManager,
    'format-surcharges': FormatSurchargesManager,
};
