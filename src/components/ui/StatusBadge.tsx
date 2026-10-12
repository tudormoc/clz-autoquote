import { cn } from '@/lib/utils';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'highlight' | 'neutral' | 'muted';

const TONES: Record<StatusTone, string> = {
    success: 'bg-success-950/60 text-success-300 border-success-700/60',
    warning: 'bg-warning-950/60 text-warning-300 border-warning-600/70',
    danger: 'bg-danger-950/60 text-danger-300 border-danger-700/60',
    info: 'bg-info-950/40 text-info-300 border-info-800/40',
    highlight: 'bg-highlight-950/40 text-highlight-300 border-highlight-800/40',
    neutral: 'bg-muted text-fg-muted border-border-strong',
    muted: 'bg-card/80 text-fg-subtle border-border font-normal',
};

const SIZES = {
    sm: 'px-2 py-0.5 text-2xs',
    md: 'px-3 py-1 text-xs',
} as const;

interface StatusBadgeProps {
    tone: StatusTone;
    size?: keyof typeof SIZES;
    /** Tooltip */
    title?: string;
    /** Monospaced, for a number */
    mono?: boolean;
    children: React.ReactNode;
}

/** Small coloured label for a state (ok, warning, shift type …). */
export function StatusBadge({ tone, size = 'sm', title, mono, children }: StatusBadgeProps) {
    return (
        <span
            title={title}
            className={cn('inline-flex items-center gap-1 rounded border font-semibold', TONES[tone], SIZES[size], mono && 'font-mono')}
        >
            {children}
        </span>
    );
}
