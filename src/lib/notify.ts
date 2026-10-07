'use client';

import { errorMessage } from '@/lib/utils';
import { APP_CONFIG } from '@/config/constants';
import { createStore } from '@/lib/store';
import { APP_COPY, fmt } from '@/locales';

export type NoticeTone = 'success' | 'error' | 'info';

export interface Notice {
    id: number;
    tone: NoticeTone;
    message: string;
}

/** Notices on screen right now (shown by <Notices /> in the root layout) */
export const noticeStore = createStore<Notice[]>([]);

let nextId = 1;

export function dismissNotice(id: number) {
    noticeStore.set(noticeStore.get().filter((notice) => notice.id !== id));
}

function show(tone: NoticeTone, message: string) {
    const id = nextId++;
    noticeStore.set([...noticeStore.get(), { id, tone, message }]);
    const { TOAST_DURATION, ERROR_TOAST_DURATION } = APP_CONFIG.UI;
    setTimeout(() => dismissNotice(id), tone === 'error' ? ERROR_TOAST_DURATION : TOAST_DURATION);
}

/** Short message in the corner of the screen, instead of a blocking alert() */
export const notify = {
    success: (message: string) => show('success', message),
    info: (message: string) => show('info', message),
    error: (message: string) => show('error', message),
    /** "Errore: …" for a failed action, from an error object or an action's error text */
    failure: (error: unknown) =>
        show('error', fmt(APP_COPY.common.actionError, { error: errorMessage(error ?? '') })),
};
