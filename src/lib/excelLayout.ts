/**
 * The layout of an Excel sheet the app reads by position (the monthly production files of Presenze Annuali and Ore
 * Studio Paghe: column O is the operator's id, X the ordinary hours …). Pure. Someone adding or moving a column in
 * the file would otherwise make the app read other figures as hours without a word: the header row must show, at
 * every position read, the title the app expects there.
 */

/** The letter Excel shows over a 0-based column: 0 → "A", 14 → "O", 26 → "AA" */
export function columnLetter(index: number): string {
    let letter = '';
    for (let rest = index; rest >= 0; rest = Math.floor(rest / 26) - 1) letter = String.fromCharCode(65 + (rest % 26)) + letter;
    return letter;
}

export interface MisplacedColumn {
    /** The column's letter in Excel */
    column: string;
    /** The title the app reads that column for */
    expected: string;
    /** What the header row shows there; null for an empty cell */
    found: string | null;
}

/** A title as compared: capitals and spaces do not count ("Ore  ferie " is "Ore Ferie") */
const sameTitle = (a: string, b: string) => a.trim().replace(/\s+/g, ' ').toUpperCase() === b.trim().replace(/\s+/g, ' ').toUpperCase();

/**
 * The columns that are not where the app reads them: `positions` are the 0-based columns read, `titles` what the
 * header row must show at each (same keys). Empty = the sheet has the layout the app expects.
 */
export function misplacedColumns<K extends string>(header: readonly unknown[] | undefined, positions: Record<K, number>, titles: Record<K, string>): MisplacedColumn[] {
    const misplaced: MisplacedColumn[] = [];
    for (const key of Object.keys(positions) as K[]) {
        const found = String(header?.[positions[key]] ?? '').trim();
        if (!sameTitle(found, titles[key])) misplaced.push({ column: columnLetter(positions[key]), expected: titles[key], found: found || null });
    }
    return misplaced.sort((a, b) => a.column.length - b.column.length || a.column.localeCompare(b.column));
}
