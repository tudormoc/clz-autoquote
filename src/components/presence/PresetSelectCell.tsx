'use client';

import { Spinner } from '@/components/ui/Spinner';
import { X } from 'lucide-react';
import { PresetPopup } from '@/components/presence/PresetPopup';
import { useInlineEditor } from '@/hooks/useInlineEditor';
import { EMPTY_VALUE } from '@/lib/format';
import { APP_COPY } from '@/locales';
import { cn } from '@/lib/utils';

interface PresetSelectCellProps {
    value: string | null;
    presets?: string[];
    onSave: (newValue: string | null) => Promise<boolean>;
}

const copy = APP_COPY.analytics.monthlySummary.causale;

/** Typed or picked text → value to save: upper-cased, '' → null */
const toCausale = (text: string): string | null => text.trim().toUpperCase() || null;

/** Causale cell (ferie / permesso) of the monthly table: pick a preset tag or type a text; can be removed. */
export function PresetSelectCell({ value, presets = [], onSave }: PresetSelectCellProps) {
    const editor = useInlineEditor<string | null>({ onSave });

    const commit = () => {
        if (!editor.isEditing || editor.saving) return;
        const next = toCausale(editor.editValue);
        if (next === (value || null)) editor.close();
        else editor.save(next);
    };

    if (editor.saving) {
        return (
            <div className="flex items-center justify-center px-2 py-1 text-xs text-primary font-mono gap-1">
                <Spinner size={12} />
                <span>{editor.editValue || '...'}</span>
            </div>
        );
    }

    if (editor.isEditing) {
        return (
            <div className="relative flex items-center justify-center z-30">
                <input
                    ref={editor.inputRef}
                    type="text"
                    value={editor.editValue}
                    placeholder={copy.placeholder}
                    onChange={(e) => editor.setEditValue(e.target.value)}
                    onBlur={commit}
                    onKeyDown={editor.keyDown(commit)}
                    className="h-7 w-32 px-2 text-xs text-center font-semibold uppercase bg-background text-fg border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary shadow-lg"
                />
                <PresetPopup presets={presets} openAbove={editor.openAbove} onPick={(preset) => editor.save(toCausale(preset))}>
                    {value && (
                        <button
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                editor.save(null);
                            }}
                            title={copy.removeTitle}
                            className="px-1.5 py-0.5 text-3xs font-medium bg-danger-950/40 hover:bg-danger-900/60 text-danger-300 border border-danger-800/50 rounded transition-colors flex items-center gap-1"
                        >
                            <X size={10} />
                            <span>{copy.remove}</span>
                        </button>
                    )}
                </PresetPopup>
            </div>
        );
    }

    const start = (e: React.MouseEvent<HTMLElement>) => editor.start(value || '', e);

    return (
        <div className="flex justify-center">
            {value && value.trim() !== '' ? (
                <span
                    onClick={start}
                    title={editor.readOnly ? undefined : APP_COPY.common.clickToEdit}
                    className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded text-2xs font-semibold bg-warning-500/15 text-warning-400 border border-warning-500/30',
                        !editor.readOnly && 'transition-colors hover:bg-warning-500/25 cursor-pointer'
                    )}
                >
                    {value}
                </span>
            ) : (
                <span
                    onClick={start}
                    title={editor.readOnly ? undefined : APP_COPY.common.clickToEdit}
                    className={cn(
                        'px-2 py-0.5 rounded text-xs font-mono text-center block text-fg-faint italic',
                        !editor.readOnly && 'transition-colors cursor-pointer hover:bg-muted/80 hover:text-fg-secondary'
                    )}
                >
                    {EMPTY_VALUE}
                </span>
            )}
        </div>
    );
}
