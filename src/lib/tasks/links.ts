/**
 * Where a link of a task, occurrence or procedure goes. Only safe targets become clickable: web pages (http/https),
 * email, phone and pages of this app. A shared-folder path is never a link (browsers refuse file:// from a web page):
 * it is shown with a "copy" button instead.
 */

import type { TaskLink } from '@/lib/tasks/types';

/** The address to open, or null when the link is only text (a path, "altro", or something that is not a safe address) */
export function linkHref({ kind, value }: TaskLink): string | null {
    const text = value.trim();
    switch (kind) {
        case 'web':
            if (/^https?:\/\//i.test(text)) return text;
            return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(text) ? `https://${text}` : null;
        case 'email':
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? `mailto:${text}` : null;
        case 'phone': {
            const digits = text.replace(/[^\d+]/g, '');
            return digits.length >= 3 ? `tel:${digits}` : null;
        }
        case 'page':
            return text.startsWith('/') && !text.startsWith('//') ? text : null;
        default:
            return null;
    }
}

/** A link the form may save: something written in the address */
export const isFilledLink = (link: TaskLink) => link.value.trim().length > 0;
