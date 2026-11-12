/**
 * Worked examples of the floor plan: the geometry, where an area is, the headquarters' outline, the scene a spec
 * becomes and how text is fitted. Made-up areas and words only. They document the agreed behaviour and run as a
 * regression check:
 *
 *     npx tsx --tsconfig tsconfig.json scripts/floorplan-examples.ts
 *
 * When something changes, update the expected values here in the same commit.
 */

import { HQ_BUILDING } from './building';
import { duplicateLines } from './duplicates';
import { createFrame } from './frame';
import { areaOf, boundsOf, clipPolygon, flattenPath, spansAt, stripAt } from './geometry';
import { HQ_STATIC_SYMBOLS, hqStaticPlans } from './hqStatic';
import { DEFAULT_OPTIONS, SHEET_A3_LANDSCAPE } from './options';
import { columnName, parseCells, placementOf, rowName } from './placement';
import { buildScene, fitTextSize } from './scene';
import { largestFit, layoutBlock, lineMarks, lineText } from './textBlock';
import type { FloorPlanArea, FloorPlanSpec, Polygon, Span, TextMeasure } from './types';

export interface FloorPlanExample {
    note: string;
    actual: string;
    expect: string;
    pass: boolean;
}

const example = (note: string, actual: unknown, expect: unknown): FloorPlanExample => ({ note, actual: String(actual), expect: String(expect), pass: String(actual) === String(expect) });
const near = (value: number) => String(Math.round(value * 1000) / 1000);
const span = (value: Span | null | undefined) => (value ? `${near(value[0])}-${near(value[1])}` : 'none');
const list = (...values: unknown[]) => values.map(String).join(' | ');

/** Every letter as wide as 0.6 of its size: no font needed, and the sums can be done by hand */
const MEASURE: TextMeasure = (text, size) => text.length * size * 0.6;

const square = (x0: number, y0: number, x1: number, y1: number): Polygon => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
/** Two units wide below, one unit wide above */
const L_SHAPE: Polygon = [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [0, 2]];

export function runGeometryExamples(): FloorPlanExample[] {
    const curve = flattenPath([{ op: 'M', to: [0, 0] }, { op: 'Q', control: [1, 1], to: [2, 0] }], 4);
    return [
        example('a square trimmed to one that overlaps a quarter of it', near(areaOf(clipPolygon(square(0, 0, 2, 2), square(1, 1, 3, 3)))), 1),
        example('the same, the other shape given the other way round', near(areaOf(clipPolygon(square(0, 0, 2, 2), [...square(1, 1, 3, 3)].reverse()))), 1),
        example('two shapes apart: nothing is left', clipPolygon(square(0, 0, 1, 1), square(2, 2, 3, 3)).length, 0),
        example('a line across a square', span(spansAt(square(0, 0, 2, 2), 1)[0]), '0-2'),
        example('a line across the narrow part of an L', span(spansAt(L_SHAPE, 0.5)[0]), '0-1'),
        example('a line across its wide part', span(spansAt(L_SHAPE, 1.5)[0]), '0-2'),
        example('the stretch free at both heights is the narrow one', span(stripAt(L_SHAPE, [0.5, 1.5])), '0-1'),
        example('one height outside the shape: no stretch', span(stripAt(square(0, 0, 2, 2), [1, 5])), 'none'),
        example('a curve cut in four pieces: its start and four more points', curve.length, 5),
        example('the pieces end where the curve ends', curve[curve.length - 1].join(','), '2,0'),
    ];
}

export function runPlacementExamples(): FloorPlanExample[] {
    return [
        example('cells name a rectangle, corner to corner', parseCells('H3-I5'), '7,2,9,5'),
        example('spaces and small letters are fine', parseCells(' b2 - c4 '), '1,1,3,4'),
        example('one cell', parseCells('A1-A1'), '0,0,1,1'),
        example('a single cell name is not a pair', parseCells('H3'), null),
        example('the second cell before the first is refused', parseCells('I5-H3'), null),
        example('columns are lettered like a spreadsheet', list(columnName(0), columnName(9), columnName(25), columnName(26)), 'A | J | Z | AA'),
        example('rows are numbered from 1', rowName(0), 1),
        example('past Z the cells still read', parseCells('AA1-AB2'), '26,0,28,2'),
        example('an area with no position has no shape', placementOf({}), null),
        example('cells that do not read: no shape either', placementOf({ cells: 'nowhere' }), null),
        example('points win over a box', placementOf({ points: square(0, 0, 1, 1), box: [5, 5, 6, 6] })?.length, 4),
    ];
}

