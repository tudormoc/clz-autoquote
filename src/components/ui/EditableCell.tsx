'use client';

import { useState } from 'react';
import { Save, X } from '@/components/ui/icons';
import { useCanEdit } from '@/components/auth/AccessProvider';
import { Button } from '@/components/ui/Button';
import { APP_COPY } from '@/locales';
import { Pressable } from '@/components/ui/Pressable';

interface EditableCellProps<T> {
    /** What the cell shows when it is not being edited */
    display: React.ReactNode;
    /** Value the editor starts from */
    startValue: () => T;
    /** The editing controls (input, select, date + time …), bound to the draft value */
    renderEditor: (draft: T, setDraft: (value: T) => void) => React.ReactNode;
    /** Saves the draft; return true to close the editor */
    onSave: (draft: T) => Promise<boolean>;
}

/**
 * Table cell that turns into an editor on click: save / cancel buttons, Enter saves, Escape cancels.
 * Someone who may only view the page sees the plain value.
 */
export function EditableCell<T>({ display, startValue, renderEditor, onSave }: EditableCellProps<T>) {
    const [draft, setDraft] = useState<{ value: T } | null>(null);
    const [saving, setSaving] = useState(false);
    const canEdit = useCanEdit();

    if (!canEdit) return <>{display}</>;

    if (draft === null) {
        return (
            <Pressable
                type="button"
                onClick={() => setDraft({ value: startValue() })}
                title={APP_COPY.common.clickToEdit}
                className="-mx-2 px-2 py-1 rounded text-left transition-colors hover:bg-muted"
            >
                {display}
            </Pressable>
        );
    }

    const save = async () => {
        setSaving(true);
        try {
            if (await onSave(draft.value)) setDraft(null);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="flex items-center gap-1"
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    save();
                } else if (e.key === 'Escape') {
                    setDraft(null);
                }
            }}
        >
            {renderEditor(draft.value, (value) => setDraft({ value }))}
            <Button onClick={save} disabled={saving} size="icon" title={APP_COPY.common.save} aria-label={APP_COPY.common.save}>
                <Save size={14} />
            </Button>
            <Button onClick={() => setDraft(null)} disabled={saving} variant="secondary" size="icon" title={APP_COPY.common.cancel} aria-label={APP_COPY.common.cancel}>
                <X size={14} />
            </Button>
        </div>
    );
}
