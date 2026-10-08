/** Shapes of the order data shown on the work progress page (see src/app/analytics/queries/order-operations-queries.ts). */
import type { FlowOperation } from '@/lib/orders/flow';
import type { OrderEdition, OrderOperationsManagementData } from '@/types';

/** A master order found by the search (all editions of one commessa root) */
export interface MasterOrderMatch {
    root_commessa_key: string;
    commessa_display: string;
    year_code: string;
    master_order_title: string;
    client_name: string;
    edition_count: number;
}

/** A material of the order (NetPro MATERIALI_ORDINI over all editions) with the stock */
export interface Material {
    part_number: string;
    description: string;
    unit_of_measure: string;
    material_class: string;
    total_quantity: number;
    picked_quantity: number;
    used_quantity: number;
    stock_quantity: number;
    order_count: number;
}

/** Everything the page shows for one master order */
export interface OrderDetailsData {
    editions: OrderEdition[];
    operations: FlowOperation[];
    materials: Material[];
    management: OrderOperationsManagementData;
}
