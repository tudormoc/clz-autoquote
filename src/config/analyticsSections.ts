/**
 * Analytics Sections Configuration
 * Single source of truth for all analytics report sections
 * 
 * To add a new report:
 * 1. Add entry to ANALYTICS_SECTIONS array
 * 2. Create report component in src/components/analytics/
 * 3. Import and add to REPORT_COMPONENTS map
 */

import { LucideIcon, Users, TrendingUp, Package, Calendar, FileText, DollarSign, BarChart3 } from 'lucide-react';
import { ProductionReport } from '@/components/analytics/ProductionReport';
import { OrderSummaryReport } from '@/components/analytics/OrderSummaryReport';
import { ClientSummaryReport } from '@/components/analytics/ClientSummaryReport';
import { ClientDeliveriesReport } from '@/components/analytics/ClientDeliveriesReport';
import { OrderRevenueReport } from '@/components/analytics/OrderRevenueReport';
import { OrderOperationsReport } from '@/components/analytics/OrderOperationsReport';
import { AreaSummaryReport } from '@/components/analytics/AreaSummaryReport';

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
        id: 'order-operations',
        label: 'Order Operations',
        icon: Calendar,
        category: 'production',
        description: 'Track operations progress per order'
    },
    {
        id: 'area-summary',
        label: 'Area Summary',
        icon: BarChart3,
        category: 'production',
        description: 'Work time summary by area'
    },
    {
        id: 'client-summary',
        label: 'Client Summary',
        icon: Users,
        category: 'clients',
        description: 'Client performance and history'
    },
    {
        id: 'client-deliveries',
        label: 'Client Deliveries',
        icon: Package,
        category: 'clients',
        description: 'Client deliveries by value'
    },
    {
        id: 'order-revenue',
        label: 'Order Revenue',
        icon: DollarSign,
        category: 'revenue',
        description: 'Revenue analysis by order'
    }
];

/**
 * Map section IDs to their report components
 * Components will be created as needed
 */
export const REPORT_COMPONENTS: Record<string, React.ComponentType> = {
    'production-metrics': ProductionReport,
    'order-summary': OrderSummaryReport,
    'order-operations': OrderOperationsReport,
    'area-summary': AreaSummaryReport,
    'client-summary': ClientSummaryReport,
    'client-deliveries': ClientDeliveriesReport,
    'order-revenue': OrderRevenueReport,
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
