/** Shapes of the order data shown on the work progress page (see src/app/analytics/queries/order-operations-queries.ts). */
import type { OrderDifference } from '@/lib/orders/differences';
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

/** Another production order of the same article (an article should have one: more usually means a duplicate) */
export interface OtherProductionOrder {
    /** Business production order ("2026/568"), when Business has it */
    business?: string;
    /** NetPro production order id, when known */
    netpro?: string;
    /** State of the NetPro order (EMI, EXE, COM …), when known */
    state?: string;
    /** It is on the same commessa (a double of the edition's own order: Riallinea then refuses the edition) */
    sameCommessa: boolean;
}

/** An open production order of the "Ordini da riallineare" list: one article of an impegno cliente */
export interface MisalignedOrder {
    /** The master order to open (first characters of the commessa) */
    rootCommessaKey: string;
    /** The edition's commessa (e.g. 260960410) */
    commessa: string;
    /** The article of the order (as Business names it, else as NetPro does) */
    article: string;
    /** The article NetPro has on the order, only when it is another than the Business one (to be fixed by hand) */
    netproArticle?: string;
    title: string;
    client: string;
    /** The impegno cliente of the article, year and number ("2026/9999"): what the list is sorted by */
    impegno?: string;
    /** Number of the Business production order */
    businessOrder?: number;
    netproOrder: string;
    netproState: string;
    /** The commessa holds production orders of several articles (editions) */
    multiEdition: boolean;
    /** The other production orders of the same article (the list shows the newest open one only) */
    otherOrders: OtherProductionOrder[];
    /** Riallinea takes the order: its article has no other production order on the commessa (the guard of findTarget in sync.ts) */
    canRealign: boolean;
    /** Why Riallinea would be refused for what it would remove (syncBlocks.ts), in words; none when it would not */
    syncBlocks: string[];
    /** What differs, by kind; none when the comparison failed */
    differences: OrderDifference[];
    /** Why the order could not be compared */
    error?: string;
}

export interface MisalignedOrders {
    /** Articles with a DiBa and an open production order, all compared (the newest open order of each) */
    checked: number;
    /** Those that differ, share their article with another order or could not be compared */
    orders: MisalignedOrder[];
}

/** Everything the page shows for one master order */
export interface OrderDetailsData {
    editions: OrderEdition[];
    operations: FlowOperation[];
    materials: Material[];
    management: OrderOperationsManagementData;
}
