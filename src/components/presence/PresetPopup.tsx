import { cn } from '@/lib/utils';

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
            className={cn(
                'absolute z-50 flex items-center gap-1 bg-card border border-border-strong p-1 rounded shadow-2xl backdrop-blur-sm whitespace-nowrap',
                openAbove ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
                alignRight && 'right-0'
            )}
        >
            {presets.map((preset) => (
                <button
                    key={preset}
                    type="button"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        onPick(preset);
                    }}
                    className="px-2 py-0.5 text-3xs font-semibold bg-muted hover:bg-warning-600/30 hover:text-warning-300 text-fg-secondary border border-border-strong rounded transition-colors"
                >
                    {preset}
                </button>
            ))}
            {children}
        </div>
    );
}
