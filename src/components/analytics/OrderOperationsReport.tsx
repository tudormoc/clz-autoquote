'use client'

import { useState } from 'react';
import { Search, Package, CheckCircle, Pause, Play } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getOrderOperationsAction } from '@/app/analytics/queries/order-operations-queries';
import { APP_CONFIG } from '@/config/constants';
import { APP_COPY } from '@/locales';

// Locale shorthand for Order Operations strings
const t = APP_COPY.analytics.orderOperations;

interface Operation {
    machine_code: string;
    machine_name: string;
    operation_name: string;
    area_name: string;
    status: 'EXE' | 'SUS' | 'COM' | 'PENDING';
    edition_count: number;
}

interface Edition {
    commessa_display: string;
    commessa_full: string;
    order_description: string;
    client_name: string;
}

// Production flow config from constants (single source of truth)
const { FLOW_A_AREAS, FLOW_B_AREAS, ASSEMBLY_AREAS, FINISHING_AREAS } = APP_CONFIG.ANALYTICS.PRODUCTION_FLOW;

// All known areas combined — operations not in any of these go to "Other"
const ALL_KNOWN_AREAS = [...FLOW_A_AREAS, ...FLOW_B_AREAS, ...ASSEMBLY_AREAS, ...FINISHING_AREAS];

/** Sort operations by their position in the given PRODUCTION_FLOW array */
const sortByFlowPosition = (ops: Operation[], flowAreas: readonly string[]) =>
    [...ops].sort((a, b) => flowAreas.indexOf(a.area_name) - flowAreas.indexOf(b.area_name));

/**
 * Infer completion status for sequential flows (A & B only).
 * If operation at position N is active (EXE/SUS/COM), all operations before N
 * must have been completed — so we visually upgrade them to COM.
 */
const inferFlowStatuses = (ops: Operation[]): Operation[] => {
    // Find the last operation that is active (EXE) or suspended (SUS)
    let lastActiveIndex = -1;
    ops.forEach((op, i) => {
        if (op.status === 'EXE' || op.status === 'SUS') {
            lastActiveIndex = i;
        }
    });

    // Upgrade all operations before the active one to COM (they must be done)
    return ops.map((op, i) => {
        if (i < lastActiveIndex && op.status !== 'COM') {
            return { ...op, status: 'COM' };
        }
        return op;
    });
};

/** Status style mapping using semantic design tokens */
const getStatusStyles = (status: string) => {
    switch (status) {
        case 'EXE':
            return 'bg-info/10 border-info/50 text-info-foreground';
        case 'SUS':
            return 'bg-warning/10 border-warning/50 text-warning-foreground';
        case 'COM':
            return 'bg-success/10 border-success/50 text-success-foreground';
        default:
            return 'bg-card border-zinc-800 text-muted-foreground';
    }
};

