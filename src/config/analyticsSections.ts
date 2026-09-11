/**
 * Analytics Sections Configuration
 * Single source of truth for all analytics report sections
 * 
 * To add a new report:
 * 1. Add entry to ANALYTICS_SECTIONS array
 * 2. Create report component in src/components/analytics/
 * 3. Import and add to REPORT_COMPONENTS map
 */

import { LucideIcon, Users, Package, Calendar, FileText, DollarSign, BarChart3, Clock, Truck, Table2, Archive, Briefcase, CalendarDays } from 'lucide-react';
import { APP_COPY } from '@/locales';
import { ProductionReport } from '@/components/analytics/ProductionReport';
import { OrderSummaryReport } from '@/components/analytics/OrderSummaryReport';
import { OrderAreaSummaryReport } from '@/components/analytics/OrderAreaSummaryReport';
import { ClientSummaryReport } from '@/components/analytics/ClientSummaryReport';
import { ClientDeliveriesReport } from '@/components/analytics/ClientDeliveriesReport';
import { OrderRevenueReport } from '@/components/analytics/OrderRevenueReport';
import { AreaSummaryReport } from '@/components/analytics/AreaSummaryReport';
import { AnnualPresenceReport } from '@/components/analytics/AnnualPresenceReport';
import { ExternalWorkReport } from '@/components/analytics/ExternalWorkReport';
import { RimanenzeReport } from '@/components/analytics/RimanenzeReport';
import { RimanenzeLaborReport } from '@/components/analytics/RimanenzeLaborReport';

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
        label: APP_COPY.analytics.reports.productionMetrics,
        icon: Package,
        category: 'production',
        description: 'Production by operator and machine'
    },
    {
        id: 'order-summary',
        label: APP_COPY.analytics.reports.orderSummary,
        icon: FileText,
        category: 'production',
        description: 'Production grouped by machine'
    },
    {
        id: 'order-area-summary',
        label: APP_COPY.analytics.reports.orderAreaSummary,
        icon: Table2,
        category: 'production',
        description: 'Production grouped by area'
    },
    {
        id: 'area-summary',
        label: APP_COPY.analytics.reports.areaSummary,
        icon: BarChart3,
        category: 'production',
        description: 'Work time summary by area'
    },
    {
        id: 'client-summary',
        label: APP_COPY.analytics.reports.clientSummary,
        icon: Users,
        category: 'clients',
        description: 'Client performance and history'
    },
    {
        id: 'client-deliveries',
        label: APP_COPY.analytics.reports.clientDeliveries,
        icon: Package,
        category: 'clients',
        description: 'Client deliveries by value'
    },
    {
        id: 'order-revenue',
        label: APP_COPY.analytics.reports.orderRevenue,
        icon: DollarSign,
        category: 'revenue',
        description: 'Revenue analysis by order'
    },
    {
        id: 'external-work',
        label: APP_COPY.analytics.reports.externalWork,
        icon: Truck,
        category: 'revenue',
        description: 'External work costs by order'
    },
    {
        id: 'annual-presence-report',
        label: APP_COPY.analytics.reports.annualPresenceReport,
        icon: CalendarDays,
        category: 'production',
        description: 'Full year presence hours by operator group'
    },
    {
        id: 'rimanenze',
        label: APP_COPY.analytics.reports.rimanenze,
        icon: Archive,
        category: 'other',
        description: 'Inventory material costs'
    },
    {
        id: 'rimanenze-labor',
        label: APP_COPY.analytics.reports.rimanenzeLabor,
        icon: Briefcase,
        category: 'other',
        description: 'Inventory labor costs'
    }
];

/**
 * Map section IDs to their report components
 * Components will be created as needed
 */
export const REPORT_COMPONENTS: Record<string, React.ComponentType> = {
    'production-metrics': ProductionReport,
    'order-summary': OrderSummaryReport,
    'order-area-summary': OrderAreaSummaryReport,
    'area-summary': AreaSummaryReport,
    'client-summary': ClientSummaryReport,
    'client-deliveries': ClientDeliveriesReport,
    'order-revenue': OrderRevenueReport,
    'external-work': ExternalWorkReport,
    'annual-presence-report': AnnualPresenceReport,
    'rimanenze': RimanenzeReport,
    'rimanenze-labor': RimanenzeLaborReport,
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
