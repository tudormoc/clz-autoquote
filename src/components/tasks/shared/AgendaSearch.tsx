'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Contact, ListChecks, Search, type LucideIcon } from '@/components/ui/icons';
import { searchAgendaAction } from '@/app/tasks/task-actions';
import { Input } from '@/components/ui/Input';
import { APP_CONFIG } from '@/config/constants';
import { LINKS } from '@/config/navigation';
import type { SearchHit, SearchKind } from '@/lib/tasks/db/search';
import { APP_COPY } from '@/locales';
import { cn } from '@/lib/utils';
import { Surface } from '@/components/ui/Surface';

const copy = APP_COPY.tasks.search;
const ICONS: Record<SearchKind, LucideIcon> = { task: ListChecks, guide: BookOpen, contact: Contact };

/** Where a result leads: the task's or procedure's page; for a contact the Contatti list showing that name */
const hrefOf = (hit: SearchHit) =>
    hit.kind === 'task' ? `${LINKS.tasks.list}/${hit.id}` : hit.kind === 'guide' ? `${LINKS.tasks.guides}/${hit.id}` : `${LINKS.tasks.contacts}?q=${encodeURIComponent(hit.title)}`;

/**
 * The search bar of the Agenda pages: from a couple of letters, tasks, procedures and contacts whose words contain
 * them, in a list under the field. ↑ ↓ and Enter, or a click, open one; Escape or a click elsewhere closes the list.
 */
export function AgendaSearch({ className = 'sm:w-72' }: { className?: string }) {
    const router = useRouter();
    const [text, setText] = useState('');
    const [hits, setHits] = useState<SearchHit[] | null>(null);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const box = useRef<HTMLDivElement>(null);
    const term = text.trim();
    const searching = term.length >= APP_CONFIG.TASKS.SEARCH_MIN_CHARS;

    // Looks up a moment after the last key; an answer to older text is dropped
    useEffect(() => {
        if (!searching) return;
        let current = true;
        const timer = window.setTimeout(async () => {
            const result = await searchAgendaAction(term).catch(() => null);
            if (!current) return;
            setHits(result?.success ? result.hits : []);
            setActive(0);
        }, APP_CONFIG.TASKS.SEARCH_DELAY_MS);
        return () => {
            current = false;
            window.clearTimeout(timer);
        };
    }, [term, searching]);

    useEffect(() => {
        if (!open) return;
        const outside = (event: MouseEvent) => {
            if (!box.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', outside);
        return () => document.removeEventListener('mousedown', outside);
    }, [open]);

    const shown = searching && open ? hits : null;
    const close = () => {
        setOpen(false);
        setText('');
        setHits(null);
    };
    /** Enter on a hit; a click is the hit's own link, so a new tab works too */
    const go = (hit: SearchHit) => {
        close();
        router.push(hrefOf(hit));
    };

    return (
        <div ref={box} className={cn('relative w-full', className)}>
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden />
            <Input
                type="search"
                value={text}
                onChange={(event) => {
                    setText(event.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') setOpen(false);
                    if (!shown || shown.length === 0) return;
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        setActive((index) => (index + (event.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length);
                    } else if (event.key === 'Enter') {
                        event.preventDefault();
                        go(shown[Math.min(active, shown.length - 1)]);
                    }
                }}
                placeholder={copy.placeholder}
                aria-label={copy.label}
                role="combobox"
                aria-expanded={shown !== null}
                aria-autocomplete="list"
                className="pl-8"
                maxLength={APP_CONFIG.TASKS.MAX_TITLE_LENGTH}
            />
            {shown && (
                <Surface kind="floating" role="listbox" className="absolute right-0 top-full z-50 mt-1 w-full sm:w-96 max-h-96 overflow-y-auto py-1">
                    {shown.length === 0 && <p className="px-3 py-2 text-sm text-fg-subtle">{copy.empty}</p>}
                    {shown.map((hit, index) => {
                        const Icon = ICONS[hit.kind];
                        const first = index === 0 || shown[index - 1].kind !== hit.kind;
                        return (
                            <div key={`${hit.kind}:${hit.id}`}>
                                {first && <p className="px-3 pt-2 pb-1 text-3xs font-semibold text-fg-subtle">{copy.groups[hit.kind]}</p>}
                                <Link
                                    href={hrefOf(hit)}
                                    role="option"
                                    aria-selected={index === active}
                                    onClick={close}
                                    onMouseEnter={() => setActive(index)}
                                    className={cn('flex items-start gap-2.5 px-3 py-1.5 text-sm', index === active && 'bg-muted', hit.inactive && 'opacity-60')}
                                    title={hit.inactive ? copy.inactive : undefined}
                                >
                                    <Icon size={14} className="mt-0.5 shrink-0 text-fg-muted" />
                                    <span className="min-w-0">
                                        <span className="block truncate text-fg-strong">{hit.title}</span>
                                        {hit.detail && <span className="block truncate text-2xs text-fg-subtle">{hit.detail}</span>}
                                    </span>
                                </Link>
                            </div>
                        );
                    })}
                </Surface>
            )}
        </div>
    );
}
