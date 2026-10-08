import { cn } from '@/lib/utils';

const VALUE_TONE = {
    number: 'font-mono text-fg-secondary',
    total: 'font-mono text-fg-strong font-semibold',
};

interface CardFieldProps {
    label: React.ReactNode;
    /** number: monospaced · total: the same, bold and bright (as in DataTable columns) */
    variant?: keyof typeof VALUE_TONE;
    children: React.ReactNode;
}

/** One "label … value" line of a phone card (DataCards rows, totals cards). Goes inside a <dl>. */
export function CardField({ label, variant, children }: CardFieldProps) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <dt className="min-w-0 text-xs text-fg-muted">{label}</dt>
            <dd className={cn('min-w-0 text-right', variant && VALUE_TONE[variant])}>{children}</dd>
        </div>
    );
}
