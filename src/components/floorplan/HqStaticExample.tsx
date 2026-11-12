'use client';

import { useMemo } from 'react';
import { FloorPlanLegend } from '@/components/floorplan/FloorPlanLegend';
import { FloorPlanSet } from '@/components/floorplan/FloorPlanSet';
import type { FloorPlanSymbolArt } from '@/components/floorplan/SymbolShape';
import type { TextMeasure } from '@/lib/floorplan';
import { HQ_STATIC_LEGEND_TITLE, hqStaticPlans } from '@/lib/floorplan/hqStatic';

/**
 * How the two symbols of the static example look: the usual safety signs, a white cross on green and a white flame
 * on red. The keys are those of HQ_STATIC_SYMBOLS (src/lib/floorplan/hqStatic.ts).
 */
const HQ_STATIC_SYMBOL_ART: FloorPlanSymbolArt = {
    soccorso: { className: 'fill-success-600', glyph: 'M10 5h4v5h5v4h-5v5h-4v-5H5v-4h5z' },
    antincendio: {
        className: 'fill-danger-600',
        grow: 1.07,
        glyph: 'M12.9 3.6C13.3 6.4 17.6 9.4 17.6 14.4C17.6 17.8 15.1 20.5 12 20.5C8.9 20.5 6.4 17.9 6.4 14.6C6.4 12.3 7.2 10.5 8.3 8.9C8.7 10.3 9.4 11.4 10.4 12C10 8.8 11 5.6 12.9 3.6Z',
    },
};

interface HqStaticExampleProps {
    /** How wide a text is; left out, the browser measures (a page needs nothing here) */
    measure?: TextMeasure;
    className?: string;
}

/**
 * STATIC EXAMPLE — the two floors of the headquarters with their areas, people and symbols, all from the hand-kept
 * file src/lib/floorplan/hqStatic.ts: the printed sheets of 12 November 2026, drawn by the app. Something complete
 * to put on a page and start from; when the plan is fed by the app's own data, this component and that file go.
 * See docs/FLOORPLAN.md → The static example.
 */
export function HqStaticExample({ measure, className }: HqStaticExampleProps) {
    const plans = useMemo(() => hqStaticPlans(), []);
    return (
        <FloorPlanSet
            plans={plans}
            symbolArt={HQ_STATIC_SYMBOL_ART}
            measure={measure}
            className={className}
            renderPlan={(plan, drawing) => (
                <section className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                        <h2 className="text-lg font-bold text-fg-strong">{plan.title}</h2>
                        <FloorPlanLegend title={HQ_STATIC_LEGEND_TITLE} symbols={plan.spec.symbols ?? {}} art={HQ_STATIC_SYMBOL_ART} />
                    </div>
                    {drawing}
                </section>
            )}
        />
    );
}
