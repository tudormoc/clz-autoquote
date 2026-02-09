/**
 * Admin Tables Configuration
 * Single source of truth for all admin table managers
 * 
 * To add a new table:
 * 1. Add entry to ADMIN_TABLES array
 * 2. Create manager component in src/components/admin/
 * 3. Import and add to MANAGER_COMPONENTS map
 */

import { LucideIcon, Target, Layers, Tags, Maximize2 } from 'lucide-react';
import { DiscountTiersManager } from '@/components/admin/DiscountTiersManager';
import { PricingConfigsManager } from '@/components/admin/PricingConfigsManager';
import { SignaturesManager } from '@/components/admin/SignaturesManager';
import { FormatSurchargesManager } from '@/components/admin/FormatSurchargesManager';

export interface AdminTableConfig {
    id: string;
    label: string;
    icon: LucideIcon;
    category: 'pricing' | 'operations' | 'clients' | 'materials' | 'other';
    description?: string;
}

/**
 * All admin tables configuration
 * Order determines sidebar display order
 */
export const ADMIN_TABLES: AdminTableConfig[] = [
    {
        id: 'pricing-configs',
        label: 'Pricing Rules',
        icon: Target,
        category: 'pricing',
        description: 'Base pricing configurations'
    },
    {
        id: 'signature-types',
        label: 'Signature Types',
        icon: Layers,
        category: 'operations',
        description: 'Signature definitions and pricing'
    },
    {
        id: 'discount-tiers',
        label: 'Discount Tiers',
        icon: Tags,
        category: 'pricing',
        description: 'Volume-based discount rules'
    },
    {
        id: 'format-surcharges',
        label: 'Format Surcharges',
        icon: Maximize2,
        category: 'pricing',
        description: 'Size-based surcharge rules'
    }
];

/**
 * Map table IDs to their manager components
 */
export const MANAGER_COMPONENTS: Record<string, React.ComponentType> = {
    'pricing-configs': PricingConfigsManager,
    'signature-types': SignaturesManager,
    'discount-tiers': DiscountTiersManager,
    'format-surcharges': FormatSurchargesManager
};

/**
 * Get tables grouped by category
 */
export function getTablesByCategory() {
    const grouped: Record<string, AdminTableConfig[]> = {};
    
    ADMIN_TABLES.forEach(table => {
        if (!grouped[table.category]) {
            grouped[table.category] = [];
        }
        grouped[table.category].push(table);
    });
    
    return grouped;
}