/** Single operation node in the production flow */
const OperationNode = ({ op }: { op: Operation }) => {
    const isCompleted = op.status === 'COM';
    const isInProgress = op.status === 'EXE';
    const isSuspended = op.status === 'SUS';

    return (
        <div className={`
            group relative p-4 rounded-xl border transition-all duration-500
            ${getStatusStyles(op.status)}
            ${isInProgress ? 'ring-1 ring-info/30' : 'hover:border-zinc-700'}
            backdrop-blur-sm
        `}>
            <div className="flex items-center gap-4 relative z-10">
                {/* Status icon */}
                <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-700
                    ${isCompleted ? 'bg-success/20 text-success-foreground border border-success/40' : ''}
                    ${isInProgress ? 'bg-info/20 text-info-foreground border border-info/40 animate-pulse' : ''}
                    ${isSuspended ? 'bg-warning/20 text-warning-foreground border border-warning/40' : ''}
                    ${!isCompleted && !isInProgress && !isSuspended ? 'bg-zinc-800/50 text-zinc-600 border border-zinc-700/50' : ''}
                `}>
                    {isCompleted && <CheckCircle className="w-5 h-5" />}
                    {isInProgress && <Play className="w-5 h-5 fill-current" />}
                    {isSuspended && <Pause className="w-5 h-5 fill-current" />}
                    {!isCompleted && !isInProgress && !isSuspended && <div className="w-2 h-2 rounded-full bg-zinc-600" />}
                </div>

                {/* Operation info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 overflow-hidden">
                        <h4 className={`text-sm font-bold tracking-wide truncate transition-colors duration-300 ${isInProgress ? 'text-info-foreground' : isCompleted ? 'text-success-foreground/90' : 'text-zinc-300 group-hover:text-zinc-100'}`}>
                            {op.operation_name}
                        </h4>
                    </div>
                    <p className="text-xs font-medium opacity-60 truncate mt-0.5">{op.machine_name}</p>
                </div>
            </div>

            {/* Active shimmer indicator */}
            {isInProgress && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-info/10 rounded-full overflow-hidden">
                    <div className="h-full bg-info/60 animate-[shimmer_2s_infinite] w-2/5" />
                </div>
            )}
        </div>
    );
};

export function OrderOperationsReport() {
    const [searchTerm, setSearchTerm] = useState('');
    const [operations, setOperations] = useState<Operation[]>([]);
    const [editions, setEditions] = useState<Edition[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(t.enterSearch);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async () => {
        if (!searchTerm.trim()) {
            setMessage(t.enterSearch);
            setOperations([]);
            setEditions([]);
            return;
        }

        setLoading(true);
        setError(null);
        setMessage(null);

        const result = await getOrderOperationsAction(searchTerm);

        if (result.success) {
            setOperations(result.data);
            setEditions(result.editions);
            setMessage(result.message);
        } else {
            setError(result.error || APP_COPY.analytics.error);
            setOperations([]);
            setEditions([]);
        }

        setLoading(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    // Filter and sort operations by production flow phase (array order = display order)
    const rawFlowA = sortByFlowPosition(operations.filter(op => (FLOW_A_AREAS as readonly string[]).includes(op.area_name)), FLOW_A_AREAS);
    const rawFlowB = sortByFlowPosition(operations.filter(op => (FLOW_B_AREAS as readonly string[]).includes(op.area_name)), FLOW_B_AREAS);
    const rawAssembly = sortByFlowPosition(operations.filter(op => (ASSEMBLY_AREAS as readonly string[]).includes(op.area_name)), ASSEMBLY_AREAS);
    const finishingOps = sortByFlowPosition(operations.filter(op => (FINISHING_AREAS as readonly string[]).includes(op.area_name)), FINISHING_AREAS);
    const unclassifiedOps = operations.filter(op => !(ALL_KNOWN_AREAS as readonly string[]).includes(op.area_name));

    // Check if any assembly op is active — if so, both Flow A and Flow B must be fully completed
    const assemblyHasActive = rawAssembly.some(op => op.status === 'EXE' || op.status === 'SUS');

    // Apply status inference per section + cascade from assembly
    const markAllCompleted = (ops: Operation[]) => ops.map(op => op.status !== 'COM' ? { ...op, status: 'COM' as const } : op);
    const flowAOps = assemblyHasActive ? markAllCompleted(rawFlowA) : inferFlowStatuses(rawFlowA);
    const flowBOps = assemblyHasActive ? markAllCompleted(rawFlowB) : inferFlowStatuses(rawFlowB);
    const assemblyOps = inferFlowStatuses(rawAssembly);

    const orderInfo = editions.length > 0 ? editions[0] : null;

    return (
        <div className="space-y-4">
            {/* Search Section */}
            <Card>
                <div className="flex gap-2">
                    <div className="flex-1">
                        <Input
                            type="text"
                            placeholder={t.searchPlaceholder}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={loading}
                        />
                    </div>
                    <Button
                        onClick={handleSearch}
                        disabled={loading}
                        className="flex items-center gap-2"
                    >
                        <Search className="w-4 h-4" />
                        {loading ? t.searching : t.search}
                    </Button>
                </div>
            </Card>

            {/* Order Header */}
            {orderInfo && (
                <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-card/50 p-6 backdrop-blur-sm">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Package className="w-32 h-32" />
                    </div>

                    <div className="flex items-start gap-6 relative z-10">
                        <div className="flex w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center flex-shrink-0">
                            <Package className="w-8 h-8 text-primary" />
                        </div>

                        <div className="flex-1">
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                                    {t.orderTitle} <span className="text-primary">{orderInfo.commessa_display}</span>
                                </h2>
                                {editions.length > 1 && (
                                    <div className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary/20 text-primary border border-primary/30">
                                        {editions.length} {t.editions}
                                    </div>
                                )}
                            </div>

                            <p className="text-muted-foreground mt-1 font-medium max-w-2xl">
                                {orderInfo.order_description}
                            </p>

                            {orderInfo.client_name && (
                                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-md bg-zinc-800/30 border border-zinc-700/50">
                                    <span className="text-xs text-zinc-400">{t.client}</span>
                                    <span className="text-sm font-semibold text-zinc-200">{orderInfo.client_name}</span>
                                </div>
                            )}

                            {editions.length > 1 && (
                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {editions.map((ed, idx) => (
                                        <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/50 border border-zinc-800/50 text-xs text-muted-foreground">
                                            <span className="font-mono text-zinc-600">{ed.commessa_full}</span>
                                            <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                            <span className="truncate">{ed.order_description}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Operations Progress Tracker */}
            {operations.length > 0 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    {/* Parallel Phase: Flow A + Flow B */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                        {/* Connecting line between parallel flows */}
                        <div className="absolute top-[4.5rem] bottom-8 left-1/2 w-px bg-gradient-to-b from-transparent via-zinc-800 to-transparent hidden md:block" />

                        {/* Flow A: Internal/Block */}
                        <div className="relative rounded-2xl bg-card/30 border border-zinc-800/40 p-5 group hover:border-info/20 transition-colors duration-500">
                            <div className="absolute -top-3 left-6 px-3 py-1 bg-background border border-zinc-800 rounded-full">
                                <h3 className="text-xs font-bold text-info-foreground flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-info animate-pulse" />
                                    {t.blockProduction}
                                </h3>
                            </div>

                            <div className="space-y-4 pt-4">
                                {flowAOps.length > 0 ? (
                                    flowAOps.map((op, idx, arr) => (
                                        <div key={idx} className="relative">
                                            {idx < arr.length - 1 && (
                                                <div className="absolute left-5 top-10 bottom-[-20px] w-0.5 bg-gradient-to-b from-info/20 to-transparent z-0" />
                                            )}
                                            <OperationNode op={op} />
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-6 text-center italic text-muted-foreground text-xs">{t.noBlockOps}</div>
                                )}
                            </div>
                        </div>

                        {/* Flow B: Cover */}
                        <div className="relative rounded-2xl bg-card/30 border border-zinc-800/40 p-5 group hover:border-accent/20 transition-colors duration-500">
                            <div className="absolute -top-3 left-6 px-3 py-1 bg-background border border-zinc-800 rounded-full">
                                <h3 className="text-xs font-bold text-accent flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                                    {t.coverProduction}
                                </h3>
                            </div>

                            <div className="space-y-4 pt-4">
                                {flowBOps.length > 0 ? (
                                    flowBOps.map((op, idx, arr) => (
                                        <div key={idx} className="relative">
                                            {idx < arr.length - 1 && (
                                                <div className="absolute left-5 top-10 bottom-[-20px] w-0.5 bg-gradient-to-b from-accent/20 to-transparent z-0" />
                                            )}
                                            <OperationNode op={op} />
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-6 text-center italic text-muted-foreground text-xs">{t.noCoverOps}</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Merge Point: Assembly */}
                    {assemblyOps.length > 0 && (
                        <div className="relative p-6 rounded-2xl bg-gradient-to-br from-card/40 via-card/20 to-transparent border border-zinc-800/60">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-zinc-800" />
                                <h3 className="text-xs font-bold text-muted-foreground bg-background px-4 py-1.5 border border-zinc-800 rounded-full">
                                    {t.assemblyBinding}
                                </h3>
                                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-zinc-800" />
                            </div>

                            <div className="space-y-4">
                                {assemblyOps.map((op, idx, arr) => (
                                    <div key={idx} className="relative">
                                        {idx < arr.length - 1 && (
                                            <div className="absolute left-5 top-10 bottom-[-20px] w-0.5 bg-gradient-to-b from-zinc-700/30 to-transparent z-0" />
                                        )}
                                        <OperationNode op={op} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Finishing */}
                    {finishingOps.length > 0 && (
                        <div className="relative p-6 rounded-2xl border border-dashed border-zinc-800/80 bg-background/30">
                            <div className="flex items-center gap-4 mb-6">
                                <h3 className="text-xs font-bold text-muted-foreground">
                                    {t.finishingDelivery}
                                </h3>
                                <div className="h-px flex-1 bg-zinc-900" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {finishingOps.map((op, idx) => (
                                    <OperationNode key={idx} op={op} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Unclassified operations — operations not mapped to any production flow phase */}
                    {unclassifiedOps.length > 0 && (
                        <div className="relative p-6 rounded-2xl border border-zinc-800/50 bg-card/20">
                            <div className="flex items-center gap-4 mb-6">
                                <h3 className="text-xs font-bold text-muted-foreground">
                                    {t.otherOperations}
                                </h3>
                                <div className="h-px flex-1 bg-zinc-900" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {unclassifiedOps.map((op, idx) => (
                                    <OperationNode key={idx} op={op} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Legend */}
                    <div className="flex flex-wrap items-center justify-center gap-8 py-6 rounded-2xl border border-zinc-800/50 bg-background/20 mt-12">
                        <div className="flex items-center gap-3 group">
                            <div className="w-3 h-3 rounded-full bg-success transition-transform group-hover:scale-125" />
                            <span className="text-xs font-bold text-muted-foreground group-hover:text-zinc-300">{t.statusCompleted}</span>
                        </div>
                        <div className="flex items-center gap-3 group">
                            <div className="w-3 h-3 rounded-full bg-info animate-pulse transition-transform group-hover:scale-125" />
                            <span className="text-xs font-bold text-muted-foreground group-hover:text-zinc-300">{t.statusActive}</span>
                        </div>
                        <div className="flex items-center gap-3 group">
                            <div className="w-3 h-3 rounded-full bg-warning transition-transform group-hover:scale-125" />
                            <span className="text-xs font-bold text-muted-foreground group-hover:text-zinc-300">{t.statusPaused}</span>
                        </div>
                        <div className="flex items-center gap-3 group">
                            <div className="w-3 h-3 rounded-full bg-zinc-700 transition-transform group-hover:scale-125" />
                            <span className="text-xs font-bold text-muted-foreground group-hover:text-zinc-300">{t.statusScheduled}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Messages */}
            {message && !error && operations.length === 0 && (
                <Card>
                    <div className="text-center py-8 text-muted-foreground">
                        <Search className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
                        <p className="text-sm">{message}</p>
                    </div>
                </Card>
            )}

            {/* Error */}
            {error && (
                <Card>
                    <div className="text-center py-8 text-destructive">
                        <p className="text-sm">{error}</p>
                    </div>
                </Card>
            )}
        </div>
    );
}
