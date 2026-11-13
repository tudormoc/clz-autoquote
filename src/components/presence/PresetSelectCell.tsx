'use client';

import { Spinner } from '@/components/ui/Spinner';
import { X } from '@/components/ui/icons';
import { PresetPopup } from '@/components/presence/PresetPopup';
import { useInlineEditor } from '@/hooks/useInlineEditor';
import { EMPTY_VALUE, PENDING_VALUE } from '@/lib/format';
import { APP_COPY } from '@/locales';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { CELL_FIELD, FIELD } from '@/components/ui/fieldLook';
import { statusBadgeClasses } from '@/components/ui/StatusBadge';
import { VALUE_PRESSABLE } from '@/components/ui/Table';

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
                <span>{editor.editValue || PENDING_VALUE}</span>
            </div>
        );
    }

    if (editor.isEditing) {
        return (
            <div className="relative flex items-center justify-center z-popup">
                <input
                    ref={editor.inputRef}
                    type="text"
                    value={editor.editValue}
                    placeholder={copy.placeholder}
                    onChange={(e) => editor.setEditValue(e.target.value)}
                    onBlur={commit}
                    onKeyDown={editor.keyDown(commit)}
                    className={cn(FIELD, CELL_FIELD, 'w-32 text-center font-semibold uppercase')}
                />
                <PresetPopup presets={presets} openAbove={editor.openAbove} onPick={(preset) => editor.save(toCausale(preset))}>
                    {value && (
                        <Button
                            type="button"
                            variant="danger"
                            size="xs"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                editor.save(null);
                            }}
                            title={copy.removeTitle}
                        >
                            <X size={10} />
                            {copy.remove}
                        </Button>
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
                        statusBadgeClasses({ tone: 'warning' }),
                        !editor.readOnly && VALUE_PRESSABLE
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
                        !editor.readOnly && VALUE_PRESSABLE
                    )}
                >
                    {EMPTY_VALUE}
                </span>
            )}
        </div>
    );
}
