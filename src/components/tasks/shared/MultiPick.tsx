'use client';

import { useMemo, useState } from 'react';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { APP_COPY } from '@/locales';

export interface PickOption {
    id: number;
    label: string;
    /** Second line (company, area …) */
    detail?: string;
}

interface MultiPickProps {
    options: PickOption[];
    selected: number[];
    onChange: (selected: number[]) => void;
    /** Shown when there is nothing to choose from */
    emptyText: string;
}

/** Above this many choices a search box appears */
const SEARCH_FROM = 8;

/** Tick the ones that apply (procedures, contacts); the ticked ones stay at the top */
export function MultiPick({ options, selected, onChange, emptyText }: MultiPickProps) {
    const [search, setSearch] = useState('');
    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();
        const chosen = options.filter((option) => selected.includes(option.id));
        const others = options.filter((option) => !selected.includes(option.id) && (!term || `${option.label} ${option.detail ?? ''}`.toLowerCase().includes(term)));
        return [...chosen, ...others];
    }, [options, selected, search]);

    if (options.length === 0) return <p className="text-xs text-fg-subtle">{emptyText}</p>;

    const toggle = (id: number, on: boolean) => onChange(on ? [...selected, id] : selected.filter((item) => item !== id));

    return (
        <div className="space-y-2">
            {options.length > SEARCH_FROM && <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={APP_COPY.common.search} />}
            <div className="max-h-56 overflow-y-auto rounded border border-border divide-y divide-border/60">
                {visible.map((option) => (
                    <label key={option.id} className="flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/40">
                        <span className="mt-0.5">
                            <Checkbox checked={selected.includes(option.id)} onChange={(e) => toggle(option.id, e.target.checked)} aria-label={option.label} />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm text-fg">{option.label}</span>
                            {option.detail && <span className="block text-2xs text-fg-subtle">{option.detail}</span>}
                        </span>
                    </label>
                ))}
            </div>
        </div>
    );
}
