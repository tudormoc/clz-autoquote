'use client';

import { useState } from 'react';
import { Markdown } from '@/components/ui/Markdown';
import { TabBar } from '@/components/ui/TabBar';
import { Textarea } from '@/components/ui/Textarea';
import { FIELD_FRAME } from '@/components/ui/fieldLook';
import { APP_COPY } from '@/locales';

interface MarkdownFieldProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /** Height of the text box (rows) */
    rows?: number;
    id?: string;
}

/** A text box for formatted text, with "Scrivi" / "Anteprima" tabs to see how it will look */
export function MarkdownField({ value, onChange, placeholder, rows = 8, id }: MarkdownFieldProps) {
    const [tab, setTab] = useState<'write' | 'preview'>('write');
    const copy = APP_COPY.common;

    return (
        <div className={FIELD_FRAME}>
            <TabBar
                className="px-2 pt-1 border-b border-border"
                tabs={[
                    { id: 'write', label: copy.write },
                    { id: 'preview', label: copy.preview },
                ]}
                active={tab}
                onChange={setTab}
            />
            {tab === 'write' ? (
                <Textarea
                    id={id}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    rows={rows}
                    className="border-0 rounded-t-none font-mono text-xs leading-relaxed resize-y"
                />
            ) : (
                <div className="px-3 py-2 min-h-40">
                    {value.trim() ? <Markdown text={value} /> : <p className="text-sm text-fg-faint">{copy.nothingToPreview}</p>}
                </div>
            )}
        </div>
    );
}
