/**
 * Analytics Sections Configuration
 * Single source of truth for the list of analytics reports (sidebar + page titles).
 *
 * To add a new report:
 * 1. Add an entry to ANALYTICS_SECTIONS (label + description in src/locales/it.ts)
 * 2. Create the report component in src/components/analytics/
 * 3. Register it in REPORT_COMPONENTS (src/components/analytics/reportComponents.ts)
 */

import { LucideIcon, Users, Package, FileText, DollarSign, BarChart3, Truck, Table2, CalendarDays, Banknote } from 'lucide-react';
import { APP_COPY } from '@/locales';

/** Sidebar groups, in display order */
export const ANALYTICS_CATEGORIES = ['production', 'clients', 'revenue'] as const;
export type AnalyticsCategory = (typeof ANALYTICS_CATEGORIES)[number];

export interface AnalyticsSectionConfig {
    id: string;
    label: string;
    icon: LucideIcon;
    category: AnalyticsCategory;
    description?: string;
}

const reports = APP_COPY.analytics.reports;
const descriptions = APP_COPY.analytics.reportDescriptions;

/**
 * All analytics sections. Order determines display order within each sidebar group.
 */
export const ANALYTICS_SECTIONS = [
    { id: 'production-metrics', label: reports.productionMetrics, icon: Package, category: 'production', description: descriptions.productionMetrics },
    { id: 'order-summary', label: reports.orderSummary, icon: FileText, category: 'production', description: descriptions.orderSummary },
    { id: 'order-area-summary', label: reports.orderAreaSummary, icon: Table2, category: 'production', description: descriptions.orderAreaSummary },
    { id: 'area-summary', label: reports.areaSummary, icon: BarChart3, category: 'production', description: descriptions.areaSummary },
    { id: 'client-summary', label: reports.clientSummary, icon: Users, category: 'clients', description: descriptions.clientSummary },
    { id: 'client-deliveries', label: reports.clientDeliveries, icon: Package, category: 'clients', description: descriptions.clientDeliveries },
    { id: 'order-revenue', label: reports.orderRevenue, icon: DollarSign, category: 'revenue', description: descriptions.orderRevenue },
    { id: 'external-work', label: reports.externalWork, icon: Truck, category: 'revenue', description: descriptions.externalWork },
    { id: 'annual-presence-report', label: reports.annualPresenceReport, icon: CalendarDays, category: 'production', description: descriptions.annualPresenceReport },
    { id: 'payroll-hours', label: reports.payrollHours, icon: Banknote, category: 'production', description: descriptions.payrollHours },
] as const satisfies readonly AnalyticsSectionConfig[];

/** The id of a report: its folder under /analytics, the key of REPORT_COMPONENTS and of LINKS.analytics */
export type AnalyticsSectionId = (typeof ANALYTICS_SECTIONS)[number]['id'];

/** The report with this id (its id typed, so its component can be looked up) */
export function getAnalyticsSection(id: string): (typeof ANALYTICS_SECTIONS)[number] | undefined {
    return ANALYTICS_SECTIONS.find((section) => section.id === id);
}