export function runBuildingExamples(): FloorPlanExample[] {
    const corners = flattenPath(HQ_BUILDING.outline, DEFAULT_OPTIONS.curveSegments);
    const { minX, maxX, minY, maxY } = boundsOf(corners);
    const mainBlockWall = 530 / 76;
    return [
        example('the grid over the headquarters', `${HQ_BUILDING.columns}x${HQ_BUILDING.rows}`, '10x11'),
        example('the outline starts with a move', HQ_BUILDING.outline[0].op, 'M'),
        example('it spans the ten columns exactly', `${near(minX)}..${near(maxX)}`, '0..10'),
        example('and sits inside the eleven rows', minY > 0 && maxY < HQ_BUILDING.rows, true),
        example('the main block has a vertical left wall: two corners on one column', corners.filter(([x]) => Math.abs(x - mainBlockWall) < 1e-9).length, 2),
    ];
}

const BARE: FloorPlanSpec = { building: HQ_BUILDING, sheet: SHEET_A3_LANDSCAPE };
const withAreas = (areas: FloorPlanArea[], rest: Partial<FloorPlanSpec> = {}): FloorPlanSpec => ({ ...BARE, ...rest, areas });

export function runSceneExamples(): FloorPlanExample[] {
    const bare = buildScene(BARE, MEASURE);
    const cut = buildScene({ ...BARE, crop: { rows: 5 } }, MEASURE);
    const sides = buildScene({ ...BARE, crop: { columns: [2, 10] } }, MEASURE);
    const grid = buildScene({ ...BARE, grid: true, crop: { columns: [2, 10], rows: 5 } }, MEASURE);

    const wholeFrame = createFrame(HQ_BUILDING, SHEET_A3_LANDSCAPE, undefined, 0);
    const pastTheWall = buildScene(withAreas([{ id: 'a', box: [9.12, 0, 10.5, 3.12] }]), MEASURE).areas[0];
    const outside: FloorPlanArea = { id: 'a', box: [0, 0, 1, 1] };

    const cutFrame = createFrame(HQ_BUILDING, SHEET_A3_LANDSCAPE, { rows: 5 }, 0);
    const pastTheCut = buildScene(withAreas([{ id: 'a', box: [6.9, 4.23, 10.5, 5.5], label: 'AREA', lines: ['First line', 'Second line'] }], { crop: { rows: 5 } }), MEASURE).areas[0];

    const extras = buildScene({ ...BARE, walls: [[[6.97, 0], [6.97, 4.25]]], excluded: { boxes: [[-1, 3.87, 3.88, 20], [-1, -1, 3.44, 3.87]], cuts: [[[3.88, 3.87], [3.88, 4.24]]] } }, MEASURE);

    return [
        example('only a building: the bare shape, nothing else', list(bare.areas.length, bare.grid, bare.clip, bare.excluded, bare.breakLines.length, bare.textSize, bare.notDrawn.length), list(0, null, null, null, 0, null, 0)),
        example('the outline is a closed path', bare.outline.startsWith('M') && bare.outline.endsWith('Z'), true),
        example('its curves stay curves', (bare.outline.match(/Q/g) ?? []).length, 2),
        example('the sheet is the spec\'s', `${bare.width}x${bare.height}`, '420x297'),
        example('cut after five rows: a break line on the arm and one on the main block', cut.breakLines.length, 2),
        example('and the rest is hidden', cut.clip !== null, true),
        example('columns left out: hidden, but nothing to break', list(sides.clip !== null, sides.breakLines.length), list(true, 0)),
        example('the grid of eight columns and five rows: its inner lines', grid.grid?.lines.length, 7 + 4),
        example('and a letter above and below each column, a number beside each row', grid.grid?.labels.length, 2 * 8 + 2 * 5),
        example('the first letter is the first column shown', grid.grid?.labels[0].text, 'C'),
        example('an area drawn past the outer wall stops at it', near(boundsOf(pastTheWall.polygon).maxX), near(wholeFrame.right)),
        example('and follows the curved wall above it: more than four corners', pastTheWall.polygon.length > 4, true),
        example('an area outside the building is not drawn, and says why', buildScene(withAreas([outside]), MEASURE).notDrawn.map((a) => `${a.id}:${a.why}`), 'a:outside'),
        example('unless it is an annex: drawn as given', buildScene(withAreas([{ ...outside, clip: false }]), MEASURE).areas[0]?.polygon.length, 4),
        example('an area without a position is kept out', buildScene(withAreas([{ id: 'a' }]), MEASURE).notDrawn.map((a) => `${a.id}:${a.why}`), 'a:unplaced'),
        example('an area that runs past the cut is drawn past it', boundsOf(pastTheCut.polygon).maxY > cutFrame.bottom, true),
        example('but its text stays above the cut', list(pastTheCut.texts.length, pastTheCut.texts.every((text) => text.y < cutFrame.bottom)), list(3, true)),
        example('without a way to measure there is no text', list(buildScene(withAreas([{ id: 'a', cells: 'H3-I4', label: 'AREA' }]), null).areas[0].texts.length, buildScene(withAreas([{ id: 'a', cells: 'H3-I4', label: 'AREA' }]), null).textSize), list(0, null)),
        example('walls and the part left out come through', list(extras.walls.length, extras.excluded?.polygons.length, extras.excluded?.cuts.length, extras.excluded?.label), list(1, 2, 1, null)),
    ];
}

