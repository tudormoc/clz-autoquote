'use client';

import { useCallback, useState } from 'react';
import {
    completeOccurrenceAction,
    postponeOccurrenceAction,
    reopenOccurrenceAction,
    setOccurrenceStatusAction,
} from '@/app/tasks/agenda-actions';
import type { Saved } from '@/app/tasks/results';
import { notify } from '@/lib/notify';
import { formatIsoDate } from '@/lib/tasks/describe';
import type { Occurrence } from '@/lib/tasks/types';
import { APP_COPY, fmt } from '@/locales';

/** The windows an occurrence action may need: done with a note, a new date, waiting for whom, why skipped / cancelled */
export type OccurrenceDialogKind = 'done' | 'postpone' | 'waiting' | 'skip' | 'cancel';

/** An occurrence with its task's title (for the messages) */
export type TitledOccurrence = Occurrence & { title: string };

export interface OccurrenceDialogValues {
    date: string;
    text: string;
}

const messages = APP_COPY.tasks.messages;

/**
 * Everything that can be done to an occurrence, from the to-do list or the task page: each action saves, says how it
 * went and reloads the page's data. Actions that need a date or a text open a window first (`dialog`).
 */
export function useOccurrenceActions(reload: () => Promise<void>, today: string) {
    const [dialog, setDialog] = useState<{ kind: OccurrenceDialogKind; occurrence: TitledOccurrence } | null>(null);
    const [busy, setBusy] = useState(false);

    /** Runs a save; true when it worked */
    const run = useCallback(
        async (save: Promise<Saved>, success?: string): Promise<boolean> => {
            setBusy(true);
            try {
                const result = await save;
                if (!result.success) {
                    notify.error(result.error);
                    return false;
                }
                if (success) notify.success(success);
                return true;
            } catch (err) {
                notify.failure(err);
                return false;
            } finally {
                setBusy(false);
                await reload();
            }
        },
        [reload]
    );

    const done = (occurrence: TitledOccurrence) =>
        run(completeOccurrenceAction(occurrence.id, occurrence.version, today, null), fmt(messages.done, { title: occurrence.title }));

    const reopen = (occurrence: TitledOccurrence) =>
        run(reopenOccurrenceAction(occurrence.id, occurrence.version), fmt(messages.reopened, { title: occurrence.title }));

    /** In progress / back to open: no window */
    const setStatus = (occurrence: TitledOccurrence, status: 'open' | 'progress') =>
        run(setOccurrenceStatusAction(occurrence.id, occurrence.version, status, null));

    /** Saves what the open window holds; closes it when saved */
    const submitDialog = async ({ date, text }: OccurrenceDialogValues) => {
        if (!dialog) return;
        const { kind, occurrence } = dialog;
        const note = text.trim() || null;
        const saved =
            kind === 'done'
                ? await run(completeOccurrenceAction(occurrence.id, occurrence.version, date, note), fmt(messages.done, { title: occurrence.title }))
                : kind === 'postpone'
                  ? await run(postponeOccurrenceAction(occurrence.id, occurrence.version, date, note), fmt(messages.postponed, { date: formatIsoDate(date) }))
                  : await run(setOccurrenceStatusAction(occurrence.id, occurrence.version, kind === 'waiting' ? 'waiting' : kind === 'skip' ? 'skipped' : 'cancelled', note));
        if (saved) setDialog(null);
    };

    return {
        busy,
        dialog,
        open: (kind: OccurrenceDialogKind, occurrence: TitledOccurrence) => setDialog({ kind, occurrence }),
        close: () => setDialog(null),
        submitDialog,
        done,
        reopen,
        setStatus,
    };
}

export type OccurrenceActions = ReturnType<typeof useOccurrenceActions>;
