'use client';

import React, { useEffect, useState, useTransition, useMemo } from 'react';
import { X, Search, CheckCircle2, ArrowUpRight, ArrowDownRight, Layers, FileText } from 'lucide-react';
import { APP_COPY } from '@/locales';
import {
    getBankAccountTransactionsAction,
    BankAccountDetailsResult,
    BankTransactionItem,
} from '@/app/cashflow/cashflow-actions';

interface BankOperationsDrilldownProps {
    accountCode: number;
    accountName: string;
    year: number;
    initialMonth?: number | null;
    onClose: () => void;
}

const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null || isNaN(val)) return '€ 0,00';
    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(val);
};

export const BankOperationsDrilldown: React.FC<BankOperationsDrilldownProps> = ({
    accountCode,
    accountName,
    year,
    initialMonth = null,
    onClose,
}) => {
    const t = APP_COPY.cashflow.bankDetails;
    const [isPending, startTransition] = useTransition();
    const [data, setData] = useState<BankAccountDetailsResult | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(initialMonth || 'all');
    const [searchTerm, setSearchTerm] = useState<string>('');

    const shortMonths = [
        'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
        'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'
    ];

    useEffect(() => {
        startTransition(async () => {
            const res = await getBankAccountTransactionsAction(accountCode, year);
            if (res.success) {
                setData(res);
            }
        });
    }, [accountCode, year]);

    useEffect(() => {
        if (initialMonth !== null && initialMonth !== undefined) {
            setSelectedMonth(initialMonth);
        }
    }, [initialMonth]);

    // Active monthly summary if a specific month is selected
    const activeSummary = useMemo(() => {
        if (!data || selectedMonth === 'all') return null;
        return data.monthlySummaries.find(s => s.month === selectedMonth) || null;
    }, [data, selectedMonth]);

    // Filtered transactions by month and search query
    const filteredTransactions = useMemo(() => {
        if (!data) return [];
        let list = data.transactions;
        if (selectedMonth !== 'all') {
            list = list.filter(t => t.month === selectedMonth);
        }
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            list = list.filter(t => 
                t.description.toLowerCase().includes(q) ||
                String(t.docNum).includes(q) ||
                String(t.regNum).includes(q) ||
                t.docSeries.toLowerCase().includes(q)
            );
        }
        return list;
    }, [data, selectedMonth, searchTerm]);

    // Period summary cards values
    const currentOpening = selectedMonth === 'all' 
        ? (data?.openingBalanceYear ?? 0) 
        : (activeSummary?.openingBalance ?? 0);

    const currentClosing = selectedMonth === 'all' 
        ? (data?.closingBalanceYear ?? 0) 
        : (activeSummary?.closingBalance ?? 0);

    const currentDare = selectedMonth === 'all' 
        ? (data?.totalDareYear ?? 0) 
        : (activeSummary?.totalDare ?? 0);

    const currentAvere = selectedMonth === 'all' 
        ? (data?.totalAvereYear ?? 0) 
        : (activeSummary?.totalAvere ?? 0);

    const currentNet = currentDare - currentAvere;

    return (
        <div className="bg-zinc-950/95 border border-zinc-700/80 rounded-xl p-4 my-2 text-zinc-100 shadow-xl space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-3">
                    <div className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-md font-mono text-xs font-bold">
                        {accountCode}
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                            {accountName}
                            <span className="text-xs font-normal text-zinc-400">({year})</span>
                        </h4>
                        <p className="text-[11px] text-zinc-400">
                            {t.subtitle}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={onClose}
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors text-xs flex items-center gap-1.5 border border-zinc-700/60"
                        title={t.close}
                    >
                        <X size={14} />
                        <span>{t.close}</span>
                    </button>
                </div>
            </div>

            {/* Month Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
                <button
                    onClick={() => setSelectedMonth('all')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        selectedMonth === 'all'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-semibold'
                            : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                    }`}
                >
                    {t.filterAllYear}
                    {data && data.transactions.length > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.2 bg-zinc-800 rounded-full text-[10px] text-zinc-300 font-mono">
                            {data.transactions.length}
                        </span>
                    )}
                </button>

                {shortMonths.map((mName, idx) => {
                    const mNum = idx + 1;
                    const mSum = data?.monthlySummaries.find(s => s.month === mNum);
                    const txCount = mSum?.transactionCount || 0;
                    const isSelected = selectedMonth === mNum;

                    return (
                        <button
                            key={mNum}
                            onClick={() => setSelectedMonth(mNum)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                isSelected
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-semibold'
                                    : txCount > 0
                                    ? 'bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800'
                                    : 'bg-zinc-900/40 text-zinc-600 border border-zinc-800/40 cursor-default'
                            }`}
                            disabled={txCount === 0}
                        >
                            {mName}
                            {txCount > 0 && (
                                <span className={`ml-1 text-[10px] font-mono ${isSelected ? 'text-amber-200' : 'text-zinc-500'}`}>
                                    ({txCount})
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 font-mono text-xs">
                {/* 1. Saldo Iniziale */}
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-2.5">
                    <span className="text-[10px] font-sans text-zinc-400 block mb-0.5">
                        {t.openingBalance} ({selectedMonth === 'all' ? `01/01/${year}` : `01/${String(selectedMonth).padStart(2, '0')}/${year}`})
                    </span>
                    <span className="text-sm font-bold text-sky-300">
                        {formatCurrency(currentOpening)}
                    </span>
                </div>

                {/* 2. Totale Dare (+) */}
                <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-lg p-2.5">
                    <span className="text-[10px] font-sans text-emerald-400 flex items-center gap-1 mb-0.5">
                        <ArrowUpRight size={12} />
                        {t.totalInflows}
                    </span>
                    <span className="text-sm font-bold text-emerald-300">
                        +{formatCurrency(currentDare)}
                    </span>
                </div>

                {/* 3. Totale Avere (-) */}
                <div className="bg-rose-950/20 border border-rose-900/40 rounded-lg p-2.5">
                    <span className="text-[10px] font-sans text-rose-400 flex items-center gap-1 mb-0.5">
                        <ArrowDownRight size={12} />
                        {t.totalOutflows}
                    </span>
                    <span className="text-sm font-bold text-rose-300">
                        -{formatCurrency(currentAvere)}
                    </span>
                </div>

                {/* 4. Variazione Periodo */}
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-2.5">
                    <span className="text-[10px] font-sans text-zinc-400 block mb-0.5">
                        {t.netVariation}
                    </span>
                    <span className={`text-sm font-bold ${currentNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {currentNet >= 0 ? `+${formatCurrency(currentNet)}` : formatCurrency(currentNet)}
                    </span>
                </div>

                {/* 5. Saldo Finale (Highlight with verification badge) */}
                <div className="col-span-2 md:col-span-1 bg-gradient-to-br from-amber-950/30 to-zinc-900 border border-amber-500/50 rounded-lg p-2.5 relative">
                    <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-sans text-amber-300 font-semibold block">
                            {t.closingBalance}
                        </span>
                        <span title={t.officialBalanceMatch}>
                            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                        </span>
                    </div>
                    <span className="text-sm font-bold text-amber-300">
                        {formatCurrency(currentClosing)}
                    </span>
                    <span className="text-[9px] font-sans text-emerald-400 block mt-0.5">
                        ✓ {t.officialBalanceMatch}
                    </span>
                </div>
            </div>

            {/* Search Bar & Transaction count */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={t.searchPlaceholder}
                        className="w-full bg-zinc-900 border border-zinc-700/60 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60"
                    />
                </div>

                <div className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <Layers size={14} className="text-zinc-500" />
                    <span>
                        <strong className="text-zinc-200">{filteredTransactions.length}</strong> {t.operationsCount}
                    </span>
                </div>
            </div>

            {/* Operations Table */}
            <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <div className="max-h-[360px] overflow-y-auto">
                    <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-zinc-900 text-zinc-400 text-[10px] uppercase tracking-wider sticky top-0 z-10 border-b border-zinc-800">
                            <tr>
                                <th className="px-2.5 py-2 w-[90px]">{t.date}</th>
                                <th className="px-2 py-2 w-[110px]">{t.regDoc}</th>
                                <th className="px-2 py-2">{t.description}</th>
                                <th className="px-2.5 py-2 text-right w-[115px]">{t.inflow}</th>
                                <th className="px-2.5 py-2 text-right w-[115px]">{t.outflow}</th>
                                <th className="px-3 py-2 text-right w-[130px] bg-zinc-900/90 text-amber-300 font-bold border-l border-zinc-800">
                                    {t.runningBalance}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60 text-[11px]">
                            {isPending && (
                                <tr>
                                    <td colSpan={6} className="text-center py-6 text-zinc-400 text-xs">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                                            {t.loading}
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {!isPending && filteredTransactions.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-6 text-zinc-500 text-xs">
                                        {t.noTransactions}
                                    </td>
                                </tr>
                            )}

                            {!isPending && filteredTransactions.map((tx, idx) => (
                                <tr key={tx.id || idx} className="hover:bg-zinc-900/60 transition-colors">
                                    {/* Data Reg */}
                                    <td className="px-2.5 py-1.5 text-zinc-300 whitespace-nowrap">
                                        {tx.formattedDate}
                                    </td>

                                    {/* N. Reg / Doc */}
                                    <td className="px-2 py-1.5 text-zinc-400 whitespace-nowrap text-[10px]">
                                        <span className="font-semibold text-zinc-300">R.{tx.regNum}/{tx.rowNum}</span>
                                        {tx.docNum > 0 && (
                                            <span className="ml-1 text-zinc-500">
                                                Doc.{tx.docNum}{tx.docSeries ? `/${tx.docSeries}` : ''}
                                            </span>
                                        )}
                                    </td>

                                    {/* Descrizione / Causale */}
                                    <td className="px-2 py-1.5 text-zinc-200 truncate max-w-[280px]" title={tx.description}>
                                        {tx.description}
                                    </td>

                                    {/* Dare (+) */}
                                    <td className="px-2.5 py-1.5 text-right font-medium text-emerald-400 whitespace-nowrap">
                                        {tx.dare > 0 ? `+${formatCurrency(tx.dare)}` : '-'}
                                    </td>

                                    {/* Avere (-) */}
                                    <td className="px-2.5 py-1.5 text-right font-medium text-rose-400 whitespace-nowrap">
                                        {tx.avere > 0 ? `-${formatCurrency(tx.avere)}` : '-'}
                                    </td>

                                    {/* Saldo Progressivo */}
                                    <td className="px-3 py-1.5 text-right font-bold text-amber-200 bg-amber-950/10 border-l border-zinc-800 whitespace-nowrap">
                                        {formatCurrency(tx.runningBalance)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
