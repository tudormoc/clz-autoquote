import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LevelCellProps {
    /** This is the level of the row */
    selected: boolean;
    /** Some of the row's pages have this level (an area or "all pages" row that is mixed) */
    partial?: boolean;
    /** What it means, for screen readers: "Analisi: Vede" */
    label: string;
    onClick: () => void;
}

/** One choice of a permission row (No / Vede / Modifica): a round tick, filled when chosen, dotted when only some pages have it. */
export function LevelCell({ selected, partial, label, onClick }: LevelCellProps) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={onClick}
            className={cn(
                'size-5 rounded-full border-2 flex items-center justify-center transition-colors',
                selected
                    ? 'bg-primary border-primary text-primary-foreground'
                    : partial
                      ? 'border-primary/60 hover:border-primary'
                      : 'border-border-strong hover:border-primary/60'
            )}
        >
            {selected ? <Check size={12} strokeWidth={3} /> : partial && <span className="size-1.5 rounded-full bg-primary/70" />}
        </button>
    );
}
