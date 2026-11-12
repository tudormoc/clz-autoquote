/**
 * Regression check of the floor plan against the agreed examples (src/lib/floorplan/examples.ts): geometry, placement,
 * outline, scene, text fitting, symbols, columns, duplicates, and that the static example of the headquarters is whole.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/floorplan-examples.ts
 */
import {
    runBuildingExamples, runColumnExamples, runDuplicateExamples, runGeometryExamples, runPlacementExamples, runSceneExamples, runStaticExamples,
    runSymbolExamples, runTextExamples, type FloorPlanExample,
} from '@/lib/floorplan/examples';

const GROUPS: [string, () => FloorPlanExample[]][] = [
    ['shapes', runGeometryExamples],
    ['where an area is', runPlacementExamples],
    ['the headquarters', runBuildingExamples],
    ['from a spec to a drawing', runSceneExamples],
    ['text inside an area', runTextExamples],
    ['symbols in front of a line', runSymbolExamples],
    ['long lists on columns', runColumnExamples],
    ['the same line twice', runDuplicateExamples],
    ['the static example of the headquarters', runStaticExamples],
];

let failed = 0;
let total = 0;

GROUPS.forEach(([title, run], index) => {
    console.log(`${index > 0 ? '\n' : ''}--- ${title} ---`);
    for (const { note, actual, expect, pass } of run()) {
        total++;
        if (!pass) failed++;
        console.log(`${pass ? 'OK  ' : 'FAIL'} ${actual.padEnd(28)} — ${note}`);
        if (!pass) console.log(`     expected ${expect}`);
    }
});

console.log(`\n${total - failed}/${total} examples pass`);
process.exit(failed > 0 ? 1 : 0);
