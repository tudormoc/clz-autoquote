/**
 * Floor plan — the numbers of the drawing, all in millimetres of the sheet unless said otherwise. They shape how a
 * plan is laid out, never what it says. A caller changes any of them through `SceneSettings.options` (scene.ts).
 */

import type { FloorPlanSheet } from './types';

export interface TextOptions {
    /** Largest and smallest size of the lines, and the step between the sizes tried */
    maxSize: number;
    minSize: number;
    sizeStep: number;
    /** Height of a line, in sizes */
    lineHeight: number;
    /** Room kept between the text and the edges of its area */
    padding: number;
    /** The heading: its size as a share of the lines' size, kept between the two limits */
    labelRatio: number;
    labelMinSize: number;
    labelMaxSize: number;
    /** Room between the heading's letters, height of its rows and room under it — all in heading sizes */
    labelSpacing: number;
    labelLineHeight: number;
    labelGap: number;
    /** How finely a block is moved down its area to find where it fits */
    scanStep: number;
}

export interface GridOptions {
    /** Band around the grid for its letters and numbers, and the gap between band and grid */
    labelBand: number;
    labelGap: number;
    labelSize: number;
}

export interface BreakLineOptions {
    /** Height and length of one tooth of the zigzag */
    amplitude: number;
    period: number;
    /** How far the line runs past the walls it cuts */
    overhang: number;
}

export interface FloorPlanOptions {
    text: TextOptions;
    grid: GridOptions;
    breakLine: BreakLineOptions;
    /** Size of the text over the hatched part */
    excludedLabelSize: number;
    /** Straight pieces a curve of the outline is cut into, when areas are trimmed to it */
    curveSegments: number;
    /** Room past the edge of the shown part, so the strokes on that edge are not cut in half */
    clipBleed: number;
}

export const DEFAULT_OPTIONS: FloorPlanOptions = {
    text: {
        maxSize: 4,
        minSize: 1.3,
        sizeStep: 0.1,
        lineHeight: 1.45,
        padding: 2.6,
        labelRatio: 0.7,
        labelMinSize: 1.6,
        labelMaxSize: 2.6,
        labelSpacing: 0.2,
        labelLineHeight: 1.5,
        labelGap: 0.9,
        scanStep: 0.5,
    },
    grid: { labelBand: 6, labelGap: 3, labelSize: 3.2 },
    breakLine: { amplitude: 1.3, period: 5.3, overhang: 2.1 },
    excludedLabelSize: 2.9,
    curveSegments: 24,
    clipBleed: 1,
};

/** Any of the numbers, group by group */
export interface FloorPlanOptionsPatch {
    text?: Partial<TextOptions>;
    grid?: Partial<GridOptions>;
    breakLine?: Partial<BreakLineOptions>;
    excludedLabelSize?: number;
    curveSegments?: number;
    clipBleed?: number;
}

/** The defaults with a caller's changes on top */
export function resolveOptions(patch: FloorPlanOptionsPatch = {}): FloorPlanOptions {
    return {
        text: { ...DEFAULT_OPTIONS.text, ...patch.text },
        grid: { ...DEFAULT_OPTIONS.grid, ...patch.grid },
        breakLine: { ...DEFAULT_OPTIONS.breakLine, ...patch.breakLine },
        excludedLabelSize: patch.excludedLabelSize ?? DEFAULT_OPTIONS.excludedLabelSize,
        curveSegments: patch.curveSegments ?? DEFAULT_OPTIONS.curveSegments,
        clipBleed: patch.clipBleed ?? DEFAULT_OPTIONS.clipBleed,
    };
}

/** The two paper sizes the app prints (src/lib/pdf/renderPdf.ts), lying down */
export const SHEET_A3_LANDSCAPE: FloorPlanSheet = { width: 420, height: 297, margin: 8 };
export const SHEET_A4_LANDSCAPE: FloorPlanSheet = { width: 297, height: 210, margin: 8 };
