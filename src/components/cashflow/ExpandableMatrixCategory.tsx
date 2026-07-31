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
    emptyMessage?: string;
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
    emptyMessage = "Nessun dato registrato per l'anno"
}) => {
    const hasItems = items && items.length > 0;

    // If there are no items, render empty single row
    if (!hasItems) {
        return (
            <tr className="hover:bg-zinc-800/30 transition-colors text-[10px]">
                <td className={`${level === 1 ? 'pl-6' : 'pl-10'} pr-2 py-1.5 font-sans font-medium text-zinc-300 truncate`} title={title}>
                    └ {title}
                </td>
                {shortMonths.map((_, mIdx) => (
                    <td key={mIdx} className="px-0.5 py-1.5 text-right text-rose-300/80 font-mono truncate">
                        -
                    </td>
                ))}
                <td className="px-1.5 py-1.5 text-right font-mono text-rose-400/80 bg-zinc-800/20 border-l border-zinc-800 truncate">
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
                className="hover:bg-zinc-800/40 transition-colors text-[10px] bg-rose-950/10 font-semibold cursor-pointer border-t border-b border-zinc-800/40"
            >
                <td className={`${level === 1 ? 'pl-6' : 'pl-10'} pr-2 py-1.5 font-sans text-rose-300 flex items-center gap-1 truncate`} title={title}>
                    {isExpanded ? (
                        <ChevronDown size={13} className="text-rose-400 shrink-0" />
                    ) : (
                        <ChevronRight size={13} className="text-rose-400 shrink-0" />
                    )}
                    └ {title}
                </td>
                {shortMonths.map((_, mIdx) => {
                    // Sum up amount across all items for month mIdx + 1
                    const monthSum = items.reduce((s, it) => s + (it.monthlyAmounts[mIdx + 1] || 0), 0);
                    return (
                        <td key={mIdx} className="px-0.5 py-1.5 text-right text-rose-300/80 font-mono truncate">
                            {loading ? '...' : (monthSum > 0 ? formatCompactEUR(monthSum) : '-')}
                        </td>
                    );
                })}
                <td className="px-1.5 py-1.5 text-right font-mono text-rose-400/80 font-bold bg-zinc-800/20 border-l border-zinc-800 truncate">
                    {loading ? '...' : formatCompactEUR(totalAmount)}
                </td>
            </tr>

            {/* Expanded Sub-items (Level 2) */}
            {isExpanded && (
                <>
                    {items.map((item, idx) => (
                        <tr key={`item_${idx}`} className="hover:bg-zinc-800/50 transition-colors text-[10px] bg-zinc-900/40">
                            <td className="pl-10 pr-2 py-1 font-sans text-zinc-300 truncate" title={item.label}>
                                └ {item.label}
                            </td>
                            {shortMonths.map((_, mIdx) => {
                                const val = item.monthlyAmounts[mIdx + 1] || 0;
                                return (
                                    <td key={mIdx} className="px-0.5 py-1 text-right text-rose-300/70 font-mono truncate">
                                        {loading ? '...' : (val > 0 ? formatCompactEUR(val) : '-')}
                                    </td>
                                );
                            })}
                            <td className="px-1.5 py-1 text-right font-mono text-rose-400/90 font-medium bg-zinc-800/20 border-l border-zinc-800 truncate">
                                {loading ? '...' : formatCompactEUR(item.totalAmount)}
                            </td>
                        </tr>
                    ))}
                </>
            )}
        </>
    );
};
