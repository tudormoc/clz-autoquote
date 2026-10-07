'use client';

import React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface MatrixRowItem {
    accountCode?: number;
    label: string;
    monthlyAmounts: Record<number, number>;
    totalAmount: number;
}

interface ExpandableMatrixCategoryProps {
    /** Label of the main category row */
    title: string;
    /** Sub-items inside this category */
    items: MatrixRowItem[];
    /** Whether this category is currently expanded */
    isExpanded: boolean;
    /** Toggle callback function */
    onToggle: () => void;
    /** Total amount across all months for this category */
    totalAmount: number;
    /** 12-month array of short month names */
    shortMonths: string[];
    /** Global loading state */
    loading?: boolean;
    /** Helper function to format compact EUR */
    formatCompactEUR: (amount?: number) => string;
    /** Indentation level (default 1 = pl-6, level 2 = pl-10) */
    level?: 1 | 2;
    /** Custom empty message when items array is empty */
}

export const ExpandableMatrixCategory: React.FC<ExpandableMatrixCategoryProps> = ({
    title,
    items,
    isExpanded,
    onToggle,
    totalAmount,
    shortMonths,
    loading = false,
    formatCompactEUR,
    level = 1,
}) => {
    const hasItems = items && items.length > 0;

    // If there are no items, render empty single row
    if (!hasItems) {
        return (
            <tr className="hover:bg-muted/30 transition-colors text-3xs">
                <td className={`${level === 1 ? 'pl-6' : 'pl-10'} pr-2 py-1.5 font-sans font-medium text-fg-secondary truncate`} title={title}>
                    └ {title}
                </td>
                {shortMonths.map((_, mIdx) => (
                    <td key={mIdx} className="px-0.5 py-1.5 text-right text-danger-300/80 font-mono truncate">
                        -
                    </td>
                ))}
                <td className="px-1.5 py-1.5 text-right font-mono text-danger-400/80 bg-muted/20 border-l border-border truncate">
                    {loading ? '...' : formatCompactEUR(totalAmount)}
                </td>
            </tr>
        );
    }

    return (
        <>
            {/* Category Header Row (Level 1) */}
            <tr
                onClick={onToggle}
                className="hover:bg-muted/40 transition-colors text-3xs bg-danger-950/10 font-semibold cursor-pointer border-t border-b border-border/40"
            >
                <td className={`${level === 1 ? 'pl-6' : 'pl-10'} pr-2 py-1.5 font-sans text-danger-300 flex items-center gap-1 truncate`} title={title}>
                    {isExpanded ? (
                        <ChevronDown size={13} className="text-danger-400 shrink-0" />
                    ) : (
                        <ChevronRight size={13} className="text-danger-400 shrink-0" />
                    )}
                    └ {title}
                </td>
                {shortMonths.map((_, mIdx) => {
                    // Sum up amount across all items for month mIdx + 1
                    const monthSum = items.reduce((s, it) => s + (it.monthlyAmounts[mIdx + 1] || 0), 0);
                    return (
                        <td key={mIdx} className="px-0.5 py-1.5 text-right text-danger-300/80 font-mono truncate">
                            {loading ? '...' : (monthSum > 0 ? formatCompactEUR(monthSum) : '-')}
                        </td>
                    );
                })}
                <td className="px-1.5 py-1.5 text-right font-mono text-danger-400/80 font-bold bg-muted/20 border-l border-border truncate">
                    {loading ? '...' : formatCompactEUR(totalAmount)}
                </td>
            </tr>

            {/* Expanded Sub-items (Level 2) */}
            {isExpanded && (
                <>
                    {items.map((item, idx) => (
                        <tr key={`item_${idx}`} className="hover:bg-muted/50 transition-colors text-3xs bg-card/40">
                            <td className="pl-10 pr-2 py-1 font-sans text-fg-secondary truncate" title={item.label}>
                                └ {item.label}
                            </td>
                            {shortMonths.map((_, mIdx) => {
                                const val = item.monthlyAmounts[mIdx + 1] || 0;
                                return (
                                    <td key={mIdx} className="px-0.5 py-1 text-right text-danger-300/70 font-mono truncate">
                                        {loading ? '...' : (val > 0 ? formatCompactEUR(val) : '-')}
                                    </td>
                                );
                            })}
                            <td className="px-1.5 py-1 text-right font-mono text-danger-400/90 font-medium bg-muted/20 border-l border-border truncate">
                                {loading ? '...' : formatCompactEUR(item.totalAmount)}
                            </td>
                        </tr>
                    ))}
                </>
            )}
        </>
    );
};
