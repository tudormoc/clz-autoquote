/**
 * Floor plan — the headquarters seen from above. Geometry only: no areas, no names.
 *
 * The outline is the one the website draws on its Contact page (hqShape in clz-websiteai3d,
 * src/components/QuantumScene.tsx), kept here in the site's own units and turned the way it shows there: the site
 * mirrors x and lays y away from the viewer, so both are flipped. A reference grid of ten square columns covers it;
 * the outline sits centred in the eleven rows that takes.
 *
 * One change from the site: the main block's left wall (x = 230, between y = 375 and y = 507) is vertical here, so
 * the edges of the areas above it continue it in one straight line.
 */

import type { Building, PathStep, Point } from './types';

const SITE = { width: 760, height: 818 };
const COLUMNS = 10;
/** Site units in one cell of the grid */
const CELL = SITE.width / COLUMNS;
const ROWS = Math.ceil(SITE.height / CELL);
const ROW_OFFSET = (ROWS * CELL - SITE.height) / 2;

const toGrid = (x: number, y: number): Point => [(SITE.width - x) / CELL, (ROW_OFFSET + SITE.height - y) / CELL];

/** Site units, in the site's order: [x, y] a corner, [controlX, controlY, x, y] a curve to a corner */
const SITE_OUTLINE: readonly (readonly number[])[] = [
    [0, 0], [51, 0], [51, 146], [119, 147], [117, 223], [157, 227], [160, 230],
    [167, 375], [230, 375], [230, 507], [297, 506], [465, 505], [516, 458],
    [554, 450], [621, 376], [693, 244], [737, 145], [760, 152], [736, 257],
    [650, 400, 455, 600], [226, 818, 0, 818],
];

const OUTLINE: readonly PathStep[] = SITE_OUTLINE.map((numbers, index): PathStep => {
    if (numbers.length === 4) return { op: 'Q', control: toGrid(numbers[0], numbers[1]), to: toGrid(numbers[2], numbers[3]) };
    return { op: index === 0 ? 'M' : 'L', to: toGrid(numbers[0], numbers[1]) };
});

export const HQ_BUILDING: Building = { outline: OUTLINE, columns: COLUMNS, rows: ROWS };
