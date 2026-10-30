'use client';

import Link from 'next/link';
import { AppWindow, Copy, ExternalLink, Folder, Globe, Link2, Mail, Phone, type LucideIcon } from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';
import { notify } from '@/lib/notify';
import { linkHref } from '@/lib/tasks/links';
import type { LinkKind, TaskLink } from '@/lib/tasks/types';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.tasks;

const LINK_ICONS: Record<LinkKind, LucideIcon> = { web: Globe, path: Folder, page: AppWindow, email: Mail, phone: Phone, other: Link2 };

function LinkRow({ link }: { link: TaskLink }) {
    const Icon = LINK_ICONS[link.kind];
    const href = linkHref(link);
    const text = link.label || link.value;
    const detail = link.label && link.label !== link.value ? link.value : null;

    const copyPath = async () => {
        try {
            await copyToClipboard(link.value);
            notify.success(copy.pathCopied);
        } catch (err) {
            notify.failure(err);
        }
    };

    const body = (
        <span className="min-w-0">
            <span className="block text-sm text-fg break-words">{text}</span>
            {detail && <span className="block text-2xs font-mono text-fg-subtle break-all">{detail}</span>}
        </span>
    );

    return (
        <li className="flex items-start gap-2.5 px-3 py-2">
            <Icon size={16} className="mt-0.5 shrink-0 text-fg-muted" />
            {href && link.kind === 'page' ? (
                <Link href={href} className="flex-1 min-w-0 hover:text-primary">
                    {body}
                </Link>
            ) : href ? (
                <a href={href} target={link.kind === 'web' ? '_blank' : undefined} rel="noopener noreferrer" className="flex-1 min-w-0 flex items-start gap-1.5 group">
                    {body}
                    {link.kind === 'web' && <ExternalLink size={12} className="mt-1 shrink-0 text-fg-faint group-hover:text-primary" />}
                </a>
            ) : (
                <span className="flex-1 min-w-0">{body}</span>
            )}
            {link.kind === 'path' && (
                <button type="button" onClick={copyPath} title={copy.pathHint} aria-label={copy.copyPath} className="shrink-0 p-1 rounded text-fg-muted hover:text-primary hover:bg-muted">
                    <Copy size={14} />
                </button>
            )}
        </li>
    );
}

/** Links and paths of a task or procedure: web pages open in a new tab, paths have a "copy" button */
export function LinkList({ links }: { links: TaskLink[] }) {
    if (links.length === 0) return null;
    return (
        <ul className="rounded-lg border border-border divide-y divide-border/60 bg-card/40">
            {links.map((link, index) => (
                <LinkRow key={`${link.kind}:${link.value}:${index}`} link={link} />
            ))}
        </ul>
    );
}
