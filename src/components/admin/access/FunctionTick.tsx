import { Checkbox } from '@/components/ui/Checkbox';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.admin.groups;

interface FunctionTickProps {
    on: boolean;
    /** "Officina, Riallinea ordine da DiBa": the cell, for screen readers */
    name: string;
    onChange: (on: boolean) => void;
}

/** One cell of a function row in Gruppi: ticked = the group may use it (together with Modifica on its page). */
export function FunctionTick({ on, name, onChange }: FunctionTickProps) {
    return (
        <div className="inline-flex justify-center">
            <Checkbox
                checked={on}
                onChange={(e) => onChange(e.target.checked)}
                aria-label={`${name}: ${on ? copy.functionLevels.edit : copy.functionLevels.none}`}
                title={copy.functionHint}
            />
        </div>
    );
}
