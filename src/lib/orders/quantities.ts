/** How the quantities of an order are compared and shown in the Quantità tab (rules for documentFacts.ts). */
import { formatNumber } from '@/lib/format';
import { QTY_EPS } from '@/lib/orders/compare';
import type { FactRules } from '@/lib/orders/documentFacts';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.analytics.orderOperations;

/** A quantity as shown in the tab (up to 3 decimals: NetPro per-piece quantities have them) */
export const quantityText = (value: number) => formatNumber(value, 3);

/** Quantities are compared to the thousandth, like the materials */
export const QUANTITY_RULES: FactRules<number> = {
    equals: (value, reference) => Math.abs(value - reference) <= QTY_EPS,
    texts: {
        noImpegno: copy.factNoImpegno,
        busMissing: copy.factBusMissing,
        netMissing: copy.factNetMissing,
        busDiffers: copy.quantityBusDiffers,
        netDiffers: copy.quantityNetDiffers,
    },
};
