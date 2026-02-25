/**
 * Analytics Sections Configuration
 * Single source of truth for all analytics report sections
 * 
 * To add a new report:
 * 1. Add entry to ANALYTICS_SECTIONS array
 * 2. Create report component in src/components/analytics/
 * 3. Import and add to REPORT_COMPONENTS map
 */

import { LucideIcon, Users, TrendingUp, Package, Calendar, FileText } from 'lucide-react';
import { ProductionReport } from '@/components/analytics/ProductionReport';
import { OrderSummaryReport } from '@/components/analytics/OrderSummaryReport';

export interface AnalyticsSectionConfig {
    id: string;
    label: string;
    icon: LucideIcon;
    category: 'clients' | 'revenue' | 'production' | 'trends' | 'other';
    description?: string;
}

/**
 * All analytics sections configuration
 * Order determines sidebar display order
 */
export const ANALYTICS_SECTIONS: AnalyticsSectionConfig[] = [
    {
        id: 'client-summary',
        label: 'Client Summary',
        icon: Users,
        category: 'clients',
        description: 'Client performance and history'
    },
    {
        id: 'revenue-analysis',
        label: 'Revenue Analysis',
        icon: TrendingUp,
        category: 'revenue',
        description: 'Revenue trends and forecasts'
    },
    {
        id: 'production-metrics',
        label: 'Production Report',
        icon: Package,
        category: 'production',
        description: 'Production by operator and machine'
    },
    {
        id: 'order-summary',
        label: 'Order Summary',
        icon: FileText,
        category: 'production',
        description: 'Production grouped by machine'
    },
    {
        id: 'time-reports',
        label: 'Time Reports',
        icon: Calendar,
        category: 'trends',
        description: 'Historical trends and patterns'
    }
];

/**
 * Map section IDs to their report components
 * Components will be created as needed
 */
export const REPORT_COMPONENTS: Record<string, React.ComponentType> = {
    'production-metrics': ProductionReport,
    'order-summary': OrderSummaryReport,
};

/**
 * Get sections grouped by category
 */
export function getSectionsByCategory() {
    const grouped: Record<string, AnalyticsSectionConfig[]> = {};
    
    ANALYTICS_SECTIONS.forEach(section => {
        if (!grouped[section.category]) {
            grouped[section.category] = [];
        }
        grouped[section.category].push(section);
    });
    
    return grouped;
}
