import { cn } from '@/lib/utils';

export type IconTone = 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const TONES: Record<IconTone, string> = {
    primary: 'bg-primary/10 text-primary',
    info: 'bg-info-500/10 text-info-400',
    success: 'bg-success-500/10 text-success-400',
    warning: 'bg-warning-500/10 text-warning-400',
    danger: 'bg-danger-500/10 text-danger-400',
    neutral: 'bg-muted text-fg-subtle',
};

const SIZES = {
    sm: 'p-1.5',
    md: 'p-2',
} as const;

interface IconTileProps {
    tone?: IconTone;
    size?: keyof typeof SIZES;
    className?: string;
    children: React.ReactNode;
}

/** An icon on a small tinted square: beside the title of a page, a window, a card. */
export function IconTile({ tone = 'primary', size = 'md', className, children }: IconTileProps) {
    return <span className={cn('inline-flex shrink-0 items-center justify-center rounded-lg', TONES[tone], SIZES[size], className)}>{children}</span>;
}
