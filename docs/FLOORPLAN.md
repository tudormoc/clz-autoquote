# Floor plan — the building, and whatever is put on it

A drawing of the headquarters seen from above, in two parts:

- **An engine** that knows the building's outline and how to lay things out on it, and nothing else. Areas, their
  headings, the names inside them, the symbols some names carry, walls, the part that is not ours — all of it
  arrives as data from whoever calls it. With no data it draws the bare shape.
- **A static example**: the two floors of the headquarters with every area, person and symbol, kept by hand in one
  file. It is the complete thing to start from before the plan is fed by the app's own data
  ([The static example](#the-static-example)).

Brought over 2026-11-11 from the website project (`clz-websiteai3d`, `extras/print/build-pianta.mjs`), where it
prints the sheets "Piano terra" and "Piano primo"; symbols, columns, the duplicate check and the static example
followed on 2026-11-12. Here it is **not connected to anything yet**: no page, no menu link, no database, no PDF.
In the code the module is `floorplan`.

## Words

| Word | In the code | What it is |
|---|---|---|
| Building | `Building`, `HQ_BUILDING` | The outline seen from above, and the size of the grid over it. The only thing the engine holds by itself. |
| Grid | `columnName`, `rowName`, `parseCells` | Ten columns (A–J) by eleven rows (1–11) of square cells laid over the building, like a spreadsheet. Positions are given on it: `[column, row]`, the corner of A1 = `[0, 0]`, fractions allowed. |
| Spec | `FloorPlanSpec` | Everything one drawing shows: building, sheet, crop, grid on/off, areas, walls, excluded part, symbols. |
| Area | `FloorPlanArea` | A room or department: where it is (`cells`, `box` or `points`), a heading (`label`) and rows of text (`lines`). |
| Line | `FloorPlanLine` | A row of text in an area: a text, or `{ text, marks }` when symbols go in front of it. |
| Symbol | `FloorPlanSymbol`, `spec.symbols` | A sign a line can carry (first aid, fire fighting …): an id and a title. A line names its symbols by id (`marks`). |
| Symbol art | `SymbolArt`, `FloorPlanSymbolArt` | How a symbol looks: the colour of its square and the glyph on it. It belongs to the components, not to the spec. |
| Legend | `FloorPlanLegend` | The symbols with their titles, beside a plan. |
| Wall | `spec.walls` | A line inside the building that is not the edge of an area. |
| Excluded | `FloorPlanExcluded` | A part of the building the plan is not about: hatched, with an optional text over it. |
| Crop | `FloorPlanCrop` | The columns and rows shown. Below the last row the building is cut with a zigzag **break line**. |
| Sheet | `FloorPlanSheet` | The paper, in millimetres (`SHEET_A3_LANDSCAPE`, `SHEET_A4_LANDSCAPE`). |
| Scene | `FloorPlanScene`, `buildScene` | The drawing itself: every shape, every row of text and every symbol, in millimetres of the sheet. |
| Measure | `TextMeasure` | A function that says how wide a text is. The engine has no font: the caller measures. |

## Where things are

```
src/lib/floorplan/                          the engine: pure functions, no DB, no React, no text of its own
    types.ts        the words above
    options.ts      every number of the drawing (sizes, paddings, symbols, columns, the zigzag) and the paper sizes
    building.ts     the outline of the headquarters
    geometry.ts     trimming one shape to another, lines across a shape, curves into straight pieces
    placement.ts    'H3-I5' → a rectangle; an area's shape as given
    frame.ts        grid units → millimetres of the sheet
    textBlock.ts    heading + lines inside an area: one size, symbols in front, columns when the list is long
    breakLine.ts    the zigzag
    scene.ts        buildScene (spec → scene), fitTextSize
    duplicates.ts   the same line in two places
    examples.ts     worked examples (made-up data, and a check of the static example)
    index.ts        everything above, for `import … from '@/lib/floorplan'`
    hqStatic.ts     THE STATIC EXAMPLE: floors, areas, people, symbols. Content — not in index.ts.

src/components/floorplan/
    FloorPlan.tsx          one plan as an SVG
    FloorPlanSet.tsx       several plans at one size of text (the floors of a building)
    FloorPlanLegend.tsx    the symbols with their titles
    SymbolShape.tsx        one symbol, and the type of its art
    textStyle.ts           the weights of the text, and the browser's measure
    HqStaticExample.tsx    THE STATIC EXAMPLE drawn: both floors, their names, the legend

src/hooks/useFloorPlanMeasure.ts            the browser measures text once the page is up
scripts/floorplan-examples.ts               runs the examples
```

`src/components/layout/` is the app's own frame (sidebar, header) and has nothing to do with this.

## How a drawing is made

1. **Frame.** The shown part of the grid is made as large as the sheet allows, and centred. Column A stays where
   the grid says even when the first columns are not shown, so a position means the same whatever the crop.
2. **Areas are trimmed to the walls.** An area may be given larger than its room: what falls outside the outline is
   cut off, so an area against the curved wall follows the curve. `clip: false` skips this (an upper-floor annex
   that stands outside the ground-floor outline).
3. **Text.** In each area the heading comes first, then one line per row, all starting on the same x like a column.
   The block goes as high in the area as it fits whole; every row is checked against the room it has at its own
   height, so under a slanted wall the block uses the corner the wall leaves free.
4. **One size.** Every area of a plan uses the same size of text: the largest at which the tightest one still fits
   (`textSize` of the scene, tried in steps of `sizeStep`). Several plans shown together share the smallest of
   theirs (`FloorPlanSet`, or `fitTextSize` by hand).
5. **Long lists go on columns.** When a list does not fit its room in one column at a size, it is tried on two and
   three (`maxColumns`), filled top to bottom, before the size goes down. A low strip with nine names stays readable
   instead of dragging the whole plan's text down.
6. **Symbols hang in front.** The symbols of a line are small squares before its text; the texts stay aligned.
   Against a straight wall the whole list moves right to make room; under a slanted wall the symbols use the free
   corner and the list does not move. A symbol may come nearer a wall than text (`symbolPadding`).
7. **The cut.** With `crop.rows`, what lies below is hidden and a break line is drawn over each wall the cut
   crosses. An area may run past the cut; its text stays above it.
8. **What cannot be drawn is named, never thrown.** `scene.notDrawn` lists each area left out and why (`unplaced`
   = no position yet, `outside` = nothing of it lies in the shown part of the building); `area.overflow` marks a
   list that fits at no size (the heading stays); `scene.unknownMarks` lists symbol ids a line carries that the
   spec does not hold.

**The same line twice.** `duplicateLines(specs)` returns every line written in more than one area across the plans
given (capitals, spaces and accents aside). The engine draws them all the same: whether a repeat is a mistake is
the caller's rule. For people it is — one person, one area, one floor — and the examples hold the static example to
it.

## Drawing one

```tsx
import { FloorPlan } from '@/components/floorplan/FloorPlan';
import { HQ_BUILDING, SHEET_A3_LANDSCAPE, type FloorPlanSpec } from '@/lib/floorplan';

// The bare shape
const spec: FloorPlanSpec = { building: HQ_BUILDING, sheet: SHEET_A3_LANDSCAPE };

<FloorPlan spec={spec} />
```

Everything else is added to the spec by the caller — from a setting, a table, a form:

```tsx
const spec: FloorPlanSpec = {
    building: HQ_BUILDING,
    sheet: SHEET_A3_LANDSCAPE,
    grid: true,
    crop: { columns: [2, 10], rows: 5 },
    symbols: { aid: { title: firstAidTitle } },
    areas: [{ id: 'a', box: [6.97, 3.12, 10.5, 4.23], label: heading, lines: [plainName, { text: otherName, marks: ['aid'] }] }],
    walls: [[[6.97, 0], [6.97, 4.25]]],
};

// How the symbol looks is given to the components. The fill class is written out in a file under src/components:
// Tailwind only makes the classes it finds there.
const art: FloorPlanSymbolArt = { aid: { className: 'fill-success-600', glyph: 'M10 5h4v5h5v4h-5v5h-4v-5H5v-4h5z' } };

<FloorPlan spec={spec} symbolArt={art} />
<FloorPlanLegend symbols={spec.symbols} art={art} />
```

Several floors together, at one size of text:

```tsx
<FloorPlanSet plans={[{ id: 'ground', spec: ground }, { id: 'first', spec: first }]} symbolArt={art} />
```

The components measure text in the browser, with the page's own font, once the page is up; until then (and on the
server) a plan is drawn without text. A caller that can measure by itself passes `measure`.

## The static example

The two floors of the headquarters exactly as on the printed sheets of 12 November 2026: 18 areas, 55 people, the
two symbols (primo soccorso, antincendio) on six of them. Kept by hand, in two files:

| File | Holds |
|---|---|
| `src/lib/floorplan/hqStatic.ts` | The data: `HQ_STATIC_FLOORS` (each floor's areas, their position and people), `HQ_STATIC_SYMBOLS` (each symbol's title and who carries it), the crop, the wall, the excluded arm, and what the printed title block says (`HQ_STATIC_SHEET_INFO`). `hqStaticPlans()` turns it into one ready spec per floor. |
| `src/components/floorplan/HqStaticExample.tsx` | The drawing: both floors in a card each, the floor's name, the legend, and how the two symbols look (`HQ_STATIC_SYMBOL_ART`). |

To see it, put the component on a page:

```tsx
import { HqStaticExample } from '@/components/floorplan/HqStaticExample';

<HqStaticExample />
```

A new page needs `requirePage(...)` and a link in `LINKS` like any other (README → Hard rules); none was added.

**Editing it.** A name moves by cutting it from one area's `people` and pasting it in another's. A new area is one
more `{ name, box, people }`. Someone gets a symbol by being added to its `people` list in `HQ_STATIC_SYMBOLS`,
written exactly as in the areas. The examples then say whether the plan is still whole: nobody twice, every area
inside the building, every list fitting, everyone on a symbol's list present.

**Going dynamic.** `hqStaticPlans()` returns `{ id, title, spec }[]`. Whatever replaces it — operators by `ENTITA`,
a settings table of areas, the people of Utenti — only has to return the same, and `FloorPlanSet` draws it. When that
exists, `hqStatic.ts` and `HqStaticExample.tsx` are deleted and nothing else changes.

**The printed sheets are a separate copy.** `clz-websiteai3d/extras/print` keeps its own list and makes the A3
PDFs with the title block (logo, address, date, sheet number). Today the two say the same; a change in one does
not reach the other.

## What the engine does not hold, on purpose

- **No words.** No area names, no people, no symbol titles, no "not ours" text. A heading is written as given:
  capitals are the caller's choice. The static example is the one place with content, and it is kept apart
  (`hqStatic.ts` is not exported from `index.ts`). Text for the screen belongs in `src/locales/it.ts` like
  everywhere else.
- **No look for the symbols.** The engine keeps room for them and says where they go; their colour and glyph are
  the caller's art.
- **No colours of its own.** The components paint with theme tokens (`fill-card`, `stroke-fg-strong`,
  `fill-primary` …), so a plan follows the light and dark looks.
- **No database, no page, no PDF.** A PDF would go through `src/lib/pdf/renderPdf.ts`.

## Checking

```bash
npx tsx --tsconfig tsconfig.json scripts/floorplan-examples.ts
```

84 examples: geometry, placement, the outline, the scene, text fitting, symbols, columns, duplicates, and the
static example. Not yet a script in `package.json` and not part of `npm run check` — to add when the module gets
its first use:

```json
"floorplan:examples": "tsx --tsconfig tsconfig.json scripts/floorplan-examples.ts"
```

## To decide later

- Where the areas and their positions are kept (a settings page, a table, a file).
- Where the names come from (the NetPro operators by `ENTITA`, the people of Utenti, a list).
- Where the symbols come from (a flag on the person, a list of roles).
- Which floors exist and what each is called.
- Whether it is a page, a PDF, or both; and whether the PDF carries the printed sheets' title block.
