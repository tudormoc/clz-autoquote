/**
 * Floor plan — the same line in two places. When the lines are people, each belongs to one area only, on one floor;
 * the module does not decide that, it only finds the repeats and leaves the answer to the caller.
 */

import { lineText } from './textBlock';
import type { FloorPlanSpec } from './types';

export interface DuplicateLine {
    /** The text, as first written */
    text: string;
    /** Every place it is in: which plan of the list given (0, 1 …) and which area */
    where: readonly { plan: number; areaId: string }[];
}

/** Capitals, spaces and accents do not make two lines different */
const sameAs = (text: string) => text.trim().replace(/\s+/g, ' ').toLocaleUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** The lines written more than once across these plans, in the order they first appear; empty when every line is in one place */
export function duplicateLines(specs: readonly FloorPlanSpec[]): DuplicateLine[] {
    const found = new Map<string, { text: string; where: { plan: number; areaId: string }[] }>();
    specs.forEach((spec, plan) => {
        for (const area of spec.areas ?? []) {
            for (const line of area.lines ?? []) {
                const text = lineText(line);
                const key = sameAs(text);
                if (!key) continue;
                const entry = found.get(key) ?? { text, where: [] };
                entry.where.push({ plan, areaId: area.id });
                found.set(key, entry);
            }
        }
    });
    return [...found.values()].filter((entry) => entry.where.length > 1);
}
