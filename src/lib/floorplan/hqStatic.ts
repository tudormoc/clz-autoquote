/**
 * Floor plan — STATIC EXAMPLE of the headquarters: the two floors with their areas, their people and the symbols
 * some of them carry, exactly as on the printed sheets of 12 November 2026 (project clz-websiteai3d,
 * extras/print/pianta-dati.mjs).
 *
 * It is here to start from: a complete, working plan to put on a page before areas, people and symbols come from
 * the app's own data. Everything in it is kept by hand. Nothing else in the module depends on it, and it is not in
 * index.ts: when the dynamic source exists, this file and src/components/floorplan/HqStaticExample.tsx go.
 *
 * Positions are in grid units (docs/FLOORPLAN.md → Words → Grid). A person is in one area only, on one floor:
 * `duplicateLines(hqStaticPlans().map((plan) => plan.spec))` is empty, and the examples check it stays so.
 */

import { HQ_BUILDING } from './building';
import { SHEET_A3_LANDSCAPE } from './options';
import type { FloorPlanCrop, FloorPlanExcluded, FloorPlanLine, FloorPlanSheet, FloorPlanSpec, FloorPlanSymbol, GridBox, Polygon } from './types';

/** What the printed sheets carry in their title block, beside the floor's name */
export const HQ_STATIC_SHEET_INFO = {
    address: 'Via Venezuela, 3 – 35127 Padova (PD)',
    author: 'TM',
    date: '12/11/2026',
} as const;

export const HQ_STATIC_LEGEND_TITLE = 'Legenda';

/**
 * The symbols, in the order of the legend, and who carries each. To give someone a symbol, add their name to its
 * list, written exactly as in the areas. How each symbol looks is in HqStaticExample.tsx, under the same key.
 */
export const HQ_STATIC_SYMBOLS: Readonly<Record<string, FloorPlanSymbol & { people: readonly string[] }>> = {
    soccorso: {
        title: 'Primo soccorso',
        people: ['SCAGNELLATO LINO', 'RIGATO FEDERICO', 'PARVU VILUTA', 'RENIER SERENELLA', 'CESAROTTO ANDREA', 'SALVAGNO DMYTRO'],
    },
    antincendio: {
        title: 'Antincendio',
        people: ['SCAGNELLATO LINO', 'RIGATO FEDERICO', 'PARVU VILUTA', 'RENIER SERENELLA', 'CESAROTTO ANDREA', 'SALVAGNO DMYTRO'],
    },
};

export interface StaticArea {
    name: string;
    /** [column0, row0, column1, row1]; it may run past a wall, the wall trims it */
    box: GridBox;
    /** false = drawn as given, outside the ground-floor outline */
    clip?: boolean;
    /** In the order they are written on the plan */
    people: readonly string[];
}

export interface StaticFloor {
    id: string;
    title: string;
    areas: readonly StaticArea[];
}

