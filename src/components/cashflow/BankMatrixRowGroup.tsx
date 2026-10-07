'use client';

import React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { APP_COPY } from '@/locales';
import type { BankAccountBalance, MonthlyBankBreakdownItem, MonthlyFinancialItem } from '@/lib/cashflow/types';
import { BankOperationsDrilldown } from './BankOperationsDrilldown';

interface BankMatrixRowGroupProps {
    category: 'attivo' | 'passivo';
    section: 'opening' | 'closing';
    banks: MonthlyBankBreakdownItem[];
    monthlyData: MonthlyFinancialItem[];
    bankBalances: BankAccountBalance[];
    shortMonths: readonly string[];
    year: number;
    loading?: boolean;
    formatCompactEUR: (amount?: number) => string;
    expandedBankDrilldown: {
        accountCode: number;
        name: string;
        section: 'opening' | 'closing';
        month: number | null;
    } | null;
    onToggleDrilldown: (accountCode: number, name: string, section: 'opening' | 'closing', month?: number | null) => void;
    onCloseDrilldown: () => void;
}

export const BankMatrixRowGroup: React.FC<BankMatrixRowGroupProps> = ({
    category,
    section,
    banks,
    monthlyData,
    bankBalances,
    shortMonths,
    year,
    loading = false,
    formatCompactEUR,
    expandedBankDrilldown,
    onToggleDrilldown,
    onCloseDrilldown,
}) => {
    if (banks.length === 0) return null;

    const isOpening = section === 'opening';
    const isAttivo = category === 'attivo';

    // Sub-header styling
    const subheaderBg = isAttivo ? 'bg-success-950/20 text-success-400' : 'bg-danger-950/20 text-danger-400';
    const subheaderLabel = isAttivo ? '└ ATTIVO (+)' : '└ PASSIVO (-)';

    return (
        <>
            {/* Category Sub-Header */}
            <tr className={`${subheaderBg} font-sans font-bold uppercase tracking-wider text-4xs`}>
                <td className="pl-6 py-0.5" colSpan={14}>
                    {subheaderLabel}
                </td>
            </tr>

            {/* Bank Rows */}
            {banks.map((bank, bIdx) => {
                const isDrilldownOpen =
                    expandedBankDrilldown?.accountCode === bank.accountCode &&
                    expandedBankDrilldown?.section === section;

                const latestBalance = bankBalances.find(b => b.accountCode === bank.accountCode)?.balance;

                // Color themes based on section & active state
                const activeRowBg = isOpening ? 'bg-info-900/40 text-info-200' : 'bg-warning-900/40 text-warning-200';
                const defaultRowBg = isOpening
                    ? 'bg-info-950/10 text-info-300/80 hover:bg-info-900/25'
                    : 'bg-warning-950/10 text-warning-300/80 hover:bg-warning-900/25';

                const chevronColor = isOpening ? 'text-info-400' : 'text-warning-400';
                const cellHoverBg = isOpening ? 'hover:bg-info-800/30' : 'hover:bg-warning-800/30';
                const totalColor = isAttivo
                    ? isOpening ? 'text-info-300' : 'text-warning-300'
                    : isOpening ? 'text-danger-300' : 'text-danger-300';
                const amountColor = isAttivo ? 'text-success-300/80' : 'text-danger-300/80';

                const cleanName = bank.name
                    .replace('BANCA POPOLARE ', 'B. ')
                    .replace('BANCA POP. ', 'B. ');

                return (
                    <React.Fragment key={`${section}_${category}_${bank.accountCode}_${bIdx}`}>
                        <tr
                            onClick={() => onToggleDrilldown(bank.accountCode, bank.name, section)}
                            className={`transition-colors text-3xs cursor-pointer ${
                                isDrilldownOpen ? activeRowBg : defaultRowBg
                            }`}
                            title={APP_COPY.cashflow.bankDetails.drilldownTooltip}
                        >
                            {/* Bank Name with Chevron */}
                            <td className="pl-7 pr-2 py-1 font-sans truncate text-fg-secondary flex items-center gap-1.5" title={bank.name}>
                                {isDrilldownOpen ? (
                                    <ChevronDown size={12} className={`${chevronColor} shrink-0`} />
                                ) : (
                                    <ChevronRight size={12} className={`${chevronColor} shrink-0`} />
                                )}
                                <span className="truncate">└ {cleanName}</span>
                            </td>

                            {/* Monthly Columns */}
                            {shortMonths.map((_, mIdx) => {
                                const item = monthlyData.find(i => i.month === mIdx + 1);
                                const bankItem = item?.bankBreakdown?.find(b => b.accountCode === bank.accountCode);
                                const val = item && item.hasBankData && bankItem
                                    ? (isOpening ? bankItem.opening : bankItem.closing)
                                    : null;

                                return (
                                    <td
                                        key={mIdx}
                                        onClick={(e) => {
                                            if (val !== null && val !== undefined) {
                                                e.stopPropagation();
                                                onToggleDrilldown(bank.accountCode, bank.name, section, mIdx + 1);
                                            }
                                        }}
                                        className={`px-0.5 py-1 text-right truncate font-mono ${amountColor} ${cellHoverBg} hover:underline`}
                                        title={
                                            val !== null && val !== undefined
                                                ? `${bank.name} - Mese ${mIdx + 1}: ${formatCompactEUR(val)} (Clicca per visualizzare le operazioni)`
                                                : ''
                                        }
                                    >
                                        {loading ? '...' : (val !== null && val !== undefined ? formatCompactEUR(val) : '')}
                                    </td>
                                );
                            })}

                            {/* Totale Column (Shows latest verified real balance) */}
                            <td
                                className={`px-1.5 py-1 text-right font-mono ${totalColor} font-semibold bg-muted/20 border-l border-border truncate`}
                                title={`Saldo Attuale Verificato: ${formatCompactEUR(latestBalance)}`}
                            >
                                {latestBalance !== undefined ? formatCompactEUR(latestBalance) : '-'}
                            </td>
                        </tr>

                        {/* Inline Drilldown Panel */}
                        {isDrilldownOpen && (
                            <tr className="bg-background">
                                <td colSpan={14} className="p-2 border-b border-border">
                                    <BankOperationsDrilldown
                                        accountCode={bank.accountCode}
                                        accountName={bank.name}
                                        year={year}
                                        initialMonth={expandedBankDrilldown.month}
                                        onClose={onCloseDrilldown}
                                    />
                                </td>
                            </tr>
                        )}
                    </React.Fragment>
                );
            })}
        </>
    );
};
