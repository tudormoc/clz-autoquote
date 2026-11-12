/** Side of the square a symbol is drawn on, and how round its corners are */
export const SYMBOL_GRID = 24;
const CORNER = 4;

/** How a symbol looks: a filled square with a glyph on it */
export interface SymbolArt {
    /** Tailwind fill class of the square: a theme token (fill-success-600 …), written out so Tailwind finds it */
    className: string;
    /** The glyph on the 24-unit square: the `d` of an SVG path, painted white in both looks */
    glyph: string;
    /** Enlarges the glyph around the middle of the square, for one that reads too thin when small */
    grow?: number;
}

/** The look of each symbol of a plan, by the symbol's id */
export type FloorPlanSymbolArt = Readonly<Record<string, SymbolArt>>;

/**
 * A symbol on its 24-unit square, to be put in place by an `<svg viewBox>` (a legend) or a `<g transform>` (a plan).
 * A symbol without art is a plain grey square: the room it takes stays, and the missing drawing is seen.
 */
export function SymbolShape({ art }: { art: SymbolArt | undefined }) {
    const middle = SYMBOL_GRID / 2;
    return (
        <>
            <rect width={SYMBOL_GRID} height={SYMBOL_GRID} rx={CORNER} className={art?.className ?? 'fill-fg-faint'} />
            {art && <path d={art.glyph} className="fill-bright" transform={art.grow ? `translate(${middle} ${middle}) scale(${art.grow}) translate(${-middle} ${-middle})` : undefined} />}
        </>
    );
}
