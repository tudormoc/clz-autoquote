import { surfaceClasses } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';

interface PresetPopupProps {
    presets: string[];
    openAbove: boolean;
    /** Anchor to the right edge of the cell (number cells) instead of the left */
    alignRight?: boolean;
    onPick: (preset: string) => void;
    /** Extra buttons after the presets (e.g. "Rimuovi") */
    children?: React.ReactNode;
}

/** Row of quick-choice tags under (or above) an inline editor. Picks on mousedown, before the input loses focus. */
export function PresetPopup({ presets, openAbove, alignRight, onPick, children }: PresetPopupProps) {
    return (
        <div
            className={surfaceClasses(
                'floating',
                'absolute z-50 flex items-center gap-1 p-1 whitespace-nowrap',
                openAbove ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
                alignRight && 'right-0'
            )}
        >
            {presets.map((preset) => (
                <Button
                    key={preset}
                    type="button"
                    variant="secondary"
                    size="xs"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        onPick(preset);
                    }}
                >
                    {preset}
                </Button>
            ))}
            {children}
        </div>
    );
}
