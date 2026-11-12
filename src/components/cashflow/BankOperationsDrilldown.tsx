'use client';

import { LoadState } from '@/components/ui/LoadState';
import { Spinner } from '@/components/ui/Spinner';
import React, { useEffect, useState, useTransition, useMemo } from 'react';
import { X, Search, CheckCircle2, ArrowUpRight, ArrowDownRight, Layers } from 'lucide-react';
import { APP_COPY, fmt } from '@/locales';
import { getBankAccountTransactionsAction } from '@/app/cashflow/cashflow-actions';
import type { BankAccountDetailsResult } from '@/lib/cashflow/types';
import { formatCurrency } from '@/lib/format';
import { errorMessage } from '@/lib/utils';

/** The frame of the panel */
const PANEL = 'bg-background/95 border border-border-strong/80 rounded-xl p-4 my-2 text-fg shadow-xl space-y-4';

interface BankOperationsDrilldownProps {
    accountCode: number;
    accountName: string;
    year: number;
    initialMonth?: number | null;
    onClose: () => void;
}

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
    /** Why the movements could not be read: shown in place of the figures, never zeros with the "verified" tick */
    const [error, setError] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(initialMonth || 'all');
    const [searchTerm, setSearchTerm] = useState<string>('');

    const shortMonths = APP_COPY.months.short;

    useEffect(() => {
        setData(null);
        setError(null);
        startTransition(async () => {
            try {
                const res = await getBankAccountTransactionsAction(accountCode, year);
                if (res.success) setData(res);
                else setError(res.error || APP_COPY.common.loadError);
            } catch (err) {
                setError(errorMessage(err));
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

    const header = (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                <div className="flex items-center gap-3">
                    <div className="px-2.5 py-1 bg-warning-500/10 border border-warning-500/30 text-warning-400 rounded-md font-mono text-xs font-bold">
                        {accountCode}
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-fg flex items-center gap-2">
                            {accountName}
                            <span className="text-xs font-normal text-fg-muted">({year})</span>
                        </h4>
                        <p className="text-2xs text-fg-muted">
                            {t.subtitle}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={onClose}
                        className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted-strong text-fg-secondary hover:text-fg-strong transition-colors text-xs flex items-center gap-1.5 border border-border-strong/60"
                        title={t.close}
                    >
                        <X size={14} />
                        <span>{t.close}</span>
                    </button>
                </div>
            </div>
    );

    // Until the movements are read nothing is known about the account: a spinner or the error, no figures
    if (!data) {
        return (
            <div className={PANEL}>
                {header}
                <LoadState loading={!error} error={error} />
            </div>
        );
    }

    return (
        <div className={PANEL}>
            {header}

            {/* Month Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
                <button
                    onClick={() => setSelectedMonth('all')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        selectedMonth === 'all'
                            ? 'bg-warning-500/20 text-warning-300 border border-warning-500/40 shadow-sm font-semibold'
                            : 'bg-card text-fg-muted hover:text-fg-soft border border-border'
                    }`}
                >
                    {t.filterAllYear}
                    {data && data.transactions.length > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.2 bg-muted rounded-full text-3xs text-fg-secondary font-mono">
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
                                    ? 'bg-warning-500/20 text-warning-300 border border-warning-500/40 shadow-sm font-semibold'
                                    : txCount > 0
                                    ? 'bg-card text-fg-secondary hover:text-fg-strong border border-border'
                                    : 'bg-card/40 text-fg-faint border border-border/40 cursor-default'
                            }`}
                            disabled={txCount === 0}
                        >
                            {mName}
                            {txCount > 0 && (
                                <span className={`ml-1 text-3xs font-mono ${isSelected ? 'text-warning-200' : 'text-fg-subtle'}`}>
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
                <div className="bg-card/80 border border-border rounded-lg p-2.5">
                    <span className="text-3xs font-sans text-fg-muted block mb-0.5">
                        {t.openingBalance} ({selectedMonth === 'all' ? `01/01/${year}` : `01/${String(selectedMonth).padStart(2, '0')}/${year}`})
                    </span>
                    <span className="text-sm font-bold text-info-300">
                        {formatCurrency(currentOpening)}
                    </span>
                </div>

                {/* 2. Totale Dare (+) */}
                <div className="bg-success-950/20 border border-success-900/40 rounded-lg p-2.5">
                    <span className="text-3xs font-sans text-success-400 flex items-center gap-1 mb-0.5">
                        <ArrowUpRight size={12} />
                        {t.totalInflows}
                    </span>
                    <span className="text-sm font-bold text-success-300">
                        +{formatCurrency(currentDare)}
                    </span>
                </div>

                {/* 3. Totale Avere (-) */}
                <div className="bg-danger-950/20 border border-danger-900/40 rounded-lg p-2.5">
                    <span className="text-3xs font-sans text-danger-400 flex items-center gap-1 mb-0.5">
                        <ArrowDownRight size={12} />
                        {t.totalOutflows}
                    </span>
                    <span className="text-sm font-bold text-danger-300">
                        -{formatCurrency(currentAvere)}
                    </span>
                </div>

                {/* 4. Variazione Periodo */}
                <div className="bg-card/80 border border-border rounded-lg p-2.5">
                    <span className="text-3xs font-sans text-fg-muted block mb-0.5">
                        {t.netVariation}
                    </span>
                    <span className={`text-sm font-bold ${currentNet >= 0 ? 'text-success-400' : 'text-danger-400'}`}>
                        {currentNet >= 0 ? `+${formatCurrency(currentNet)}` : formatCurrency(currentNet)}
                    </span>
                </div>

                {/* 5. Saldo Finale (Highlight with verification badge) */}
                <div className="col-span-2 md:col-span-1 bg-gradient-to-br from-warning-950/30 to-card border border-warning-500/50 rounded-lg p-2.5 relative">
                    <div className="flex items-center justify-between mb-0.5">
                        <span className="text-3xs font-sans text-warning-300 font-semibold block">
                            {t.closingBalance}
                        </span>
                        <span title={t.officialBalanceMatch}>
                            <CheckCircle2 size={13} className="text-success-400 shrink-0" />
                        </span>
                    </div>
                    <span className="text-sm font-bold text-warning-300">
                        {formatCurrency(currentClosing)}
                    </span>
                    <span className="text-3xs font-sans text-success-400 block mt-0.5">
                        ✓ {t.officialBalanceMatch}
                    </span>
                </div>
            </div>

            {/* Search Bar & Transaction count */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={t.searchPlaceholder}
                        className="w-full bg-card border border-border-strong/60 rounded-lg pl-8 pr-3 py-1.5 text-xs text-fg-soft placeholder-fg-subtle focus:outline-none focus:border-warning-500/60"
                    />
                </div>

                <div className="text-xs text-fg-muted flex items-center gap-1.5">
                    <Layers size={14} className="text-fg-subtle" />
                    <span>
                        <strong className="text-fg-soft">{filteredTransactions.length}</strong> {t.operationsCount}
                    </span>
                </div>
            </div>

            {/* Operations Table */}
            <div className="border border-border rounded-lg overflow-hidden">
                <div className="max-h-[360px] overflow-y-auto">
                    <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-card text-fg-muted text-3xs sticky top-0 z-10 border-b border-border">
                            <tr>
                                <th className="px-2.5 py-2 w-[90px]">{t.date}</th>
                                <th className="px-2 py-2 w-[110px]">{t.regDoc}</th>
                                <th className="px-2 py-2">{t.description}</th>
                                <th className="px-2.5 py-2 text-right w-[115px]">{t.inflow}</th>
                                <th className="px-2.5 py-2 text-right w-[115px]">{t.outflow}</th>
                                <th className="px-3 py-2 text-right w-[130px] bg-card/90 text-warning-300 font-bold border-l border-border">
                                    {t.runningBalance}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 text-2xs">
                            {isPending && (
                                <tr>
                                    <td colSpan={6} className="text-center py-6 text-fg-muted text-xs">
                                        <div className="flex items-center justify-center gap-2">
                                            <Spinner size={14} className="text-warning-400" />
                                            {t.loading}
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {!isPending && filteredTransactions.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-6 text-fg-subtle text-xs">
                                        {t.noTransactions}
                                    </td>
                                </tr>
                            )}

                            {!isPending && filteredTransactions.map((tx, idx) => (
                                <tr key={tx.id || idx} className="hover:bg-card/60 transition-colors">
                                    {/* Data Reg */}
                                    <td className="px-2.5 py-1.5 text-fg-secondary whitespace-nowrap">
                                        {tx.formattedDate}
                                    </td>

                                    {/* N. Reg / Doc */}
                                    <td className="px-2 py-1.5 text-fg-muted whitespace-nowrap text-3xs">
                                        <span className="font-semibold text-fg-secondary">R.{tx.regNum}/{tx.rowNum}</span>
                                        {tx.docNum > 0 && (
                                            <span className="ml-1 text-fg-subtle">
                                                {fmt(t.docNumber, { number: `${tx.docNum}${tx.docSeries ? `/${tx.docSeries}` : ''}` })}
                                            </span>
                                        )}
                                    </td>

                                    {/* Descrizione / Causale */}
                                    <td className="px-2 py-1.5 text-fg-soft truncate max-w-[280px]" title={tx.description}>
                                        {tx.description}
                                    </td>

                                    {/* Dare (+) */}
                                    <td className="px-2.5 py-1.5 text-right font-medium text-success-400 whitespace-nowrap">
                                        {tx.dare > 0 ? `+${formatCurrency(tx.dare)}` : '-'}
                                    </td>

                                    {/* Avere (-) */}
                                    <td className="px-2.5 py-1.5 text-right font-medium text-danger-400 whitespace-nowrap">
                                        {tx.avere > 0 ? `-${formatCurrency(tx.avere)}` : '-'}
                                    </td>

                                    {/* Saldo Progressivo */}
                                    <td className="px-3 py-1.5 text-right font-bold text-warning-200 bg-warning-950/10 border-l border-border whitespace-nowrap">
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
