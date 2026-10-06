'use client';

import { useState, type KeyboardEvent } from 'react';
import { Plus, X, Edit2, Check, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface PresetTagEditorProps {
    title: string;
    description: string;
    parametro: 'FERIE_PRESETS' | 'PERMESSO_PRESETS';
    value: string;
    onSave: (parametro: string, newValue: string) => Promise<boolean>;
    onRename?: (
        parametro: 'FERIE_PRESETS' | 'PERMESSO_PRESETS',
        oldTag: string,
        newTag: string,
        updatedPresetsValue: string
    ) => Promise<boolean>;
    disabled?: boolean;
}

/**
 * Reusable visual tag/chip editor for presence presets (Ferie & Permesso).
 * Supports adding, editing/renaming (with cascade to operator data), and removing.
 */
export function PresetTagEditor({
    title,
    description,
    parametro,
    value,
    onSave,
    onRename,
    disabled = false,
}: PresetTagEditorProps) {
    const [newTag, setNewTag] = useState('');
    const [editingTag, setEditingTag] = useState<string | null>(null);
    const [editTagValue, setEditTagValue] = useState<string>('');
    const [saving, setSaving] = useState(false);

    const tags = value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    const handleAdd = async () => {
        const trimmed = newTag.trim().toUpperCase();
        if (!trimmed || saving || disabled) return;

        // Prevent duplicate
        if (tags.some((t) => t.toUpperCase() === trimmed)) {
            setNewTag('');
            return;
        }

        const nextTags = [...tags, trimmed];
        const nextValue = nextTags.join(',');

        setSaving(true);
        try {
            const success = await onSave(parametro, nextValue);
            if (success) {
                setNewTag('');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleStartRename = (tag: string) => {
        setEditingTag(tag);
        setEditTagValue(tag);
    };

    const handleCancelRename = () => {
        setEditingTag(null);
        setEditTagValue('');
    };

    const handleCommitRename = async (oldTag: string) => {
        const trimmed = editTagValue.trim().toUpperCase();
        if (!trimmed || saving || disabled) return;

        // If unchanged, just exit edit mode
        if (trimmed === oldTag.toUpperCase()) {
            handleCancelRename();
            return;
        }

        const nextTags = tags.map((t) => (t.toUpperCase() === oldTag.toUpperCase() ? trimmed : t));
        const nextValue = nextTags.join(',');

        setSaving(true);
        try {
            let success = false;
            if (onRename) {
                success = await onRename(parametro, oldTag, trimmed, nextValue);
            } else {
                success = await onSave(parametro, nextValue);
            }
            if (success) {
                handleCancelRename();
            }
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async (tagToRemove: string) => {
        if (saving || disabled) return;

        const nextTags = tags.filter((t) => t.toUpperCase() !== tagToRemove.toUpperCase());
        const nextValue = nextTags.join(',');

        setSaving(true);
        try {
            await onSave(parametro, nextValue);
        } finally {
            setSaving(false);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    return (
        <div className="p-4 rounded-lg bg-card/50 border border-border space-y-3">
            <div>
                <h4 className="text-xs font-semibold text-fg-soft">{title}</h4>
                <p className="text-2xs text-fg-muted mt-0.5">{description}</p>
            </div>

            {/* Visual Tags List */}
            <div className="flex flex-wrap gap-1.5 min-h-[32px] items-center">
                {tags.length === 0 ? (
                    <span className="text-xs text-fg-faint italic">Nessun preset configurato</span>
                ) : (
                    tags.map((tag) => {
                        const isEditingThisTag = editingTag === tag;

                        if (isEditingThisTag) {
                            return (
                                <div
                                    key={tag}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-background border border-primary shadow-sm"
                                >
                                    <input
                                        type="text"
                                        value={editTagValue}
                                        onChange={(e) => setEditTagValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleCommitRename(tag);
                                            } else if (e.key === 'Escape') {
                                                e.preventDefault();
                                                handleCancelRename();
                                            }
                                        }}
                                        autoFocus
                                        className="h-6 w-28 text-xs font-mono bg-transparent text-fg focus:outline-none px-1"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleCommitRename(tag)}
                                        disabled={saving || !editTagValue.trim()}
                                        className="text-success-400 hover:text-success-300 p-0.5 rounded cursor-pointer transition-colors"
                                        title="Salva"
                                    >
                                        <Check size={12} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCancelRename}
                                        disabled={saving}
                                        className="text-fg-muted hover:text-fg-soft p-0.5 rounded cursor-pointer transition-colors"
                                        title="Annulla"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            );
                        }

                        return (
                            <span
                                key={tag}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-warning-500/10 text-warning-300 border border-warning-500/30 font-mono shadow-sm group"
                            >
                                <span>{tag}</span>
                                <button
                                    type="button"
                                    onClick={() => handleStartRename(tag)}
                                    disabled={saving || disabled}
                                    className="text-warning-400/50 hover:text-warning-300 transition-colors p-0.5 rounded cursor-pointer opacity-70 group-hover:opacity-100"
                                    title={`Modifica ${tag}`}
                                >
                                    <Edit2 size={11} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleRemove(tag)}
                                    disabled={saving || disabled}
                                    className="text-warning-400/50 hover:text-danger-400 transition-colors p-0.5 rounded cursor-pointer opacity-70 group-hover:opacity-100"
                                    title={`Rimuovi ${tag}`}
                                >
                                    <X size={11} />
                                </button>
                            </span>
                        );
                    })
                )}
            </div>

            {/* Add new tag form */}
            <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                <Input
                    type="text"
                    placeholder="Nuovo testo..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={saving || disabled}
                    className="h-7 w-48 text-xs font-mono bg-background text-fg"
                />
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleAdd}
                    disabled={saving || disabled || !newTag.trim()}
                    className="h-7 px-3 text-xs gap-1 cursor-pointer"
                >
                    {saving ? (
                        <Loader2 size={12} className="animate-spin" />
                    ) : (
                        <Plus size={12} />
                    )}
                    <span>Aggiungi</span>
                </Button>
            </div>
        </div>
    );
}
