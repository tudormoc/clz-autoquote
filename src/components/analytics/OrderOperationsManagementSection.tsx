'use client'

/**
 * ORDER OPERATIONS MANAGEMENT SECTION
 * 
 * Collapsible section displaying and comparing operations & materials from:
 * 1. Distinta Base (cicli & movdis in ERP Business DB COOPZANARDI)
 * 2. Ordine di Produzione (OPERAZIONI & MATERIALI_ORDINI in NETPRO DB, and movord Y / attivit in BUSINESS)
 * 
 * Includes one-click in-place synchronization from DiBa (Single Source of Truth)
 * keeping order IDs intact with zero duplicate orders.
 */

import { useState, useEffect, useMemo } from 'react';
import { 
    Layers, 
    RefreshCw, 
    ChevronDown, 
    Check, 
    AlertCircle, 
    FileText,
    Boxes,
    Cpu,
    ArrowLeftRight,
    Package,
    AlertTriangle,
    CheckCircle2,
    Sparkles,
    X
} from 'lucide-react';
import { 
    OrderOperationsManagementData, 
    DibaOperationRow, 
    OrderProductionOperationRow,
    DibaMaterialRow,
    OrderMaterialSummaryRow
} from '@/types';
import { 
    refreshOrderOperationsManagementAction,
    syncOrderFromDibaAction
} from '@/app/analytics/queries/order-operations-queries';
import { APP_COPY } from '@/locales';

interface EditionItem {
    commessa_display?: string;
    commessa_full: string;
    ordine?: string;
    part_number?: string;
    order_description?: string;
}

interface OrderOperationsManagementSectionProps {
    operationsManagement: OrderOperationsManagementData;
    rootCommessaKey?: string;
    editions?: EditionItem[];
}

type ActiveTab = 'diba' | 'order' | 'comparison' | 'materials';

