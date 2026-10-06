/**
 * Report component for each analytics section id (see src/config/analyticsSections.ts).
 * Kept apart from the section list so the sidebar does not bundle every report.
 */
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
