import { SYMBOL_GRID, SymbolShape, type FloorPlanSymbolArt } from '@/components/floorplan/SymbolShape';
import type { FloorPlanSymbol } from '@/lib/floorplan';
import { cn } from '@/lib/utils';

interface FloorPlanLegendProps {
    /** The symbols of a plan (`spec.symbols`), in this order */
    symbols: Readonly<Record<string, FloorPlanSymbol>>;
    /** How each looks: the same art the plan is drawn with */
    art?: FloorPlanSymbolArt;
    /** A word in front of the symbols */
    title?: string;
    className?: string;
}

/** What the symbols of a floor plan mean: each one with its title, on one line that wraps. Nothing without symbols. */
export function FloorPlanLegend({ symbols, art, title, className }: FloorPlanLegendProps) {
    const ids = Object.keys(symbols);
    if (ids.length === 0) return null;
    return (
        <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg', className)}>
            {title && <span className="text-2xs font-bold uppercase tracking-widest text-fg-muted">{title}</span>}
            {ids.map((id) => (
                <span key={id} className="inline-flex items-center gap-1.5">
                    <svg viewBox={`0 0 ${SYMBOL_GRID} ${SYMBOL_GRID}`} className="h-4 w-4 shrink-0" aria-hidden>
                        <SymbolShape art={art?.[id]} />
                    </svg>
                    {symbols[id].title}
                </span>
            ))}
        </div>
    );
}
