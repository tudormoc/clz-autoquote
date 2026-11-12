/**
 * Floor plan — the words of the module.
 *
 * A plan is a building's outline plus what a caller puts on it: areas with the text inside them, walls, a part left
 * out. None of that is written in this module: it all arrives in a FloorPlanSpec, and a spec with only a building
 * draws the bare shape.
 *
 * Two units:
 *   - grid units, in a spec: [column, row] of the reference grid laid over the building, the corner of A1 = [0, 0],
 *     fractions allowed. They never move, whatever part of the building is shown.
 *   - millimetres of the sheet, in a scene: what the drawing is made of (frame.ts converts).
 *
 * See docs/FLOORPLAN.md.
 */

/** [x, y]: [column, row] in a spec, millimetres in a scene */
export type Point = readonly [number, number];
/** Corner points in order; a closed shape, or an open line where the name says so */
export type Polygon = readonly Point[];
/** [from, to] along one axis */
export type Span = readonly [number, number];
/** [column0, row0, column1, row1]: a rectangle in grid units */
export type GridBox = readonly [number, number, number, number];

/** One step of an outline, as in an SVG path */
export type PathStep =
    | { readonly op: 'M' | 'L'; readonly to: Point }
    | { readonly op: 'Q'; readonly control: Point; readonly to: Point };

/** A building seen from above */
export interface Building {
    /** Its closed outline, in grid units */
    readonly outline: readonly PathStep[];
    /** The reference grid that covers it */
    readonly columns: number;
    readonly rows: number;
}

/** Where an area is: one of the three. With none of them the area is kept out of the drawing (not placed yet). */
export interface AreaPlacement {
    /** 'H3-I5': the rectangle from the top-left cell to the bottom-right cell of the reference grid */
    cells?: string;
    /** A rectangle in grid units */
    box?: GridBox;
    /** Any convex shape, in grid units */
    points?: Polygon;
}

/** A row of text under an area's heading: the text alone, or with the ids of the symbols drawn in front of it */
export type FloorPlanLine = string | { readonly text: string; readonly marks?: readonly string[] };

/** A symbol a line can carry (a role, a qualification …). How it looks is the drawing's business, not the spec's. */
export interface FloorPlanSymbol {
    /** What it means, for a legend */
    title: string;
}

export interface FloorPlanArea extends AreaPlacement {
    /** Names the area in the scene (a React key, the list of areas not drawn) */
    id: string;
    /** false = drawn as given, even outside the outline (an upper-floor annex). Otherwise trimmed to the walls. */
    clip?: boolean;
    /** Heading of the area, written as given */
    label?: string;
    /** Lines under the heading, one per row, in this order; a list too long for its room goes on more columns */
    lines?: readonly FloorPlanLine[];
}

/** A part of the building the plan is not about: hatched */
export interface FloorPlanExcluded {
    /** What these rectangles cover of the building is hatched */
    boxes: readonly GridBox[];
    /** Open lines along the boundary that no area outline already draws (dashed) */
    cuts?: readonly Polygon[];
    /** Text over the hatch: where its middle is (grid units) and how it is turned (degrees, clockwise) */
    label?: { text: string; at: Point; angle: number };
}

/** The part of the building that is shown */
export interface FloorPlanCrop {
    /** First column shown and the one after the last, A = 0 */
    columns?: Span;
    /** Rows shown from the top; the building is cut below them with a break line */
    rows?: number;
}

/** The sheet the plan is drawn on, in millimetres */
export interface FloorPlanSheet {
    width: number;
    height: number;
    /** Room left free along the four edges */
    margin: number;
}

/** Everything one drawing shows */
export interface FloorPlanSpec {
    building: Building;
    sheet: FloorPlanSheet;
    crop?: FloorPlanCrop;
    /** Draw the reference grid with its letters and numbers */
    grid?: boolean;
    areas?: readonly FloorPlanArea[];
    /** Open lines inside the building that are not the edge of an area, in grid units; trimmed to the outline */
    walls?: readonly Polygon[];
    excluded?: FloorPlanExcluded;
    /** The symbols the lines may carry, by id, in the order of a legend. A mark naming none of them is left out. */
    symbols?: Readonly<Record<string, FloorPlanSymbol>>;
}

/** The two kinds of text inside an area */
export type TextRole = 'label' | 'line';
/** How wide a text is (mm) at a size (mm). The module never measures by itself: the caller knows the font. */
export type TextMeasure = (text: string, size: number, role: TextRole) => number;

// ─── The scene: what the drawing is made of, in millimetres of the sheet ─────────

/** A symbol in front of a line: a square, given by its top-left corner */
export interface SceneMark {
    id: string;
    x: number;
    y: number;
    side: number;
}

/** One row of text, left-aligned on its baseline */
export interface SceneText {
    role: TextRole;
    text: string;
    x: number;
    y: number;
    size: number;
    /** Room between the letters (mm); labels only */
    spacing?: number;
    /** The last row of a heading: a short rule goes under it */
    rule?: boolean;
    /** The symbols hanging in front of the text, left to right; lines only */
    marks?: readonly SceneMark[];
}

export interface SceneArea {
    id: string;
    /** Its outline, as drawn (it may run past a cut; the clip hides that part) */
    polygon: Polygon;
    texts: readonly SceneText[];
    /** The lines did not fit even at the smallest size and were left out; the heading stays when it fits */
    overflow: boolean;
}

/** A letter or number of the reference grid, centred on its point */
export interface SceneGridLabel {
    text: string;
    x: number;
    y: number;
    size: number;
}

export interface SceneGrid {
    /** The shown part of the grid */
    frame: { x: number; y: number; width: number; height: number };
    /** The lines between its cells */
    lines: readonly (readonly [Point, Point])[];
    labels: readonly SceneGridLabel[];
}

export interface SceneExcluded {
    polygons: readonly Polygon[];
    cuts: readonly Polygon[];
    /** Centred on its point, turned by `angle` degrees */
    label: { text: string; x: number; y: number; angle: number; size: number } | null;
}

/** Why an area of the spec is missing from the scene */
export interface AreaNotDrawn {
    id: string;
    /** 'unplaced' = no cells, box or points yet; 'outside' = nothing of it lies in the shown part of the building */
    why: 'unplaced' | 'outside';
}

export interface FloorPlanScene {
    /** The sheet */
    width: number;
    height: number;
    /** The building's outline: the `d` of an SVG path */
    outline: string;
    /** What stays visible of the building and everything on it when the plan is cropped; null = all of it */
    clip: Polygon | null;
    grid: SceneGrid | null;
    excluded: SceneExcluded | null;
    areas: readonly SceneArea[];
    /** Open lines, to be trimmed to the outline */
    walls: readonly Polygon[];
    /** Zigzag lines where the building is cut */
    breakLines: readonly Polygon[];
    /** Size of the lines in every area (mm); null when no area has text, or nothing could be measured */
    textSize: number | null;
    notDrawn: readonly AreaNotDrawn[];
    /** Ids that lines carry but `spec.symbols` does not hold: left out of the drawing */
    unknownMarks: readonly string[];
}
