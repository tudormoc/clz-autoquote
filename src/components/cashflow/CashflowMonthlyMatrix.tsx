'use client';

import React, { useState } from 'react';
import { CalendarRange, ArrowUpRight, ArrowDownRight, ChevronRight, ChevronDown } from 'lucide-react';
import { APP_COPY } from '@/locales';
import { MonthlyFinancialItem } from '@/app/cashflow/cashflow-actions';

interface CashflowMonthlyMatrixProps {
    monthlyData?: MonthlyFinancialItem[];
    grandTotalIncome?: number;
    grandTotalExpense?: number;
    grandNetCashflow?: number;
    year?: number;
    loading?: boolean;
}

const formatCompactEUR = (amount?: number) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '-';
    if (amount === 0) return '€0';
    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
    }).format(amount);
};

export const CashflowMonthlyMatrix: React.FC<CashflowMonthlyMatrixProps> = ({
    monthlyData = [],
    grandTotalIncome = 0,
    grandTotalExpense = 0,
    grandNetCashflow = 0,
    year = 2026,
    loading = false,
}) => {
    const mx = APP_COPY.cashflow.matrix;
    const m = APP_COPY.cashflow.macro;

    const [expandedOpening, setExpandedOpening] = useState<boolean>(false);
    const [expandedIncomes, setExpandedIncomes] = useState<boolean>(false);
    const [expandedExpenses, setExpandedExpenses] = useState<boolean>(false);
    const [expandedClosing, setExpandedClosing] = useState<boolean>(false);

    const shortMonths = [
        'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
        'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'
    ];

    // Extract unique bank accounts from the first available month's breakdown
    const sampleBreakdown = monthlyData.find(i => i.bankBreakdown && i.bankBreakdown.length > 0)?.bankBreakdown || [];

    return (
        <div className="bg-card border border-zinc-800 rounded-xl overflow-hidden shadow-sm w-full">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg">
                        <CalendarRange size={18} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-zinc-100 text-base">
                            {mx.title} ({year})
                        </h3>
                        <p className="text-xs text-zinc-400">Clicca sulle righe per espandere/comprimere le voci interne</p>
                    </div>
                </div>
            </div>

            {/* Matrix Table - Fits 12 months without horizontal scroll */}
            <div className="w-full overflow-hidden">
                <table className="w-full text-left text-xs table-fixed">
                    <thead className="bg-zinc-900/90 text-zinc-400 font-semibold border-b border-zinc-800 text-[10px]">
                        <tr>
                            <th className="px-2 py-2.5 w-[22%] truncate">{mx.categoryHeader}</th>
                            {shortMonths.map((month, idx) => (
                                <th key={idx} className="px-0.5 py-2.5 text-right font-mono uppercase tracking-wider">
                                    {month}
                                </th>
                            ))}
                            <th className="px-1.5 py-2.5 text-right font-mono text-zinc-200 bg-zinc-800/40 w-[10%]">
                                {mx.totalHeader}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                        
                        {/* 1. OPENING BALANCE MAIN ROW */}
                        <tr 
                            onClick={() => setExpandedOpening(!expandedOpening)}
                            className="bg-sky-950/20 font-semibold border-b border-sky-900/30 text-sky-200 cursor-pointer hover:bg-sky-900/30 transition-colors"
                        >
                            <td className="px-2 py-2 font-sans flex items-center gap-1.5 truncate" title="Clicca per espandere le banche">
                                {expandedOpening ? <ChevronDown size={14} className="text-sky-400 shrink-0" /> : <ChevronRight size={14} className="text-sky-400 shrink-0" />}
                                Saldo Iniziale (Opening)
                            </td>
                            {shortMonths.map((_, mIdx) => {
                                const item = monthlyData.find((i) => i.month === mIdx + 1);
                                const val = item && item.hasBankData ? item.openingBalance : null;
                                return (
                                    <td key={mIdx} className="px-0.5 py-2 text-right text-sky-300 truncate">
                                        {loading ? '...' : (val !== null && val !== undefined ? formatCompactEUR(val) : '')}
                                    </td>
                                );
                            })}
                            <td className="px-1.5 py-2 text-right font-bold text-sky-400 bg-sky-950/40 border-l border-zinc-800 truncate">
                                {loading ? '...' : (monthlyData.find(i => i.hasBankData)?.openingBalance !== undefined ? formatCompactEUR(monthlyData.find(i => i.hasBankData)?.openingBalance ?? 0) : '')}
                            </td>
                        </tr>

                        {/* OPENING SUB-ROWS (PER BANK ACCOUNT) */}
                        {expandedOpening && sampleBreakdown.map((bank, bIdx) => (
                            <tr key={`op_${bIdx}`} className="bg-sky-950/10 text-sky-300/80 hover:bg-sky-900/20 transition-colors text-[10px]">
                                <td className="pl-6 pr-2 py-1 font-sans truncate text-zinc-400" title={bank.name}>
                                    └ {bank.name.replace('BANCA POPOLARE ', 'B. ').replace('BANCA POP. ', 'B. ')}
                                </td>
                                {shortMonths.map((_, mIdx) => {
                                    const item = monthlyData.find((i) => i.month === mIdx + 1);
                                    const bankItem = item?.bankBreakdown?.find(b => b.accountCode === bank.accountCode);
                                    const val = item && item.hasBankData && bankItem ? bankItem.opening : null;
                                    return (
                                        <td key={mIdx} className="px-0.5 py-1 text-right truncate font-mono">
                                            {loading ? '...' : (val !== null && val !== undefined ? formatCompactEUR(val) : '')}
                                        </td>
                                    );
                                })}
                                <td className="px-1.5 py-1 text-right bg-zinc-800/10 border-l border-zinc-800 truncate">
                                    -
                                </td>
                            </tr>
                        ))}

                        {/* 2. CASH IN MAIN ROW (ENTRATE) */}
                        <tr 
                            onClick={() => setExpandedIncomes(!expandedIncomes)}
                            className="bg-emerald-950/30 text-emerald-400 font-sans font-bold uppercase tracking-wider text-[10px] cursor-pointer hover:bg-emerald-900/40 transition-colors"
                        >
                            <td className="px-2 py-2 flex items-center gap-1.5 truncate" title="Clicca per espandere le voci di entrate">
                                {expandedIncomes ? <ChevronDown size={14} className="text-emerald-400 shrink-0" /> : <ChevronRight size={14} className="text-emerald-400 shrink-0" />}
                                <ArrowUpRight size={12} className="shrink-0" />
                                {mx.incomesSection} (Cash In)
                            </td>
                            {shortMonths.map((_, mIdx) => {
                                const item = monthlyData.find((i) => i.month === mIdx + 1);
                                const val = item ? item.incomeAmount : 0;
                                return (
                                    <td key={mIdx} className="px-0.5 py-2 text-right text-emerald-300 font-mono font-bold truncate">
                                        {loading ? '...' : formatCompactEUR(val)}
                                    </td>
                                );
                            })}
                            <td className="px-1.5 py-2 text-right font-bold font-mono text-emerald-400 bg-emerald-950/50 border-l border-zinc-800 truncate">
                                {loading ? '...' : formatCompactEUR(grandTotalIncome)}
                            </td>
                        </tr>

                        {/* CASH IN SUB-ROW: Incassi da Clienti */}
                        {expandedIncomes && (
                            <tr className="hover:bg-zinc-800/30 transition-colors text-[10px]">
                                <td className="pl-6 pr-2 py-1.5 font-sans font-medium text-zinc-300 truncate" title={m.clientIncomes}>
                                    └ {m.clientIncomes}
                                </td>
                                {shortMonths.map((_, mIdx) => {
                                    const item = monthlyData.find((i) => i.month === mIdx + 1);
                                    const val = item ? item.incomeAmount : 0;
                                    return (
                                        <td key={mIdx} className="px-0.5 py-1.5 text-right text-emerald-300/80 font-mono truncate">
                                            {loading ? '...' : formatCompactEUR(val)}
                                        </td>
                                    );
                                })}
                                <td className="px-1.5 py-1.5 text-right font-mono text-emerald-400/80 bg-zinc-800/20 border-l border-zinc-800 truncate">
                                    {loading ? '...' : formatCompactEUR(grandTotalIncome)}
                                </td>
                            </tr>
                        )}

                        {/* 3. CASH OUT MAIN ROW (USCITE) */}
                        <tr 
                            onClick={() => setExpandedExpenses(!expandedExpenses)}
                            className="bg-rose-950/30 text-rose-400 font-sans font-bold uppercase tracking-wider text-[10px] cursor-pointer hover:bg-rose-900/40 transition-colors"
                        >
                            <td className="px-2 py-2 flex items-center gap-1.5 truncate" title="Clicca per espandere le voci di uscite">
                                {expandedExpenses ? <ChevronDown size={14} className="text-rose-400 shrink-0" /> : <ChevronRight size={14} className="text-rose-400 shrink-0" />}
                                <ArrowDownRight size={12} className="shrink-0" />
                                {mx.expensesSection} (Cash Out)
                            </td>
                            {shortMonths.map((_, mIdx) => {
                                const item = monthlyData.find((i) => i.month === mIdx + 1);
                                const val = item ? item.expenseAmount : 0;
                                return (
                                    <td key={mIdx} className="px-0.5 py-2 text-right text-rose-300 font-mono font-bold truncate">
                                        {loading ? '...' : formatCompactEUR(val)}
                                    </td>
                                );
                            })}
                            <td className="px-1.5 py-2 text-right font-bold font-mono text-rose-400 bg-rose-950/50 border-l border-zinc-800 truncate">
                                {loading ? '...' : formatCompactEUR(grandTotalExpense)}
                            </td>
                        </tr>

                        {/* CASH OUT SUB-ROW: Pagamenti Fornitori */}
                        {expandedExpenses && (
                            <tr className="hover:bg-zinc-800/30 transition-colors text-[10px]">
                                <td className="pl-6 pr-2 py-1.5 font-sans font-medium text-zinc-300 truncate" title={m.supplierExpenses}>
                                    └ {m.supplierExpenses}
                                </td>
                                {shortMonths.map((_, mIdx) => {
                                    const item = monthlyData.find((i) => i.month === mIdx + 1);
                                    const val = item ? item.expenseAmount : 0;
                                    return (
                                        <td key={mIdx} className="px-0.5 py-1.5 text-right text-rose-300/80 font-mono truncate">
                                            {loading ? '...' : formatCompactEUR(val)}
                                        </td>
                                    );
                                })}
                                <td className="px-1.5 py-1.5 text-right font-mono text-rose-400/80 bg-zinc-800/20 border-l border-zinc-800 truncate">
                                    {loading ? '...' : formatCompactEUR(grandTotalExpense)}
                                </td>
                            </tr>
                        )}

                        {/* 4. NET CASH FLOW ROW */}
                        <tr className="bg-zinc-900 font-bold border-t border-b border-zinc-700 text-zinc-100 text-xs">
                            <td className="px-2 py-2.5 font-sans truncate">Flusso Netto (Net Flow)</td>
                            {shortMonths.map((_, mIdx) => {
                                const item = monthlyData.find((i) => i.month === mIdx + 1);
                                const val = item ? item.netAmount : 0;
                                const isPositive = val >= 0;
                                return (
                                    <td
                                        key={mIdx}
                                        className={`px-0.5 py-2.5 text-right truncate ${
                                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                                        }`}
                                    >
                                        {loading ? '...' : formatCompactEUR(val)}
                                    </td>
                                );
                            })}
                            <td className="px-1.5 py-2.5 text-right font-bold text-emerald-400 bg-zinc-800/40 border-l border-zinc-800 truncate">
                                {loading ? '...' : formatCompactEUR(grandNetCashflow)}
                            </td>
                        </tr>

                        {/* 5. CLOSING BALANCE MAIN ROW */}
                        <tr 
                            onClick={() => setExpandedClosing(!expandedClosing)}
                            className="bg-amber-950/25 font-bold border-t-2 border-amber-500/40 text-amber-300 text-xs cursor-pointer hover:bg-amber-900/30 transition-colors"
                        >
                            <td className="px-2 py-2.5 font-sans flex items-center gap-1.5 truncate" title="Clicca per espandere le banche">
                                {expandedClosing ? <ChevronDown size={14} className="text-amber-400 shrink-0" /> : <ChevronRight size={14} className="text-amber-400 shrink-0" />}
                                Saldo Finale (Closing)
                            </td>
                            {shortMonths.map((_, mIdx) => {
                                const item = monthlyData.find((i) => i.month === mIdx + 1);
                                const val = item && item.hasBankData ? item.closingBalance : null;
                                return (
                                    <td key={mIdx} className="px-0.5 py-2.5 text-right font-mono text-amber-200 truncate">
                                        {loading ? '...' : (val !== null && val !== undefined ? formatCompactEUR(val) : '')}
                                    </td>
                                );
                            })}
                            <td className="px-1.5 py-2.5 text-right font-bold text-amber-400 bg-amber-950/40 border-l border-zinc-800 truncate">
                                {loading ? '...' : (() => {
                                    const lastRecorded = [...monthlyData].reverse().find(i => i.hasBankData && i.closingBalance !== null);
                                    return lastRecorded?.closingBalance !== undefined && lastRecorded?.closingBalance !== null ? formatCompactEUR(lastRecorded.closingBalance) : '';
                                })()}
                            </td>
                        </tr>

                        {/* CLOSING SUB-ROWS (PER BANK ACCOUNT) */}
                        {expandedClosing && sampleBreakdown.map((bank, bIdx) => (
                            <tr key={`cl_${bIdx}`} className="bg-amber-950/10 text-amber-300/80 hover:bg-amber-900/20 transition-colors text-[10px]">
                                <td className="pl-6 pr-2 py-1 font-sans truncate text-zinc-400" title={bank.name}>
                                    └ {bank.name.replace('BANCA POPOLARE ', 'B. ').replace('BANCA POP. ', 'B. ')}
                                </td>
                                {shortMonths.map((_, mIdx) => {
                                    const item = monthlyData.find((i) => i.month === mIdx + 1);
                                    const bankItem = item?.bankBreakdown?.find(b => b.accountCode === bank.accountCode);
                                    const val = item && item.hasBankData && bankItem ? bankItem.closing : null;
                                    return (
                                        <td key={mIdx} className="px-0.5 py-1 text-right truncate font-mono">
                                            {loading ? '...' : (val !== null && val !== undefined ? formatCompactEUR(val) : '')}
                                        </td>
                                    );
                                })}
                                <td className="px-1.5 py-1 text-right bg-zinc-800/10 border-l border-zinc-800 truncate">
                                    -
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
