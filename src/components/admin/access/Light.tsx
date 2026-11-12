import { Minus, type LucideIcon } from 'lucide-react';
import { CHIP_ACTIVE, CHIP_INACTIVE, type ChipTone } from '@/components/ui/ToggleChips';
import type { LightState } from '@/lib/auth/lights';
import { cn } from '@/lib/utils';
import { Pressable } from '@/components/ui/Pressable';

interface LightProps {
    state: LightState;
    tone: ChipTone;
    /** What the light is (eye, pencil): a round light with the icon inside */
    icon?: LucideIcon;
    /** A named light (a page's own function, e.g. Riallinea): a pill with its name instead of an icon */
    label?: string;
    /** "Operatori: Modifica": the light for screen readers, and its tooltip when there is no hint */
    name: string;
    /** Tooltip saying what the light gives */
    hint?: string;
    onToggle: () => void;
}

/**
 * The one control of the Gruppi page: a light that is on or off, switched by a click. On a row of several pages it
 * can be "some" (dashed, a dash inside) when only part of them have it; a click then switches it on for all.
 */
export function Light({ state, tone, icon: Icon, label, name, hint, onToggle }: LightProps) {
    const Glyph = state === 'some' ? Minus : Icon;
    return (
        <Pressable
            type="button"
            onClick={onToggle}
            aria-pressed={state === 'on' ? true : state === 'some' ? 'mixed' : false}
            aria-label={name}
            title={hint ?? name}
            className={cn(
                'inline-flex items-center justify-center rounded-full border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                label ? 'min-h-7 px-3 py-0.5 text-center text-xs leading-tight' : 'h-8 w-8',
                state === 'on' ? CHIP_ACTIVE[tone] : CHIP_INACTIVE,
                state === 'some' && 'border-dashed text-fg-secondary'
            )}
        >
            {label ?? (Glyph && <Glyph size={16} />)}
        </Pressable>
    );
}
