'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { surfaceClasses } from '@/components/ui/Surface';
import { Pressable } from '@/components/ui/Pressable';

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
    /** Starts folded (Più avanti) */
    folded?: boolean;
    children: React.ReactNode;
}

/** A group of "Da fare" (Scadute, Oggi …): title with count, click to fold, the rows in a panel */
export function AgendaSection({ title, count, tone, folded = false, children }: AgendaSectionProps) {
    const [open, setOpen] = useState(!folded);

    return (
        <section className="space-y-2">
            <Pressable type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-2 group">
                <ChevronDown size={16} className={cn('text-fg-muted transition-transform', !open && '-rotate-90')} />
                <h2 className={cn('text-sm font-semibold', TONES[tone])}>{title}</h2>
                <span className="text-3xs px-1.5 rounded-full bg-muted text-fg-secondary font-mono">{count}</span>
            </Pressable>
            {open && <ul className={surfaceClasses('panel', 'divide-y divide-border/60')}>{children}</ul>}
        </section>
    );
}
