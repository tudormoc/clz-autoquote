import { APP_CONFIG } from '@/config/constants';

const { AREA_EXPECTED_VELOCITY, FOLDING_AREA } = APP_CONFIG.ANALYTICS;

/**
 * Expected work hours for one commessa in one area, from AREA_EXPECTED_VELOCITY.
 * The folding area (FOLDING_AREA) is measured in sheets (fogli), every other area in requested quantity.
 * null when the area has no velocity or the measure is missing.
 */
export function calcExpectedHours(areaName: string, qtyRequested: number | null, fogli: number | null = null): number | null {
    const velocity = AREA_EXPECTED_VELOCITY[areaName as keyof typeof AREA_EXPECTED_VELOCITY] ?? 0;
    if (!velocity) return null;

    if (areaName === FOLDING_AREA) {
        if (fogli == null) return null;
        return fogli / velocity;
    }

    if (qtyRequested == null) return null;
    return qtyRequested / velocity;
}
