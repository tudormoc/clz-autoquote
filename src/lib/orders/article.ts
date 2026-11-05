/** How the article data of an order (title, composition, measures) are compared and shown in the Articolo tab (rules for documentFacts.ts). */
import { EMPTY_VALUE, formatNumber } from '@/lib/format';
import { cutToPlace, type FactRules } from '@/lib/orders/documentFacts';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.analytics.orderOperations;

export const titleText = (value: string) => value || EMPTY_VALUE;

/** A measure (base, altezza, pages) as text, so every article fact is compared and shown the same way */
export const measureText = (value: unknown) => formatNumber(Number(value) || 0, 3);

/** A place matches when it holds the impegno's text cut to what the place keeps (Business compares text without case) */
export const ARTICLE_RULES: FactRules<string> = {
    equals: (value, reference, place) => String(value ?? '').trim().toLowerCase() === cutToPlace(String(reference ?? ''), place.maxLength).trim().toLowerCase(),
    texts: {
        noImpegno: copy.factNoImpegno,
        busMissing: copy.factBusMissing,
        netMissing: copy.factNetMissing,
        busDiffers: copy.articleBusDiffers,
        netDiffers: copy.articleNetDiffers,
    },
};
