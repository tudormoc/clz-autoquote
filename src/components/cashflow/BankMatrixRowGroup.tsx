'use client';

import React from 'react';
import { BankOperationsDrilldown } from '@/components/cashflow/BankOperationsDrilldown';
import { MatrixRow, MATRIX_COLUMNS } from '@/components/cashflow/MatrixRow';
import { monthValues } from '@/lib/cashflow/matrix';
import type { BankAccountBalance, MonthlyBankBreakdownItem, MonthlyFinancialItem } from '@/lib/cashflow/types';
import { formatCurrencyRounded, monthName } from '@/lib/format';
import { cn } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';
import { TableCell, TableRow } from '@/components/ui/Table';

const copy = APP_COPY.cashflow.matrix;

/** The bank account (and month) whose operations are open under the matrix */
export interface BankDrilldown {
    accountCode: number;
    name: string;
    section: 'opening' | 'closing';
    month: number | null;
}

interface BankMatrixRowGroupProps {
    category: 'attivo' | 'passivo';
    section: 'opening' | 'closing';
    banks: MonthlyBankBreakdownItem[];
    monthlyData: MonthlyFinancialItem[];
    bankBalances: BankAccountBalance[];
    year: number;
    loading?: boolean;
    drilldown: BankDrilldown | null;
    onToggleDrilldown: (accountCode: number, name: string, section: 'opening' | 'closing', month?: number | null) => void;
    onCloseDrilldown: () => void;
}

/** Bank accounts of one kind (assets or liabilities) under the opening or closing balance; a click opens their operations. */
export function BankMatrixRowGroup({ category, section, banks, monthlyData, bankBalances, year, loading, drilldown, onToggleDrilldown, onCloseDrilldown }: BankMatrixRowGroupProps) {
    if (banks.length === 0) return null;

    const isOpening = section === 'opening';
    const isAsset = category === 'attivo';

    return (
        <>
            <TableRow className={cn('font-sans font-bold text-3xs', isAsset ? 'bg-success-950/20 hover:bg-success-950/20 text-success-400' : 'bg-danger-950/20 hover:bg-danger-950/20 text-danger-400')}>
                <TableCell className="pl-6 py-0.5" colSpan={MATRIX_COLUMNS}>└ {isAsset ? copy.assets : copy.liabilities}</TableCell>
            </TableRow>

            {banks.map((bank) => {
                const open = drilldown?.accountCode === bank.accountCode && drilldown.section === section;
                const balance = bankBalances.find((candidate) => candidate.accountCode === bank.accountCode)?.balance;
                const values = monthValues(monthlyData, (item) => {
                    const entry = item.bankBreakdown?.find((candidate) => candidate.accountCode === bank.accountCode);
                    return item.hasBankData && entry ? (isOpening ? entry.opening : entry.closing) : null;
                });

                return (
                    <React.Fragment key={`${section}_${category}_${bank.accountCode}`}>
                        <MatrixRow
                            level="item"
                            tone={isOpening ? 'info' : 'warning'}
                            rowClass={isOpening ? 'bg-info-950/10' : 'bg-warning-950/10'}
                            label={bank.name.replace('BANCA POPOLARE ', 'B. ').replace('BANCA POP. ', 'B. ')}
                            title={bank.name}
                            values={values}
                            total={balance}
                            totalTitle={balance !== undefined ? fmt(copy.verifiedBalance, { amount: formatCurrencyRounded(balance) }) : undefined}
                            loading={loading}
                            active={open}
                            valueClass={() => (isAsset ? 'text-success-300' : 'text-danger-300')}
                            cellTitle={(month, value) =>
                                value === null || value === undefined ? undefined : fmt(copy.bankMonth, { bank: bank.name, month: monthName(month), amount: formatCurrencyRounded(value) })
                            }
                            onCellClick={(month) => onToggleDrilldown(bank.accountCode, bank.name, section, month)}
                            expandable={{ expanded: open, onToggle: () => onToggleDrilldown(bank.accountCode, bank.name, section) }}
                        />

                        {open && (
                            <TableRow className="bg-background hover:bg-background">
                                <TableCell colSpan={MATRIX_COLUMNS} className="p-2 border-b border-border">
                                    <BankOperationsDrilldown
                                        accountCode={bank.accountCode}
                                        accountName={bank.name}
                                        year={year}
                                        initialMonth={drilldown.month}
                                        onClose={onCloseDrilldown}
                                    />
                                </TableCell>
                            </TableRow>
                        )}
                    </React.Fragment>
                );
            })}
        </>
    );
}
