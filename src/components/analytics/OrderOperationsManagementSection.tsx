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
    RefreshCw, 
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
import { compareOperations, compareMaterials, type OpField } from '@/lib/orderCompare';

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
    /** Reports DiBa alignment so the parent can show it on the tab label */
    onStatusChange?: (hasDiscrepancies: boolean, count: number) => void;
}

type ActiveTab = 'diba' | 'order' | 'comparison' | 'materials';

const hl = (bad?: boolean) => (bad ? 'text-amber-300 bg-amber-500/15 rounded px-1 -mx-1' : '');

/** Compact phase cell: lavorazione · centro · note, with mismatching parts highlighted */
const OpCell = ({ lav, code, centro, centroDescr, note, badLav, badCentro, badNote }: {
    lav?: string; code?: number; centro?: string | number; centroDescr?: string; note?: string;
    badLav?: boolean; badCentro?: boolean; badNote?: boolean;
}) => (
    <div className="leading-tight min-w-0">
        <p className="font-semibold text-zinc-100 truncate" title={lav}>
            <span className={hl(badLav)}>{lav || '-'}</span>
            {code !== undefined && <span className="ml-1 text-[10px] text-zinc-500 font-mono">({code})</span>}
        </p>
        <p className="text-[11px] text-zinc-400 truncate" title={centroDescr}>
            <span className={hl(badCentro)}>{centro || '-'}{centroDescr ? ` · ${centroDescr}` : ''}</span>
        </p>
        {(note || badNote) && (
            <p className="text-[11px] text-zinc-500 truncate max-w-[300px] flex items-center gap-1" title={note}>
                <FileText className="w-3 h-3 flex-shrink-0" />
                <span className={hl(badNote)}>{note || '(nessuna nota)'}</span>
            </p>
        )}
    </div>
);

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
    editions = [],
    onStatusChange
}: OrderOperationsManagementSectionProps) {
    const [activeTab, setActiveTab] = useState<ActiveTab>('comparison');
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
            const res = await refreshOrderOperationsManagementAction(rootCommessaKey, data.article_father, data.commessa_full);
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

    // Switch edition (multi-edition orders): reload the panel scoped to that edition
    const handleSelectEdition = async (commessaFull: string) => {
        if (!rootCommessaKey || commessaFull === data.commessa_full) return;
        setIsRefreshing(true);
        setFeedback(null);
        try {
            const res = await refreshOrderOperationsManagementAction(rootCommessaKey, undefined, commessaFull);
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
                const refRes = await refreshOrderOperationsManagementAction(rootCommessaKey, data.article_father, data.commessa_full);
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

    const busOps = useMemo(() => data?.business_operations || [], [data?.business_operations]);
    const netMats = useMemo(() => data?.netpro_materials || [], [data?.netpro_materials]);

    // 3-way comparison DiBa -> Business order -> NetPro order (same logic as the server-side count)
    const comparisonRows = useMemo(() => compareOperations(dibaOps, busOps, orderOps), [dibaOps, busOps, orderOps]);
    const materialsComparison = useMemo(
        () => compareMaterials(dibaMats, orderMats, netMats, fatherQuant),
        [dibaMats, orderMats, netMats, fatherQuant]
    );
    const isMultiEdition = editions.length > 1;

    const hasDiscrepancies = data?.has_discrepancies || false;
    const discrepancyCount = data?.discrepancy_count || 0;

    useEffect(() => {
        onStatusChange?.(hasDiscrepancies, discrepancyCount);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasDiscrepancies, discrepancyCount]);

    const subTabClass = (id: ActiveTab, active: string) =>
        `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === id ? `${active} border shadow-sm` : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
        }`;

    return (
        <div className="space-y-3">
            {/* Toolbar: sub-tabs · document info · status · actions — one line */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-1 p-1 bg-zinc-950/80 rounded-xl border border-zinc-800">
                    <button type="button" onClick={() => setActiveTab('comparison')} className={subTabClass('comparison', 'bg-primary/20 text-primary border-primary/30')}>
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>{t.comparisonTab}</span>
                        <span className="text-[10px] px-1.5 rounded-full bg-zinc-800 text-zinc-300">{comparisonRows.length}</span>
                    </button>
                    <button type="button" onClick={() => setActiveTab('materials')} className={subTabClass('materials', 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30')}>
                        <Package className="w-3.5 h-3.5" />
                        <span>{t.dibaMaterialsTab}</span>
                        <span className="text-[10px] px-1.5 rounded-full bg-zinc-800 text-zinc-300">{materialsComparison.length}</span>
                    </button>
                    <button type="button" onClick={() => setActiveTab('diba')} className={subTabClass('diba', 'bg-purple-500/20 text-purple-300 border-purple-500/30')}>
                        <Boxes className="w-3.5 h-3.5" />
                        <span>{t.dibaTab}</span>
                        <span className="text-[10px] px-1.5 rounded-full bg-zinc-800 text-zinc-300">{dibaOps.length}</span>
                    </button>
                    <button type="button" onClick={() => setActiveTab('order')} className={subTabClass('order', 'bg-blue-500/20 text-blue-300 border-blue-500/30')}>
                        <Cpu className="w-3.5 h-3.5" />
                        <span>{t.prodOrderOpsTab}</span>
                        <span className="text-[10px] px-1.5 rounded-full bg-zinc-800 text-zinc-300">{orderOps.length}</span>
                    </button>
                </div>

                {isMultiEdition && (
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] uppercase text-zinc-500 font-semibold mr-1">{t.editions}</span>
                        {editions.map((ed, idx) => (
                            <button
                                key={ed.commessa_full}
                                type="button"
                                onClick={() => handleSelectEdition(ed.commessa_full)}
                                disabled={isRefreshing}
                                title={ed.order_description}
                                className={`px-2 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-colors ${
                                    data.commessa_full === ed.commessa_full
                                        ? 'bg-primary/20 text-primary border-primary/40'
                                        : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                                }`}
                            >
                                {idx + 1} · {ed.commessa_full}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-4 text-xs">
                    <div title={`${dibaOps.length} ${t.totalOperations} · ${dibaMats.length} materiali DiBa`}>
                        <span className="text-[10px] uppercase text-zinc-500 font-semibold">{t.dibaArticleFather} </span>
                        <span className="font-mono font-bold text-zinc-100">{data.article_father || '-'}</span>
                    </div>
                    <div title={`${orderOps.length} ${t.totalOperations} · ${orderMats.length} materiali ordine`}>
                        <span className="text-[10px] uppercase text-zinc-500 font-semibold">NetPro </span>
                        <span className="font-mono font-bold text-zinc-100">{data.ordine_netpro || (editions.length > 0 && editions[0].ordine) || '-'}</span>
                        <span className="text-zinc-500"> · Business #{data.order_bus_numord || '-'}</span>
                    </div>
                </div>

                <div className="ml-auto flex items-center gap-2">
                    {hasDiscrepancies ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            <span>{t.dibaDiscrepanciesDetected.replace('{count}', String(discrepancyCount))}</span>
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <Check className="w-3.5 h-3.5" />
                            <span>{t.dibaAligned}</span>
                        </span>
                    )}

                    {hasDiscrepancies && (
                        <button
                            type="button"
                            onClick={() => setShowSyncConfirm(true)}
                            disabled={isSyncing || isMultiEdition}
                            title={isMultiEdition ? 'Riallineamento non ancora disponibile per ordini con più edizioni' : t.syncButton}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 transition-colors shadow disabled:opacity-50"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{isSyncing ? t.syncing : t.syncButton}</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        title={t.refreshData}
                        className="p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition-all disabled:opacity-70"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-purple-400' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Feedback Banner */}
            {feedback && (
                <div className={`px-3 py-2 rounded-lg border text-xs flex items-center justify-between gap-2 ${
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

            {(
                <div>
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
                                                <th className="py-2 px-3 w-16 text-center">{t.dibaRow}</th>
                                                <th className="py-2 px-3 w-16 text-center">{t.dibaFase}</th>
                                                <th className="py-2 px-3 w-14 text-center">{t.dibaLav}</th>
                                                <th className="py-2 px-3">{t.dibaDescrLav}</th>
                                                <th className="py-2 px-3">{t.dibaTerzista}</th>
                                                <th className="py-2 px-3 w-16 text-center">{t.dibaCentro}</th>
                                                <th className="py-2 px-3">{t.dibaDescrCentro}</th>
                                                <th className="py-2 px-3 max-w-[320px]">{t.dibaNote}</th>
                                                <th className="py-2 px-3 text-right w-16">{t.dibaTEsec}</th>
                                                <th className="py-2 px-3 text-right w-16">{t.dibaPerQta}</th>
                                                <th className="py-2 px-3 text-center w-12">{t.dibaAggRiga}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/30">
                                            {dibaOps.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-zinc-800/40 transition-colors">
                                                    <td className="py-1 px-3 text-center font-mono font-medium text-zinc-300">
                                                        {row.riga.toFixed(4)}
                                                    </td>
                                                    <td className="py-1 px-3 text-center font-mono font-bold text-primary">
                                                        {row.fase}
                                                    </td>
                                                    <td className="py-1 px-3 text-center font-mono text-zinc-300">
                                                        {row.codlavo}
                                                    </td>
                                                    <td className="py-1 px-3 font-semibold text-zinc-100 whitespace-nowrap">
                                                        {row.descr_lavor}
                                                    </td>
                                                    <td className="py-1 px-3 whitespace-nowrap">
                                                        <span className="text-[11px] text-zinc-400">
                                                            {row.terzista}
                                                        </span>
                                                    </td>
                                                    <td className="py-1 px-3 text-center font-mono text-zinc-300">
                                                        {row.codcent}
                                                    </td>
                                                    <td className="py-1 px-3 text-zinc-300 whitespace-nowrap">
                                                        {row.descr_centro}
                                                    </td>
                                                    <td className="py-1 px-3 text-zinc-300 max-w-[320px]">
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
                                                    <td className="py-1 px-3 text-right font-mono text-zinc-400">
                                                        {row.tesec.toFixed(4)}
                                                    </td>
                                                    <td className="py-1 px-3 text-right font-mono text-zinc-300">
                                                        {row.perqta.toFixed(2)}
                                                    </td>
                                                    <td className="py-1 px-3 text-center">
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
                                                <th className="py-2 px-3 w-16 text-center">{t.orderSeq}</th>
                                                <th className="py-2 px-3">{t.orderOperation}</th>
                                                <th className="py-2 px-3 w-20 text-center">{t.orderStatus}</th>
                                                <th className="py-2 px-3 w-20 text-center">{t.orderCenter}</th>
                                                <th className="py-2 px-3">{t.orderMachine}</th>
                                                <th className="py-2 px-3">{t.orderArea}</th>
                                                <th className="py-2 px-3 max-w-[320px]">{t.dibaNote}</th>
                                                <th className="py-2 px-3 font-mono text-[10px]">{t.orderId}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/30">
                                            {orderOps.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-zinc-800/40 transition-colors">
                                                    <td className="py-1 px-3 text-center font-mono font-bold text-blue-400">
                                                        {row.sequenza}
                                                    </td>
                                                    <td className="py-1 px-3 font-semibold text-zinc-100 whitespace-nowrap">
                                                        {row.descrizione}
                                                    </td>
                                                    <td className="py-1 px-3 text-center whitespace-nowrap">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getNetproStatusBadge(row.stato)}`}>
                                                            {row.stato}
                                                        </span>
                                                    </td>
                                                    <td className="py-1 px-3 text-center font-mono text-zinc-300">
                                                        {row.centro_assegnato || '-'}
                                                    </td>
                                                    <td className="py-1 px-3 text-zinc-200 font-medium whitespace-nowrap">
                                                        {row.machine_name || row.machine_code || '-'}
                                                    </td>
                                                    <td className="py-1 px-3 whitespace-nowrap text-zinc-400 text-[11px]">
                                                        {row.area_name}
                                                    </td>
                                                    <td className="py-1 px-3 text-zinc-300 max-w-[320px]">
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
                                                    <td className="py-1 px-3 font-mono text-[10px] text-zinc-500 whitespace-nowrap">
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

                    {/* TAB 3: CONFRONTO FASI — DiBa (truth) → Ordine Business → Ordine NetPro */}
                    {activeTab === 'comparison' && (
                        <div className="rounded-xl border border-zinc-800 overflow-x-auto">
                            <table className="w-full text-left text-xs font-sans">
                                <thead className="bg-zinc-950/80 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                                    <tr>
                                        <th className="py-2 px-3 w-14 text-center">Fase</th>
                                        <th className="py-2 px-3 text-purple-300">Distinta Base</th>
                                        <th className="py-2 px-3 text-amber-200">Ordine Business #{data.order_bus_numord || '-'}</th>
                                        <th className="py-2 px-3 text-blue-300">Ordine NetPro</th>
                                        <th className="py-2 px-3 w-56">{t.alignedStatus}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/30">
                                    {comparisonRows.map(row => {
                                        const d = row.diba, b = row.bus, n = row.net;
                                        const bad = (side: OpField[], f: OpField) => side.includes(f);
                                        return (
                                            <tr key={row.fase} className={row.issues.length ? 'bg-amber-500/[0.04] hover:bg-amber-500/10' : 'hover:bg-zinc-800/40'}>
                                                <td className="py-1 px-3 text-center font-mono font-bold text-zinc-100 align-top">{row.fase}</td>

                                                {/* DiBa */}
                                                <td className="py-1 px-3 align-top">
                                                    {d ? (
                                                        <OpCell lav={d.descr_lavor} code={d.codlavo} centro={d.codcent} centroDescr={d.descr_centro} note={d.note} />
                                                    ) : <span className="text-zinc-500 italic">Non in DiBa</span>}
                                                </td>

                                                {/* Business order */}
                                                <td className="py-1 px-3 align-top">
                                                    {b ? (
                                                        <OpCell lav={b.descr_lavor} code={b.codlavo} centro={b.codcent} centroDescr={b.descr_centro} note={b.note}
                                                            badLav={bad(row.busDiff, 'lav')} badCentro={bad(row.busDiff, 'centro')} badNote={bad(row.busDiff, 'note')} />
                                                    ) : <span className={d ? 'text-amber-300 font-semibold' : 'text-zinc-600'}>{d ? 'Mancante' : '-'}</span>}
                                                </td>

                                                {/* NetPro order */}
                                                <td className="py-1 px-3 align-top">
                                                    {n ? (
                                                        <div className="flex items-start gap-2">
                                                            <div className="min-w-0 flex-1">
                                                                <OpCell lav={n.descrizione} centro={n.centro_assegnato} centroDescr={n.machine_name} note={n.note}
                                                                    badLav={bad(row.netDiff, 'lav')} badCentro={bad(row.netDiff, 'centro')} badNote={bad(row.netDiff, 'note')} />
                                                            </div>
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex-shrink-0 ${getNetproStatusBadge(n.stato)}`}>{n.stato}</span>
                                                        </div>
                                                    ) : <span className={d ? 'text-amber-300 font-semibold' : 'text-zinc-600'}>{d ? 'Mancante' : '-'}</span>}
                                                </td>

                                                {/* Result */}
                                                <td className="py-1 px-3 align-top">
                                                    {row.issues.length === 0 ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                            {t.statusAligned}
                                                        </span>
                                                    ) : (
                                                        <div className="flex flex-col gap-0.5">
                                                            {row.issues.map((iss, i) => (
                                                                <span key={i} className="text-[10px] font-semibold text-amber-300">• {iss}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* TAB 4: CONFRONTO MATERIALI — DiBa (expected) → Ordine Business → Ordine NetPro */}
                    {activeTab === 'materials' && (
                        materialsComparison.length === 0 ? (
                            <div className="py-8 text-center text-zinc-400 text-sm italic">
                                Nessun materiale configurato per questo articolo.
                            </div>
                        ) : (
                            <div className="rounded-xl border border-zinc-800 overflow-x-auto">
                                <table className="w-full text-left text-xs font-sans">
                                    <thead className="bg-zinc-950/80 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                                        <tr>
                                            <th className="py-2 px-3">Codice Materiale</th>
                                            <th className="py-2 px-3">Descrizione</th>
                                            <th className="py-2 px-3 w-14 text-center">U.M.</th>
                                            <th className="py-2 px-3 text-right w-28 text-purple-300">{t.expectedQty}</th>
                                            <th className="py-2 px-3 text-right w-28 text-amber-200">Ordine Business</th>
                                            <th className="py-2 px-3 text-right w-28 text-blue-300">Ordine NetPro</th>
                                            <th className="py-2 px-3 w-56">{t.alignedStatus}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/30">
                                        {materialsComparison.map(row => {
                                            const fmt = (v?: number) => v === undefined ? '-' : v.toLocaleString('it-IT', { maximumFractionDigits: 3 });
                                            return (
                                                <tr key={row.part_number} className={row.issues.length ? 'bg-amber-500/[0.04] hover:bg-amber-500/10' : 'hover:bg-zinc-800/40'}>
                                                    <td className="py-1 px-3 font-mono font-bold text-zinc-100">{row.part_number}</td>
                                                    <td className="py-1 px-3 text-zinc-200 max-w-[360px] truncate" title={row.description}>{row.description}</td>
                                                    <td className="py-1 px-3 text-center text-zinc-400 font-mono">{row.unmis || '-'}</td>
                                                    <td className="py-1 px-3 text-right font-mono font-semibold text-purple-300">{fmt(row.expected)}</td>
                                                    <td className={`py-1 px-3 text-right font-mono font-semibold ${row.busDiff ? 'text-amber-300' : 'text-zinc-200'}`}>{fmt(row.bus)}</td>
                                                    <td className={`py-1 px-3 text-right font-mono font-semibold ${row.netDiff ? 'text-amber-300' : 'text-zinc-200'}`}>{fmt(row.net)}</td>
                                                    <td className="py-1 px-3">
                                                        {row.issues.length === 0 ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                {t.statusAligned}
                                                            </span>
                                                        ) : (
                                                            <div className="flex flex-col gap-0.5">
                                                                {row.issues.map((iss, i) => (
                                                                    <span key={i} className="text-[10px] font-semibold text-amber-300">• {iss}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )
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
                                    <strong className="text-zinc-200">Nessuna duplicazione:</strong> gli ordini mantengono lo stesso identico ID (#{data.order_bus_numord || '-'}). L&apos;inventario rimane invariato fino al completamento.
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
