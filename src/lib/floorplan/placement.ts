/**
 * Floor plan — where an area is. The reference grid names its columns with letters and its rows with numbers, like a
 * spreadsheet; an area is given by cells ('H3-I5'), by a rectangle in grid units, or by its corner points.
 */

import type { AreaPlacement, GridBox, Polygon } from './types';

const LETTERS = 26;
const CODE_A = 65;

/** A, B … Z, AA, AB … for column 0, 1 … */
export function columnName(index: number): string {
    let name = '';
    for (let n = index; n >= 0; n = Math.floor(n / LETTERS) - 1) name = String.fromCharCode(CODE_A + (n % LETTERS)) + name;
    return name;
}

/** 1, 2 … for row 0, 1 … */
export const rowName = (index: number) => String(index + 1);

const columnIndex = (name: string) => [...name.toUpperCase()].reduce((index, letter) => index * LETTERS + letter.charCodeAt(0) - CODE_A + 1, 0) - 1;

/** 'H3-I5' → [7, 2, 9, 5]: from the top-left corner of the first cell to the bottom-right corner of the second. null when the text is not two cells in that order. */
export function parseCells(cells: string): GridBox | null {
    const match = /^([A-Z]+)(\d+)-([A-Z]+)(\d+)$/i.exec(cells.replace(/\s/g, ''));
    if (!match) return null;
    const box: GridBox = [columnIndex(match[1]), Number(match[2]) - 1, columnIndex(match[3]) + 1, Number(match[4])];
    return box[1] >= 0 && box[2] > box[0] && box[3] > box[1] ? box : null;
}

export const boxPolygon = ([column0, row0, column1, row1]: GridBox): Polygon => [[column0, row0], [column1, row0], [column1, row1], [column0, row1]];

/** The shape of an area in grid units, as given (not trimmed to anything); null when it has no usable position */
export function placementOf(area: AreaPlacement): Polygon | null {
    if (area.points && area.points.length >= 3) return area.points;
    if (area.box) return boxPolygon(area.box);
    const box = area.cells ? parseCells(area.cells) : null;
    return box ? boxPolygon(box) : null;
}
