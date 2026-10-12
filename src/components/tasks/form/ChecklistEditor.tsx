'use client';

import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { newStepId } from '@/lib/tasks/taskDraft';
import type { ChecklistItem } from '@/lib/tasks/types';
import { APP_COPY } from '@/locales';

const form = APP_COPY.tasks.form;

interface ChecklistEditorProps {
    items: ChecklistItem[];
    onChange: (items: ChecklistItem[]) => void;
}

/** The steps to tick every time: type, move up / down, remove, add */
export function ChecklistEditor({ items, onChange }: ChecklistEditorProps) {
    const move = (index: number, by: number) => {
        const next = [...items];
        const [item] = next.splice(index, 1);
        next.splice(index + by, 0, item);
        onChange(next);
    };

    return (
        <div className="space-y-2">
            {items.map((item, index) => (
                <div key={item.id} className="flex items-center gap-1.5">
                    <span className="w-6 shrink-0 text-right text-xs font-mono text-fg-faint">{index + 1}.</span>
                    <Input
                        value={item.text}
                        placeholder={form.stepPlaceholder}
                        aria-label={`${form.checklist} ${index + 1}`}
                        onChange={(e) => onChange(items.map((step) => (step.id === item.id ? { ...step, text: e.target.value } : step)))}
                    />
                    <Button type="button" variant="ghost" size="sm" title={form.moveUp} aria-label={form.moveUp} disabled={index === 0} onClick={() => move(index, -1)}>
                        <ArrowUp size={14} />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" title={form.moveDown} aria-label={form.moveDown} disabled={index === items.length - 1} onClick={() => move(index, 1)}>
                        <ArrowDown size={14} />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" title={form.remove} aria-label={form.remove} onClick={() => onChange(items.filter((step) => step.id !== item.id))}>
                        <X size={14} />
                    </Button>
                </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...items, { id: newStepId(), text: '' }])}>
                <Plus size={14} />
                {form.addStep}
            </Button>
        </div>
    );
}
