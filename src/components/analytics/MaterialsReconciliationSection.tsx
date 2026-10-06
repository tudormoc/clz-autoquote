'use client'

import { useState, useEffect } from 'react';
import { 
    Scale, 
    AlertTriangle, 
    CheckCircle2, 
    ChevronDown, 
    Check, 
    AlertCircle,
    Pencil,
    X,
    Loader2,
    RefreshCw,
    ClipboardList
} from 'lucide-react';
import { 
    MaterialReconciliationData, 
    ReconciledMaterialRow, 
    ProductionOrderDocument, 
    CaricoDocument 
} from '@/types';
import { 
    updateOrderMaterialQuantityAction, 
    updateCaricoMaterialQuantityAction,
    refreshMaterialReconciliationAction 
} from '@/app/analytics/queries/order-operations-queries';
import { APP_COPY } from '@/locales';

interface MaterialsReconciliationSectionProps {
    reconciliation: MaterialReconciliationData;
    rootCommessaKey?: string;
}

export function MaterialsReconciliationSection({ 
    reconciliation, 
    rootCommessaKey 
}: MaterialsReconciliationSectionProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [materialsList, setMaterialsList] = useState<ReconciledMaterialRow[]>(reconciliation?.materials || []);
    const [productionOrdersList, setProductionOrdersList] = useState<ProductionOrderDocument[]>(reconciliation?.productionOrders || []);
    const [carichiList, setCarichiList] = useState<CaricoDocument[]>(reconciliation?.carichi || []);
    
    const [editingCell, setEditingCell] = useState<{ partNumber: string; field: 'order' | 'carico' } | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const t = APP_COPY.analytics.orderOperations;

    // Sync local state when reconciliation prop changes
    useEffect(() => {
        setMaterialsList(reconciliation?.materials || []);
        setProductionOrdersList(reconciliation?.productionOrders || []);
        setCarichiList(reconciliation?.carichi || []);
        setEditingCell(null);
        setFeedback(null);
    }, [reconciliation]);

    // Auto-dismiss feedback after 4 seconds
    useEffect(() => {
        if (!feedback) return;
        const timer = setTimeout(() => setFeedback(null), 4000);
        return () => clearTimeout(timer);
    }, [feedback]);

    // Group unique carico documents by anno + serie + numdoc
    const uniqueCarichiMap = new Map<string, CaricoDocument>();
    for (const c of carichiList) {
        const key = `${c.anno}-${c.serie}-${c.numdoc}`;
        if (!uniqueCarichiMap.has(key)) {
            uniqueCarichiMap.set(key, c);
        }
    }
    const uniqueCarichi = Array.from(uniqueCarichiMap.values());
    const carichiCount = uniqueCarichi.length;

    // Unique production orders
    const prodOrder = productionOrdersList.length > 0 ? productionOrdersList[0] : null;

    // Handle Manual Refresh
    const handleRefresh = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!rootCommessaKey) return;

        setIsRefreshing(true);
        setFeedback(null);

        try {
            const res = await refreshMaterialReconciliationAction(rootCommessaKey);
            if (res.success && res.reconciliation) {
                setMaterialsList(res.reconciliation.materials || []);
                setProductionOrdersList(res.reconciliation.productionOrders || []);
                setCarichiList(res.reconciliation.carichi || []);
                // Silent refresh — no success feedback, button spinning is enough
            } else {
                setFeedback({ type: 'error', message: res.error || t.errorSaving });
            }
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.message || t.errorSaving });
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleStartEdit = (mat: ReconciledMaterialRow, field: 'order' | 'carico') => {
        if (field === 'order' && (!mat.order_numord || !mat.order_riga)) {
            setFeedback({ type: 'error', message: t.noOrderRowToEdit });
            return;
        }
        if (field === 'carico' && (!mat.carico_numdoc || !mat.carico_riga)) {
            setFeedback({ type: 'error', message: t.noCaricoRowToEdit });
            return;
        }

        const currentVal = field === 'order' ? mat.order_quantity : mat.carico_quantity;
        setEditValue(currentVal ? currentVal.toString() : '0');
        setEditingCell({ partNumber: mat.part_number, field });
    };

    const handleCancelEdit = () => {
        setEditingCell(null);
        setEditValue('');
    };

    const handleSaveEdit = async (mat: ReconciledMaterialRow) => {
        if (!editingCell) return;

        const newQty = parseFloat(editValue.replace(',', '.'));
        if (isNaN(newQty) || newQty < 0) {
            setFeedback({ type: 'error', message: 'Inserire una quantità numerica valida (≥ 0)' });
            return;
        }

        setIsSaving(true);
        setFeedback(null);

        try {
            if (editingCell.field === 'order') {
                const res = await updateOrderMaterialQuantityAction({
                    anno: mat.order_anno!,
                    serie: mat.order_serie || ' ',
                    numord: mat.order_numord!,
                    riga: mat.order_riga!,
                    newQuantity: newQty
                });

                if (res.success) {
                    setMaterialsList(prev => prev.map(item => {
                        if (item.part_number !== mat.part_number) return item;
                        return {
                            ...item,
                            order_quantity: newQty,
                            diff_quantity: item.carico_quantity - newQty
                        };
                    }));
                    setFeedback({ type: 'success', message: `${t.saved}: ${mat.part_number} (Fabbisogno = ${newQty.toLocaleString('it-IT')})` });
                    setEditingCell(null);
                } else {
                    setFeedback({ type: 'error', message: res.error || t.errorSaving });
                }
            } else {
                const res = await updateCaricoMaterialQuantityAction({
                    anno: mat.carico_anno!,
                    serie: mat.carico_serie || ' ',
                    numdoc: mat.carico_numdoc!,
                    riga: mat.carico_riga!,
                    newQuantity: newQty
                });

                if (res.success) {
                    setMaterialsList(prev => prev.map(item => {
                        if (item.part_number !== mat.part_number) return item;
                        return {
                            ...item,
                            carico_quantity: newQty,
                            diff_quantity: newQty - item.order_quantity
                        };
                    }));
                    setFeedback({ type: 'success', message: `${t.saved}: ${mat.part_number} (Scaricato = ${newQty.toLocaleString('it-IT')})` });
                    setEditingCell(null);
                } else {
                    setFeedback({ type: 'error', message: res.error || t.errorSaving });
                }
            }
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.message || t.errorSaving });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md overflow-hidden transition-all duration-300 shadow-xl">
            {/* Header Accordion Button */}
            <div className="w-full p-5 flex items-center justify-between gap-4 hover:bg-zinc-800/30 transition-colors">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex-1 flex items-center gap-3.5 text-left cursor-pointer group"
                >
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/25 text-purple-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                        <Scale className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h2 className="text-base font-bold text-white tracking-wide group-hover:text-primary transition-colors">
                                {t.reconciliationTab}
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700/80">
                                {materialsList.length} {t.reconciliationCount}
                            </span>
                            {prodOrder && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                    Ord. Prod. {prodOrder.numord}/{prodOrder.anno}
                                </span>
                            )}
                            {carichiCount === 1 && (
                                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    <Check className="w-3 h-3" />
                                    Doc. {uniqueCarichi[0].numdoc}/{uniqueCarichi[0].anno}
                                </span>
                            )}
                            {carichiCount > 1 && (
                                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-destructive/20 text-destructive border border-destructive/40 animate-pulse">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    {carichiCount} Carichi Rilevati
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            {t.reconciliationSubtitle}
                        </p>
                    </div>
                </button>

                {/* Right controls: Refresh Button & Accordion Toggle */}
                <div className="flex items-center gap-2">
                    {rootCommessaKey && (
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors border border-zinc-700/60 shadow-sm"
                            title={t.refreshData}
                        >
                            <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-primary' : ''} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className={`p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 hover:text-white transition-all transform duration-300 ${isOpen ? 'rotate-180 bg-primary/10 border-primary/30 text-primary' : ''}`}
                    >
                        <ChevronDown className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Collapsible Content */}
            {isOpen && (
                <div className="p-6 pt-2 border-t border-zinc-800/80 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    
                    {/* FEEDBACK BANNER */}
                    {feedback && (
                        <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                            feedback.type === 'success' 
                                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' 
                                : 'bg-destructive/20 border-destructive/50 text-destructive-foreground'
                        }`}>
                            <div className="flex items-center gap-2">
                                {feedback.type === 'success' ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                )}
                                <span className="font-medium">{feedback.message}</span>
                            </div>
                            <button 
                                onClick={() => setFeedback(null)} 
                                className="text-zinc-400 hover:text-white p-1 rounded"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    {/* SECTION A: DOCUMENTS DETAILS (ORDINE DI PRODUZIONE + CARICO DA PRODUZIONE) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        
                        {/* 1. ORDINE DI PRODUZIONE CARD */}
                        <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-950/20 text-zinc-200 text-xs flex flex-col justify-between">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4 text-blue-400" />
                                    <span className="font-bold uppercase tracking-wider text-blue-400 text-[11px]">
                                        {t.prodOrderDocTitle}
                                    </span>
                                </div>
                                {prodOrder && (
                                    <span className="px-2 py-0.5 rounded bg-blue-900/60 font-mono font-bold text-blue-200 border border-blue-700/60 text-[11px]">
                                        N. {prodOrder.numord} / {prodOrder.anno}
                                    </span>
                                )}
                            </div>

                            {prodOrder ? (
                                <div className="space-y-1">
                                    <p className="text-zinc-300">
                                        Articolo: <strong className="text-white">{prodOrder.codart}</strong> ({prodOrder.descr})
                                    </p>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-zinc-400 text-[11px] pt-1 border-t border-blue-500/20 mt-1.5">
                                        {prodOrder.datord && <span>Data Ord.: <strong className="text-zinc-200">{prodOrder.datord}</strong></span>}
                                        {prodOrder.datcons && <span>Consegna: <strong className="text-zinc-200">{prodOrder.datcons}</strong></span>}
                                        <span>Q.tà Ordine: <strong className="text-blue-300 font-mono">{Number(prodOrder.quant).toLocaleString('it-IT')} Cp</strong></span>
                                        {prodOrder.flevas === 'S' && (
                                            <span className="text-emerald-400 font-semibold">&bull; Evaso ({Number(prodOrder.quaeva).toLocaleString('it-IT')} Cp)</span>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-zinc-400 italic">Nessun ordine di produzione collegato trovato.</p>
                            )}
                        </div>

                        {/* 2. CARICO DA PRODUZIONE CARD */}
                        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-zinc-200 text-xs flex flex-col justify-between">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    <span className="font-bold uppercase tracking-wider text-emerald-400 text-[11px]">
                                        {t.caricoDocTitle}
                                    </span>
                                </div>
                                {carichiCount === 1 && (
                                    <span className="px-2 py-0.5 rounded bg-emerald-900/60 font-mono font-bold text-emerald-200 border border-emerald-700/60 text-[11px]">
                                        Doc. N. {uniqueCarichi[0].numdoc} / {uniqueCarichi[0].anno}
                                    </span>
                                )}
                            </div>

                            {carichiCount === 1 ? (
                                <div className="space-y-1">
                                    <p className="text-zinc-300">
                                        Data: <strong className="text-white">{uniqueCarichi[0].datdoc}</strong> &bull; Articolo: <strong className="text-white">{uniqueCarichi[0].codart}</strong>
                                    </p>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-zinc-400 text-[11px] pt-1 border-t border-emerald-500/20 mt-1.5">
                                        <span>Q.tà Prodotta: <strong className="text-emerald-300 font-mono">{Number(uniqueCarichi[0].quant).toLocaleString('it-IT')} Cp</strong></span>
                                        <span>Valore: <strong className="text-emerald-300 font-mono">€ {Number(uniqueCarichi[0].valore).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong></span>
                                    </div>
                                </div>
                            ) : carichiCount > 1 ? (
                                <div className="space-y-1.5 text-destructive-foreground">
                                    <div className="flex items-center gap-1.5 text-red-300 font-bold">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        <span>Rilevati {carichiCount} documenti di carico!</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-400">
                                        {uniqueCarichi.map(c => `Doc. ${c.numdoc}/${c.anno}`).join(', ')}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-zinc-400 italic">{t.caricoNoneAlert}</p>
                            )}
                        </div>

                    </div>

                    {/* SECTION B: COMPACT SINGLE-ROW RECONCILIATION TABLE (STRICTLY 5 COLUMNS) */}
                    <div>
                        {materialsList.length === 0 ? (
                            <div className="py-6 text-center text-zinc-400 text-xs italic">
                                {t.noReconciliationData}
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/40">
                                <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                                    <thead className="bg-zinc-950 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                                        <tr>
                                            <th className="py-2 px-3 w-[140px]">{t.materialCode}</th>
                                            <th className="py-2 px-3">{t.materialDescription}</th>
                                            <th className="py-2 px-2 text-center w-[50px]">{t.materialUm}</th>
                                            <th className="py-2 px-3 text-right w-[180px]">
                                                <div className="flex items-center justify-end gap-1">
                                                    <span>{t.reconciliationOrderQty}</span>
                                                    <Pencil className="w-2.5 h-2.5 text-zinc-500 opacity-60" />
                                                </div>
                                            </th>
                                            <th className="py-2 px-3 text-right w-[180px]">
                                                <div className="flex items-center justify-end gap-1">
                                                    <span>{t.reconciliationCaricoQty}</span>
                                                    <Pencil className="w-2.5 h-2.5 text-zinc-500 opacity-60" />
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/50 bg-zinc-900/20">
                                        {materialsList.map((mat) => {
                                            const isEditingOrder = editingCell?.partNumber === mat.part_number && editingCell?.field === 'order';
                                            const isEditingCarico = editingCell?.partNumber === mat.part_number && editingCell?.field === 'carico';

                                            return (
                                                <tr key={mat.part_number} className="hover:bg-zinc-800/40 transition-colors h-8">
                                                    {/* 1. Codice Articolo */}
                                                    <td className="py-1 px-3 font-mono font-bold text-primary text-xs">
                                                        {mat.part_number}
                                                    </td>

                                                    {/* 2. Descrizione Materiale (strict single row with truncate) */}
                                                    <td className="py-1 px-3 font-medium text-zinc-200 max-w-[340px] xl:max-w-[540px] truncate" title={mat.description}>
                                                        {mat.description}
                                                    </td>

                                                    {/* 3. U.M. */}
                                                    <td className="py-1 px-2 text-center text-zinc-400">
                                                        {mat.unit_of_measure || '-'}
                                                    </td>

                                                    {/* 4. Q.tà Ordine (Fabbisogno) - EDITABLE */}
                                                    <td className="py-1 px-3 text-right">
                                                        {isEditingOrder ? (
                                                            <div className="flex items-center justify-end gap-1">
                                                                <input
                                                                    type="number"
                                                                    step="any"
                                                                    min="0"
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleSaveEdit(mat);
                                                                        if (e.key === 'Escape') handleCancelEdit();
                                                                    }}
                                                                    autoFocus
                                                                    disabled={isSaving}
                                                                    className="w-24 px-1.5 py-0.5 text-right font-mono text-xs bg-zinc-950 border border-primary text-white rounded focus:outline-none focus:ring-1 focus:ring-primary"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSaveEdit(mat)}
                                                                    disabled={isSaving}
                                                                    className="p-1 rounded bg-emerald-600/80 hover:bg-emerald-600 text-white"
                                                                    title={t.save}
                                                                >
                                                                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={handleCancelEdit}
                                                                    disabled={isSaving}
                                                                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                                                                    title={t.cancel}
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div 
                                                                onClick={() => handleStartEdit(mat, 'order')}
                                                                className="group/cell inline-flex items-center justify-end gap-1.5 cursor-pointer px-1.5 py-0.5 rounded hover:bg-zinc-800/80 border border-transparent hover:border-zinc-700/60 transition-all"
                                                                title={t.clickToEdit}
                                                            >
                                                                <Pencil className="w-2.5 h-2.5 text-zinc-500 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
                                                                <span className="font-mono font-medium text-zinc-300">
                                                                    {mat.order_quantity > 0 
                                                                        ? mat.order_quantity.toLocaleString('it-IT')
                                                                        : '-'
                                                                    }
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* 5. Q.tà Scaricata (Carico) - EDITABLE */}
                                                    <td className="py-1 px-3 text-right">
                                                        {isEditingCarico ? (
                                                            <div className="flex items-center justify-end gap-1">
                                                                <input
                                                                    type="number"
                                                                    step="any"
                                                                    min="0"
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleSaveEdit(mat);
                                                                        if (e.key === 'Escape') handleCancelEdit();
                                                                    }}
                                                                    autoFocus
                                                                    disabled={isSaving}
                                                                    className="w-24 px-1.5 py-0.5 text-right font-mono text-xs bg-zinc-950 border border-primary text-white rounded focus:outline-none focus:ring-1 focus:ring-primary"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSaveEdit(mat)}
                                                                    disabled={isSaving}
                                                                    className="p-1 rounded bg-emerald-600/80 hover:bg-emerald-600 text-white"
                                                                    title={t.save}
                                                                >
                                                                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={handleCancelEdit}
                                                                    disabled={isSaving}
                                                                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                                                                    title={t.cancel}
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div 
                                                                onClick={() => handleStartEdit(mat, 'carico')}
                                                                className="group/cell inline-flex items-center justify-end gap-1.5 cursor-pointer px-1.5 py-0.5 rounded hover:bg-zinc-800/80 border border-transparent hover:border-zinc-700/60 transition-all"
                                                                title={t.clickToEdit}
                                                            >
                                                                <Pencil className="w-2.5 h-2.5 text-zinc-500 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
                                                                <span className="font-mono font-medium text-zinc-100">
                                                                    {mat.carico_quantity > 0 
                                                                        ? mat.carico_quantity.toLocaleString('it-IT')
                                                                        : '-'
                                                                    }
                                                                </span>
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
                    </div>

                </div>
            )}
        </div>
    );
}