export const HQ_STATIC_FLOORS: readonly StaticFloor[] = [
    {
        id: 'terra',
        title: 'Piano terra',
        areas: [
            {
                name: 'Ufficio',
                box: [3.44, 0, 4.75, 3.87],
                people: ['BRAVI STEFANO', 'BRUNELLO FABIO', 'FORCELLA FABRIZIO', 'MONALDINI MASSIMO', 'MORANDO DANIELE', 'PORELLI CHIARA', 'SCAGNELLATO LINO', 'ZANON ELISA'],
            },
            { name: 'Taglio', box: [4.75, 3.12, 5.5, 3.87], people: ['RIGATO FEDERICO', 'FRIZZARIN NICOLA'] },
            {
                name: 'Piega',
                box: [4.75, 0, 5.92, 3.12],
                people: ['BRUNORO GIORGIO', 'LOVISARO MAURO', 'MASO BRUNO', 'PARVU VILUTA', 'PELIZZARO RICCARDO', 'PIANTELLA MICHELA'],
            },
            {
                name: 'Cucitura',
                box: [5.92, 0, 6.97, 2.06],
                people: ['CARRARO FRANCESCO', 'CARROSSA CRISTINA', 'GHIOTTO DAVIDE', 'RENIER SERENELLA', 'ZANELLA ROBERTA'],
            },
            { name: 'Raccolta', box: [5.92, 2.06, 6.97, 3.12], people: ['BISON JESSICA', 'CARINCI SARA', 'RUVOLETTO MICHELE'] },
            { name: 'Incassatura normale', box: [6.97, 0, 8.11, 3.12], people: ['CESAROTTO ROSITO', 'KOFFI AWOLOU LUCA'] },
            // One column split in two at the same height as Cucitura / Raccolta
            { name: 'Stampa a caldo', box: [8.11, 0, 9.12, 2.06], people: ['BECCARO LORENA'] },
            { name: 'Messa in colla', box: [8.11, 2.06, 9.12, 3.12], people: ['GRIGGIO MAURO', 'JAWO ADAMA'] },
            { name: 'Incassatura veloce', box: [9.12, 0, 10.5, 3.12], people: ['SALVIATO ROBERTO', 'ZATTI ELISA'] },
            { name: 'Magazzino', box: [6.97, 3.12, 10.5, 4.23], people: ['BERTOLI CARLO', 'CESAROTTO ANDREA', 'MORETTO MARTINO', 'SIMONATO ARNALDO'] },
        ],
    },
    {
        id: 'primo',
        title: 'Piano primo',
        areas: [
            { name: 'Ufficio', box: [3.44, 0, 4.3, 3.87], people: ['MOCANU TUDOR', 'PASQUATTO MARTA', 'GRILLO MARIO'] },
            // An annex outside the ground-floor outline
            { name: 'Amministrazione', box: [4.07, 4.23, 5.0, 4.95], clip: false, people: ['SAMBO IVANO', 'ZANELLATO STEFANIA', 'PICCININ WALTER'] },
            { name: 'Taglio cartone e tela', box: [6.0, 0, 6.97, 2.4], people: ['CRISTOFANON ALESSIO'] },
            { name: 'Copertine', box: [6.0, 2.4, 6.97, 3.6], people: ['BULLO ALBERTO'] },
            {
                // It continues below the cut
                name: 'Cellofanatura e finissaggio',
                box: [6.9, 4.23, 10.5, 5.5],
                people: ['AGLAOU MOUAD', 'CARRARO ELENA', 'DAOUDA OUSMANE', 'FEBO JENNIFER', 'KAMALOUDINE AHMED NJOYA', 'MAGGIOLINI CRISTIAN', 'SALMASO DANIEL', 'STEFAN ALEXANDRU BELEUTA', 'STURARO MIRCO'],
            },
            { name: 'Lavori manuali', box: [8.25, 1.3, 10.5, 3.6], people: ['ULGELMO GIANLUCA'] },
            { name: 'Officina', box: [6.97, 0, 8.25, 2.4], people: ['SALVAGNO DMYTRO'] },
            { name: 'Campioni', box: [6.97, 2.4, 8.25, 3.6], people: ['MIRON ANDRADA'] },
        ],
    },
];

/** Only the upper part of the building is CLZ's concern: columns C–J, the first five rows */
export const HQ_STATIC_CROP: FloorPlanCrop = { columns: [2, 10], rows: 5 };

/** On every floor: the wall that continues the main block's left wall up to the outer curve */
export const HQ_STATIC_WALLS: readonly Polygon[] = [[[6.97, 0], [6.97, 4.25]]];

/** On every floor: the curved arm is not CLZ (less the office standing in it) */
export const HQ_STATIC_EXCLUDED: FloorPlanExcluded = {
    boxes: [[-1, 3.87, 3.88, 20], [-1, -1, 3.44, 3.87]],
    cuts: [[[3.88, 3.87], [3.88, 4.24]]],
    label: { text: 'NON CLZ', at: [3.1, 4.5], angle: -45 },
};

export interface StaticPlan {
    id: string;
    title: string;
    spec: FloorPlanSpec;
}

/** The symbols as a spec wants them: without the lists of people */
const SYMBOLS: Readonly<Record<string, FloorPlanSymbol>> = Object.fromEntries(Object.entries(HQ_STATIC_SYMBOLS).map(([id, { title }]) => [id, { title }]));

/** A person as a line of their area, with the symbols they carry */
function lineOf(name: string): FloorPlanLine {
    const marks = Object.keys(HQ_STATIC_SYMBOLS).filter((id) => HQ_STATIC_SYMBOLS[id].people.includes(name));
    return marks.length > 0 ? { text: name, marks } : name;
}

/** One ready spec per floor, headings in capitals as on the printed sheets */
export function hqStaticPlans(sheet: FloorPlanSheet = SHEET_A3_LANDSCAPE, grid = true): StaticPlan[] {
    return HQ_STATIC_FLOORS.map((floor) => ({
        id: floor.id,
        title: floor.title,
        spec: {
            building: HQ_BUILDING,
            sheet,
            grid,
            crop: HQ_STATIC_CROP,
            walls: HQ_STATIC_WALLS,
            excluded: HQ_STATIC_EXCLUDED,
            symbols: SYMBOLS,
            areas: floor.areas.map((area) => ({
                id: `${floor.id}: ${area.name}`,
                box: area.box,
                clip: area.clip,
                label: area.name.toLocaleUpperCase('it'),
                lines: area.people.map(lineOf),
            })),
        },
    }));
}
