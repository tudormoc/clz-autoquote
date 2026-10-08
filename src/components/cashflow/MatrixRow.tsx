import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrencyRounded } from '@/lib/format';
import type { MonthValues } from '@/lib/cashflow/matrix';
import { cn } from '@/lib/utils';

export type MatrixTone = 'info' | 'success' | 'danger' | 'warning' | 'neutral';
/** main = section row · group = category inside a section · item = one account / client */
export type MatrixLevel = 'main' | 'group' | 'item';

/** Columns of the matrix: label, twelve months, total */
export const MATRIX_COLUMNS = 14;
const LOADING = '...';

const TONES: Record<MatrixTone, { row: string; group: string; value: string; total: string; icon: string; active: string }> = {
    info: { row: 'bg-info-950/20 text-info-200 border-b border-info-900/30 hover:bg-info-900/30', group: 'bg-info-950/10', value: 'text-info-300', total: 'text-info-400 bg-info-950/40', icon: 'text-info-400', active: 'bg-info-900/40 text-info-200' },
    success: { row: 'bg-success-950/30 text-success-400 hover:bg-success-900/40', group: 'bg-success-950/20', value: 'text-success-300', total: 'text-success-400 bg-success-950/50', icon: 'text-success-400', active: 'bg-success-900/40 text-success-200' },
    danger: { row: 'bg-danger-950/30 text-danger-400 hover:bg-danger-900/40', group: 'bg-danger-950/10', value: 'text-danger-300', total: 'text-danger-400 bg-danger-950/50', icon: 'text-danger-400', active: 'bg-danger-900/40 text-danger-200' },
    warning: { row: 'bg-warning-950/25 text-warning-300 border-t-2 border-warning-500/40 hover:bg-warning-900/30', group: 'bg-warning-950/10', value: 'text-warning-200', total: 'text-warning-400 bg-warning-950/40', icon: 'text-warning-400', active: 'bg-warning-900/40 text-warning-200' },
    neutral: { row: 'bg-card text-fg border-y border-border-strong', group: 'bg-card', value: 'text-fg', total: 'text-fg bg-muted/40', icon: 'text-fg-muted', active: 'bg-muted text-fg' },
};

const LEVELS: Record<MatrixLevel, { row: string; label: string; cell: string; total: string }> = {
    main: { row: 'text-2xs font-semibold', label: 'px-2 py-2', cell: 'px-0.5 py-2', total: 'px-1.5 py-2 font-bold' },
    group: { row: 'text-3xs font-semibold border-y border-border/40 hover:bg-muted/40', label: 'pl-6 pr-2 py-1.5', cell: 'px-0.5 py-1.5 opacity-80', total: 'px-1.5 py-1.5 font-bold bg-muted/20' },
    item: { row: 'text-3xs bg-card/40 hover:bg-muted/50', label: 'pl-10 pr-2 py-1', cell: 'px-0.5 py-1 opacity-70', total: 'px-1.5 py-1 font-medium bg-muted/20' },
};

interface MatrixRowProps {
    label: React.ReactNode;
    /** Tooltip of the label */
    title?: string;
    level?: MatrixLevel;
    tone: MatrixTone;
    /** January … December */
    values: MonthValues;
    /** Column on the right; null / undefined show `empty` */
    total?: number | null;
    loading?: boolean;
    /** Breakdown row: zero, negative and missing amounts show "-" in the month cells */
    dashes?: boolean;
    /** Text for a missing value (default: nothing) */
    empty?: string;
    /** Whole-euro amount by default */
    format?: (value: number) => string;
    /** Chevron and click: the row opens / closes the rows below it */
    expandable?: { expanded: boolean; onToggle: () => void };
    /** Row of an opened detail panel (stronger colour) */
    active?: boolean;
    /** Extra classes of the row (a tinted background, a smaller text) */
    rowClass?: string;
    /** Colour of a month value, instead of the tone's */
    valueClass?: (value: number) => string;
    /** Tooltip of one month cell */
    cellTitle?: (month: number, value: number | null | undefined) => string | undefined;
    /** Click on a month cell that has a value (opens the detail of that month) */
    onCellClick?: (month: number) => void;
    totalTitle?: string;
    totalClass?: string;
    icon?: React.ReactNode;
}

/** One row of the cashflow matrix: label, twelve month amounts and the total, coloured by tone and indented by level. */
export function MatrixRow({
    label, title, level = 'main', tone, values, total, loading, dashes, empty, format = formatCurrencyRounded,
    expandable, active, rowClass, valueClass, cellTitle, onCellClick, totalTitle, totalClass, icon,
}: MatrixRowProps) {
    const t = TONES[tone];
    const l = LEVELS[level];
    const showTotal = (value: number | null | undefined) => {
        if (loading) return LOADING;
        return value === null || value === undefined ? empty ?? '' : format(value);
    };
    const showMonth = (value: number | null | undefined) =>
        dashes && !loading && (value === null || value === undefined || value <= 0) ? '-' : showTotal(value);
    const Chevron = expandable?.expanded ? ChevronDown : ChevronRight;

    return (
        <tr
            onClick={expandable?.onToggle}
            className={cn('transition-colors', l.row, level === 'main' ? t.row : level === 'group' ? t.group : '', rowClass, active && t.active, expandable && 'cursor-pointer')}
        >
            {/* Pinned while the table scrolls sideways on narrow screens */}
            <td className={cn(l.label, 'font-sans truncate max-lg:sticky max-lg:left-0 max-lg:z-[1] max-lg:bg-card')} title={title ?? (typeof label === 'string' ? label : undefined)}>
                <div className="flex items-center gap-1.5">
                    {expandable && <Chevron size={level === 'main' ? 14 : 13} className={cn('shrink-0', t.icon)} />}
                    {icon}
                    <span className="truncate">{level === 'main' ? label : <>└ {label}</>}</span>
                </div>
            </td>
            {values.map((value, index) => {
                const clickable = !!onCellClick && value !== null && value !== undefined;
                return (
                    <td
                        key={index}
                        onClick={clickable ? (event) => { event.stopPropagation(); onCellClick(index + 1); } : undefined}
                        title={cellTitle?.(index + 1, value)}
                        className={cn(l.cell, 'text-right font-mono truncate', value !== null && value !== undefined ? valueClass?.(value) ?? t.value : t.value, clickable && 'hover:underline hover:bg-muted/30')}
                    >
                        {showMonth(value)}
                    </td>
                );
            })}
            <td title={totalTitle} className={cn(l.total, 'text-right font-mono border-l border-border truncate', level === 'main' && t.total, totalClass)}>
                {showTotal(total)}
            </td>
        </tr>
    );
}
