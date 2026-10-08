/**
 * Production flow of an order: its operations sorted into Blocco / Copertina / Assemblaggio / Finitura / other columns,
 * with the status of the earlier steps inferred (a step that is running means the ones before it are done).
 */
import { APP_CONFIG } from '@/config/constants';

export type FlowStatus = 'EXE' | 'SUS' | 'COM' | 'PENDING';

export interface FlowOperation {
    machine_code: string;
    machine_name: string;
    operation_name: string;
    diba_note?: string;
    area_name: string;
    status: FlowStatus;
    edition_count: number;
}

const { FLOW_A_AREAS, FLOW_B_AREAS, ASSEMBLY_AREAS, FINISHING_AREAS } = APP_CONFIG.ANALYTICS.PRODUCTION_FLOW;
const ALL_KNOWN_AREAS: readonly string[] = [...FLOW_A_AREAS, ...FLOW_B_AREAS, ...ASSEMBLY_AREAS, ...FINISHING_AREAS];

const isActive = (op: FlowOperation) => op.status === 'EXE' || op.status === 'SUS';

/** The operations of the given areas, in the order of that area list */
const inAreas = (operations: FlowOperation[], areas: readonly string[]) =>
    operations
        .filter((op) => areas.includes(op.area_name))
        .sort((a, b) => areas.indexOf(a.area_name) - areas.indexOf(b.area_name));

const markCompleted = (ops: FlowOperation[]) => ops.map((op): FlowOperation => (op.status === 'COM' ? op : { ...op, status: 'COM' }));

/** Everything before the last running or suspended step must have been completed */
const inferStatuses = (ops: FlowOperation[]): FlowOperation[] => {
    let lastActive = -1;
    ops.forEach((op, index) => {
        if (isActive(op)) lastActive = index;
    });
    return ops.map((op, index) => (index < lastActive && op.status !== 'COM' ? { ...op, status: 'COM' } : op));
};

export function buildProductionFlow(operations: FlowOperation[]) {
    const rawBlock = inAreas(operations, FLOW_A_AREAS);
    const rawCover = inAreas(operations, FLOW_B_AREAS);
    const rawAssembly = inAreas(operations, ASSEMBLY_AREAS);

    // When assembly has started, both block and cover production are finished
    const assemblyStarted = rawAssembly.some(isActive);
    const blockOps = assemblyStarted ? markCompleted(rawBlock) : inferStatuses(rawBlock);
    const coverOps = assemblyStarted ? markCompleted(rawCover) : inferStatuses(rawCover);
    const assemblyOps = inferStatuses(rawAssembly);
    const finishingOps = inAreas(operations, FINISHING_AREAS);
    const otherOps = operations.filter((op) => !ALL_KNOWN_AREAS.includes(op.area_name));

    const all = [...blockOps, ...coverOps, ...assemblyOps, ...finishingOps, ...otherOps];
    const completed = all.filter((op) => op.status === 'COM').length;
    return {
        blockOps,
        coverOps,
        assemblyOps,
        finishingOps,
        otherOps,
        total: all.length,
        completed,
        running: all.filter((op) => op.status === 'EXE').length,
        paused: all.filter((op) => op.status === 'SUS').length,
        progressPercent: all.length ? Math.round((completed / all.length) * 100) : 0,
    };
}
