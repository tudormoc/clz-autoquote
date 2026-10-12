'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SectionTone = 'danger' | 'warning' | 'primary' | 'muted' | 'success';

const TONES: Record<SectionTone, string> = {
    danger: 'text-danger-400',
    warning: 'text-warning-300',
    primary: 'text-primary',
    muted: 'text-fg-muted',
    success: 'text-success-400',
};

interface AgendaSectionProps {
    title: string;
    count: number;
    tone: SectionTone;
    hint?: string;
    /** Starts folded (Più avanti) */
    folded?: boolean;
    children: React.ReactNode;
}

/** A group of "Da fare" (Scadute, Oggi …): title with count, click to fold, the rows in a panel */
export function AgendaSection({ title, count, tone, hint, folded = false, children }: AgendaSectionProps) {
    const [open, setOpen] = useState(!folded);

    return (
        <section className="space-y-2">
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-2 group">
                <ChevronDown size={16} className={cn('text-fg-muted transition-transform', !open && '-rotate-90')} />
                <h2 className={cn('text-sm font-semibold', TONES[tone])}>{title}</h2>
                <span className="text-3xs px-1.5 rounded-full bg-muted text-fg-secondary font-mono">{count}</span>
                {hint && <span className="hidden sm:inline text-2xs text-fg-subtle">{hint}</span>}
            </button>
            {open && <ul className="rounded-lg border border-border bg-card divide-y divide-border/60">{children}</ul>}
        </section>
    );
}
