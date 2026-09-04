'use client';

import React, { useState } from 'react';
import { CalendarRange, ArrowUpRight, ArrowDownRight, ChevronRight, ChevronDown } from 'lucide-react';
import { APP_COPY } from '@/locales';
import { MonthlyFinancialItem, ClientMonthlyBreakdownItem, PayrollMonthlyBreakdown, ExtraExpenseCategoryBreakdown, SupplierCostGroupBreakdown } from '@/app/cashflow/cashflow-actions';
import { ExpandableMatrixCategory } from './ExpandableMatrixCategory';

interface CashflowMonthlyMatrixProps {
    monthlyData?: MonthlyFinancialItem[];
    clientMonthlySummary?: ClientMonthlyBreakdownItem[];
    payrollMonthlyBreakdown?: PayrollMonthlyBreakdown[];
    extraExpenseBreakdown?: ExtraExpenseCategoryBreakdown[];
    supplierCostGroupBreakdown?: SupplierCostGroupBreakdown[];
    grandTotalIncome?: number;
    grandTotalExpense?: number;
    grandTotalPayroll?: number;
    grandTotalExtraExpenses?: number;
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
    clientMonthlySummary = [],
    payrollMonthlyBreakdown = [],
    extraExpenseBreakdown = [],
    supplierCostGroupBreakdown = [],
    grandTotalIncome = 0,
    grandTotalExpense = 0,
    grandTotalPayroll = 0,
    grandTotalExtraExpenses = 0,
    grandNetCashflow = 0,
    year = 2026,
    loading = false,
}) => {
    const mx = APP_COPY.cashflow.matrix;
    const m = APP_COPY.cashflow.macro;

    const [expandedOpening, setExpandedOpening] = useState<boolean>(false);
    const [expandedIncomes, setExpandedIncomes] = useState<boolean>(false);
    const [expandedClientIncomes, setExpandedClientIncomes] = useState<boolean>(false);
    const [expandedExpenses, setExpandedExpenses] = useState<boolean>(false);
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [expandedClosing, setExpandedClosing] = useState<boolean>(false);

    const toggleCategory = (key: string) => {
        setExpandedCategories(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

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

                        {/* OPENING SUB-ROWS (PER BANK ACCOUNT ORGANIZED BY ATTIVO & PASSIVO) */}
                        {expandedOpening && (
                            <>
                                {/* Attivo Sub-Header */}
                                <tr className="bg-emerald-950/20 text-emerald-400 font-sans font-bold uppercase tracking-wider text-[9px]">
                                    <td className="pl-6 py-0.5" colSpan={14}>
                                        └ ATTIVO (+)
                                    </td>
                                </tr>
                                {sampleBreakdown.filter(b => [9020021, 9020037, 12010004, 12010002].includes(b.accountCode)).map((bank, bIdx) => (
                                    <tr key={`op_att_${bIdx}`} className="bg-sky-950/10 text-sky-300/80 hover:bg-sky-900/20 transition-colors text-[10px]">
                                        <td className="pl-8 pr-2 py-1 font-sans truncate text-zinc-400" title={bank.name}>
                                            └ {bank.name.replace('BANCA POPOLARE ', 'B. ').replace('BANCA POP. ', 'B. ')}
                                        </td>
                                        {shortMonths.map((_, mIdx) => {
                                            const item = monthlyData.find((i) => i.month === mIdx + 1);
                                            const bankItem = item?.bankBreakdown?.find(b => b.accountCode === bank.accountCode);
                                            const val = item && item.hasBankData && bankItem ? bankItem.opening : null;
                                            return (
                                                <td key={mIdx} className="px-0.5 py-1 text-right truncate font-mono text-emerald-300/80">
                                                    {loading ? '...' : (val !== null && val !== undefined ? formatCompactEUR(val) : '')}
                                                </td>
                                            );
                                        })}
                                        <td className="px-1.5 py-1 text-right bg-zinc-800/10 border-l border-zinc-800 truncate">
                                            -
                                        </td>
                                    </tr>
                                ))}

                                {/* Passivo Sub-Header */}
                                <tr className="bg-rose-950/20 text-rose-400 font-sans font-bold uppercase tracking-wider text-[9px]">
                                    <td className="pl-6 py-0.5" colSpan={14}>
                                        └ PASSIVO (-)
                                    </td>
                                </tr>
                                {sampleBreakdown.filter(b => [12010001, 12010003, 20110015].includes(b.accountCode)).map((bank, bIdx) => (
                                    <tr key={`op_pass_${bIdx}`} className="bg-sky-950/10 text-sky-300/80 hover:bg-sky-900/20 transition-colors text-[10px]">
                                        <td className="pl-8 pr-2 py-1 font-sans truncate text-zinc-400" title={bank.name}>
                                            └ {bank.name.replace('BANCA POPOLARE ', 'B. ').replace('BANCA POP. ', 'B. ')}
                                        </td>
                                        {shortMonths.map((_, mIdx) => {
                                            const item = monthlyData.find((i) => i.month === mIdx + 1);
                                            const bankItem = item?.bankBreakdown?.find(b => b.accountCode === bank.accountCode);
                                            const val = item && item.hasBankData && bankItem ? bankItem.opening : null;
                                            return (
                                                <td key={mIdx} className="px-0.5 py-1 text-right truncate font-mono text-rose-300/80">
                                                    {loading ? '...' : (val !== null && val !== undefined ? formatCompactEUR(val) : '')}
                                                </td>
                                            );
                                        })}
                                        <td className="px-1.5 py-1 text-right bg-zinc-800/10 border-l border-zinc-800 truncate">
                                            -
                                        </td>
                                    </tr>
                                ))}
                            </>
                        )}

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

                        {/* CASH IN SUB-ROWS (2-Level Hierarchy) */}
                        {expandedIncomes && (
                            <>
                                {/* Level 1 Sub-Row: Incassi da Clienti (Fatturato) */}
                                <tr 
                                    onClick={() => setExpandedClientIncomes(!expandedClientIncomes)}
                                    className="hover:bg-zinc-800/40 transition-colors text-[10px] bg-emerald-950/20 font-semibold cursor-pointer border-t border-b border-zinc-800/40"
                                >
                                    <td className="pl-6 pr-2 py-1.5 font-sans text-emerald-300 flex items-center gap-1 truncate" title={m.clientIncomes}>
                                        {expandedClientIncomes ? <ChevronDown size={13} className="text-emerald-400 shrink-0" /> : <ChevronRight size={13} className="text-emerald-400 shrink-0" />}
                                        └ {m.clientIncomes}
                                    </td>
                                    {shortMonths.map((_, mIdx) => {
                                        const item = monthlyData.find((i) => i.month === mIdx + 1);
                                        const val = item ? item.incomeAmount : 0;
                                        return (
                                            <td key={mIdx} className="px-0.5 py-1.5 text-right text-emerald-300 font-mono truncate">
                                                {loading ? '...' : formatCompactEUR(val)}
                                            </td>
                                        );
                                    })}
                                    <td className="px-1.5 py-1.5 text-right font-mono text-emerald-400 font-bold bg-zinc-800/30 border-l border-zinc-800 truncate">
                                        {loading ? '...' : formatCompactEUR(grandTotalIncome)}
                                    </td>
                                </tr>

                                {/* Level 2 Sub-Rows: Client List (Nested under Incassi da Clienti) */}
                                {expandedClientIncomes && (
                                    <>
                                        {clientMonthlySummary.length > 0 ? (
                                            clientMonthlySummary.map((client, cIdx) => (
                                                <tr key={`client_${cIdx}`} className="hover:bg-zinc-800/50 transition-colors text-[10px] bg-zinc-900/40">
                                                    <td className="pl-10 pr-2 py-1 font-sans text-zinc-300 truncate" title={client.name}>
                                                        └ {client.name}
                                                    </td>
                                                    {shortMonths.map((_, mIdx) => {
                                                        const val = client.monthlyAmounts[mIdx + 1] || 0;
                                                        return (
                                                            <td key={mIdx} className="px-0.5 py-1 text-right text-emerald-300/70 font-mono truncate">
                                                                {loading ? '...' : (val > 0 ? formatCompactEUR(val) : '-')}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-1.5 py-1 text-right font-mono text-emerald-400/90 font-medium bg-zinc-800/20 border-l border-zinc-800 truncate">
                                                        {loading ? '...' : formatCompactEUR(client.totalAmount)}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr className="hover:bg-zinc-800/30 transition-colors text-[10px]">
                                                <td className="pl-10 pr-2 py-1.5 font-sans font-medium text-zinc-500 truncate" colSpan={14}>
                                                    └ Nessun cliente registrato per l&apos;anno
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                )}
                            </>
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
                                const val = item ? (item.expenseAmount + item.payrollAmount + item.extraExpenseAmount) : 0;
                                return (
                                    <td key={mIdx} className="px-0.5 py-2 text-right text-rose-300 font-mono font-bold truncate">
                                        {loading ? '...' : formatCompactEUR(val)}
                                    </td>
                                );
                            })}
                            <td className="px-1.5 py-2 text-right font-bold font-mono text-rose-400 bg-rose-950/50 border-l border-zinc-800 truncate">
                                {loading ? '...' : formatCompactEUR(grandTotalExpense + grandTotalPayroll + grandTotalExtraExpenses)}
                            </td>
                        </tr>

                        {/* CASH OUT SUB-ROWS */}
                        {expandedExpenses && (
                            <>
                                {/* Level 1: Fornitori Materie Prime (expandable by cost group) */}
                                <ExpandableMatrixCategory
                                    title={m.supplierExpenses}
                                    items={supplierCostGroupBreakdown.map(g => ({
                                        accountCode: g.costAccountCode,
                                        label: g.label,
                                        monthlyAmounts: g.monthlyAmounts,
                                        totalAmount: g.totalAmount,
                                    }))}
                                    isExpanded={expandedCategories['suppliers'] || false}
                                    onToggle={() => toggleCategory('suppliers')}
                                    totalAmount={grandTotalExpense}
                                    shortMonths={shortMonths}
                                    loading={loading}
                                    formatCompactEUR={formatCompactEUR}
                                />

                                {/* Level 1: Stipendi & Costo del Personale (expandable) */}
                                <ExpandableMatrixCategory
                                    title={m.payrollExpenses}
                                    items={payrollMonthlyBreakdown.map(p => ({
                                        accountCode: p.accountCode,
                                        label: m[p.localeKey] || p.localeKey,
                                        monthlyAmounts: p.monthlyAmounts,
                                        totalAmount: p.totalAmount
                                    }))}
                                    isExpanded={expandedCategories['payroll'] || false}
                                    onToggle={() => toggleCategory('payroll')}
                                    totalAmount={grandTotalPayroll}
                                    shortMonths={shortMonths}
                                    loading={loading}
                                    formatCompactEUR={formatCompactEUR}
                                />

                                {/* Extra Expense Categories (Taxes, Financing, Leasing, Bank Fees) */}
                                {extraExpenseBreakdown.map((cat) => (
                                    <ExpandableMatrixCategory
                                        key={`extra_cat_${cat.key}`}
                                        title={cat.label}
                                        items={cat.accounts.map(acc => ({
                                            accountCode: acc.accountCode,
                                            label: acc.label,
                                            monthlyAmounts: acc.monthlyAmounts,
                                            totalAmount: acc.totalAmount
                                        }))}
                                        isExpanded={expandedCategories[cat.key] || false}
                                        onToggle={() => toggleCategory(cat.key)}
                                        totalAmount={cat.totalAmount}
                                        shortMonths={shortMonths}
                                        loading={loading}
                                        formatCompactEUR={formatCompactEUR}
                                    />
                                ))}
                            </>
                        )}

                        {/* 4. CASH FLOW ROW */}
                        <tr className="bg-zinc-900 font-bold border-t border-b border-zinc-700 text-zinc-100 text-xs">
                            <td className="px-2 py-2.5 font-sans truncate" title="Saldo Iniziale + Entrate - Uscite">Flusso di Cassa (Cash Flow)</td>
                            {shortMonths.map((_, mIdx) => {
                                const item = monthlyData.find((i) => i.month === mIdx + 1);
                                const val = item ? item.cashFlow : 0;
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

                        {/* 4.5 RECONCILIATION DISCREPANCY ROW */}
                        <tr className="bg-zinc-950 font-semibold text-[10px] text-zinc-400 border-b border-zinc-800">
                            <td className="px-2 py-1.5 font-sans truncate text-amber-400/90" title="Scostamento tra Flusso di Cassa Calcolato e Saldo Finale Reale in Banca">
                                ⚠ Scostamento Banca (Non tracciato)
                            </td>
                            {shortMonths.map((_, mIdx) => {
                                const item = monthlyData.find((i) => i.month === mIdx + 1);
                                if (!item || !item.hasBankData || item.openingBalance === null || item.openingBalance === undefined || item.closingBalance === null || item.closingBalance === undefined) {
                                    return <td key={mIdx} className="px-0.5 py-1.5 text-right font-mono text-zinc-600">-</td>;
                                }
                                // Expected closing = cash flow (which already includes opening + net)
                                const expectedClosing = item.cashFlow;
                                const diff = item.closingBalance - expectedClosing;
                                const isZero = Math.abs(diff) < 1;
                                return (
                                    <td 
                                        key={mIdx} 
                                        className={`px-0.5 py-1.5 text-right font-mono truncate ${
                                            isZero ? 'text-zinc-500' : diff > 0 ? 'text-emerald-400/80' : 'text-rose-400/80'
                                        }`}
                                        title={`Atteso: ${formatCompactEUR(expectedClosing)} | Reale: ${formatCompactEUR(item.closingBalance)}`}
                                    >
                                        {loading ? '...' : (diff > 0 ? `+${formatCompactEUR(diff)}` : formatCompactEUR(diff))}
                                    </td>
                                );
                            })}
                            <td className="px-1.5 py-1.5 text-right font-mono text-zinc-500 bg-zinc-900 border-l border-zinc-800 truncate">
                                -
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

                        {/* CLOSING SUB-ROWS (PER BANK ACCOUNT ORGANIZED BY ATTIVO & PASSIVO) */}
                        {expandedClosing && (
                            <>
                                {/* Attivo Sub-Header */}
                                <tr className="bg-emerald-950/20 text-emerald-400 font-sans font-bold uppercase tracking-wider text-[9px]">
                                    <td className="pl-6 py-0.5" colSpan={14}>
                                        └ ATTIVO (+)
                                    </td>
                                </tr>
                                {sampleBreakdown.filter(b => [9020021, 9020037, 12010004, 12010002].includes(b.accountCode)).map((bank, bIdx) => (
                                    <tr key={`cl_att_${bIdx}`} className="bg-amber-950/10 text-amber-300/80 hover:bg-amber-900/20 transition-colors text-[10px]">
                                        <td className="pl-8 pr-2 py-1 font-sans truncate text-zinc-400" title={bank.name}>
                                            └ {bank.name.replace('BANCA POPOLARE ', 'B. ').replace('BANCA POP. ', 'B. ')}
                                        </td>
                                        {shortMonths.map((_, mIdx) => {
                                            const item = monthlyData.find((i) => i.month === mIdx + 1);
                                            const bankItem = item?.bankBreakdown?.find(b => b.accountCode === bank.accountCode);
                                            const val = item && item.hasBankData && bankItem ? bankItem.closing : null;
                                            return (
                                                <td key={mIdx} className="px-0.5 py-1 text-right truncate font-mono text-emerald-300/80">
                                                    {loading ? '...' : (val !== null && val !== undefined ? formatCompactEUR(val) : '')}
                                                </td>
                                            );
                                        })}
                                        <td className="px-1.5 py-1 text-right bg-zinc-800/10 border-l border-zinc-800 truncate">
                                            -
                                        </td>
                                    </tr>
                                ))}

                                {/* Passivo Sub-Header */}
                                <tr className="bg-rose-950/20 text-rose-400 font-sans font-bold uppercase tracking-wider text-[9px]">
                                    <td className="pl-6 py-0.5" colSpan={14}>
                                        └ PASSIVO (-)
                                    </td>
                                </tr>
                                {sampleBreakdown.filter(b => [12010001, 12010003, 20110015].includes(b.accountCode)).map((bank, bIdx) => (
                                    <tr key={`cl_pass_${bIdx}`} className="bg-amber-950/10 text-amber-300/80 hover:bg-amber-900/20 transition-colors text-[10px]">
                                        <td className="pl-8 pr-2 py-1 font-sans truncate text-zinc-400" title={bank.name}>
                                            └ {bank.name.replace('BANCA POPOLARE ', 'B. ').replace('BANCA POP. ', 'B. ')}
                                        </td>
                                        {shortMonths.map((_, mIdx) => {
                                            const item = monthlyData.find((i) => i.month === mIdx + 1);
                                            const bankItem = item?.bankBreakdown?.find(b => b.accountCode === bank.accountCode);
                                            const val = item && item.hasBankData && bankItem ? bankItem.closing : null;
                                            return (
                                                <td key={mIdx} className="px-0.5 py-1 text-right truncate font-mono text-rose-300/80">
                                                    {loading ? '...' : (val !== null && val !== undefined ? formatCompactEUR(val) : '')}
                                                </td>
                                            );
                                        })}
                                        <td className="px-1.5 py-1 text-right bg-zinc-800/10 border-l border-zinc-800 truncate">
                                            -
                                        </td>
                                    </tr>
                                ))}
                            </>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
