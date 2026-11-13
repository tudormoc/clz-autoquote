'use client';

import { Plus, X } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { LINK_KINDS, type LinkKind, type TaskLink } from '@/lib/tasks/types';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.tasks;
const KIND_OPTIONS = LINK_KINDS.map((kind) => ({ value: kind, label: copy.linkKinds[kind] }));

interface LinksEditorProps {
    links: TaskLink[];
    onChange: (links: TaskLink[]) => void;
}

/** Rows of kind / name / address, a row added with the button, removed with ✕ */
export function LinksEditor({ links, onChange }: LinksEditorProps) {
    const set = (index: number, change: Partial<TaskLink>) => onChange(links.map((link, i) => (i === index ? { ...link, ...change } : link)));

    return (
        <div className="space-y-2">
            {links.map((link, index) => (
                <div key={index} className="grid grid-cols-1 sm:grid-cols-[10rem_1fr_2fr_auto] gap-2 items-center">
                    <Select
                        aria-label={copy.form.linkKind}
                        options={KIND_OPTIONS}
                        value={link.kind}
                        onChange={(e) => set(index, { kind: e.target.value as LinkKind })}
                    />
                    <Input aria-label={copy.form.linkLabel} placeholder={copy.form.linkLabel} value={link.label} onChange={(e) => set(index, { label: e.target.value })} />
                    <Input
                        aria-label={copy.form.linkValue}
                        placeholder={copy.linkPlaceholders[link.kind] || copy.form.linkValue}
                        value={link.value}
                        onChange={(e) => set(index, { value: e.target.value })}
                        className={link.kind === 'path' ? 'font-mono text-xs' : undefined}
                    />
                    <Button type="button" variant="ghost" size="sm" title={copy.form.remove} aria-label={copy.form.remove} onClick={() => onChange(links.filter((_, i) => i !== index))}>
                        <X size={16} />
                    </Button>
                </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...links, { kind: 'web', label: '', value: '' }])}>
                <Plus size={14} />
                {copy.form.addLink}
            </Button>
        </div>
    );
}
