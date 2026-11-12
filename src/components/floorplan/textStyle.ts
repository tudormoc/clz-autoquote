import type { TextMeasure, TextRole } from '@/lib/floorplan';

/** Weight of each kind of text inside an area; the browser measures with the same ones it draws with */
export const TEXT_WEIGHT: Record<TextRole, number> = { label: 800, line: 400 };

/** Size the browser measures at, scaled down to the size asked: small sizes measure badly */
const MEASURE_PX = 100;

/** How wide a text is in this font, by the browser's own measure; null where there is no canvas */
export function browserMeasure(fontFamily: string): TextMeasure | null {
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return null;
    return (text, size, role) => {
        context.font = `${TEXT_WEIGHT[role]} ${MEASURE_PX}px ${fontFamily}`;
        return (context.measureText(text).width / MEASURE_PX) * size;
    };
}
