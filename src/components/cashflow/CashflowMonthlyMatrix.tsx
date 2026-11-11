'use client';

import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, CalendarRange, ChevronsUpDown } from 'lucide-react';
import { BankMatrixRowGroup, type BankDrilldown } from '@/components/cashflow/BankMatrixRowGroup';
import { ExpandableMatrixCategory } from '@/components/cashflow/ExpandableMatrixCategory';
import { MatrixRow } from '@/components/cashflow/MatrixRow';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CASHFLOW_CONFIG } from '@/config/cashflowConfig';
import { useAddress } from '@/hooks/useAddress';
import { choiceParam, listParam, numberParam } from '@/lib/address';
import { firstOpeningBalance, lastClosingBalance, monthValues } from '@/lib/cashflow/matrix';
import type { CashflowDataResult } from '@/lib/cashflow/types';
import { formatCurrencyRounded } from '@/lib/format';
import { cn, toggleInSet } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.cashflow.matrix;
const macro = APP_COPY.cashflow.macro;

/** Rows that open and close; the extra-expense categories add their own keys */
const SECTION_KEYS = ['opening', 'incomes', 'clients', 'expenses', 'suppliers', 'payroll', 'closing'];

const SIDES = ['opening', 'closing'] as const;
/**
 * What is opened in the table, in the address: the rows unfolded, and the bank account whose operations are shown
 * (its code, under which balance, the month clicked). Unfolding stays on the same history step.
 */
const VIEW = { open: listParam([]), bank: numberParam(), side: choiceParam(SIDES, 'opening'), month: numberParam() };
/** For "Pulisci" of the page, which folds everything back */
export const MATRIX_VIEW_NAMES = Object.keys(VIEW);

const signed = (value: number) => (value > 0 ? `+${formatCurrencyRounded(value)}` : formatCurrencyRounded(value));

interface CashflowMonthlyMatrixProps {
    data: CashflowDataResult | null;
    year: number;
    loading: boolean;
}

/**
 * Month-by-month table of the year: opening balance, cash in, cash out, cash flow, the gap to the real bank balance and
 * the closing balance. Rows open to show clients, suppliers, payroll, taxes … and the bank accounts with their operations.
 */
