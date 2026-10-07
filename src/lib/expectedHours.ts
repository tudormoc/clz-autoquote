import { APP_CONFIG } from '@/config/constants';

const AREA_EXPECTED_VELOCITY = APP_CONFIG.ANALYTICS.AREA_EXPECTED_VELOCITY;

/** True when the area has an expected velocity (so expected hours can be computed) */
export function hasExpectedVelocity(areaName: string): boolean {
    return (AREA_EXPECTED_VELOCITY[areaName as keyof typeof AREA_EXPECTED_VELOCITY] ?? 0) > 0;
}

/**
 * Expected work hours for one commessa in one area, from AREA_EXPECTED_VELOCITY.
 * 'Piega' is measured in sheets (fogli), every other area in requested quantity.
 * null when the area has no velocity or the measure is missing.
 */
export function calcExpectedHours(areaName: string, qtyRequested: number | null, fogli: number | null = null): number | null {
    const velocity = AREA_EXPECTED_VELOCITY[areaName as keyof typeof AREA_EXPECTED_VELOCITY] ?? 0;
    if (!velocity) return null;

    if (areaName === 'Piega') {
        if (fogli == null) return null;
        return fogli / velocity;
    }

    if (qtyRequested == null) return null;
    return qtyRequested / velocity;
}