/** Status style mapping for NetPro operations */
const getNetproStatusBadge = (stato: string) => {
    switch (stato) {
        case 'EXE':
            return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
        case 'SUS':
            return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
        case 'COM':
            return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
        case 'REL':
            return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
        default:
            return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
};

export function OrderOperationsManagementSection({
    operationsManagement,
    rootCommessaKey,
    editions = []
}: OrderOperationsManagementSectionProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<ActiveTab>('diba');
    const [data, setData] = useState<OrderOperationsManagementData>(operationsManagement);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showSyncConfirm, setShowSyncConfirm] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

    const t = APP_COPY.analytics.orderOperations;

    // Sync state when prop changes
    useEffect(() => {
        setData(operationsManagement);
    }, [operationsManagement]);

    // Auto-dismiss feedback after 5 seconds
    useEffect(() => {
        if (!feedback) return;
        const timer = setTimeout(() => setFeedback(null), 5000);
        return () => clearTimeout(timer);
    }, [feedback]);

    // Handle refresh
    const handleRefresh = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!rootCommessaKey) return;

        setIsRefreshing(true);
        setFeedback(null);

        try {
            const res = await refreshOrderOperationsManagementAction(rootCommessaKey, data.article_father);
            if (res.success && res.operationsManagement) {
                setData(res.operationsManagement);
            } else {
                setFeedback({ type: 'error', message: res.error || t.errorSaving });
            }
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.message || t.errorSaving });
        } finally {
            setIsRefreshing(false);
        }
    };

    // Handle Sync from DiBa
    const handleSyncFromDiba = async () => {
        if (!rootCommessaKey) return;

        setIsSyncing(true);
        setFeedback(null);

        try {
            const res = await syncOrderFromDibaAction({
                rootCommessaKey,
                articleFather: data.article_father
            });

            if (res.success) {
                setFeedback({ type: 'success', message: res.message || t.syncSuccess });
                setShowSyncConfirm(false);
                // Refresh data immediately
                const refRes = await refreshOrderOperationsManagementAction(rootCommessaKey, data.article_father);
                if (refRes.success && refRes.operationsManagement) {
                    setData(refRes.operationsManagement);
                }
            } else {
                setFeedback({ type: 'error', message: res.error || t.errorSaving });
            }
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.message || t.errorSaving });
        } finally {
            setIsSyncing(false);
        }
    };

    const dibaOps = useMemo(() => data?.diba_operations || [], [data?.diba_operations]);
    const orderOps = useMemo(() => data?.order_operations || [], [data?.order_operations]);
    const dibaMats = useMemo(() => data?.diba_materials || [], [data?.diba_materials]);
    const orderMats = useMemo(() => data?.order_materials || [], [data?.order_materials]);
    const fatherQuant = useMemo(() => data?.order_father_quant || 1000, [data?.order_father_quant]);

    // Aligned comparison rows by fase/sequenza
    const comparisonRows = useMemo(() => {
        const map = new Map<number, {
            fase: number;
            diba?: DibaOperationRow;
            order?: OrderProductionOperationRow;
        }>();

        for (const op of dibaOps) {
            if (!map.has(op.fase)) {
                map.set(op.fase, { fase: op.fase });
            }
            map.get(op.fase)!.diba = op;
        }

        for (const op of orderOps) {
            if (!map.has(op.sequenza)) {
                map.set(op.sequenza, { fase: op.sequenza });
            }
            map.get(op.sequenza)!.order = op;
        }

        return Array.from(map.values()).sort((a, b) => a.fase - b.fase);
    }, [dibaOps, orderOps]);

    // Materials comparison
    const materialsComparison = useMemo(() => {
        const map = new Map<string, {
            part_number: string;
            description: string;
            unmis: string;
            expectedQuant: number;
            actualQuant: number;
            diff: number;
            status: 'MATCH' | 'DIFF' | 'DIBA_ONLY' | 'ORDER_ONLY';
        }>();

        for (const dm of dibaMats) {
            const exp = (fatherQuant * dm.quant) / (dm.perpz || 1000);
            map.set(dm.codfigli, {
                part_number: dm.codfigli,
                description: dm.description,
                unmis: dm.unmis,
                expectedQuant: exp,
                actualQuant: 0,
                diff: -exp,
                status: 'DIBA_ONLY'
            });
        }

        for (const om of orderMats) {
            if (map.has(om.part_number)) {
                const item = map.get(om.part_number)!;
                item.actualQuant = om.quant;
                item.diff = om.quant - item.expectedQuant;
                item.status = Math.abs(item.diff) < 0.001 ? 'MATCH' : 'DIFF';
            } else {
                map.set(om.part_number, {
                    part_number: om.part_number,
                    description: om.description,
                    unmis: om.unmis,
                    expectedQuant: 0,
                    actualQuant: om.quant,
                    diff: om.quant,
                    status: 'ORDER_ONLY'
                });
            }
        }

        return Array.from(map.values()).sort((a, b) => {
            if (a.status !== 'MATCH' && b.status === 'MATCH') return -1;
            if (a.status === 'MATCH' && b.status !== 'MATCH') return 1;
            return a.part_number.localeCompare(b.part_number);
        });
    }, [dibaMats, orderMats, fatherQuant]);

    const hasDiscrepancies = data?.has_discrepancies || false;
    const discrepancyCount = data?.discrepancy_count || 0;

    return (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md overflow-hidden transition-all duration-300 shadow-xl relative">
            {/* Collapsible Header */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-5 flex items-center justify-between gap-4 text-left hover:bg-zinc-800/40 transition-colors cursor-pointer group"
            >
                <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/25 text-purple-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                        <Layers className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-base font-bold text-white tracking-wide group-hover:text-primary transition-colors">
                                {t.operationsManagementTab}
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700/80">
                                {dibaOps.length} DiBa / {orderOps.length} NetPro
                            </span>

                            {/* Discrepancy Status Badge in Header */}
                            {hasDiscrepancies ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                    <span>{t.dibaDiscrepanciesDetected.replace('{count}', String(discrepancyCount))}</span>
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    <Check className="w-3.5 h-3.5" />
                                    <span>{t.dibaAligned}</span>
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            {t.operationsManagementSubtitle}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Sync Button */}
                    {hasDiscrepancies && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowSyncConfirm(true);
                            }}
                            title={t.syncButton}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 text-xs font-bold transition-all shadow-sm cursor-pointer"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>{t.syncButton}</span>
                        </div>
                    )}

                    {/* Silent Refresh Button */}
                    <div
                        onClick={handleRefresh}
                        title={t.refreshData}
                        className={`p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition-all ${
                            isRefreshing ? 'opacity-70 pointer-events-none' : ''
                        }`}
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-purple-400' : ''}`} />
                    </div>

                    <div className={`p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 group-hover:text-white transition-all transform duration-300 ${isOpen ? 'rotate-180 bg-primary/10 border-primary/30 text-primary' : ''}`}>
                        <ChevronDown className="w-4 h-4" />
                    </div>
                </div>
            </button>

            {/* Feedback Banners */}
            {feedback && (
                <div className={`px-5 py-2.5 border-t text-xs flex items-center justify-between gap-2 ${
                    feedback.type === 'error'
                        ? 'bg-destructive/10 border-destructive/20 text-destructive'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}>
                    <div className="flex items-center gap-2">
                        {feedback.type === 'error' ? (
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        )}
                        <span>{feedback.message}</span>
                    </div>
                    <button 
                        type="button" 
                        onClick={() => setFeedback(null)} 
                        className="p-1 hover:bg-zinc-800/40 rounded"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {isOpen && (
                <div className="p-6 pt-4 border-t border-zinc-800/80 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Metadata Header Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                                    <Boxes className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                                        {t.dibaArticleFather}
                                    </p>
                                    <p className="text-sm font-bold font-mono text-zinc-100 mt-0.5">
                                        {data.article_father || '-'}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                                    {dibaOps.length} {t.totalOperations}
                                </span>
                                <p className="text-[10px] text-zinc-500 mt-1 font-mono">
                                    {dibaMats.length} materiali DiBa
                                </p>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                    <Cpu className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                                        {t.prodOrderDocTitle} (NetPro / Business #{data.order_bus_numord || '-'})
                                    </p>
                                    <p className="text-sm font-bold font-mono text-zinc-100 mt-0.5">
                                        {data.ordine_netpro || (editions.length > 0 && editions[0].ordine) || '-'}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                                    {orderOps.length} {t.totalOperations}
                                </span>
                                <p className="text-[10px] text-zinc-500 mt-1 font-mono">
                                    {orderMats.length} materiali ordine
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Discrepancy Action Banner */}
                    {hasDiscrepancies && (
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 flex-shrink-0">
                                <AlertTriangle className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-amber-200">
                                    Rilevate {discrepancyCount} differenze rispetto alla Distinta Base
                                </h4>
                                <p className="text-xs text-amber-400/80 mt-0.5">
                                    La DiBa contiene modifiche a lavorazioni o materiali non ancora allineate agli ordini attivi. Usa il pulsante <strong className="text-amber-300">Riallinea</strong> in alto per sincronizzarle in-place senza duplicare l'ordine.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Sub-Tabs Selector */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                        <div className="flex items-center gap-2 p-1 bg-zinc-950/80 rounded-xl border border-zinc-800">
                            <button
                                type="button"
                                onClick={() => setActiveTab('diba')}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    activeTab === 'diba'
                                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm'
                                        : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                <Boxes className="w-3.5 h-3.5" />
                                <span>{t.dibaTab}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300">
                                    {dibaOps.length}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('order')}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    activeTab === 'order'
                                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-sm'
                                        : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                <Cpu className="w-3.5 h-3.5" />
                                <span>{t.prodOrderOpsTab}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300">
                                    {orderOps.length}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('comparison')}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    activeTab === 'comparison'
                                        ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm'
                                        : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                                <span>{t.comparisonTab}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300">
                                    {comparisonRows.length}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('materials')}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    activeTab === 'materials'
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                                        : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                <Package className="w-3.5 h-3.5" />
                                <span>{t.dibaMaterialsTab}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300">
                                    {materialsComparison.length}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* TAB 1: DISTINTA BASE COMPACT TABLE */}
                    {activeTab === 'diba' && (
                        <div className="space-y-3">
                            {dibaOps.length === 0 ? (
                                <div className="py-8 text-center text-zinc-400 text-sm italic">
                                    {t.noDibaOperations}
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                                    <table className="w-full text-left text-xs font-sans">
                                        <thead className="bg-zinc-950/80 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                                            <tr>
                                                <th className="py-2.5 px-3 w-16 text-center">{t.dibaRow}</th>
                                                <th className="py-2.5 px-3 w-16 text-center">{t.dibaFase}</th>
                                                <th className="py-2.5 px-3 w-14 text-center">{t.dibaLav}</th>
                                                <th className="py-2.5 px-3">{t.dibaDescrLav}</th>
                                                <th className="py-2.5 px-3">{t.dibaTerzista}</th>
                                                <th className="py-2.5 px-3 w-16 text-center">{t.dibaCentro}</th>
                                                <th className="py-2.5 px-3">{t.dibaDescrCentro}</th>
                                                <th className="py-2.5 px-3 max-w-[320px]">{t.dibaNote}</th>
                                                <th className="py-2.5 px-3 text-right w-16">{t.dibaTEsec}</th>
                                                <th className="py-2.5 px-3 text-right w-16">{t.dibaPerQta}</th>
                                                <th className="py-2.5 px-3 text-center w-12">{t.dibaAggRiga}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/30">
                                            {dibaOps.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-zinc-800/40 transition-colors">
                                                    <td className="py-2 px-3 text-center font-mono font-medium text-zinc-300">
                                                        {row.riga.toFixed(4)}
                                                    </td>
                                                    <td className="py-2 px-3 text-center font-mono font-bold text-primary">
                                                        {row.fase}
                                                    </td>
                                                    <td className="py-2 px-3 text-center font-mono text-zinc-300">
                                                        {row.codlavo}
                                                    </td>
                                                    <td className="py-2 px-3 font-semibold text-zinc-100 whitespace-nowrap">
                                                        {row.descr_lavor}
                                                    </td>
                                                    <td className="py-2 px-3 whitespace-nowrap">
                                                        <span className="text-[11px] text-zinc-400">
                                                            {row.terzista}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3 text-center font-mono text-zinc-300">
                                                        {row.codcent}
                                                    </td>
                                                    <td className="py-2 px-3 text-zinc-300 whitespace-nowrap">
                                                        {row.descr_centro}
                                                    </td>
                                                    <td className="py-2 px-3 text-zinc-300 max-w-[320px]">
                                                        {row.note ? (
                                                            <div className="flex items-start gap-1">
                                                                <FileText className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                                                                <span className="leading-snug break-words text-[11px]">
                                                                    {row.note}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-zinc-600">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-mono text-zinc-400">
                                                        {row.tesec.toFixed(4)}
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-mono text-zinc-300">
                                                        {row.perqta.toFixed(2)}
                                                    </td>
                                                    <td className="py-2 px-3 text-center">
                                                        {row.aggriga === 'S' ? (
                                                            <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-emerald-500/20 text-emerald-400">
                                                                <Check className="w-3 h-3" />
                                                            </span>
                                                        ) : (
                                                            <span className="text-zinc-600">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: ORDINE DI PRODUZIONE (NETPRO) COMPACT TABLE */}
                    {activeTab === 'order' && (
                        <div className="space-y-3">
                            {orderOps.length === 0 ? (
                                <div className="py-8 text-center text-zinc-400 text-sm italic">
                                    {t.noOrderOperations}
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                                    <table className="w-full text-left text-xs font-sans">
                                        <thead className="bg-zinc-950/80 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                                            <tr>
                                                <th className="py-2.5 px-3 w-16 text-center">{t.orderSeq}</th>
                                                <th className="py-2.5 px-3">{t.orderOperation}</th>
                                                <th className="py-2.5 px-3 w-20 text-center">{t.orderStatus}</th>
                                                <th className="py-2.5 px-3 w-20 text-center">{t.orderCenter}</th>
                                                <th className="py-2.5 px-3">{t.orderMachine}</th>
                                                <th className="py-2.5 px-3">{t.orderArea}</th>
                                                <th className="py-2.5 px-3 max-w-[320px]">{t.dibaNote}</th>
                                                <th className="py-2.5 px-3 font-mono text-[10px]">{t.orderId}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/30">
                                            {orderOps.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-zinc-800/40 transition-colors">
                                                    <td className="py-2 px-3 text-center font-mono font-bold text-blue-400">
                                                        {row.sequenza}
                                                    </td>
                                                    <td className="py-2 px-3 font-semibold text-zinc-100 whitespace-nowrap">
                                                        {row.descrizione}
                                                    </td>
                                                    <td className="py-2 px-3 text-center whitespace-nowrap">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getNetproStatusBadge(row.stato)}`}>
                                                            {row.stato}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3 text-center font-mono text-zinc-300">
                                                        {row.centro_assegnato || '-'}
                                                    </td>
                                                    <td className="py-2 px-3 text-zinc-200 font-medium whitespace-nowrap">
                                                        {row.machine_name || row.machine_code || '-'}
                                                    </td>
                                                    <td className="py-2 px-3 whitespace-nowrap text-zinc-400 text-[11px]">
                                                        {row.area_name}
                                                    </td>
                                                    <td className="py-2 px-3 text-zinc-300 max-w-[320px]">
                                                        {row.note ? (
                                                            <div className="flex items-start gap-1">
                                                                <FileText className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
                                                                <span className="leading-snug break-words text-[11px]">
                                                                    {row.note}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-zinc-600">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3 font-mono text-[10px] text-zinc-500 whitespace-nowrap">
                                                        {row.id_oper}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 3: CONFRONTO ALLINEATO OPERAZIONI */}
                    {activeTab === 'comparison' && (
                        <div className="space-y-3">
                            <div className="overflow-x-auto rounded-xl border border-zinc-800">
                                <table className="w-full text-left text-xs font-sans">
                                    <thead className="bg-zinc-950/80 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                                        <tr>
                                            <th className="py-2.5 px-3 w-16 text-center">Fase/Seq</th>
                                            <th className="py-2.5 px-3">Distinta Base (ERP)</th>
                                            <th className="py-2.5 px-3">Centro DiBa</th>
                                            <th className="py-2.5 px-3">Ordine Produzione (NetPro)</th>
                                            <th className="py-2.5 px-3">Macchina NetPro</th>
                                            <th className="py-2.5 px-3 w-20 text-center">Stato</th>
                                            <th className="py-2.5 px-3 w-24 text-center">{t.alignedStatus}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/30">
                                        {comparisonRows.map((row, idx) => {
                                            const hasDiba = !!row.diba;
                                            const hasOrder = !!row.order;
                                            const isAligned = hasDiba && hasOrder;

                                            return (
                                                <tr key={idx} className="hover:bg-zinc-800/40 transition-colors">
                                                    <td className="py-2 px-3 text-center font-mono font-bold text-zinc-100">
                                                        {row.fase}
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        {row.diba ? (
                                                            <div className="font-semibold text-zinc-100">
                                                                {row.diba.descr_lavor}
                                                                <span className="ml-1.5 text-[10px] text-zinc-500 font-mono">
                                                                    (Lav: {row.diba.codlavo})
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-zinc-600 italic">Non presente in DiBa</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3 text-zinc-300">
                                                        {row.diba ? (
                                                            <span className="text-xs">
                                                                {row.diba.descr_centro || `Centro ${row.diba.codcent}`}
                                                            </span>
                                                        ) : (
                                                            <span className="text-zinc-600">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        {row.order ? (
                                                            <div className="font-semibold text-zinc-100">
                                                                {row.order.descrizione}
                                                            </div>
                                                        ) : (
                                                            <span className="text-zinc-600 italic">Non presente in Ordine</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3 text-zinc-300">
                                                        {row.order ? (
                                                            <span className="text-xs">
                                                                {row.order.machine_name || row.order.machine_code || '-'}
                                                            </span>
                                                        ) : (
                                                            <span className="text-zinc-600">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3 text-center">
                                                        {row.order ? (
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getNetproStatusBadge(row.order.stato)}`}>
                                                                {row.order.stato}
                                                            </span>
                                                        ) : (
                                                            <span className="text-zinc-600">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3 text-center">
                                                        {isAligned ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                {t.statusAligned}
                                                            </span>
                                                        ) : hasDiba ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                                {t.statusOnlyDiba}
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                                {t.statusOnlyOrder}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: CONFRONTO MATERIALI (DIBA VS ORDINE) */}
                    {activeTab === 'materials' && (
                        <div className="space-y-3">
                            {materialsComparison.length === 0 ? (
                                <div className="py-8 text-center text-zinc-400 text-sm italic">
                                    Nessun materiale configurato per questo articolo.
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                                    <table className="w-full text-left text-xs font-sans">
                                        <thead className="bg-zinc-950/80 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                                            <tr>
                                                <th className="py-2.5 px-3">Codice Materiale</th>
                                                <th className="py-2.5 px-3">Descrizione</th>
                                                <th className="py-2.5 px-3 w-16 text-center">U.M.</th>
                                                <th className="py-2.5 px-3 text-right w-28">{t.expectedQty}</th>
                                                <th className="py-2.5 px-3 text-right w-28">{t.actualQty}</th>
                                                <th className="py-2.5 px-3 text-right w-24">Differenza</th>
                                                <th className="py-2.5 px-3 w-28 text-center">{t.alignedStatus}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/30">
                                            {materialsComparison.map((row, idx) => {
                                                const isMatch = row.status === 'MATCH';
                                                const isDiff = row.status === 'DIFF';
                                                const isDibaOnly = row.status === 'DIBA_ONLY';
                                                const isOrderOnly = row.status === 'ORDER_ONLY';

                                                return (
                                                    <tr key={idx} className="hover:bg-zinc-800/40 transition-colors">
                                                        <td className="py-2 px-3 font-mono font-bold text-zinc-100">
                                                            {row.part_number}
                                                        </td>
                                                        <td className="py-2 px-3 text-zinc-200">
                                                            {row.description}
                                                        </td>
                                                        <td className="py-2 px-3 text-center text-zinc-400 font-mono">
                                                            {row.unmis || '-'}
                                                        </td>
                                                        <td className="py-2 px-3 text-right font-mono font-semibold text-purple-300">
                                                            {row.expectedQuant.toLocaleString('it-IT')}
                                                        </td>
                                                        <td className="py-2 px-3 text-right font-mono font-semibold text-blue-300">
                                                            {row.actualQuant.toLocaleString('it-IT')}
                                                        </td>
                                                        <td className={`py-2 px-3 text-right font-mono font-bold ${
                                                            isMatch ? 'text-zinc-500' : 'text-amber-400'
                                                        }`}>
                                                            {row.diff > 0 ? `+${row.diff.toLocaleString('it-IT')}` : row.diff.toLocaleString('it-IT')}
                                                        </td>
                                                        <td className="py-2 px-3 text-center">
                                                            {isMatch ? (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                    {t.statusAligned}
                                                                </span>
                                                            ) : isDiff ? (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                                    Q.tà Diversa
                                                                </span>
                                                            ) : isDibaOnly ? (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                                    {t.statusOnlyDiba}
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                                    {t.statusOnlyOrder}
                                                                </span>
                                                            )}
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
            )}

            {/* SYNC CONFIRMATION MODAL */}
            {showSyncConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-200">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300">
                                    <Sparkles className="w-6 h-6 text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-zinc-100">
                                        {t.syncConfirmTitle}
                                    </h3>
                                    <p className="text-xs text-zinc-400 mt-0.5">
                                        Commessa: <span className="font-mono text-zinc-200">{rootCommessaKey}</span> | Articolo: <span className="font-mono text-zinc-200">{data.article_father}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowSyncConfirm(false)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/60 p-4 rounded-xl border border-zinc-800 space-y-3">
                            <p className="font-medium text-zinc-200">
                                {t.syncConfirmDescription}
                            </p>
                            <ul className="space-y-1.5 text-zinc-400 list-disc list-inside">
                                <li>
                                    <strong className="text-zinc-200">Business Cube ERP:</strong> aggiorna le <span className="text-purple-300">Lavorazioni collegate</span> (fasi attive) e gli <span className="text-emerald-300">Impegni collegati</span> (materiali).
                                </li>
                                <li>
                                    <strong className="text-zinc-200">NetPro MES:</strong> aggiorna istantaneamente <span className="text-blue-300">OPERAZIONI</span> e <span className="text-blue-300">MATERIALI_ORDINI</span> per i reparti.
                                </li>
                                <li>
                                    <strong className="text-zinc-200">Nessuna duplicazione:</strong> gli ordini mantengono lo stesso identico ID (#671). L'inventario rimane invariato fino al completamento.
                                </li>
                            </ul>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowSyncConfirm(false)}
                                disabled={isSyncing}
                                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                                {t.cancel}
                            </button>

                            <button
                                type="button"
                                onClick={handleSyncFromDiba}
                                disabled={isSyncing}
                                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 text-zinc-950 hover:bg-amber-400 text-xs font-bold transition-all shadow-lg disabled:opacity-50"
                            >
                                {isSyncing ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        <span>{t.syncing}</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-3.5 h-3.5" />
                                        <span>{t.syncConfirmButton}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
