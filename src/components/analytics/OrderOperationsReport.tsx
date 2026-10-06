'use client'

import { useState } from 'react';
import { Search, Package, CheckCircle, Pause, Play, Printer, ArrowRight, ChevronLeft, FileText, Boxes, Workflow, Layers, AlertTriangle, Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
    getOrderOperationsAction,
    getSingleOrderDetailsAction,
    MasterOrderMatch,
    Material
} from '@/app/analytics/queries/order-operations-queries';
import { APP_CONFIG } from '@/config/constants';
import { APP_COPY } from '@/locales';
import { OrderOperationsManagementSection } from './OrderOperationsManagementSection';
import { OrderOperationsManagementData } from '@/types';

// Locale shorthand for Order Operations strings
const t = APP_COPY.analytics.orderOperations;

interface Operation {
    machine_code: string;
    machine_name: string;
    operation_name: string;
    diba_note?: string;
    area_name: string;
    status: 'EXE' | 'SUS' | 'COM' | 'PENDING';
    edition_count: number;
}

interface Edition {
    commessa_display: string;
    commessa_full: string;
    order_description: string;
    master_order_title?: string;
    client_name: string;
    ordine?: string;
    part_number?: string;
}

type SectionTab = 'flow' | 'materials' | 'management';

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

/** Single operation row in the production flow (compact: one line + optional note) */
const OperationNode = ({ op, index }: { op: Operation; index?: number }) => {
    const isCompleted = op.status === 'COM';
    const isInProgress = op.status === 'EXE';
    const isSuspended = op.status === 'SUS';

    return (
        <div className={`
            relative px-2.5 py-1.5 rounded-lg border transition-colors
            ${getStatusStyles(op.status)}
            ${isInProgress ? 'ring-1 ring-info/30' : 'hover:border-zinc-700'}
        `}>
            <div className="flex items-center gap-2">
                {/* Status icon */}
                <div className={`
                    w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0
                    ${isCompleted ? 'bg-success/20 text-success-foreground' : ''}
                    ${isInProgress ? 'bg-info/20 text-info-foreground animate-pulse' : ''}
                    ${isSuspended ? 'bg-warning/20 text-warning-foreground' : ''}
                    ${!isCompleted && !isInProgress && !isSuspended ? 'bg-zinc-800/60 text-zinc-500' : ''}
                `}>
                    {isCompleted && <CheckCircle className="w-3.5 h-3.5" />}
                    {isInProgress && <Play className="w-3.5 h-3.5 fill-current" />}
                    {isSuspended && <Pause className="w-3.5 h-3.5 fill-current" />}
                    {!isCompleted && !isInProgress && !isSuspended && (
                        index !== undefined
                            ? <span className="text-[10px] font-mono font-bold">{index + 1}</span>
                            : <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                    )}
                </div>

                {/* Operation info */}
                <div className="flex-1 min-w-0 leading-tight">
                    <p
                        className={`text-xs font-semibold truncate ${isInProgress ? 'text-info-foreground' : isCompleted ? 'text-success-foreground/90' : 'text-zinc-200'}`}
                        title={op.operation_name}
                    >
                        {op.operation_name}
                    </p>
                    <p className="text-[11px] opacity-60 truncate" title={op.machine_name}>{op.machine_name}</p>
                </div>
            </div>

            {/* DiBa Technical Note — always shown in full */}
            {op.diba_note && (
                <div className="mt-1 pt-1 border-t border-white/5 flex items-start gap-1 text-[11px]">
                    <FileText className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                    <p className="leading-snug whitespace-pre-line text-zinc-300">{op.diba_note}</p>
                </div>
            )}
        </div>
    );
};