export function CashflowMonthlyMatrix({ data, year, loading }: CashflowMonthlyMatrixProps) {
    const monthly = data?.monthlyBreakdown ?? [];
    const bankBalances = data?.bankBalances ?? [];
    const clients = data?.clientMonthlySummary ?? [];
    const extraCategories = data?.extraExpenseBreakdown ?? [];
    const totals = {
        income: data?.grandTotalIncome ?? 0,
        suppliers: data?.grandTotalExpense ?? 0,
        payroll: data?.grandTotalPayroll ?? 0,
        extra: data?.grandTotalExtraExpenses ?? 0,
        net: data?.grandNetCashflow ?? 0,
    };

    const view = useAddress(VIEW);
    const { open, bank: openBank, side, month: openMonth } = view.values;
    const expanded = useMemo(() => new Set(open), [open]);
    const setExpanded = (keys: ReadonlySet<string>) => view.set({ open: [...keys] }, 'replace');

    const allKeys = [...SECTION_KEYS, ...extraCategories.map((category) => category.key)];
    const allExpanded = allKeys.every((key) => expanded.has(key));
    const expandable = (key: string) => ({ expanded: expanded.has(key), onToggle: () => setExpanded(toggleInSet(expanded, key)) });

    // The accounts are listed from the first month that has a bank breakdown
    const banks = monthly.find((item) => item.bankBreakdown?.length)?.bankBreakdown ?? [];
    const drilldownBank = banks.find((bank) => bank.accountCode === openBank);
    const drilldown: BankDrilldown | null = drilldownBank ? { accountCode: drilldownBank.accountCode, name: drilldownBank.name, section: side, month: openMonth } : null;
    const closeDrilldown = () => view.set({ bank: null, side: 'opening', month: null }, 'replace');

    const toggleDrilldown = (accountCode: number, _name: string, section: 'opening' | 'closing', month: number | null = null) => {
        if (drilldown?.accountCode === accountCode && drilldown.section === section && (month === null || drilldown.month === month)) closeDrilldown();
        else view.set({ bank: accountCode, side: section, month }, 'replace');
    };
    const assets = banks.filter((bank) => CASHFLOW_CONFIG.isAttivo(bank.accountCode));
    const liabilities = banks.filter((bank) => !CASHFLOW_CONFIG.isAttivo(bank.accountCode));
    const bankGroups = (section: 'opening' | 'closing') =>
        (['attivo', 'passivo'] as const).map((category) => (
            <BankMatrixRowGroup
                key={category}
                category={category}
                section={section}
                banks={category === 'attivo' ? assets : liabilities}
                monthlyData={monthly}
                bankBalances={bankBalances}
                year={year}
                loading={loading}
                drilldown={drilldown}
                onToggleDrilldown={toggleDrilldown}
                onCloseDrilldown={closeDrilldown}
            />
        ));

    const today = new Date();
    const currentMonth = year === today.getFullYear() ? today.getMonth() + 1 : null;
    const expense = (item: (typeof monthly)[number]) => item.expenseAmount + item.payrollAmount + item.extraExpenseAmount;
    const gap = (item: (typeof monthly)[number]) =>
        item.hasBankData && item.openingBalance != null && item.closingBalance != null ? item.closingBalance - item.cashFlow : null;
    const sign = (value: number) => (value >= 0 ? 'text-success-400' : 'text-danger-400');

    return (
        <Card className="overflow-hidden w-full">
            <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg">
                        <CalendarRange size={18} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-fg text-base">{fmt(copy.title, { year })}</h3>
                        <p className="text-xs text-fg-muted">{copy.hint}</p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpanded(allExpanded ? new Set() : new Set(allKeys))}
                >
                    <ChevronsUpDown size={14} className="text-primary" />
                    {allExpanded ? copy.collapseAll : copy.expandAll}
                </Button>
            </div>

            {/* Narrow screens: the table keeps its width and scrolls sideways, row names pinned on the left */}
            <div className="overflow-x-auto">
                <table className="w-full max-lg:min-w-matrix text-left text-xs table-fixed">
                    <thead className="bg-card/90 text-fg-muted font-semibold border-b border-border text-3xs">
                        <tr>
                            <th className="px-2 py-2.5 w-[22%] truncate max-lg:sticky max-lg:left-0 max-lg:z-10 max-lg:bg-card">{copy.categoryHeader}</th>
                            {APP_COPY.months.short.map((month, index) => {
                                const current = index + 1 === currentMonth;
                                return (
                                    <th
                                        key={month}
                                        title={current ? copy.currentMonth : undefined}
                                        className={cn('px-0.5 py-2.5 text-right font-mono', current && 'text-primary font-bold bg-primary/10')}
                                    >
                                        {current && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mr-1" />}
                                        {month}
                                    </th>
                                );
                            })}
                            <th className="px-1.5 py-2.5 text-right font-mono text-fg-soft bg-muted/40 w-[10%]">{copy.totalHeader}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-mono text-2xs">
                        <MatrixRow
                            tone="info"
                            label={copy.opening}
                            values={monthValues(monthly, (item) => (item.hasBankData ? item.openingBalance : null))}
                            total={firstOpeningBalance(monthly)}
                            loading={loading}
                            expandable={expandable('opening')}
                        />
                        {expanded.has('opening') && bankGroups('opening')}

                        <MatrixRow
                            tone="success"
                            label={copy.incomes}
                            icon={<ArrowUpRight size={12} className="shrink-0" />}
                            values={monthValues(monthly, (item) => item.incomeAmount, 0)}
                            total={totals.income}
                            loading={loading}
                            expandable={expandable('incomes')}
                        />
                        {expanded.has('incomes') && (
                            <ExpandableMatrixCategory
                                title={macro.clientIncomes}
                                tone="success"
                                items={clients.map((client) => ({ label: client.name, monthlyAmounts: client.monthlyAmounts, totalAmount: client.totalAmount }))}
                                values={monthValues(monthly, (item) => item.incomeAmount, 0)}
                                total={totals.income}
                                emptyText={copy.noClients}
                                expanded={expanded.has('clients')}
                                onToggle={expandable('clients').onToggle}
                                loading={loading}
                            />
                        )}

                        <MatrixRow
                            tone="danger"
                            label={copy.expenses}
                            icon={<ArrowDownRight size={12} className="shrink-0" />}
                            values={monthValues(monthly, expense, 0)}
                            total={totals.suppliers + totals.payroll + totals.extra}
                            loading={loading}
                            expandable={expandable('expenses')}
                        />
                        {expanded.has('expenses') && (
                            <>
                                <ExpandableMatrixCategory
                                    title={macro.supplierExpenses}
                                    tone="danger"
                                    items={(data?.supplierCostGroupBreakdown ?? []).map((group) => ({ label: group.label, monthlyAmounts: group.monthlyAmounts, totalAmount: group.totalAmount }))}
                                    total={totals.suppliers}
                                    expanded={expanded.has('suppliers')}
                                    onToggle={expandable('suppliers').onToggle}
                                    loading={loading}
                                />
                                <ExpandableMatrixCategory
                                    title={macro.payrollExpenses}
                                    tone="danger"
                                    items={(data?.payrollMonthlyBreakdown ?? []).map((line) => ({ label: macro[line.localeKey] || line.localeKey, monthlyAmounts: line.monthlyAmounts, totalAmount: line.totalAmount }))}
                                    total={totals.payroll}
                                    expanded={expanded.has('payroll')}
                                    onToggle={expandable('payroll').onToggle}
                                    loading={loading}
                                />
                                {extraCategories.map((category) => (
                                    <ExpandableMatrixCategory
                                        key={category.key}
                                        title={category.label}
                                        tone="danger"
                                        items={category.accounts.map((account) => ({ label: account.label, monthlyAmounts: account.monthlyAmounts, totalAmount: account.totalAmount }))}
                                        total={category.totalAmount}
                                        expanded={expanded.has(category.key)}
                                        onToggle={expandable(category.key).onToggle}
                                        loading={loading}
                                    />
                                ))}
                            </>
                        )}

                        <MatrixRow
                            tone="neutral"
                            label={copy.cashFlow}
                            title={copy.cashFlowHint}
                            values={monthValues(monthly, (item) => item.cashFlow, 0)}
                            total={totals.net}
                            loading={loading}
                            valueClass={sign}
                            totalClass={sign(totals.net)}
                        />

                        <MatrixRow
                            tone="neutral"
                            rowClass="text-3xs bg-background text-fg-muted"
                            label={<span className="text-warning-400/90">{copy.gap}</span>}
                            title={copy.gapHint}
                            values={monthValues(monthly, gap, null)}
                            total={null}
                            empty="-"
                            format={signed}
                            loading={loading}
                            valueClass={(value) => (Math.abs(value) < 1 ? 'text-fg-subtle' : value > 0 ? 'text-success-400/80' : 'text-danger-400/80')}
                            cellTitle={(month, value) => {
                                const item = monthly.find((candidate) => candidate.month === month);
                                return value === null || value === undefined || !item
                                    ? undefined
                                    : fmt(copy.expectedVsActual, { expected: formatCurrencyRounded(item.cashFlow), actual: formatCurrencyRounded(item.closingBalance ?? 0) });
                            }}
                        />

                        <MatrixRow
                            tone="warning"
                            label={copy.closing}
                            values={monthValues(monthly, (item) => (item.hasBankData ? item.closingBalance : null))}
                            total={lastClosingBalance(monthly)}
                            loading={loading}
                            expandable={expandable('closing')}
                        />
                        {expanded.has('closing') && bankGroups('closing')}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
