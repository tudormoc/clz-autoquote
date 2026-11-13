'use client';

import { useState } from 'react';
import { Plus, X } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { EditableCell } from '@/components/ui/EditableCell';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { APP_COPY, fmt } from '@/locales';
import { useCanEdit } from '@/components/auth/AccessProvider';
import { Surface } from '@/components/ui/Surface';
import { IconButton } from '@/components/ui/IconButton';
import { statusBadgeClasses } from '@/components/ui/StatusBadge';
import { titleClasses } from '@/components/ui/titleLook';

const copy = APP_COPY.analytics.presenceSettings;

const parseTags = (value: string) => value.split(',').map((tag) => tag.trim()).filter(Boolean);
const sameTag = (a: string, b: string) => a.toUpperCase() === b.toUpperCase();

interface PresetTagEditorProps {
    title: string;
    /** The tags, separated by commas, as stored */
    value: string;
    /** Saves the whole list; true when it was saved */
    onSave: (value: string) => Promise<boolean>;
    /** Renames one tag everywhere it was used; true when it was saved */
    onRename: (oldTag: string, newTag: string, value: string) => Promise<boolean>;
}

/** The quick-pick texts of a presence column (Ferie, Permessi) as chips: click one to rename it, ✕ removes it, the field adds one. */
export function PresetTagEditor({ title, value, onSave, onRename }: PresetTagEditorProps) {
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
        <Surface kind="inset" className="p-4 space-y-3">
            <h4 className={titleClasses('label')}>{title}</h4>

            <div className="flex flex-wrap gap-1.5 min-h-8 items-center">
                {tags.length === 0 && <span className="text-xs text-fg-faint italic">{copy.noPresets}</span>}
                {tags.map((tag) => (
                    <span key={tag} className={statusBadgeClasses({ tone: 'warning', size: 'md', className: 'pr-1.5' })}>
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
                            <IconButton type="button" size="xs" tone="danger" onClick={() => remove(tag)} disabled={saving} title={fmt(copy.removePreset, { tag })}>
                                <X size={11} />
                            </IconButton>
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
        </Surface>
    );
}
