# Floor plan — the building, and whatever is put on it

A drawing of the headquarters seen from above, as an engine: it knows the building's outline and how to lay things
out on it, and **nothing else**. Areas, their headings, the names inside them, walls, the part that is not ours —
all of it arrives as data from whoever calls it. With no data it draws the bare shape.

Brought over 2026-11-11 from the website project (`clz-websiteai3d`, `extras/print/build-pianta.mjs`), where it
printed the two sheets "Piano terra" and "Piano primo" from a hand-kept list. Here it is **not connected to anything
yet**: no page, no menu link, no database, no PDF. In the code the module is `floorplan`.

## Words

| Word | In the code | What it is |
|---|---|---|
| Building | `Building`, `HQ_BUILDING` | The outline seen from above, and the size of the grid over it. The only thing the module holds by itself. |
| Grid | `columnName`, `rowName`, `parseCells` | Ten columns (A–J) by eleven rows (1–11) of square cells laid over the building, like a spreadsheet. Positions are given on it: `[column, row]`, the corner of A1 = `[0, 0]`, fractions allowed. |
| Spec | `FloorPlanSpec` | Everything one drawing shows: building, sheet, crop, grid on/off, areas, walls, excluded part. |
| Area | `FloorPlanArea` | A room or department: where it is (`cells`, `box` or `points`), a heading (`label`) and rows of text (`lines`). |
| Wall | `spec.walls` | A line inside the building that is not the edge of an area. |
| Excluded | `FloorPlanExcluded` | A part of the building the plan is not about: hatched, with an optional text over it. |
| Crop | `FloorPlanCrop` | The columns and rows shown. Below the last row the building is cut with a zigzag **break line**. |
| Sheet | `FloorPlanSheet` | The paper, in millimetres (`SHEET_A3_LANDSCAPE`, `SHEET_A4_LANDSCAPE`). |
| Scene | `FloorPlanScene`, `buildScene` | The drawing itself: every shape and every row of text, in millimetres of the sheet. |
| Measure | `TextMeasure` | A function that says how wide a text is. The module has no font: the caller measures. |

## Where things are

```
src/lib/floorplan/
    types.ts        the words above
    options.ts      every number of the drawing (sizes, paddings, the zigzag), and the paper sizes
    building.ts     the outline of the headquarters
    geometry.ts     trimming one shape to another, lines across a shape, curves into straight pieces
    placement.ts    'H3-I5' → a rectangle; an area's shape as given
    frame.ts        grid units → millimetres of the sheet
    textBlock.ts    heading + lines inside an area, at the largest size that fits
    breakLine.ts    the zigzag
    scene.ts        buildScene (spec → scene), fitTextSize
    examples.ts     worked examples (made-up data)
    index.ts        everything above, for `import … from '@/lib/floorplan'`
src/components/floorplan/FloorPlan.tsx      draws a scene as an SVG
scripts/floorplan-examples.ts               runs the examples
```

`src/components/layout/` is the app's own frame (sidebar, header) and has nothing to do with this.

## How a drawing is made

1. **Frame.** The shown part of the grid is made as large as the sheet allows, and centred. Column A stays where
   the grid says even when the first columns are not shown, so a position means the same whatever the crop.
2. **Areas are trimmed to the walls.** An area may be given larger than its room: what falls outside the outline is
   cut off, so an area against the curved wall follows the curve. `clip: false` skips this (an upper-floor annex
   that stands outside the ground-floor outline).
3. **Text.** In each area the heading comes first, then one line per row, all starting on the same x. The block
   goes as high in the area as it fits whole. **Every area of a plan uses the same size**: the largest at which the
   tightest one still fits (`textSize` of the scene). Lines that fit at no size are left out and the area is marked
   `overflow`; the heading stays.
4. **The cut.** With `crop.rows`, what lies below is hidden and a break line is drawn over each wall the cut
   crosses. An area may run past the cut; its text stays above it.
5. **What cannot be drawn is named**, never thrown: `scene.notDrawn` lists each area left out and why
   (`unplaced` = no position yet, `outside` = nothing of it lies in the shown part of the building).

## Drawing one

```tsx
import { FloorPlan } from '@/components/floorplan/FloorPlan';
import { HQ_BUILDING, SHEET_A3_LANDSCAPE, type FloorPlanSpec } from '@/lib/floorplan';

// The bare shape
const spec: FloorPlanSpec = { building: HQ_BUILDING, sheet: SHEET_A3_LANDSCAPE };

<FloorPlan spec={spec} />
```

Everything else is added to the spec by the caller — from a setting, a table, a form, whatever is decided later:

```ts
const spec: FloorPlanSpec = {
    building: HQ_BUILDING,
    sheet: SHEET_A3_LANDSCAPE,
    grid: true,
    crop: { columns: [2, 10], rows: 5 },
    areas: [{ id: 'a', box: [6.97, 3.12, 10.5, 4.23], label: heading, lines: names }],
    walls: [[[6.97, 0], [6.97, 4.25]]],
};
```

Several plans shown together (the floors of one building) share one size: take the smallest `fitTextSize(spec,
measure)` and give it to each `<FloorPlan textSize={…} />`.

The component measures text in the browser, with the page's own font, once the page is up; until then (and on the
server) it draws the plan without text. A caller that can measure by itself passes `measure`.

## What it does not hold, on purpose

- **No words.** No area names, no people, no title block, no logo, no "not ours" text. A heading is written as
  given: capitals are the caller's choice. Text for the screen belongs in `src/locales/it.ts` like everywhere else.
- **No colours of its own.** The component paints with theme tokens (`fill-card`, `stroke-fg-strong`,
  `fill-primary` …), so it follows the light and dark looks.
- **No database, no page, no PDF.** When it gets a page, that page needs `requirePage(...)` and a link in
  `LINKS` like any other (README → Hard rules); a PDF would go through `src/lib/pdf/renderPdf.ts`.

## Checking

```bash
npx tsx --tsconfig tsconfig.json scripts/floorplan-examples.ts
```

Not yet a script in `package.json` and not part of `npm run check` — to add when the module gets its first use:

```json
"floorplan:examples": "tsx --tsconfig tsconfig.json scripts/floorplan-examples.ts"
```

## To decide later

- Where the areas and their positions are kept (a settings page, a table, a file).
- Where the names come from (the NetPro operators by `ENTITA`, the people of Utenti, a list).
- Which floors exist and what each is called.
- Whether it is a page, a PDF, or both.
