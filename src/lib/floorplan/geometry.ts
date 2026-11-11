/**
 * Floor plan — plane geometry: curves cut into straight pieces, a shape trimmed to another, and where a horizontal
 * line runs inside a shape. Pure functions on points; the unit is the caller's.
 */

import type { PathStep, Point, Polygon, Span } from './types';

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The corner points of an outline, every curve cut into `segments` straight pieces */
export function flattenPath(steps: readonly PathStep[], segments: number): Point[] {
    const points: Point[] = [];
    let from: Point | null = null;
    for (const step of steps) {
        if (step.op === 'Q' && from) {
            const [startX, startY] = from;
            const [controlX, controlY] = step.control;
            const [endX, endY] = step.to;
            for (let i = 1; i <= segments; i++) {
                const t = i / segments;
                const u = 1 - t;
                points.push([u * u * startX + 2 * u * t * controlX + t * t * endX, u * u * startY + 2 * u * t * controlY + t * t * endY]);
            }
        } else {
            points.push(step.to);
        }
        from = step.to;
    }
    return points;
}

export interface Bounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

/** The box around a shape */
export function boundsOf(polygon: Polygon): Bounds {
    const xs = polygon.map(([x]) => x);
    const ys = polygon.map(([, y]) => y);
    return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** Twice the area of a shape, with the sign of the direction its corners turn */
function signedDoubleArea(polygon: Polygon): number {
    return polygon.reduce((sum, [x, y], i) => {
        const [nextX, nextY] = polygon[(i + 1) % polygon.length];
        return sum + x * nextY - nextX * y;
    }, 0);
}

export const areaOf = (polygon: Polygon) => Math.abs(signedDoubleArea(polygon)) / 2;

/**
 * What of `subject` (any shape) lies inside `convex` (a convex shape) — Sutherland–Hodgman. An empty list when
 * nothing does. The building is the subject and an area the convex shape: areas are rectangles or convex by rule.
 */
export function clipPolygon(subject: Polygon, convex: Polygon): Point[] {
    const turn = Math.sign(signedDoubleArea(convex)) || 1;
    const inside = (p: Point, a: Point, b: Point) => turn * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= 0;
    const crossing = (p: Point, q: Point, a: Point, b: Point): Point => {
        const d = (p[0] - q[0]) * (a[1] - b[1]) - (p[1] - q[1]) * (a[0] - b[0]);
        const t = ((p[0] - a[0]) * (a[1] - b[1]) - (p[1] - a[1]) * (a[0] - b[0])) / d;
        return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
    };

    let kept: Point[] = [...subject];
    for (let i = 0; i < convex.length && kept.length > 0; i++) {
        const a = convex[i];
        const b = convex[(i + 1) % convex.length];
        const input = kept;
        kept = [];
        for (let j = 0; j < input.length; j++) {
            const current = input[j];
            const previous = input[(j + input.length - 1) % input.length];
            const currentIn = inside(current, a, b);
            const previousIn = inside(previous, a, b);
            if (currentIn) {
                if (!previousIn) kept.push(crossing(previous, current, a, b));
                kept.push(current);
            } else if (previousIn) {
                kept.push(crossing(previous, current, a, b));
            }
        }
    }
    return kept;
}

/** Where the horizontal line at height `y` runs inside a shape, left to right */
export function spansAt(polygon: Polygon, y: number): Span[] {
    const crossings: number[] = [];
    for (let i = 0; i < polygon.length; i++) {
        const [x0, y0] = polygon[i];
        const [x1, y1] = polygon[(i + 1) % polygon.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) crossings.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
    }
    crossings.sort((a, b) => a - b);
    const spans: Span[] = [];
    for (let i = 0; i + 1 < crossings.length; i += 2) spans.push([crossings[i], crossings[i + 1]]);
    return spans;
}

/** The widest stretch along x that lies inside a shape at every one of the given heights; null when there is none */
export function stripAt(polygon: Polygon, heights: readonly number[]): Span | null {
    if (heights.length === 0) return null;
    let best: Span | null = null;
    for (const first of spansAt(polygon, heights[0])) {
        let strip: Span | null = first;
        for (const y of heights.slice(1)) {
            let hit: Span | null = null;
            for (const span of spansAt(polygon, y)) {
                const from = Math.max(strip[0], span[0]);
                const to = Math.min(strip[1], span[1]);
                if (to > from && (!hit || to - from > hit[1] - hit[0])) hit = [from, to];
            }
            strip = hit;
            if (!strip) break;
        }
        if (strip && (!best || strip[1] - strip[0] > best[1] - best[0])) best = strip;
    }
    return best;
}