/** One column of the production flow (Blocco / Copertina / Assemblaggio / ...) */
const FlowColumn = ({ title, ops, accent, emptyText, numbered }: {
    title: string;
    ops: Operation[];
    accent: string;
    emptyText?: string;
    numbered?: boolean;
}) => {
    const done = ops.filter(o => o.status === 'COM').length;
    return (
        <div className="flex flex-col min-h-0 rounded-xl border border-zinc-800/70 bg-card/30">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-800/70">
                <h3 className={`text-xs font-bold flex items-center gap-1.5 ${accent}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {title}
                </h3>
                <span className="text-[10px] font-mono text-zinc-400">
                    {done}/{ops.length}
                </span>
            </div>
            <div className="p-2 space-y-1.5">
                {ops.length > 0
                    ? ops.map((op, idx) => <OperationNode key={idx} op={op} index={numbered ? idx : undefined} />)
                    : <div className="py-4 text-center italic text-muted-foreground text-xs">{emptyText || '-'}</div>}
            </div>
        </div>
    );
};

export function OrderOperationsReport() {
    const [searchTerm, setSearchTerm] = useState('');
    const [matches, setMatches] = useState<MasterOrderMatch[]>([]);
    const [operations, setOperations] = useState<Operation[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [operationsManagement, setOperationsManagement] = useState<OrderOperationsManagementData>({
        article_father: '',
        ordine_netpro: '',
        diba_operations: [],
        order_operations: []
    });
    const [editions, setEditions] = useState<Edition[]>([]);
    const [activeSection, setActiveSection] = useState<SectionTab>('flow');
    // DiBa alignment status reported by the management panel (stays correct after an in-panel sync/refresh)
    const [dibaStatus, setDibaStatus] = useState<{ hasDiscrepancies: boolean; count: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(t.enterSearch);
    const [error, setError] = useState<string | null>(null);

    const emptyOpsManagement: OrderOperationsManagementData = {
        article_father: '',
        ordine_netpro: '',
        diba_operations: [],
        order_operations: []
    };

    const resetOrderData = () => {
        setOperations([]);
        setMaterials([]);
        setOperationsManagement(emptyOpsManagement);
        setEditions([]);
        setDibaStatus(null);
    };

    const handleSearch = async () => {
        if (!searchTerm.trim()) {
            setMessage(t.enterSearch);
            resetOrderData();
            setMatches([]);
            return;
        }

        setLoading(true);
        setError(null);
        setMessage(null);
        resetOrderData();
        setMatches([]);

        const result = await getOrderOperationsAction(searchTerm);

        if (result.success) {
            if (result.status === 'single') {
                setOperations(result.data);
                setEditions(result.editions);
                setMaterials(result.materials || []);
                setOperationsManagement(result.operationsManagement || emptyOpsManagement);
                setActiveSection('flow');
                setMatches([]);
                setMessage(null);
            } else if (result.status === 'multiple') {
                setMatches(result.matches);
                setMessage(null);
            } else {
                setMatches([]);
                setMessage(result.message);
            }
        } else {
            setError(result.error || APP_COPY.analytics.error);
            setMatches([]);
        }

        setLoading(false);
    };

    const handleSelectOrder = async (rootCommessaKey: string) => {
        setLoading(true);
        setError(null);

        const result = await getSingleOrderDetailsAction(rootCommessaKey);
        if (result.success) {
            setOperations(result.data);
            setEditions(result.editions);
            setMaterials(result.materials || []);
            setOperationsManagement(result.operationsManagement || emptyOpsManagement);
            setDibaStatus(null);
            setActiveSection('flow');
        } else {
            setError(result.error || APP_COPY.analytics.error);
        }

        setLoading(false);
    };

    const handleBackToMatches = () => {
        resetOrderData();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handlePrintCommessa = (netproId?: string) => {
        if (!netproId) return;
        window.open(`/api/reports/commessa?netproId=${encodeURIComponent(netproId)}`, '_blank');
    };

    const handlePrintAllEditions = () => {
        const validIds = editions.map(e => e.ordine).filter(Boolean);
        if (validIds.length === 0) return;
        window.open(`/api/reports/commessa?netproIds=${encodeURIComponent(validIds.join(','))}`, '_blank');
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

    // Overall progress (after inference)
    const allFlowOps = [...flowAOps, ...flowBOps, ...assemblyOps, ...finishingOps, ...unclassifiedOps];
    const countCom = allFlowOps.filter(o => o.status === 'COM').length;
    const countExe = allFlowOps.filter(o => o.status === 'EXE').length;
    const countSus = allFlowOps.filter(o => o.status === 'SUS').length;
    const progressPct = allFlowOps.length ? Math.round((countCom / allFlowOps.length) * 100) : 0;

    const orderInfo = editions.length > 0 ? editions[0] : null;
    const rootCommessaKey = orderInfo?.commessa_full ? orderInfo.commessa_full.slice(0, 7) : '';
    const hasOrder = operations.length > 0;

    // DiBa status for the tab label: panel-reported value wins, falls back to the loaded data
    const dibaHasDisc = dibaStatus ? dibaStatus.hasDiscrepancies : !!operationsManagement.has_discrepancies;
    const dibaDiscCount = dibaStatus ? dibaStatus.count : (operationsManagement.discrepancy_count || 0);

    const tabs: { id: SectionTab; label: string; icon: React.ReactNode; badge: React.ReactNode }[] = [
        {
            id: 'flow',
            label: t.operationsTab,
            icon: <Workflow className="w-4 h-4 text-blue-400" />,
            badge: <span className="text-[10px] px-1.5 rounded-full bg-zinc-800 text-zinc-300">{operations.length}</span>,
        },
        {
            id: 'materials',
            label: t.materialsTab,
            icon: <Boxes className="w-4 h-4 text-amber-400" />,
            badge: <span className="text-[10px] px-1.5 rounded-full bg-zinc-800 text-zinc-300">{materials.length}</span>,
        },
        {
            id: 'management',
            label: t.operationsManagementTab,
            icon: <Layers className="w-4 h-4 text-purple-400" />,
            badge: dibaHasDisc ? (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <AlertTriangle className="w-3 h-3" />{dibaDiscCount}
                </span>
            ) : (
                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <Check className="w-3 h-3" />DiBa
                </span>
            ),
        },
    ];

    return (
        <div className="flex-1 min-h-0 flex flex-col gap-3">
            {/* Top bar: title + search on one line */}
            <div className="flex items-center gap-3 flex-shrink-0">
                <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                    <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                        <Workflow size={18} />
                    </div>
                    <h1 className="text-lg font-bold text-white whitespace-nowrap">{t.pageTitle}</h1>
                </div>
                <div className="flex-1 flex gap-2">
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
            </div>

            {/* Order header: one compact strip */}
            {orderInfo && (
                <div className="flex-shrink-0 rounded-xl border border-zinc-800 bg-card/60 px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        {matches.length > 1 && (
                            <button
                                type="button"
                                onClick={handleBackToMatches}
                                className="flex items-center gap-1 text-xs text-zinc-300 hover:text-white px-2 py-1 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800"
                                title={t.backToResults}
                            >
                                <ChevronLeft className="w-4 h-4 text-primary" />
                                <span>{matches.length}</span>
                            </button>
                        )}

                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                                <Package className="w-4 h-4" />
                            </div>
                            <h2 className="text-lg font-bold text-white whitespace-nowrap">
                                {t.orderTitle} <span className="text-primary">{orderInfo.commessa_display}</span>
                            </h2>
                        </div>

                        {(orderInfo.master_order_title || orderInfo.order_description) && (
                            <div className="min-w-0 max-w-[40%]">
                                <p className="text-[10px] uppercase text-zinc-500 font-semibold leading-none">{t.title}</p>
                                <p className="text-sm font-semibold text-zinc-100 truncate" title={orderInfo.master_order_title || orderInfo.order_description}>
                                    {orderInfo.master_order_title || orderInfo.order_description}
                                </p>
                            </div>
                        )}

                        {orderInfo.client_name && (
                            <div className="min-w-0">
                                <p className="text-[10px] uppercase text-zinc-500 font-semibold leading-none">{t.client}</p>
                                <p className="text-sm font-semibold text-zinc-200 truncate">{orderInfo.client_name}</p>
                            </div>
                        )}

                        {/* Progress summary */}
                        {hasOrder && (
                            <div className="flex items-center gap-2 min-w-[180px]">
                                <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                    <div className="h-full bg-success" style={{ width: `${progressPct}%` }} />
                                </div>
                                <span className="text-xs font-mono text-zinc-300 whitespace-nowrap">
                                    {countCom}/{allFlowOps.length}
                                </span>
                                {countExe > 0 && <span className="text-[10px] px-1.5 rounded bg-info/15 text-info-foreground border border-info/30">{countExe} {t.statusActive}</span>}
                                {countSus > 0 && <span className="text-[10px] px-1.5 rounded bg-warning/15 text-warning-foreground border border-warning/30">{countSus} {t.statusPaused}</span>}
                            </div>
                        )}

                        <div className="ml-auto flex items-center gap-2 flex-wrap">
                            {editions.map((ed, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 pl-2 rounded-lg bg-zinc-900/70 border border-zinc-800" title={ed.order_description}>
                                    {editions.length > 1 && (
                                        <span className="text-[10px] font-bold text-primary">{t.editionSingle} {idx + 1}</span>
                                    )}
                                    <span className="font-mono text-xs text-zinc-300">{ed.commessa_full}</span>
                                    {ed.ordine && (
                                        <button
                                            type="button"
                                            onClick={() => handlePrintCommessa(ed.ordine)}
                                            className="p-1.5 rounded-r-lg text-zinc-300 hover:text-primary hover:bg-primary/15 border-l border-zinc-800"
                                            title={t.printCommessa}
                                        >
                                            <Printer className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {editions.length > 1 && (
                                <Button
                                    onClick={handlePrintAllEditions}
                                    className="flex items-center gap-1.5 text-xs h-8 px-3"
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>{t.printAllEditions} ({editions.length})</span>
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Order workspace: tab bar + one full-height panel */}
            {hasOrder && (
                <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
                    <div className="flex-shrink-0 flex items-center gap-1 px-2 pt-2 border-b border-zinc-800/80 overflow-x-auto">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveSection(tab.id)}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                                    activeSection === tab.id
                                        ? 'border-primary text-white bg-zinc-800/60'
                                        : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                                }`}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                                {tab.badge}
                            </button>
                        ))}
                    </div>

                    {/* Panels stay mounted (hidden) so their local state survives tab switches */}
                    <div className="flex-1 min-h-0 relative">
                        {/* Fasi di lavorazione */}
                        <div className={`absolute inset-0 overflow-auto p-3 ${activeSection === 'flow' ? '' : 'hidden'}`}>
                            <div className="flex flex-wrap items-center justify-end gap-4 mb-2 text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success" />{t.statusCompleted}</span>
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-info animate-pulse" />{t.statusActive}</span>
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning" />{t.statusPaused}</span>
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-700" />{t.statusScheduled}</span>
                            </div>
                            <div className="grid gap-3 items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
                                <FlowColumn title={t.blockProduction} ops={flowAOps} accent="text-info-foreground" emptyText={t.noBlockOps} numbered />
                                <FlowColumn title={t.coverProduction} ops={flowBOps} accent="text-accent" emptyText={t.noCoverOps} numbered />
                                {assemblyOps.length > 0 && (
                                    <FlowColumn title={t.assemblyBinding} ops={assemblyOps} accent="text-zinc-300" numbered />
                                )}
                                {finishingOps.length > 0 && (
                                    <FlowColumn title={t.finishingDelivery} ops={finishingOps} accent="text-zinc-300" />
                                )}
                                {unclassifiedOps.length > 0 && (
                                    <FlowColumn title={t.otherOperations} ops={unclassifiedOps} accent="text-zinc-400" />
                                )}
                            </div>
                        </div>

                        {/* Materiali */}
                        <div className={`absolute inset-0 overflow-auto p-3 ${activeSection === 'materials' ? '' : 'hidden'}`}>
                            {materials.length === 0 ? (
                                <div className="py-8 text-center text-zinc-400 text-sm italic">
                                    {t.noMaterials}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-zinc-800 overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-zinc-950/80 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 sticky top-0">
                                            <tr>
                                                <th className="py-2 px-3">{t.materialCode}</th>
                                                <th className="py-2 px-3">{t.materialDescription}</th>
                                                <th className="py-2 px-3 text-right">{t.materialQty}</th>
                                                <th className="py-2 px-3 text-right">{t.materialStock}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/30">
                                            {materials.map((mat, idx) => {
                                                const isStockSufficient = mat.stock_quantity >= mat.total_quantity;
                                                return (
                                                    <tr key={idx} className="hover:bg-zinc-800/40 transition-colors">
                                                        <td className="py-1.5 px-3 font-mono font-bold text-primary">
                                                            {mat.part_number}
                                                        </td>
                                                        <td className="py-1.5 px-3 font-medium text-zinc-200">
                                                            {mat.description}
                                                        </td>
                                                        <td className="py-1.5 px-3 text-right font-mono font-bold text-zinc-100 whitespace-nowrap">
                                                            {new Intl.NumberFormat('it-IT').format(mat.total_quantity)}{' '}
                                                            <span className="font-normal text-zinc-400">{mat.unit_of_measure}</span>
                                                        </td>
                                                        <td className="py-1.5 px-3 text-right whitespace-nowrap">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono font-semibold ${
                                                                isStockSufficient
                                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                            }`}>
                                                                {new Intl.NumberFormat('it-IT').format(mat.stock_quantity)}{' '}
                                                                <span className="text-[10px] font-normal opacity-80">{mat.unit_of_measure}</span>
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>


                        {/* Gestione Operazioni Ordine (Distinta Base & Ordine Produzione) */}
                        <div className={`absolute inset-0 overflow-auto p-3 ${activeSection === 'management' ? '' : 'hidden'}`}>
                            <OrderOperationsManagementSection
                                operationsManagement={operationsManagement}
                                rootCommessaKey={rootCommessaKey}
                                editions={editions}
                                onStatusChange={(hasDiscrepancies, count) => setDibaStatus({ hasDiscrepancies, count })}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Search results / messages (scroll inside, page never scrolls) */}
            {!hasOrder && (
                <div className="flex-1 min-h-0 overflow-auto space-y-3">
                    {matches.length > 1 && editions.length === 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-zinc-400 px-1">
                                {t.multipleResultsFound}: <span className="text-white font-bold">{matches.length}</span> — {t.selectOrderToView}
                            </p>

                            <div className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800 bg-card/40 overflow-hidden">
                                {matches.map((m) => (
                                    <div
                                        key={m.root_commessa_key}
                                        onClick={() => handleSelectOrder(m.root_commessa_key)}
                                        className="group flex items-center justify-between gap-4 py-2 px-4 hover:bg-zinc-800/50 cursor-pointer transition-colors duration-150"
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                            <div className="flex flex-col items-center justify-center bg-zinc-800/90 border border-zinc-700/80 rounded-lg px-2.5 py-0.5 flex-shrink-0 min-w-[64px]">
                                                <span className="text-sm font-bold text-white font-mono leading-tight">
                                                    {m.commessa_display}
                                                </span>
                                                <span className="text-[10px] text-zinc-400 font-medium">
                                                    20{m.year_code}
                                                </span>
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-zinc-200 group-hover:text-primary transition-colors truncate">
                                                    {m.master_order_title}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs text-zinc-400">
                                                    <span className="truncate max-w-[320px]">
                                                        {m.client_name || '-'}
                                                    </span>
                                                    <span>•</span>
                                                    <span className="text-zinc-500 font-medium">
                                                        {m.edition_count} {m.edition_count === 1 ? t.editionSingle : t.editions}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 flex-shrink-0 text-zinc-500 group-hover:text-primary transition-colors text-xs font-semibold">
                                            <span className="hidden sm:inline">{t.openOrder}</span>
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {message && !error && (
                        <Card>
                            <div className="text-center py-8 text-muted-foreground">
                                <Search className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
                                <p className="text-sm">{message}</p>
                            </div>
                        </Card>
                    )}

                    {error && (
                        <Card>
                            <div className="text-center py-8 text-destructive">
                                <p className="text-sm">{error}</p>
                            </div>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}
