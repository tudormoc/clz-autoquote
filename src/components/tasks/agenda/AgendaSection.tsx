'use client';

import { useState } from 'react';
import { surfaceClasses } from '@/components/ui/Surface';
import { FoldToggle } from '@/components/ui/FoldToggle';
import { titleClasses } from '@/components/ui/titleLook';
import { Fold } from '@/components/ui/Fold';

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
            <FoldToggle open={open} count={count} onClick={() => setOpen(!open)} className="-ml-1">
                <h2 className={titleClasses('section', TONES[tone])}>{title}</h2>
            </FoldToggle>
            <Fold open={open}>
                <ul className={surfaceClasses('panel', 'divide-y divide-border/60')}>{children}</ul>
            </Fold>
        </section>
    );
}