export function runTextExamples(): FloorPlanExample[] {
    const text = DEFAULT_OPTIONS.text;
    const three = { label: 'AREA', lines: ['First line', 'Second line', 'Third line'] };
    /** A room whose top-left half is cut off by a slanted wall */
    const wedge: Polygon = [[0, 30], [30, 0], [30, 30]];
    const inWedge = layoutBlock(wedge, { label: 'X', lines: ['Aa', 'Bb', 'Cc'] }, 2, MEASURE, text) ?? [];
    const wrapped = layoutBlock(square(0, 0, 20, 40), { label: 'ALPHA BETA GAMMA' }, text.maxSize, MEASURE, text) ?? [];

    const roomy: FloorPlanArea = { id: 'roomy', cells: 'H2-I4', label: 'AREA', lines: ['First line'] };
    const tight: FloorPlanArea = { id: 'tight', box: [8, 1, 9, 1.6], label: 'AREA', lines: ['First line', 'Second line', 'Third line'] };
    const together = buildScene(withAreas([roomy, tight]), MEASURE);
    const tightAlone = fitTextSize(withAreas([tight]), MEASURE);
    const roomyAlone = fitTextSize(withAreas([roomy]), MEASURE);
    const crowded = buildScene(withAreas([{ id: 'a', box: [8, 1, 8.6, 1.5], label: 'A', lines: Array.from({ length: 12 }, () => 'Line') }]), MEASURE).areas[0];

    return [
        example('three lines in a big room: the largest size', largestFit(square(0, 0, 100, 60), three, MEASURE, text), text.maxSize),
        example('the same in a small room: as large as its height allows', largestFit(square(0, 0, 22, 16.5), three, MEASURE, text), 1.7),
        example('a room too low for them at any size', largestFit(square(0, 0, 22, 10), three, MEASURE, text), null),
        example('nothing to write: nothing placed, and that always fits', layoutBlock(square(0, 0, 1, 1), {}, text.maxSize, MEASURE, text)?.length, 0),
        example('under a slanted wall every row still starts on the same x', list(inWedge.length, new Set(inWedge.map((row) => row.x)).size), list(4, 1)),
        example('a heading too long for its room breaks between words, one rule under the last', list(wrapped.filter((row) => row.role === 'label').length, wrapped.filter((row) => row.rule).length), list(3, 1)),
        example('two areas on one plan share the size of the tighter one', list(together.textSize === tightAlone, (tightAlone ?? 0) < (roomyAlone ?? 0)), list(true, true)),
        example('a size given from outside wins', buildScene(withAreas([roomy, tight]), MEASURE, { textSize: 2 }).textSize, 2),
        example('lines that fit at no size are left out, the heading stays', list(crowded.overflow, crowded.texts.length, crowded.texts[0]?.role), list(true, 1, 'label')),
        example('a plan with no text has no text size', fitTextSize(withAreas([{ id: 'a', cells: 'H3-I4' }]), MEASURE), null),
    ];
}

