import { cn } from '@/lib/utils';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'highlight' | 'neutral' | 'muted';

const TONES: Record<StatusTone, string> = {
    success: 'bg-success-950/60 text-success-300 border-success-700/60',
    warning: 'bg-warning-950/60 text-warning-300 border-warning-600/70',
    danger: 'bg-danger-950/60 text-danger-300 border-danger-700/60',
    info: 'bg-info-950/40 text-info-300 border-info-800/40',
    highlight: 'bg-highlight-950/40 text-highlight-300 border-highlight-800/40',
    neutral: 'bg-muted text-fg-muted border-border-strong',
    muted: 'bg-card text-fg-subtle border-border font-normal',
};

const SIZES = {
    sm: 'px-2 py-0.5 text-2xs',
    md: 'px-3 py-1 text-xs',
} as const;

interface BadgeLook {
    tone: StatusTone;
    size?: keyof typeof SIZES;
    /** Monospaced, for a number or a code */
    mono?: boolean;
    className?: string;
}

/** The look of a badge, for something that is not a plain label (a tag one clicks to change it, a chip holding a button) */
export function statusBadgeClasses({ tone, size = 'sm', mono, className }: BadgeLook) {
    return cn('inline-flex items-center gap-1 rounded border font-semibold', TONES[tone], SIZES[size], mono && 'font-mono', className);
}

interface StatusBadgeProps extends BadgeLook {
    /** Tooltip */
    title?: string;
    children: React.ReactNode;
}

/** Small coloured label: a state (ok, warning, shift type …), a count on a tab, a code, a tag. The one look of every such label. */
export function StatusBadge({ title, children, ...look }: StatusBadgeProps) {
    return (
        <span title={title} className={statusBadgeClasses(look)}>
            {children}
        </span>
    );
}
