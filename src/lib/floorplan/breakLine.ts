/**
 * Floor plan — the break line: the zigzag of a technical drawing where a building is cut and goes on. The same
 * zigzag is the lower edge of what stays visible and the line drawn over the walls it cuts, so the two always match.
 */

import type { BreakLineOptions } from './options';
import type { Point } from './types';

/**
 * The zigzag along height `y` from `from` to `to`: a corner at every half tooth, and the two ends wherever they
 * fall on it. `origin` is where the teeth are counted from, so pieces drawn apart line up.
 */
export function zigzag(from: number, to: number, y: number, origin: number, { amplitude, period }: BreakLineOptions): Point[] {
    const half = period / 2;
    const at = (x: number): Point => {
        const t = ((((x - origin) / period) % 1) + 1) % 1;
        return [x, y + amplitude * (t < 0.5 ? t * 4 - 1 : 3 - t * 4)];
    };
    const points = [at(from)];
    for (let x = (Math.floor((from - origin) / half) + 1) * half + origin; x < to; x += half) points.push(at(x));
    points.push(at(to));
    return points;
}
