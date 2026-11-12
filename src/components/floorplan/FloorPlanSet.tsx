'use client';

import { Fragment, useMemo, useRef, type ReactNode } from 'react';
import { FloorPlan } from '@/components/floorplan/FloorPlan';
import type { FloorPlanSymbolArt } from '@/components/floorplan/SymbolShape';
import { useFloorPlanMeasure } from '@/hooks/useFloorPlanMeasure';
import { fitTextSize, type FloorPlanSpec, type TextMeasure } from '@/lib/floorplan';
import { cn } from '@/lib/utils';

interface PlanOfSet {
    id: string;
    spec: FloorPlanSpec;
}

interface FloorPlanSetProps<P extends PlanOfSet> {
    /** The plans shown together: the floors of one building */
    plans: readonly P[];
    symbolArt?: FloorPlanSymbolArt;
    /** How wide a text is; left out, the browser measures once for all the plans */
    measure?: TextMeasure;
    /** What goes around each drawing (a card, the floor's name, a legend); left out, the drawings follow one another */
    renderPlan?: (plan: P, drawing: ReactNode) => ReactNode;
    className?: string;
}

/**
 * Several floor plans at one size of text: the largest at which the tightest area of any of them still fits, so the
 * sheets of one building read as a set. It measures once and gives the measure and the size to every plan.
 */
export function FloorPlanSet<P extends PlanOfSet>({ plans, symbolArt, measure, renderPlan, className }: FloorPlanSetProps<P>) {
    const box = useRef<HTMLDivElement>(null);
    const measured = useFloorPlanMeasure(box, measure);

    const textSize = useMemo(() => {
        if (!measured) return undefined;
        const sizes = plans.map((plan) => fitTextSize(plan.spec, measured)).filter((size): size is number => size !== null);
        return sizes.length > 0 ? Math.min(...sizes) : undefined;
    }, [plans, measured]);

    return (
        <div ref={box} className={cn('flex flex-col gap-6 font-sans', className)}>
            {plans.map((plan) => {
                const drawing = <FloorPlan spec={plan.spec} symbolArt={symbolArt} measure={measured} textSize={textSize} />;
                return <Fragment key={plan.id}>{renderPlan ? renderPlan(plan, drawing) : drawing}</Fragment>;
            })}
        </div>
    );
}
