'use client';

import { LoadState } from '@/components/ui/LoadState';
import { Spinner } from '@/components/ui/Spinner';
import React, { useEffect, useState, useTransition, useMemo } from 'react';
import { X, Search, CheckCircle2, ArrowUpRight, ArrowDownRight, Layers } from '@/components/ui/icons';
import { APP_COPY, fmt } from '@/locales';
import { getBankAccountTransactionsAction } from '@/app/cashflow/cashflow-actions';
import type { BankAccountDetailsResult } from '@/lib/cashflow/types';
import { formatCurrency } from '@/lib/format';
import { cn, errorMessage } from '@/lib/utils';
import { SURFACE_TONE, Surface, surfaceClasses } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { ChoiceButton } from '@/components/ui/ChoiceButton';
import { Input } from '@/components/ui/Input';
import { DENSE_CELL, DENSE_HEAD, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { MissingValue } from '@/components/ui/TableCells';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { titleClasses } from '@/components/ui/titleLook';

/** The frame of the panel */
const PANEL = surfaceClasses('inset', 'p-4 my-2 space-y-4');

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
                    <StatusBadge tone="warning" size="md" mono>
                        {accountCode}
                    </StatusBadge>
                    <div>
                        <h4 className={titleClasses('section', 'flex items-center gap-2')}>
                            {accountName}
                            <span className="text-xs font-normal text-fg-muted">({year})</span>
                        </h4>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={onClose} title={t.close}>
                        <X size={14} />
                        {t.close}
                    </Button>
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
                <ChoiceButton size="sm" tone="warning" selected={selectedMonth === 'all'} onClick={() => setSelectedMonth('all')}>
                    {t.filterAllYear}
                    {data && data.transactions.length > 0 && <span className="ml-1.5 opacity-70">({data.transactions.length})</span>}
                </ChoiceButton>

                {shortMonths.map((mName, idx) => {
                    const mNum = idx + 1;
                    const mSum = data?.monthlySummaries.find(s => s.month === mNum);
                    const txCount = mSum?.transactionCount || 0;
                    const isSelected = selectedMonth === mNum;

                    return (
                        <ChoiceButton key={mNum} size="sm" tone="warning" selected={isSelected} disabled={txCount === 0} onClick={() => setSelectedMonth(mNum)}>
                            {mName}
                            {txCount > 0 && <span className="ml-1.5 opacity-70">({txCount})</span>}
                        </ChoiceButton>
                    );
                })}
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 font-mono text-xs">
                <Surface kind="inset" className="p-2.5">
                    <span className="text-3xs font-sans text-fg-muted block mb-0.5">
                        {t.openingBalance} ({selectedMonth === 'all' ? `01/01/${year}` : `01/${String(selectedMonth).padStart(2, '0')}/${year}`})
                    </span>
                    <span className="text-sm font-bold text-info-300">
                        {formatCurrency(currentOpening)}
                    </span>
                </Surface>

                <div className={surfaceClasses('inset', SURFACE_TONE.success, 'p-2.5')}>
                    <span className="text-3xs font-sans text-success-400 flex items-center gap-1 mb-0.5">
                        <ArrowUpRight size={12} />
                        {t.totalInflows}
                    </span>
                    <span className="text-sm font-bold text-success-300">
                        +{formatCurrency(currentDare)}
                    </span>
                </div>

                <div className={surfaceClasses('inset', SURFACE_TONE.danger, 'p-2.5')}>
                    <span className="text-3xs font-sans text-danger-400 flex items-center gap-1 mb-0.5">
                        <ArrowDownRight size={12} />
                        {t.totalOutflows}
                    </span>
                    <span className="text-sm font-bold text-danger-300">
                        -{formatCurrency(currentAvere)}
                    </span>
                </div>

                <Surface kind="inset" className="p-2.5">
                    <span className="text-3xs font-sans text-fg-muted block mb-0.5">
                        {t.netVariation}
                    </span>
                    <span className={`text-sm font-bold ${currentNet >= 0 ? 'text-success-400' : 'text-danger-400'}`}>
                        {currentNet >= 0 ? `+${formatCurrency(currentNet)}` : formatCurrency(currentNet)}
                    </span>
                </Surface>

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
                        {t.officialBalanceMatch}
                    </span>
                </div>
            </div>

            {/* Search Bar & Transaction count */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
                    <Input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={t.searchPlaceholder} aria-label={t.searchPlaceholder} className="pl-8" />
                </div>

                <div className="text-xs text-fg-muted flex items-center gap-1.5">
                    <Layers size={14} className="text-fg-subtle" />
                    <span>
                        <strong className="text-fg-soft">{filteredTransactions.length}</strong> {t.operationsCount}
                    </span>
                </div>
            </div>

            {/* Operations Table */}
            <Surface className="overflow-hidden">
                <Table containerClassName="max-h-96 overflow-y-auto" className="text-xs font-mono">
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className={DENSE_HEAD}>{t.date}</TableHead>
                            <TableHead className={DENSE_HEAD}>{t.regDoc}</TableHead>
                            <TableHead className={DENSE_HEAD}>{t.description}</TableHead>
                            <TableHead className={cn(DENSE_HEAD, 'text-right')}>{t.inflow}</TableHead>
                            <TableHead className={cn(DENSE_HEAD, 'text-right')}>{t.outflow}</TableHead>
                            <TableHead className={cn(DENSE_HEAD, 'text-right text-warning-300')}>{t.runningBalance}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(isPending || filteredTransactions.length === 0) && (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={6} className="py-6 text-center text-fg-muted">
                                    {isPending ? (
                                        <span className="inline-flex items-center gap-2">
                                            <Spinner size={14} />
                                            {t.loading}
                                        </span>
                                    ) : (
                                        t.noTransactions
                                    )}
                                </TableCell>
                            </TableRow>
                        )}
                        {!isPending &&
                            filteredTransactions.map((tx, idx) => (
                                <TableRow key={tx.id || idx}>
                                    <TableCell className={cn(DENSE_CELL, 'text-fg-secondary whitespace-nowrap')}>{tx.formattedDate}</TableCell>
                                    <TableCell className={cn(DENSE_CELL, 'text-fg-muted whitespace-nowrap')}>
                                        <span className="font-semibold text-fg-secondary">R.{tx.regNum}/{tx.rowNum}</span>
                                        {tx.docNum > 0 && (
                                            <span className="ml-1 text-fg-subtle">{fmt(t.docNumber, { number: `${tx.docNum}${tx.docSeries ? `/${tx.docSeries}` : ''}` })}</span>
                                        )}
                                    </TableCell>
                                    <TableCell className={cn(DENSE_CELL, 'max-w-xs truncate text-fg-soft')} title={tx.description}>
                                        {tx.description}
                                    </TableCell>
                                    <TableCell className={cn(DENSE_CELL, 'text-right font-medium text-success-400 whitespace-nowrap')}>
                                        {tx.dare > 0 ? `+${formatCurrency(tx.dare)}` : <MissingValue />}
                                    </TableCell>
                                    <TableCell className={cn(DENSE_CELL, 'text-right font-medium text-danger-400 whitespace-nowrap')}>
                                        {tx.avere > 0 ? `-${formatCurrency(tx.avere)}` : <MissingValue />}
                                    </TableCell>
                                    <TableCell className={cn(DENSE_CELL, 'text-right font-bold text-warning-200 whitespace-nowrap')}>{formatCurrency(tx.runningBalance)}</TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </Surface>
        </div>
    );
};
