'use client';

import { Spinner } from '@/components/ui/Spinner';
import { useInlineEditor } from '@/hooks/useInlineEditor';
import { EMPTY_VALUE } from '@/lib/format';
import { cn } from '@/lib/utils';
import { APP_COPY } from '@/locales';

type HoursValue = number | string | null;

interface EditableHoursCellProps {
    value: HoursValue;
    onSave: (newValue: HoursValue) => Promise<boolean>;
}

const STEP = 0.5;

/** Typed text → value to save: a number rounded to 0.1 h, other text upper-cased (presets such as 'FESTA'), '' → null */
function parseHours(text: string): HoursValue {
    const trimmed = text.trim();
    if (trimmed === '') return null;
    const normalized = trimmed.replace(',', '.');
    const numeric = parseFloat(normalized);
    return !isNaN(numeric) && !isNaN(Number(normalized)) ? Math.round(numeric * 10) / 10 : trimmed.toUpperCase();
}

/** Hours cell of the monthly table: click to type the hours, Enter or leaving the field saves, Escape cancels. */
export function EditableHoursCell({ value, onSave }: EditableHoursCellProps) {
    const editor = useInlineEditor<HoursValue>({ onSave });

    const commit = () => {
        if (!editor.isEditing || editor.saving) return;
        const next = parseHours(editor.editValue);
        if (next === value) editor.close();
        else editor.save(next);
    };

    if (editor.saving) {
        return (
            <div className="flex items-center justify-end px-2 py-1 text-xs text-primary font-mono gap-1">
                <Spinner size={12} />
                <span>{editor.editValue || '...'}</span>
            </div>
        );
    }

    if (editor.isEditing) {
        return (
            <div className="relative flex justify-end z-30">
                <input
                    ref={editor.inputRef}
                    type="number"
                    step={STEP}
                    min={0}
                    value={editor.editValue}
                    onChange={(e) => editor.setEditValue(e.target.value)}
                    onBlur={commit}
                    onKeyDown={editor.keyDown(commit)}
                    className="h-7 w-24 px-2 text-xs text-right font-mono bg-background text-fg border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary shadow-lg"
                />
            </div>
        );
    }

    const hasValue = value !== null && value !== undefined && String(value).trim() !== '';
    const start = (e: React.MouseEvent<HTMLElement>) => editor.start(hasValue ? String(value) : '', e);

    // Text kept in an hours field (e.g. 'FESTA'): shown as a tag
    if (hasValue && isNaN(Number(value))) {
        return (
            <div className="flex justify-end">
                <span
                    onClick={start}
                    title={editor.readOnly ? undefined : APP_COPY.common.clickToEdit}
                    className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-warning-500/15 text-warning-400 border border-warning-500/30',
                        !editor.readOnly && 'cursor-pointer hover:bg-warning-500/25 transition-colors'
                    )}
                >
                    {String(value)}
                </span>
            </div>
        );
    }

    return (
        <span
            onClick={start}
            title={editor.readOnly ? undefined : APP_COPY.common.clickToEdit}
            className={cn(
                'px-2 py-1 rounded text-sm font-mono text-right block',
                !editor.readOnly && 'transition-colors cursor-pointer hover:bg-muted/80 hover:text-primary',
                hasValue && Number(value) > 0 ? 'text-fg-soft font-medium' : 'text-fg-subtle italic'
            )}
        >
            {hasValue ? Number(value).toFixed(1) : EMPTY_VALUE}
        </span>
    );
}
