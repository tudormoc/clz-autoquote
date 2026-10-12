'use client';

import { RotateCcw } from 'lucide-react';
import { useCanEdit } from '@/components/auth/AccessProvider';
import { OccurrenceStatusBadge } from '@/components/tasks/shared/TaskBadges';
import { formatMoment, formatShortDay } from '@/lib/tasks/describe';
import type { OccurrenceActions, TitledOccurrence } from '@/hooks/useOccurrenceActions';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.tasks;

/** The closed occurrences of a task: when it was due, how it ended, when and by whom, the outcome; "Riapri" on each */
export function ClosedOccurrences({ occurrences, actions }: { occurrences: TitledOccurrence[]; actions: OccurrenceActions }) {
    const canEdit = useCanEdit();
    if (occurrences.length === 0) return <p className="text-sm text-fg-subtle">{copy.detail.noPast}</p>;

    return (
        <ul className="divide-y divide-border/60">
            {occurrences.map((occurrence) => (
                <li key={occurrence.id} className="py-2.5 flex items-start gap-3">
                    <span className="w-24 shrink-0 font-mono text-sm text-fg-secondary">{occurrence.dueDate ? formatShortDay(occurrence.dueDate) : copy.repeat.noDate}</span>
                    <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <OccurrenceStatusBadge status={occurrence.status} note={occurrence.statusNote} />
                            {occurrence.doneAt && (
                                <span className="text-xs text-fg-subtle">{fmt(copy.detail.doneBy, { date: formatMoment(occurrence.doneAt), name: occurrence.doneByName ?? '' })}</span>
                            )}
                        </div>
                        {(occurrence.outcome || (occurrence.status !== 'done' && occurrence.statusNote)) && (
                            <p className="text-xs text-fg whitespace-pre-line break-words">{occurrence.outcome ?? occurrence.statusNote}</p>
                        )}
                    </div>
                    {canEdit && (
                        <button
                            type="button"
                            onClick={() => actions.reopen(occurrence)}
                            disabled={actions.busy}
                            title={copy.actions.reopen}
                            aria-label={copy.actions.reopen}
                            className="p-1.5 rounded text-fg-muted hover:text-fg-strong hover:bg-muted disabled:opacity-50"
                        >
                            <RotateCcw size={14} />
                        </button>
                    )}
                </li>
            ))}
        </ul>
    );
}
