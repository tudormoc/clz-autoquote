import { cn } from '@/lib/utils';

const TONES = {
    success: 'bg-success-500',
    primary: 'bg-primary',
    warning: 'bg-warning-500',
    neutral: 'bg-fg-faint',
} as const;

export type MeterTone = keyof typeof TONES;

const SIZES = {
    sm: 'h-1',
    md: 'h-1.5',
} as const;

interface MeterLook {
    size?: keyof typeof SIZES;
    /** Its width and the room around it (w-24, flex-1, mt-2) */
    className?: string;
    /** Tooltip saying what it measures; without one the bar is only decoration beside its number */
    title?: string;
}

/** One share of the whole, 0 to 1 */
interface OneValue extends MeterLook {
    value: number;
    tone?: MeterTone;
    parts?: never;
}

/** Several shares side by side, each 0 to 1 of the whole (pages a group may change, then those it may only see) */
interface SeveralParts extends MeterLook {
    parts: readonly { value: number; tone: MeterTone }[];
    value?: never;
    tone?: never;
}

const percent = (share: number) => `${Math.round(Math.min(1, Math.max(0, share)) * 100)}%`;

/**
 * A thin bar that fills from the left: how much of something is done, taken or given. The one place of the app where
 * a number becomes a width, so no screen writes a style of its own for it.
 */
export function Meter({ value, tone = 'success', parts, size = 'md', className, title }: OneValue | SeveralParts) {
    const filled = parts ?? [{ value: value ?? 0, tone }];
    return (
        <span title={title} aria-hidden={title ? undefined : true} className={cn('flex overflow-hidden rounded-full bg-muted', SIZES[size], className)}>
            {filled.map((part, index) => (
                <span key={index} className={cn('h-full transition-width', TONES[part.tone])} style={{ width: percent(part.value) }} />
            ))}
        </span>
    );
}
