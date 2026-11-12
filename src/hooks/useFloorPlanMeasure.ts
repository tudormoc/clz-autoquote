'use client';

import { useEffect, useState, type RefObject } from 'react';
import { browserMeasure } from '@/components/floorplan/textStyle';
import type { TextMeasure } from '@/lib/floorplan';

/**
 * How wide a text of a floor plan is, measured by the browser in the font of `target`. Text can be measured only
 * once the page is up, and again when the font has loaded: null until then, and a plan is drawn without text.
 * `given` is a measure from outside and wins; null there means "someone else is measuring, wait" (FloorPlanSet
 * measures once for all its plans).
 */
export function useFloorPlanMeasure(target: RefObject<Element | null>, given?: TextMeasure | null): TextMeasure | null {
    const [measured, setMeasured] = useState<TextMeasure | null>(null);

    useEffect(() => {
        if (given !== undefined) return;
        let mounted = true;
        const read = () => {
            if (!mounted || !target.current) return;
            const fromBrowser = browserMeasure(getComputedStyle(target.current).fontFamily);
            setMeasured(() => fromBrowser);
        };
        read();
        document.fonts?.ready.then(read);
        return () => {
            mounted = false;
        };
    }, [given, target]);

    return given !== undefined ? given : measured;
}
