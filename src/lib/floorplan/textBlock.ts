/**
 * Floor plan — the text of an area: its heading, then one line per row, all starting on the same x like a column.
 * The symbols of a line hang in front of it, so the lines stay aligned. A list too long for its room goes on two
 * or three columns, filled top to bottom. The block goes as high in the area as it fits whole, whatever the area's
 * shape (a wall may cut a corner off): every row is checked against the room it has at its own height.
 * How wide a text is comes from the caller (TextMeasure): this module knows no font.
 */

import { boundsOf, clamp, stripAt } from './geometry';
import type { TextOptions } from './options';
import type { FloorPlanLine, Polygon, SceneMark, SceneText, TextMeasure } from './types';

/** Where the baseline sits in a row: a heading's in heading sizes from the row's top, a line's as a share of its height */
const LABEL_BASELINE = 0.9;
const LINE_BASELINE = 0.75;

export interface BlockContent {
    label?: string;
    lines?: readonly FloorPlanLine[];
}

export const lineText = (line: FloorPlanLine) => (typeof line === 'string' ? line : line.text);
export const lineMarks = (line: FloorPlanLine): readonly string[] => (typeof line === 'string' ? [] : (line.marks ?? []));

export const hasText = (content: BlockContent) => Boolean(content.label?.trim()) || (content.lines?.length ?? 0) > 0;

/** The sizes tried for the lines, largest first */
export function sizesToTry({ maxSize, minSize, sizeStep }: TextOptions): number[] {
    const steps = Math.max(0, Math.round((maxSize - minSize) / sizeStep));
    return Array.from({ length: steps + 1 }, (_, i) => Math.round((maxSize - i * sizeStep) * 100) / 100);
}

/** Room the symbols of a line take in front of it, the gap before the text included */
export function symbolsWidth(count: number, size: number, options: TextOptions): number {
    return count > 0 ? (count * options.symbolSide + (count - 1) * options.symbolGap + options.symbolLead) * size : 0;
}

/** The symbols of a line whose text starts at x on baseline y: squares centred on the capitals, ending before the text */
function marksAt(ids: readonly string[], x: number, baseline: number, size: number, options: TextOptions): SceneMark[] {
    const side = options.symbolSide * size;
    const start = x - symbolsWidth(ids.length, size, options);
    const top = baseline - (options.capHeight / 2 + options.symbolSide / 2) * size;
    return ids.map((id, i) => ({ id, x: start + i * (options.symbolSide + options.symbolGap) * size, y: top, side }));
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

/** One line of the list, measured */
interface Cell {
    text: string;
    marks: readonly string[];
    width: number;
    /** Room its symbols need in front of it */
    lead: number;
    /** Where its text starts, counted from the block's x */
    dx: number;
}

/** A row of the block: how tall it is and how much room it needs left and right of the block's x */
type Row =
    | { kind: 'label'; text: string; size: number; spacing: number; rule: boolean; height: number; left: number; right: number }
    | { kind: 'lines'; cells: Cell[]; height: number; left: number; right: number };

/** The block with its lines on this many columns; null when it does not fit */
function layoutColumns(room: Polygon, content: BlockContent, size: number, columns: number, measure: TextMeasure, options: TextOptions): SceneText[] | null {
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
            rows.push({ kind: 'label', text, size: labelSize, spacing, rule: last, height: labelSize * (options.labelLineHeight + (last ? options.labelGap : 0)), left: 0, right: labelWidth(text) });
        });
    }

    const cells: Cell[] = (content.lines ?? []).map((line) => {
        const marks = lineMarks(line);
        return { text: lineText(line), marks, width: measure(lineText(line), size, 'line'), lead: symbolsWidth(marks.length, size, options), dx: 0 };
    });
    const perColumn = Math.ceil(cells.length / columns);
    const groups = Array.from({ length: columns }, (_, c) => cells.slice(c * perColumn, (c + 1) * perColumn)).filter((group) => group.length > 0);
    // Where each column's text starts: after the widest line before it, the gap, and room for its own symbols
    let dx = 0;
    groups.forEach((group, c) => {
        if (c > 0) dx += Math.max(...groups[c - 1].map((cell) => cell.width)) + options.columnGap * size + Math.max(...group.map((cell) => cell.lead));
        for (const cell of group) cell.dx = dx;
    });
    for (let r = 0; r < perColumn; r++) {
        const inRow = groups.map((group) => group[r]).filter((cell): cell is Cell => cell !== undefined);
        const end = inRow[inRow.length - 1];
        rows.push({ kind: 'lines', cells: inRow, height: size * options.lineHeight, left: inRow[0].lead, right: end.dx + end.width });
    }

    const height = rows.reduce((sum, row) => sum + row.height, 0);
    for (let blockTop = top; blockTop + height <= bottom; blockTop += options.scanStep) {
        // Every row must fit where it is: text `padding` away from the walls, a hanging symbol `symbolPadding` away
        let from = -Infinity;
        let to = Infinity;
        let y = blockTop;
        for (const row of rows) {
            const strip = stripAt(room, [y, y + row.height]);
            if (!strip) {
                from = Infinity;
                break;
            }
            from = Math.max(from, strip[0] + padding, strip[0] + options.symbolPadding + row.left);
            to = Math.min(to, strip[1] - padding - row.right);
            y += row.height;
        }
        if (from > to) continue;

        const texts: SceneText[] = [];
        y = blockTop;
        for (const row of rows) {
            if (row.kind === 'label') {
                texts.push({ role: 'label', text: row.text, x: from, y: y + row.size * LABEL_BASELINE, size: row.size, spacing: row.spacing, ...(row.rule ? { rule: true } : {}) });
            } else {
                const baseline = y + row.height * LINE_BASELINE;
                for (const cell of row.cells) {
                    const x = from + cell.dx;
                    texts.push({ role: 'line', text: cell.text, x, y: baseline, size, ...(cell.marks.length > 0 ? { marks: marksAt(cell.marks, x, baseline, size, options) } : {}) });
                }
            }
            y += row.height;
        }
        return texts;
    }
    return null;
}

/**
 * The rows of an area's text at this size of the lines, placed inside `room` (mm), on as few columns as it takes.
 * An empty list when there is nothing to write; null when the block does not fit at this size.
 */
export function layoutBlock(room: Polygon, content: BlockContent, size: number, measure: TextMeasure, options: TextOptions): SceneText[] | null {
    if (!hasText(content)) return [];
    const most = Math.max(1, Math.min(options.maxColumns, content.lines?.length ?? 0));
    for (let columns = 1; columns <= most; columns++) {
        const texts = layoutColumns(room, content, size, columns, measure, options);
        if (texts) return texts;
    }
    return null;
}

/** The largest size of the lines at which an area's whole block fits; null when it does not fit even at the smallest */
export function largestFit(room: Polygon, content: BlockContent, measure: TextMeasure, options: TextOptions): number | null {
    return sizesToTry(options).find((size) => layoutBlock(room, content, size, measure, options) !== null) ?? null;
}