export function runSymbolExamples(): FloorPlanExample[] {
    const text = DEFAULT_OPTIONS.text;
    const size = 2;
    const room = square(0, 0, 60, 30);
    const marked = layoutBlock(room, { lines: [{ text: 'Aa', marks: ['a', 'b'] }] }, size, MEASURE, text) ?? [];
    const [first, second] = marked[0]?.marks ?? [];
    const mixed = layoutBlock(room, { lines: ['Aa', { text: 'Bb', marks: ['a'] }, 'Cc'] }, size, MEASURE, text) ?? [];

    /** A room whose top-left half is cut off by a slanted wall: lower rows have free room on their left */
    const wedge: Polygon = [[0, 30], [30, 0], [30, 30]];
    const plain = layoutBlock(wedge, { lines: ['Aa', 'Bb', 'Cc'] }, size, MEASURE, text) ?? [];
    const hanging = layoutBlock(wedge, { lines: ['Aa', 'Bb', { text: 'Cc', marks: ['a'] }] }, size, MEASURE, text) ?? [];

    const line = { text: 'Aa', marks: ['a', 'ghost'] };
    const known = buildScene(withAreas([{ id: 'x', cells: 'H2-I4', lines: [line] }], { symbols: { a: { title: 'A' } } }), MEASURE);
    const none = buildScene(withAreas([{ id: 'x', cells: 'H2-I4', lines: [line] }]), MEASURE);

    return [
        example('two symbols on a line: two squares in front of the text, left to right', list(marked[0]?.marks?.length, first.x < second.x && second.x + second.side < marked[0].x), list(2, true)),
        example('a square is as tall as the options say, and centred on the capitals', list(near(first.side), near(first.y + first.side / 2)), list(near(text.symbolSide * size), near(marked[0].y - (text.capHeight / 2) * size))),
        example('the lines stay on one x, with or without symbols', list(mixed.length, new Set(mixed.map((row) => row.x)).size), list(3, 1)),
        example('against a straight wall the list moves right to make room: symbol padding + symbols', near(marked[0].x), near(text.symbolPadding + (2 * text.symbolSide + text.symbolGap + text.symbolLead) * size)),
        example('under a slanted wall a symbol hangs into the free corner: the list does not move', near(hanging[0].x), near(plain[0].x)),
        example('a mark naming a symbol of the spec is drawn, one naming none is left out and listed', list(known.areas[0].texts[0].marks?.map((mark) => mark.id), known.unknownMarks), list('a', 'ghost')),
        example('with no symbols in the spec no mark is drawn', list(none.areas[0].texts[0].marks, [...none.unknownMarks].sort()), list(undefined, 'a,ghost')),
    ];
}

