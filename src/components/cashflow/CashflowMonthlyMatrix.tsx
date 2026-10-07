'use client';

import React, { useState } from 'react';
import { CalendarRange, ArrowUpRight, ArrowDownRight, ChevronRight, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { APP_COPY } from '@/locales';
import type {
    BankAccountBalance,
    ClientMonthlyBreakdownItem,
    ExtraExpenseCategoryBreakdown,
    MonthlyFinancialItem,
    PayrollMonthlyBreakdown,
    SupplierCostGroupBreakdown,
} from '@/lib/cashflow/types';
import { CASHFLOW_CONFIG } from '@/config/cashflowConfig';
import { ExpandableMatrixCategory } from './ExpandableMatrixCategory';
import { BankMatrixRowGroup } from './BankMatrixRowGroup';
import { EMPTY_VALUE, formatCurrencyRounded } from '@/lib/format';

interface CashflowMonthlyMatrixProps {
    monthlyData?: MonthlyFinancialItem[];
    bankBalances?: BankAccountBalance[];
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
    if (amount === undefined || amount === null || isNaN(amount)) return EMPTY_VALUE;
    if (amount === 0) return '€0';
    return formatCurrencyRounded(amount);
};

export const CashflowMonthlyMatrix: React.FC<CashflowMonthlyMatrixProps> = ({
    monthlyData = [],
    bankBalances = [],
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

    const [allExpanded, setAllExpanded] = useState<boolean>(false);
    const [expandedOpening, setExpandedOpening] = useState<boolean>(false);
    const [expandedIncomes, setExpandedIncomes] = useState<boolean>(false);
    const [expandedClientIncomes, setExpandedClientIncomes] = useState<boolean>(false);
    const [expandedExpenses, setExpandedExpenses] = useState<boolean>(false);
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [expandedClosing, setExpandedClosing] = useState<boolean>(false);
    const [expandedBankDrilldown, setExpandedBankDrilldown] = useState<{
        accountCode: number;
        name: string;
        section: 'opening' | 'closing';
        month: number | null;
    } | null>(null);

    const handleToggleAll = () => {
        const next = !allExpanded;
        setAllExpanded(next);
        setExpandedOpening(next);
        setExpandedIncomes(next);
        setExpandedClientIncomes(next);
        setExpandedExpenses(next);
        setExpandedClosing(next);
        const cats: Record<string, boolean> = {};
        CASHFLOW_CONFIG.EXTRA_EXPENSE_CATEGORIES.forEach(c => (cats[c.key] = next));
        setExpandedCategories(cats);
    };

    const handleToggleBankDrilldown = (
        accountCode: number,
        name: string,
        section: 'opening' | 'closing',
        month: number | null = null
    ) => {
        if (
            expandedBankDrilldown?.accountCode === accountCode &&
            expandedBankDrilldown?.section === section &&
            (month === null || expandedBankDrilldown?.month === month)
        ) {
            setExpandedBankDrilldown(null);
        } else {
            setExpandedBankDrilldown({ accountCode, name, section, month });
        }
    };

    const toggleCategory = (key: string) => {
        setExpandedCategories(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const shortMonths = APP_COPY.months.short;

    // Current calendar month for visual indicator
    const currentCalendarMonth = new Date().getMonth() + 1;
    const currentCalendarYear = new Date().getFullYear();

    // Extract unique bank accounts from the first available month's breakdown
    const sampleBreakdown = monthlyData.find(i => i.bankBreakdown && i.bankBreakdown.length > 0)?.bankBreakdown || [];

    // Filter banks using Single Source of Truth from CASHFLOW_CONFIG
    const attivoBanks = sampleBreakdown.filter(b => CASHFLOW_CONFIG.isAttivo(b.accountCode));
    const passivoBanks = sampleBreakdown.filter(b => !CASHFLOW_CONFIG.isAttivo(b.accountCode));

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm w-full">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg">
                        <CalendarRange size={18} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-fg text-base">
                            {mx.title} ({year})
                        </h3>
                        <p className="text-xs text-fg-muted">Clicca sulle righe per espandere/comprimere le voci interne</p>
                    </div>
                </div>

                {/* Quick Action: Expand All / Collapse All */}
                <button
                    onClick={handleToggleAll}
                    className="px-3 py-1.5 rounded-lg bg-muted/80 hover:bg-muted-strong text-fg-secondary hover:text-fg-strong transition-colors text-xs flex items-center gap-1.5 border border-border-strong/60 font-medium"
                    title={allExpanded ? mx.collapseAll : mx.expandAll}
                >
                    <ChevronsUpDown size={14} className="text-primary" />
                    <span>{allExpanded ? mx.collapseAll : mx.expandAll}</span>
                </button>
            </div>

            {/* Matrix Table - Fits 12 months without horizontal scroll */}
            <div className="w-full overflow-hidden">
                <table className="w-full text-left text-xs table-fixed">
                    <thead className="bg-card/90 text-fg-muted font-semibold border-b border-border text-3xs">
                        <tr>
                            <th className="px-2 py-2.5 w-[22%] truncate">{mx.categoryHeader}</th>
                            {shortMonths.map((month, idx) => {
                                const isCurrent = idx + 1 === currentCalendarMonth && year === currentCalendarYear;
                                return (
                                    <th
                                        key={idx}
                                        className={`px-0.5 py-2.5 text-right font-mono uppercase tracking-wider ${
                                            isCurrent ? 'text-primary font-bold bg-primary/10' : ''
                                        }`}
                                        title={isCurrent ? 'Mese Corrente' : undefined}
                                    >
                                        {isCurrent && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mr-1" />}
                                        {month}
                                    </th>
                                );
                            })}
                            <th className="px-1.5 py-2.5 text-right font-mono text-fg-soft bg-muted/40 w-[10%]">
                                {mx.totalHeader}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-mono text-2xs">
                        
                        {/* 1. OPENING BALANCE MAIN ROW */}
                        <tr 
                            onClick={() => setExpandedOpening(!expandedOpening)}
                            className="bg-info-950/20 font-semibold border-b border-info-900/30 text-info-200 cursor-pointer hover:bg-info-900/30 transition-colors"
                        >
                            <td className="px-2 py-2 font-sans flex items-center gap-1.5 truncate" title="Clicca per espandere le banche">
                                {expandedOpening ? <ChevronDown size={14} className="text-info-400 shrink-0" /> : <ChevronRight size={14} className="text-info-400 shrink-0" />}
                                Saldo Iniziale (Opening)
                            </td>
                            {shortMonths.map((_, mIdx) => {
                                const item = monthlyData.find((i) => i.month === mIdx + 1);
                                const val = item && item.hasBankData ? item.openingBalance : null;
                                return (
                                    <td key={mIdx} className="px-0.5 py-2 text-right text-info-300 truncate">
                                        {loading ? '...' : (val !== null && val !== undefined ? formatCompactEUR(val) : '')}
                                    </td>
                                );
                            })}
                            <td className="px-1.5 py-2 text-right font-bold text-info-400 bg-info-950/40 border-l border-border truncate">
                                {loading ? '...' : (monthlyData.find(i => i.hasBankData)?.openingBalance !== undefined ? formatCompactEUR(monthlyData.find(i => i.hasBankData)?.openingBalance ?? 0) : '')}
                            </td>
                        </tr>

                        {/* OPENING SUB-ROWS (PER BANK ACCOUNT ORGANIZED BY ATTIVO & PASSIVO) */}
                        {expandedOpening && (
                            <>
                                <BankMatrixRowGroup
                                    category="attivo"
                                    section="opening"
                                    banks={attivoBanks}
                                    monthlyData={monthlyData}
                                    bankBalances={bankBalances}
                                    shortMonths={shortMonths}
                                    year={year}
                                    loading={loading}
                                    formatCompactEUR={formatCompactEUR}
                                    expandedBankDrilldown={expandedBankDrilldown}
                                    onToggleDrilldown={handleToggleBankDrilldown}
                                    onCloseDrilldown={() => setExpandedBankDrilldown(null)}
                                />
                                <BankMatrixRowGroup
                                    category="passivo"
                                    section="opening"
                                    banks={passivoBanks}
                                    monthlyData={monthlyData}
                                    bankBalances={bankBalances}
                                    shortMonths={shortMonths}
                                    year={year}
                                    loading={loading}
                                    formatCompactEUR={formatCompactEUR}
                                    expandedBankDrilldown={expandedBankDrilldown}
                                    onToggleDrilldown={handleToggleBankDrilldown}
                                    onCloseDrilldown={() => setExpandedBankDrilldown(null)}
                                />
                            </>
                        )}

                        {/* 2. CASH IN MAIN ROW (ENTRATE) */}
                        <tr 
                            onClick={() => setExpandedIncomes(!expandedIncomes)}
                            className="bg-success-950/30 text-success-400 font-sans font-bold uppercase tracking-wider text-3xs cursor-pointer hover:bg-success-900/40 transition-colors"
                        >
                            <td className="px-2 py-2 flex items-center gap-1.5 truncate" title="Clicca per espandere le voci di entrate">
                                {expandedIncomes ? <ChevronDown size={14} className="text-success-400 shrink-0" /> : <ChevronRight size={14} className="text-success-400 shrink-0" />}
                                <ArrowUpRight size={12} className="shrink-0" />
                                {mx.incomesSection} (Cash In)
                            </td>
                            {shortMonths.map((_, mIdx) => {
                                const item = monthlyData.find((i) => i.month === mIdx + 1);
                                const val = item ? item.incomeAmount : 0;
                                return (
                                    <td key={mIdx} className="px-0.5 py-2 text-right text-success-300 font-mono font-bold truncate">
                                        {loading ? '...' : formatCompactEUR(val)}
                                    </td>
                                );
                            })}
                            <td className="px-1.5 py-2 text-right font-bold font-mono text-success-400 bg-success-950/50 border-l border-border truncate">
                                {loading ? '...' : formatCompactEUR(grandTotalIncome)}
                            </td>
                        </tr>

                        {/* CASH IN SUB-ROWS (2-Level Hierarchy) */}
                        {expandedIncomes && (
                            <>
                                {/* Level 1 Sub-Row: Incassi da Clienti (Fatturato) */}
                                <tr 
                                    onClick={() => setExpandedClientIncomes(!expandedClientIncomes)}
                                    className="hover:bg-muted/40 transition-colors text-3xs bg-success-950/20 font-semibold cursor-pointer border-t border-b border-border/40"
                                >
                                    <td className="pl-6 pr-2 py-1.5 font-sans text-success-300 flex items-center gap-1 truncate" title={m.clientIncomes}>
                                        {expandedClientIncomes ? <ChevronDown size={13} className="text-success-400 shrink-0" /> : <ChevronRight size={13} className="text-success-400 shrink-0" />}
                                        └ {m.clientIncomes}
                                    </td>
                                    {shortMonths.map((_, mIdx) => {
                                        const item = monthlyData.find((i) => i.month === mIdx + 1);
                                        const val = item ? item.incomeAmount : 0;
                                        return (
                                            <td key={mIdx} className="px-0.5 py-1.5 text-right text-success-300 font-mono truncate">
                                                {loading ? '...' : formatCompactEUR(val)}
                                            </td>
                                        );
                                    })}
                                    <td className="px-1.5 py-1.5 text-right font-mono text-success-400 font-bold bg-muted/30 border-l border-border truncate">
                                        {loading ? '...' : formatCompactEUR(grandTotalIncome)}
                                    </td>
                                </tr>

                                {/* Level 2 Sub-Rows: Client List (Nested under Incassi da Clienti) */}
                                {expandedClientIncomes && (
                                    <>
                                        {clientMonthlySummary.length > 0 ? (
                                            clientMonthlySummary.map((client, cIdx) => (
                                                <tr key={`client_${cIdx}`} className="hover:bg-muted/50 transition-colors text-3xs bg-card/40">
                                                    <td className="pl-10 pr-2 py-1 font-sans text-fg-secondary truncate" title={client.name}>
                                                        └ {client.name}
                                                    </td>
                                                    {shortMonths.map((_, mIdx) => {
                                                        const val = client.monthlyAmounts[mIdx + 1] || 0;
                                                        return (
                                                            <td key={mIdx} className="px-0.5 py-1 text-right text-success-300/70 font-mono truncate">
                                                                {loading ? '...' : (val > 0 ? formatCompactEUR(val) : '-')}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-1.5 py-1 text-right font-mono text-success-400/90 font-medium bg-muted/20 border-l border-border truncate">
                                                        {loading ? '...' : formatCompactEUR(client.totalAmount)}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr className="hover:bg-muted/30 transition-colors text-3xs">
                                                <td className="pl-10 pr-2 py-1.5 font-sans font-medium text-fg-subtle truncate" colSpan={14}>
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
                            className="bg-danger-950/30 text-danger-400 font-sans font-bold uppercase tracking-wider text-3xs cursor-pointer hover:bg-danger-900/40 transition-colors"
                        >
                            <td className="px-2 py-2 flex items-center gap-1.5 truncate" title="Clicca per espandere le voci di uscite">
                                {expandedExpenses ? <ChevronDown size={14} className="text-danger-400 shrink-0" /> : <ChevronRight size={14} className="text-danger-400 shrink-0" />}
                                <ArrowDownRight size={12} className="shrink-0" />
                                {mx.expensesSection} (Cash Out)
                            </td>
                            {shortMonths.map((_, mIdx) => {
                                const item = monthlyData.find((i) => i.month === mIdx + 1);
                                const val = item ? (item.expenseAmount + item.payrollAmount + item.extraExpenseAmount) : 0;
                                return (
                                    <td key={mIdx} className="px-0.5 py-2 text-right text-danger-300 font-mono font-bold truncate">
                                        {loading ? '...' : formatCompactEUR(val)}
                                    </td>
                                );
                            })}
                            <td className="px-1.5 py-2 text-right font-bold font-mono text-danger-400 bg-danger-950/50 border-l border-border truncate">
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
                        <tr className="bg-card font-bold border-t border-b border-border-strong text-fg text-xs">
                            <td className="px-2 py-2.5 font-sans truncate" title="Saldo Iniziale + Entrate - Uscite">Flusso di Cassa (Cash Flow)</td>
                            {shortMonths.map((_, mIdx) => {
                                const item = monthlyData.find((i) => i.month === mIdx + 1);
                                const val = item ? item.cashFlow : 0;
                                const isPositive = val >= 0;
                                return (
                                    <td
                                        key={mIdx}
                                        className={`px-0.5 py-2.5 text-right truncate ${
                                            isPositive ? 'text-success-400' : 'text-danger-400'
                                        }`}
                                    >
                                        {loading ? '...' : formatCompactEUR(val)}
                                    </td>
                                );
                            })}
                            <td className="px-1.5 py-2.5 text-right font-bold text-success-400 bg-muted/40 border-l border-border truncate">
                                {loading ? '...' : formatCompactEUR(grandNetCashflow)}
                            </td>
                        </tr>

                        {/* 4.5 RECONCILIATION DISCREPANCY ROW */}
                        <tr className="bg-background font-semibold text-3xs text-fg-muted border-b border-border">
                            <td className="px-2 py-1.5 font-sans truncate text-warning-400/90" title="Scostamento tra Flusso di Cassa Calcolato e Saldo Finale Reale in Banca">
                                ⚠ Scostamento Banca (Non tracciato)
                            </td>
                            {shortMonths.map((_, mIdx) => {
                                const item = monthlyData.find((i) => i.month === mIdx + 1);
                                if (!item || !item.hasBankData || item.openingBalance === null || item.openingBalance === undefined || item.closingBalance === null || item.closingBalance === undefined) {
                                    return <td key={mIdx} className="px-0.5 py-1.5 text-right font-mono text-fg-faint">-</td>;
                                }
                                // Expected closing = cash flow (which already includes opening + net)
                                const expectedClosing = item.cashFlow;
                                const diff = item.closingBalance - expectedClosing;
                                const isZero = Math.abs(diff) < 1;
                                return (
                                    <td 
                                        key={mIdx} 
                                        className={`px-0.5 py-1.5 text-right font-mono truncate ${
                                            isZero ? 'text-fg-subtle' : diff > 0 ? 'text-success-400/80' : 'text-danger-400/80'
                                        }`}
                                        title={`Atteso: ${formatCompactEUR(expectedClosing)} | Reale: ${formatCompactEUR(item.closingBalance)}`}
                                    >
                                        {loading ? '...' : (diff > 0 ? `+${formatCompactEUR(diff)}` : formatCompactEUR(diff))}
                                    </td>
                                );
                            })}
                            <td className="px-1.5 py-1.5 text-right font-mono text-fg-subtle bg-card border-l border-border truncate">
                                -
                            </td>
                        </tr>

                        {/* 5. CLOSING BALANCE MAIN ROW */}
                        <tr 
                            onClick={() => setExpandedClosing(!expandedClosing)}
                            className="bg-warning-950/25 font-bold border-t-2 border-warning-500/40 text-warning-300 text-xs cursor-pointer hover:bg-warning-900/30 transition-colors"
                        >
                            <td className="px-2 py-2.5 font-sans flex items-center gap-1.5 truncate" title="Clicca per espandere le banche">
                                {expandedClosing ? <ChevronDown size={14} className="text-warning-400 shrink-0" /> : <ChevronRight size={14} className="text-warning-400 shrink-0" />}
                                Saldo Finale (Closing)
                            </td>
                            {shortMonths.map((_, mIdx) => {
                                const item = monthlyData.find((i) => i.month === mIdx + 1);
                                const val = item && item.hasBankData ? item.closingBalance : null;
                                return (
                                    <td key={mIdx} className="px-0.5 py-2.5 text-right font-mono text-warning-200 truncate">
                                        {loading ? '...' : (val !== null && val !== undefined ? formatCompactEUR(val) : '')}
                                    </td>
                                );
                            })}
                            <td className="px-1.5 py-2.5 text-right font-bold text-warning-400 bg-warning-950/40 border-l border-border truncate">
                                {loading ? '...' : (() => {
                                    const lastRecorded = [...monthlyData].reverse().find(i => i.hasBankData && i.closingBalance !== null);
                                    return lastRecorded?.closingBalance !== undefined && lastRecorded?.closingBalance !== null ? formatCompactEUR(lastRecorded.closingBalance) : '';
                                })()}
                            </td>
                        </tr>

                        {/* CLOSING SUB-ROWS (PER BANK ACCOUNT ORGANIZED BY ATTIVO & PASSIVO) */}
                        {expandedClosing && (
                            <>
                                <BankMatrixRowGroup
                                    category="attivo"
                                    section="closing"
                                    banks={attivoBanks}
                                    monthlyData={monthlyData}
                                    bankBalances={bankBalances}
                                    shortMonths={shortMonths}
                                    year={year}
                                    loading={loading}
                                    formatCompactEUR={formatCompactEUR}
                                    expandedBankDrilldown={expandedBankDrilldown}
                                    onToggleDrilldown={handleToggleBankDrilldown}
                                    onCloseDrilldown={() => setExpandedBankDrilldown(null)}
                                />
                                <BankMatrixRowGroup
                                    category="passivo"
                                    section="closing"
                                    banks={passivoBanks}
                                    monthlyData={monthlyData}
                                    bankBalances={bankBalances}
                                    shortMonths={shortMonths}
                                    year={year}
                                    loading={loading}
                                    formatCompactEUR={formatCompactEUR}
                                    expandedBankDrilldown={expandedBankDrilldown}
                                    onToggleDrilldown={handleToggleBankDrilldown}
                                    onCloseDrilldown={() => setExpandedBankDrilldown(null)}
                                />
                            </>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
