/**
 * Floor plan — from a spec to a scene: everything the drawing is made of, in millimetres of the sheet, ready for
 * whatever draws it (src/components/floorplan/FloorPlan.tsx). Areas are trimmed to the walls, their text is placed
 * at one size shared by the whole plan, the part of the building not shown is cut off with a break line.
 */

import { zigzag } from './breakLine';
import { createFrame, type Frame } from './frame';
import { clipPolygon, flattenPath, spansAt } from './geometry';
import { resolveOptions, type FloorPlanOptions, type FloorPlanOptionsPatch, type TextOptions } from './options';
import { boxPolygon, columnName, placementOf, rowName } from './placement';
import { hasText, largestFit, layoutBlock, lineMarks, lineText, type BlockContent } from './textBlock';
import type {
    AreaNotDrawn, FloorPlanArea, FloorPlanExcluded, FloorPlanScene, FloorPlanSpec, PathStep, Point, Polygon, SceneArea,
    SceneExcluded, SceneGrid, SceneGridLabel, SceneText, TextMeasure,
} from './types';

export interface SceneSettings {
    /** One size for the lines instead of the largest that fits this plan: several plans shown together share the
     *  smallest of their `fitTextSize` */
    textSize?: number;
    /** Any of the drawing's numbers (options.ts) */
    options?: FloorPlanOptionsPatch;
}

/** Where a grid label's baseline sits under its middle, in sizes: capitals and digits look centred on their point */
const GRID_LABEL_DROP = 0.36;

interface PlacedArea {
    area: FloorPlanArea;
    /** Its outline as drawn */
    shape: Polygon;
    /** The part of it its text may use: the shape, less what the cut hides */
    room: Polygon;
    /** Its heading and lines, the lines carrying only the symbols the spec holds */
    content: BlockContent;
}

interface Layout {
    frame: Frame;
    /** The building's outline as corner points on the sheet */
    walls: Polygon;
    /** The shown part of the sheet, when the plan is cropped */
    shown: Polygon | null;
    areas: PlacedArea[];
    notDrawn: AreaNotDrawn[];
    unknownMarks: string[];
}

const round = (value: number) => Math.round(value * 100) / 100;

/** The outline as the `d` of an SVG path, curves kept as curves */
function outlinePath(steps: readonly PathStep[], frame: Frame): string {
    const at = (point: Point) => frame.point(point).map(round).join(',');
    return `${steps.map((step) => (step.op === 'Q' ? `Q${at(step.control)} ${at(step.to)}` : `${step.op}${at(step.to)}`)).join(' ')} Z`;
}

/** Frame, walls and the areas that can be drawn — what both the scene and the text size are worked out from */
function layoutOf(spec: FloorPlanSpec, options: FloorPlanOptions): Layout {
    const around = spec.grid ? options.grid.labelBand + options.grid.labelGap : 0;
    const frame = createFrame(spec.building, spec.sheet, spec.crop, around);
    const walls = flattenPath(spec.building.outline, options.curveSegments).map(frame.point);

    const bleed = options.clipBleed;
    const shown: Polygon | null =
        frame.cutBelow || frame.cutSides
            ? [[frame.left - bleed, frame.top - bleed], [frame.right + bleed, frame.top - bleed], [frame.right + bleed, frame.cutBelow ? frame.bottom : frame.bottom + bleed], [frame.left - bleed, frame.cutBelow ? frame.bottom : frame.bottom + bleed]]
            : null;

    // A line keeps the marks that name a symbol of the spec; the others are left out and named in the scene
    const known = new Set(Object.keys(spec.symbols ?? {}));
    const unknownMarks = new Set<string>();
    const contentOf = (area: FloorPlanArea): BlockContent => ({
        label: area.label,
        lines: (area.lines ?? []).map((line) => {
            const marks: string[] = [];
            for (const id of lineMarks(line)) {
                if (known.has(id)) marks.push(id);
                else unknownMarks.add(id);
            }
            return marks.length > 0 ? { text: lineText(line), marks } : lineText(line);
        }),
    });

    const areas: PlacedArea[] = [];
    const notDrawn: AreaNotDrawn[] = [];
    for (const area of spec.areas ?? []) {
        const placed = placementOf(area);
        if (!placed) {
            notDrawn.push({ id: area.id, why: 'unplaced' });
            continue;
        }
        const given = placed.map(frame.point);
        const shape = area.clip === false ? given : clipPolygon(walls, given);
        const room = shown ? clipPolygon(shape, shown) : shape;
        if (shape.length < 3 || room.length < 3) notDrawn.push({ id: area.id, why: 'outside' });
        else areas.push({ area, shape, room, content: contentOf(area) });
    }
    return { frame, walls, shown, areas, notDrawn, unknownMarks: [...unknownMarks] };
}

/** The largest size at which the text of every area fits, never below the smallest size; null when no area has text */
function sharedTextSize(areas: readonly PlacedArea[], measure: TextMeasure, text: TextOptions): number | null {
    const written = areas.filter(({ content }) => hasText(content));
    if (written.length === 0) return null;
    return Math.min(...written.map(({ content, room }) => largestFit(room, content, measure, text) ?? text.minSize));
}