export function runColumnExamples(): FloorPlanExample[] {
    const text = DEFAULT_OPTIONS.text;
    const six = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];
    const low = layoutBlock(square(0, 0, 80, 16), { lines: six }, 2, MEASURE, text) ?? [];
    const firstColumn = Math.min(...low.map((row) => row.x));
    const tall = layoutBlock(square(0, 0, 80, 40), { lines: six }, 2, MEASURE, text) ?? [];
    const nine = { label: 'AREA', lines: Array.from({ length: 9 }, (_, i) => `Person number ${i + 1}`) };
    const strip = square(0, 0, 150, 37);

    return [
        example('six lines in a low wide room: two columns', list(low.length, new Set(low.map((row) => row.x)).size), list(6, 2)),
        example('filled top to bottom: the first column holds the first three', low.filter((row) => row.x === firstColumn).map((row) => row.text), 'L1,L2,L3'),
        example('the rows of the two columns are level', new Set(low.map((row) => near(row.y))).size, 3),
        example('the same lines in a room tall enough stay on one column', new Set(tall.map((row) => row.x)).size, 1),
        example('never more columns than the options allow', layoutBlock(square(0, 0, 400, 10.5), { lines: Array.from({ length: 12 }, (_, i) => `L${i}`) }, 2, MEASURE, text), null),
        example('nine lines in a low strip: columns keep the text larger than one column could', (largestFit(strip, nine, MEASURE, text) ?? 0) > (largestFit(strip, nine, MEASURE, { ...text, maxColumns: 1 }) ?? 0), true),
    ];
}

export function runDuplicateExamples(): FloorPlanExample[] {
    const plan = (...areas: FloorPlanArea[]) => withAreas(areas);
    const where = (specs: FloorPlanSpec[]) => duplicateLines(specs).map((found) => `${found.text} @ ${found.where.map((place) => `${place.plan}/${place.areaId}`).join('+')}`);
    return [
        example('every line in one place: nothing found', where([plan({ id: 'a', lines: ['Mario Rossi'] }, { id: 'b', lines: ['Anna Bianchi'] })]).length, 0),
        example('the same line in two areas of a plan', where([plan({ id: 'a', lines: ['Mario Rossi'] }, { id: 'b', lines: ['Mario Rossi'] })]), 'Mario Rossi @ 0/a+0/b'),
        example('or on two plans, whatever the capitals and the spaces', where([plan({ id: 'a', lines: ['Mario Rossi'] }), plan({ id: 'b', lines: [' mario  ROSSI '] })]), 'Mario Rossi @ 0/a+1/b'),
        example('a line carrying symbols is still the same line', where([plan({ id: 'a', lines: [{ text: 'Mario Rossi', marks: ['x'] }] }, { id: 'b', lines: ['Mario Rossi'] })]).length, 1),
        example('areas without a position count too', where([plan({ id: 'a', cells: 'H3-I4', lines: ['Mario Rossi'] }, { id: 'later', lines: ['Mario Rossi'] })]).length, 1),
    ];
}

/** The static example of the headquarters (hqStatic.ts): that it is whole, and stays so when someone edits it */
export function runStaticExamples(): FloorPlanExample[] {
    const plans = hqStaticPlans();
    const specs = plans.map((plan) => plan.spec);
    const scenes = specs.map((spec) => buildScene(spec, MEASURE));
    const lines = specs.map((spec) => (spec.areas ?? []).flatMap((area) => area.lines ?? []));
    const everyone = new Set(lines.flat().map(lineText));
    const listed = Object.values(HQ_STATIC_SYMBOLS).flatMap((symbol) => symbol.people);

    return [
        example('two floors', plans.map((plan) => plan.title), 'Piano terra,Piano primo'),
        example('their areas', specs.map((spec) => spec.areas?.length), '10,8'),
        example('their people', lines.map((floor) => floor.length), '35,20'),
        example('each person is in one area only, on one floor', duplicateLines(specs).map((found) => found.text), ''),
        example('every area has a place inside the shown part of the building', scenes.flatMap((scene) => scene.notDrawn).length, 0),
        example('everybody fits: no list is cut', scenes.flatMap((scene) => scene.areas).filter((area) => area.overflow).length, 0),
        example('six people carry both symbols', lines.flat().filter((line) => lineMarks(line).length === 2).length, 6),
        example("everyone on a symbol's list is on a plan", listed.filter((name) => !everyone.has(name)), ''),
        example('no line carries a symbol the plans do not know', scenes.flatMap((scene) => scene.unknownMarks).length, 0),
        example('headings are in capitals, as on the printed sheets', specs[0].areas?.[0].label, 'UFFICIO'),
        example('each floor has a size for its text to share', specs.map((spec) => fitTextSize(spec, MEASURE) !== null), 'true,true'),
    ];
}
