import { Minus, type LucideIcon } from '@/components/ui/icons';
import { ChoiceButton, type ChoiceTone } from '@/components/ui/ChoiceButton';
import type { LightState } from '@/lib/auth/lights';

interface LightProps {
    state: LightState;
    tone: ChoiceTone;
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
        <ChoiceButton
            round
            size={label ? 'sm' : 'icon'}
            tone={tone}
            selected={state === 'on' ? true : state === 'some' ? 'mixed' : false}
            onClick={onToggle}
            aria-label={name}
            title={hint ?? name}
            className={label ? 'text-center leading-tight' : undefined}
        >
            {label ?? (Glyph && <Glyph size={16} />)}
        </ChoiceButton>
    );
}
