import { QuoteInput } from '../types';

/**
 * Automatically determines the cover production type based on book specifications.
 */
export function calculateCoverProductionType(input: QuoteInput): 'standard' | 'fast' | 'manual' {
    const { width, height } = input.format;
    const { headbands_enabled, spine_type } = input.cover_details;
    const { quantity } = input;

    // 1. Manual check (Overrides everything else)
    if (width > 305 || height > 380) {
        return 'manual';
    }

    // 2. Fast check
    const isFastWidth = width > 99 && width < 296;
    const isFastHeight = height > 119 && height < 381;
    const hasNoHeadbands = !headbands_enabled;
    const isBulkOrder = quantity >= 1000;
    const isSquareSpine = spine_type === 'square';

    if (isFastWidth && isFastHeight && hasNoHeadbands && isBulkOrder && isSquareSpine) {
        return 'fast';
    }

    // 3. Default to Standard
    return 'standard';
}
