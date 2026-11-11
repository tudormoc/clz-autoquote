/**
 * Floor plan — the frame: how the shown part of a building's grid sits on the sheet. It turns grid units into
 * millimetres, as large as the sheet allows and centred. Column A stays where the grid says even when the first
 * columns are not shown, so a position in a spec means the same whatever the crop.
 */

import { clamp } from './geometry';
import type { Building, FloorPlanCrop, FloorPlanSheet, Point, Span } from './types';

export interface Frame {
    /** Millimetres in one cell of the grid */
    scale: number;
    /** Where a column, a row or a grid point is on the sheet */
    x: (column: number) => number;
    y: (row: number) => number;
    point: (gridPoint: Point) => Point;
    /** The shown part of the grid: its columns, how many rows, and its edges on the sheet */
    columns: Span;
    rows: number;
    left: number;
    top: number;
    right: number;
    bottom: number;
    /** The building goes on below the shown rows / beside the shown columns */
    cutBelow: boolean;
    cutSides: boolean;
}

/**
 * @param around room kept free between the sheet's margin and the grid on every side (the band of the grid's
 *               letters and numbers, when they are drawn)
 */
export function createFrame(building: Building, sheet: FloorPlanSheet, crop: FloorPlanCrop | undefined, around: number): Frame {
    // A crop that names nothing sensible shows everything
    const first = crop?.columns ? clamp(crop.columns[0], 0, building.columns) : 0;
    const last = crop?.columns ? clamp(crop.columns[1], 0, building.columns) : building.columns;
    const columns: Span = last > first ? [first, last] : [0, building.columns];
    const rows = crop?.rows && crop.rows > 0 ? Math.min(crop.rows, building.rows) : building.rows;

    const inset = sheet.margin + around;
    const roomWidth = Math.max(0, sheet.width - 2 * inset);
    const roomHeight = Math.max(0, sheet.height - 2 * inset);
    const shownColumns = columns[1] - columns[0];
    const scale = Math.min(roomWidth / shownColumns, roomHeight / rows);

    const left = inset + (roomWidth - shownColumns * scale) / 2;
    const top = inset + (roomHeight - rows * scale) / 2;
    const originX = left - columns[0] * scale;
    const x = (column: number) => originX + column * scale;
    const y = (row: number) => top + row * scale;

    return {
        scale,
        x,
        y,
        point: ([column, row]) => [x(column), y(row)],
        columns,
        rows,
        left,
        top,
        right: x(columns[1]),
        bottom: y(rows),
        cutBelow: rows < building.rows,
        cutSides: columns[0] > 0 || columns[1] < building.columns,
    };
}