/**
 * The size of the lines a plan would take by itself (mm); null when it has no text. For several plans shown together
 * (the floors of one building): take the smallest and pass it to each as `SceneSettings.textSize`.
 */
export function fitTextSize(spec: FloorPlanSpec, measure: TextMeasure, optionsPatch?: FloorPlanOptionsPatch): number | null {
    const options = resolveOptions(optionsPatch);
    return sharedTextSize(layoutOf(spec, options).areas, measure, options.text);
}

function gridOf(frame: Frame, { labelBand, labelGap, labelSize }: FloorPlanOptions['grid']): SceneGrid {
    const lines: (readonly [Point, Point])[] = [];
    for (let column = Math.floor(frame.columns[0]) + 1; column < frame.columns[1]; column++) lines.push([[frame.x(column), frame.top], [frame.x(column), frame.bottom]]);
    for (let row = 1; row < frame.rows; row++) lines.push([[frame.left, frame.y(row)], [frame.right, frame.y(row)]]);

    // Letters above and below, numbers left and right, each in the middle of its cell and of its band
    const away = labelGap + labelBand / 2;
    const drop = labelSize * GRID_LABEL_DROP;
    const labels: SceneGridLabel[] = [];
    for (let column = Math.ceil(frame.columns[0]); column + 1 <= frame.columns[1]; column++) {
        const x = frame.x(column + 0.5);
        labels.push({ text: columnName(column), x, y: frame.top - away + drop, size: labelSize });
        labels.push({ text: columnName(column), x, y: frame.bottom + away + drop, size: labelSize });
    }
    for (let row = 0; row + 1 <= frame.rows; row++) {
        const y = frame.y(row + 0.5) + drop;
        labels.push({ text: rowName(row), x: frame.left - away, y, size: labelSize });
        labels.push({ text: rowName(row), x: frame.right + away, y, size: labelSize });
    }
    return { frame: { x: frame.left, y: frame.top, width: frame.right - frame.left, height: frame.bottom - frame.top }, lines, labels };
}

function excludedOf(excluded: FloorPlanExcluded, frame: Frame, walls: Polygon, labelSize: number): SceneExcluded {
    const [labelX, labelY] = excluded.label ? frame.point(excluded.label.at) : [0, 0];
    return {
        polygons: excluded.boxes.map((box) => clipPolygon(walls, boxPolygon(box).map(frame.point))).filter((polygon) => polygon.length >= 3),
        cuts: (excluded.cuts ?? []).map((line) => line.map(frame.point)),
        label: excluded.label ? { text: excluded.label.text, x: labelX, y: labelY, angle: excluded.label.angle, size: labelSize } : null,
    };
}

/** The text of one area at the plan's size; when its lines do not fit, the heading alone */
function sceneAreaOf({ area, shape, room, content }: PlacedArea, size: number | null, measure: TextMeasure | null, text: TextOptions): SceneArea {
    let texts: SceneText[] = [];
    let overflow = false;
    if (size !== null && measure) {
        const block = layoutBlock(room, content, size, measure, text);
        overflow = block === null;
        texts = block ?? layoutBlock(room, { label: content.label }, size, measure, text) ?? [];
    }
    return { id: area.id, polygon: shape, texts, overflow };
}

/**
 * Everything a plan's drawing is made of.
 * @param measure how wide a text is; null draws the plan without any text (nothing can be placed without it)
 */
export function buildScene(spec: FloorPlanSpec, measure: TextMeasure | null, settings: SceneSettings = {}): FloorPlanScene {
    const options = resolveOptions(settings.options);
    const { frame, walls, shown, areas, notDrawn, unknownMarks } = layoutOf(spec, options);

    const fitted = measure ? sharedTextSize(areas, measure, options.text) : null;
    const textSize = fitted === null ? null : (settings.textSize ?? fitted);

    // Where the building is cut below, the lower edge of what stays visible is the zigzag itself
    const teethFrom = frame.x(0);
    const clip: Polygon | null = !shown
        ? null
        : frame.cutBelow
          ? [shown[0], shown[1], ...zigzag(shown[0][0], shown[1][0], frame.bottom, teethFrom, options.breakLine).reverse()]
          : shown;
    const breakLines = frame.cutBelow
        ? spansAt(walls, frame.bottom).map(([from, to]) => zigzag(from - options.breakLine.overhang, to + options.breakLine.overhang, frame.bottom, teethFrom, options.breakLine))
        : [];

    return {
        width: spec.sheet.width,
        height: spec.sheet.height,
        outline: outlinePath(spec.building.outline, frame),
        clip,
        grid: spec.grid ? gridOf(frame, options.grid) : null,
        excluded: spec.excluded ? excludedOf(spec.excluded, frame, walls, options.excludedLabelSize) : null,
        areas: areas.map((placed) => sceneAreaOf(placed, textSize, measure, options.text)),
        walls: (spec.walls ?? []).map((line) => line.map(frame.point)),
        breakLines,
        textSize,
        notDrawn,
        unknownMarks,
    };
}
