'use client';

import { createStore } from '@/lib/store';
import { APP_COPY } from '@/locales';

export interface ConfirmOptions {
    title: string;
    message?: string;
    /** Text of the confirm button (default "Conferma") */
    confirmLabel?: string;
    /** danger: red confirm button, for deletions */
    tone?: 'primary' | 'danger';
}

interface ConfirmRequest extends ConfirmOptions {
    resolve: (confirmed: boolean) => void;
}

/** The question on screen right now (shown by <ConfirmHost /> in the root layout) */
export const confirmStore = createStore<ConfirmRequest | null>(null);

/** Asks the user in the app's own window, instead of confirm(); resolves true on "Conferma" */
export function askConfirm(options: ConfirmOptions): Promise<boolean> {
    confirmStore.get()?.resolve(false);
    return new Promise((resolve) => confirmStore.set({ ...options, resolve }));
}

export function answerConfirm(confirmed: boolean) {
    confirmStore.get()?.resolve(confirmed);
    confirmStore.set(null);
}

/** Deletion question: "Elimina" window with the given text and a red "Elimina" button */
export function confirmDelete(message: string): Promise<boolean> {
    return askConfirm({ title: APP_COPY.common.delete, message, tone: 'danger', confirmLabel: APP_COPY.common.delete });
}
