'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EditableCell } from '@/components/ui/EditableCell';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { APP_COPY, fmt } from '@/locales';
import { useCanEdit } from '@/components/auth/AccessProvider';

const copy = APP_COPY.analytics.presenceSettings;

const parseTags = (value: string) => value.split(',').map((tag) => tag.trim()).filter(Boolean);
const sameTag = (a: string, b: string) => a.toUpperCase() === b.toUpperCase();

interface PresetTagEditorProps {
    title: string;
    description: string;
    /** The tags, separated by commas, as stored */
    value: string;
    /** Saves the whole list; true when it was saved */
    onSave: (value: string) => Promise<boolean>;
    /** Renames one tag everywhere it was used; true when it was saved */
    onRename: (oldTag: string, newTag: string, value: string) => Promise<boolean>;
}

/** The quick-pick texts of a presence column (Ferie, Permessi) as chips: click one to rename it, ✕ removes it, the field adds one. */
export function PresetTagEditor({ title, description, value, onSave, onRename }: PresetTagEditorProps) {
    const canEdit = useCanEdit();
    const [newTag, setNewTag] = useState('');
    const [saving, setSaving] = useState(false);
    const tags = parseTags(value);

    const run = async (write: () => Promise<boolean>) => {
        setSaving(true);
        try {
            return await write();
        } finally {
            setSaving(false);
        }
    };

    const add = async () => {
        const tag = newTag.trim().toUpperCase();
        if (!tag || saving) return;
        if (tags.some((existing) => sameTag(existing, tag))) {
            setNewTag('');
            return;
        }
        if (await run(() => onSave([...tags, tag].join(',')))) setNewTag('');
    };

    const remove = (tag: string) => run(() => onSave(tags.filter((existing) => !sameTag(existing, tag)).join(',')));

    const rename = async (oldTag: string, draft: string) => {
        const tag = draft.trim().toUpperCase();
        if (!tag) return false;
        if (sameTag(tag, oldTag)) return true;
        const next = tags.map((existing) => (sameTag(existing, oldTag) ? tag : existing)).join(',');
        return run(() => onRename(oldTag, tag, next));
    };

    return (
        <div className="p-4 rounded-lg bg-card/50 border border-border space-y-3">
            <div>
                <h4 className="text-xs font-semibold text-fg-soft">{title}</h4>
                <p className="text-2xs text-fg-muted mt-0.5">{description}</p>
            </div>

            <div className="flex flex-wrap gap-1.5 min-h-8 items-center">
                {tags.length === 0 && <span className="text-xs text-fg-faint italic">{copy.noPresets}</span>}
                {tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-md bg-warning-500/10 border border-warning-500/30">
                        <EditableCell
                            display={<span className="text-xs font-semibold font-mono text-warning-300">{tag}</span>}
                            startValue={() => tag}
                            renderEditor={(draft, setDraft) => (
                                <div className="w-28">
                                    <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="h-7 text-xs font-mono" autoFocus />
                                </div>
                            )}
                            onSave={(draft) => rename(tag, draft)}
                        />
                        {canEdit && (
                            <button
                                type="button"
                                onClick={() => remove(tag)}
                                disabled={saving}
                                title={fmt(copy.removePreset, { tag })}
                                className="p-0.5 rounded text-warning-400/60 hover:text-danger-400 transition-colors disabled:opacity-50"
                            >
                                <X size={11} />
                            </button>
                        )}
                    </span>
                ))}
            </div>

            {canEdit && (
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        add();
                    }}
                    className="flex items-center gap-2 pt-1 border-t border-border/60"
                >
                    <div className="w-48">
                        <Input
                            placeholder={copy.newPresetPlaceholder}
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            disabled={saving}
                            className="h-7 text-xs font-mono"
                        />
                    </div>
                    <Button type="submit" size="sm" variant="secondary" disabled={saving || !newTag.trim()}>
                        {saving ? <Spinner size={12} /> : <Plus size={12} />}
                        {copy.addPreset}
                    </Button>
                </form>
            )}
        </div>
    );
}
