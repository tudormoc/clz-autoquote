/**
 * Floor plan — the text of an area: its heading, then one line per row, all starting on the same x like a column.
 * The block goes as high in the area as it fits whole, whatever the area's shape (a wall may cut a corner off).
 * How wide a text is comes from the caller (TextMeasure): this module knows no font.
 */

import { boundsOf, clamp, stripAt } from './geometry';
import type { TextOptions } from './options';
import type { Polygon, SceneText, TextMeasure, TextRole } from './types';

/** Where the baseline sits in a row: a heading's in heading sizes from the row's top, a line's as a share of its height */
const LABEL_BASELINE = 0.9;
const LINE_BASELINE = 0.75;

export interface BlockContent {
    label?: string;
    lines?: readonly string[];
}

interface Row {
    role: TextRole;
    text: string;
    size: number;
    width: number;
    height: number;
    spacing?: number;
    rule?: boolean;
}

export const hasText = (content: BlockContent) => Boolean(content.label?.trim()) || (content.lines?.length ?? 0) > 0;

/** The sizes tried for the lines, largest first */
export function sizesToTry({ maxSize, minSize, sizeStep }: TextOptions): number[] {
    const steps = Math.max(0, Math.round((maxSize - minSize) / sizeStep));
    return Array.from({ length: steps + 1 }, (_, i) => Math.round((maxSize - i * sizeStep) * 100) / 100);
}

/** A heading broken between its words so that every row fits `width`; a single word is never broken */
function wrapWords(text: string, width: number, widthOf: (text: string) => number): string[] {
    const rows: string[] = [];
    let row = '';
    for (const word of text.split(/\s+/).filter(Boolean)) {
        const longer = row ? `${row} ${word}` : word;
        if (row && widthOf(longer) > width) {
            rows.push(row);
            row = word;
        } else {
            row = longer;
        }
    }
    if (row) rows.push(row);
    return rows;
}

/**
 * The rows of an area's text at this size of the lines, placed inside `room` (mm). An empty list when there is
 * nothing to write; null when the block does not fit at this size.
 */
export function layoutBlock(room: Polygon, content: BlockContent, size: number, measure: TextMeasure, options: TextOptions): SceneText[] | null {
    if (!hasText(content)) return [];
    const { minX, minY, maxX, maxY } = boundsOf(room);
    const padding = options.padding;
    const top = minY + padding;
    const bottom = maxY - padding;

    const labelSize = clamp(size * options.labelRatio, options.labelMinSize, options.labelMaxSize);
    const spacing = labelSize * options.labelSpacing;
    const labelWidth = (text: string) => measure(text, labelSize, 'label') + spacing * Math.max(0, [...text].length - 1);

    const rows: Row[] = [];
    const label = content.label?.trim();
    if (label) {
        const wrapped = wrapWords(label, maxX - minX - 2 * padding, labelWidth);
        wrapped.forEach((text, i) => {
            const last = i === wrapped.length - 1;
            const height = labelSize * (options.labelLineHeight + (last ? options.labelGap : 0));
            rows.push({ role: 'label', text, size: labelSize, width: labelWidth(text), height, spacing, ...(last ? { rule: true } : {}) });
        });
    }
    for (const text of content.lines ?? []) rows.push({ role: 'line', text, size, width: measure(text, size, 'line'), height: size * options.lineHeight });

    const height = rows.reduce((sum, row) => sum + row.height, 0);
    const width = Math.max(...rows.map((row) => row.width));

    for (let blockTop = top; blockTop + height <= bottom; blockTop += options.scanStep) {
        // The block needs one stretch of the area that is free at the top and the bottom of every row
        const edges = [blockTop];
        let y = blockTop;
        for (const row of rows) edges.push((y += row.height));
        const strip = stripAt(room, edges);
        if (!strip || strip[1] - strip[0] - 2 * padding < width) continue;

        const x = strip[0] + padding;
        y = blockTop;
        return rows.map((row) => {
            const baseline = y + (row.role === 'label' ? row.size * LABEL_BASELINE : row.height * LINE_BASELINE);
            y += row.height;
            return {
                role: row.role,
                text: row.text,
                x,
                y: baseline,
                size: row.size,
                ...(row.spacing !== undefined ? { spacing: row.spacing } : {}),
                ...(row.rule ? { rule: true } : {}),
            };
        });
    }
    return null;
}

/** The largest size of the lines at which an area's whole block fits; null when it does not fit even at the smallest */
export function largestFit(room: Polygon, content: BlockContent, measure: TextMeasure, options: TextOptions): number | null {
    return sizesToTry(options).find((size) => layoutBlock(room, content, size, measure, options) !== null) ?? null;
}
