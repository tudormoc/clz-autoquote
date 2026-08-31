'use client'

import { useState } from 'react';
import { Search, Package, CheckCircle, Pause, Play, Printer, ArrowRight, ChevronLeft, Layers, FileText, Boxes, Workflow, ChevronDown, ChevronUp } from 'lucide-react';
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

            {/* DiBa Technical Note — always shown in full */}
            {op.diba_note && (
                <div className="mt-2.5 pt-2 border-t border-white/5 flex items-start gap-1.5 text-[11px]">
                    <div className="p-0.5 rounded bg-primary/10 text-primary mt-0.5 flex-shrink-0">
                        <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="leading-relaxed whitespace-pre-line text-zinc-300 font-medium">
                            {op.diba_note}
                        </p>
                    </div>
                </div>
            )}

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
    const [matches, setMatches] = useState<MasterOrderMatch[]>([]);
    const [operations, setOperations] = useState<Operation[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [editions, setEditions] = useState<Edition[]>([]);
    const [isOperationsOpen, setIsOperationsOpen] = useState(false);
    const [isMaterialsOpen, setIsMaterialsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(t.enterSearch);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async () => {
        if (!searchTerm.trim()) {
            setMessage(t.enterSearch);
            setOperations([]);
            setMaterials([]);
            setEditions([]);
            setMatches([]);
            return;
        }

        setLoading(true);
        setError(null);
        setMessage(null);
        setOperations([]);
        setMaterials([]);
        setEditions([]);
        setMatches([]);

        const result = await getOrderOperationsAction(searchTerm);

        if (result.success) {
            if (result.status === 'single') {
                setOperations(result.data);
                setEditions(result.editions);
                setMaterials(result.materials || []);
                setIsOperationsOpen(false);
                setIsMaterialsOpen(false);
                setMatches([]);
                setMessage(null);
            } else if (result.status === 'multiple') {
                setMatches(result.matches);
                setOperations([]);
                setMaterials([]);
                setEditions([]);
                setMessage(null);
            } else {
                setOperations([]);
                setMaterials([]);
                setEditions([]);
                setMatches([]);
                setMessage(result.message);
            }
        } else {
            setError(result.error || APP_COPY.analytics.error);
            setOperations([]);
            setMaterials([]);
            setEditions([]);
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
            setIsOperationsOpen(false);
            setIsMaterialsOpen(false);
        } else {
            setError(result.error || APP_COPY.analytics.error);
        }

        setLoading(false);
    };

    const handleBackToMatches = () => {
        setOperations([]);
        setMaterials([]);
        setEditions([]);
        setIsOperationsOpen(false);
        setIsMaterialsOpen(false);
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

            {/* Back to Multiple Search Results Button */}
            {matches.length > 1 && editions.length > 0 && (
                <div className="flex items-center justify-between">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBackToMatches}
                        className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 h-8 px-3 rounded-xl transition-all shadow-sm"
                    >
                        <ChevronLeft className="w-4 h-4 text-primary" />
                        <span>{t.backToResults} ({matches.length})</span>
                    </Button>
                </div>
            )}

            {/* Multiple Orders Matches Selector - Simple Clean List */}
            {matches.length > 1 && editions.length === 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <p className="text-xs font-semibold text-zinc-400">
                            {t.multipleResultsFound}: <span className="text-white font-bold">{matches.length}</span> — {t.selectOrderToView}
                        </p>
                    </div>

                    <div className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800 bg-card/40 overflow-hidden">
                        {matches.map((m) => (
                            <div
                                key={m.root_commessa_key}
                                onClick={() => handleSelectOrder(m.root_commessa_key)}
                                className="group flex items-center justify-between gap-4 p-3 px-4 hover:bg-zinc-800/50 cursor-pointer transition-colors duration-150"
                            >
                                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                    {/* Order Code Badge */}
                                    <div className="flex flex-col items-center justify-center bg-zinc-800/90 border border-zinc-700/80 rounded-lg px-2.5 py-1 flex-shrink-0 min-w-[64px]">
                                        <span className="text-sm font-bold text-white font-mono leading-tight">
                                            {m.commessa_display}
                                        </span>
                                        <span className="text-[10px] text-zinc-400 font-medium">
                                            20{m.year_code}
                                        </span>
                                    </div>

                                    {/* Order Title & Client */}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-zinc-200 group-hover:text-primary transition-colors truncate">
                                            {m.master_order_title}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
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

                                {/* Action Arrow */}
                                <div className="flex items-center gap-2 flex-shrink-0 text-zinc-500 group-hover:text-primary transition-colors text-xs font-semibold">
                                    <span className="hidden sm:inline">{t.openOrder}</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {/* Order Header */}
            {orderInfo && (
                <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-card/60 p-6 backdrop-blur-sm shadow-xl">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Package className="w-40 h-40" />
                    </div>

                    <div className="flex flex-col gap-5 relative z-10">
                        {/* Top Meta Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="flex w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center flex-shrink-0 text-primary">
                                    <Package className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h2 className="text-2xl font-bold tracking-tight text-white">
                                            {t.orderTitle} <span className="text-primary">{orderInfo.commessa_display}</span>
                                        </h2>
                                        {editions.length > 1 && (
                                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/20 text-primary border border-primary/30 shadow-sm">
                                                {editions.length} {t.editions}
                                            </span>
                                        )}
                                    </div>

                                    {/* Master Order Title from Business ERP */}
                                    {(orderInfo.master_order_title || orderInfo.order_description) && (
                                        <p className="text-xs text-zinc-400 mt-1.5 leading-snug">
                                            <span className="text-zinc-500 font-medium">{t.title}</span>
                                            <span className="text-sm font-semibold text-zinc-100 ml-1">
                                                {orderInfo.master_order_title || orderInfo.order_description}
                                            </span>
                                        </p>
                                    )}

                                    {orderInfo.client_name && (
                                        <p className="text-xs text-zinc-400 mt-1.5">
                                            <span className="text-zinc-500 font-medium">{t.client}</span>
                                            <span className="font-semibold text-zinc-200 ml-1">{orderInfo.client_name}</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Print All Editions Button */}
                            {editions.length > 1 && (
                                <Button
                                    onClick={handlePrintAllEditions}
                                    className="flex items-center gap-2 text-xs font-semibold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-4 rounded-xl"
                                >
                                    <Printer className="w-4 h-4" />
                                    <span>{t.printAllEditions} ({editions.length})</span>
                                </Button>
                            )}
                        </div>

                        {/* Single Edition Display */}
                        {editions.length === 1 && (
                            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-base font-semibold text-white tracking-wide">
                                        {orderInfo.order_description}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 font-mono text-xs border border-zinc-700">
                                        {orderInfo.commessa_full}
                                    </span>
                                    {orderInfo.ordine && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handlePrintCommessa(orderInfo.ordine)}
                                            className="flex items-center gap-2 text-xs h-8 bg-zinc-800 border-zinc-700 hover:bg-primary/20 hover:text-primary hover:border-primary/40 transition-all font-medium text-zinc-200"
                                        >
                                            <Printer className="w-3.5 h-3.5" />
                                            <span>{t.printCommessa}</span>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Multiple Editions Cards Grid */}
                        {editions.length > 1 && (
                            <div className="space-y-2.5">
                                <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                                    <span>{t.editionsList}</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {editions.map((ed, idx) => (
                                        <div
                                            key={idx}
                                            className="group relative flex flex-col justify-between p-4 rounded-xl bg-zinc-900/80 border border-zinc-700/70 hover:border-primary/50 hover:bg-zinc-800/60 transition-all duration-200 shadow-md"
                                        >
                                            <div>
                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-primary/15 text-primary border border-primary/25">
                                                        {t.editionSingle} {idx + 1}
                                                    </span>
                                                    <span className="font-mono text-xs font-bold text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                                                        {ed.commessa_full}
                                                    </span>
                                                </div>
                                                <h3 className="text-sm font-semibold text-white leading-snug group-hover:text-primary transition-colors">
                                                    {ed.order_description}
                                                </h3>
                                            </div>

                                            {ed.ordine && (
                                                <div className="mt-3 pt-3 border-t border-zinc-800/80 flex justify-end">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handlePrintCommessa(ed.ordine)}
                                                        className="w-full flex items-center justify-center gap-2 text-xs py-1.5 h-8 bg-zinc-800/80 border-zinc-700/80 hover:bg-primary/20 hover:text-primary hover:border-primary/40 transition-all font-medium text-zinc-200"
                                                    >
                                                        <Printer className="w-3.5 h-3.5" />
                                                        <span>{t.printCommessa}</span>
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Collapsible Sections: Operations & Materials */}
            {operations.length > 0 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Section 1: Fasi di Lavorazione (Operazioni) */}
                    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md overflow-hidden transition-all duration-300 shadow-xl">
                        <button
                            type="button"
                            onClick={() => setIsOperationsOpen(!isOperationsOpen)}
                            className="w-full p-5 flex items-center justify-between gap-4 text-left hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                        >
                            <div className="flex items-center gap-3.5">
                                <div className="w-10 h-10 rounded-xl bg-info/10 border border-info/25 text-info flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                    <Workflow className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2.5">
                                        <h2 className="text-base font-bold text-white tracking-wide group-hover:text-primary transition-colors">
                                            {t.operationsTab}
                                        </h2>
                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700/80">
                                            {operations.length} {t.operationsCount}
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-400 mt-0.5">
                                        Flusso produttivo parallelo, macchine e avanzamento
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className={`p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 group-hover:text-white transition-all transform duration-300 ${isOperationsOpen ? 'rotate-180 bg-primary/10 border-primary/30 text-primary' : ''}`}>
                                    <ChevronDown className="w-4 h-4" />
                                </div>
                            </div>
                        </button>

                        {isOperationsOpen && (
                            <div className="p-6 pt-4 border-t border-zinc-800/80 space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
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
                    </div>

                    {/* Section 2: Materiali (Distinta Base) */}
                    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md overflow-hidden transition-all duration-300 shadow-xl">
                        <button
                            type="button"
                            onClick={() => setIsMaterialsOpen(!isMaterialsOpen)}
                            className="w-full p-5 flex items-center justify-between gap-4 text-left hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                        >
                            <div className="flex items-center gap-3.5">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                    <Boxes className="w-5 h-5 text-amber-400" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2.5">
                                        <h2 className="text-base font-bold text-white tracking-wide group-hover:text-primary transition-colors">
                                            {t.materialsTab}
                                        </h2>
                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700/80">
                                            {materials.length} {t.materialsCount}
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-400 mt-0.5">
                                        Distinta base, fabbisogno materiali e giacenze di magazzino
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className={`p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 group-hover:text-white transition-all transform duration-300 ${isMaterialsOpen ? 'rotate-180 bg-primary/10 border-primary/30 text-primary' : ''}`}>
                                    <ChevronDown className="w-4 h-4" />
                                </div>
                            </div>
                        </button>

                        {isMaterialsOpen && (
                            <div className="p-6 pt-4 border-t border-zinc-800/80 animate-in fade-in slide-in-from-top-2 duration-300">
                                {materials.length === 0 ? (
                                    <div className="py-8 text-center text-zinc-400 text-sm italic">
                                        {t.noMaterials}
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto rounded-xl border border-zinc-800">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-zinc-950/80 text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                                                <tr>
                                                    <th className="py-3 px-4">{t.materialCode}</th>
                                                    <th className="py-3 px-4">{t.materialDescription}</th>
                                                    <th className="py-3 px-4 text-right">{t.materialQty}</th>
                                                    <th className="py-3 px-4 text-right">{t.materialStock}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/30">
                                                {materials.map((mat, idx) => {
                                                    const isStockSufficient = mat.stock_quantity >= mat.total_quantity;
                                                    return (
                                                        <tr key={idx} className="hover:bg-zinc-800/40 transition-colors">
                                                            <td className="py-3.5 px-4 font-mono font-bold text-xs text-primary">
                                                                {mat.part_number}
                                                            </td>
                                                            <td className="py-3.5 px-4 font-medium text-zinc-200">
                                                                {mat.description}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-right font-mono font-bold text-zinc-100 whitespace-nowrap">
                                                                {new Intl.NumberFormat('it-IT').format(mat.total_quantity)}{' '}
                                                                <span className="text-xs font-normal text-zinc-400">{mat.unit_of_measure}</span>
                                                            </td>
                                                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold ${
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
                        )}
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
