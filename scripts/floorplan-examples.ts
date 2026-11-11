/**
 * Regression check of the floor plan's geometry, placement, outline, scene and text fitting against the agreed
 * examples (src/lib/floorplan/examples.ts).
 *
 *   npx tsx --tsconfig tsconfig.json scripts/floorplan-examples.ts
 */
import { runBuildingExamples, runGeometryExamples, runPlacementExamples, runSceneExamples, runTextExamples, type FloorPlanExample } from '@/lib/floorplan/examples';

const GROUPS: [string, () => FloorPlanExample[]][] = [
    ['shapes', runGeometryExamples],
    ['where an area is', runPlacementExamples],
    ['the headquarters', runBuildingExamples],
    ['from a spec to a drawing', runSceneExamples],
    ['text inside an area', runTextExamples],
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
