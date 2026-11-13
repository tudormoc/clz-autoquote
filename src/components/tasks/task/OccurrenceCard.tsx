'use client';

import { useState } from 'react';
import { CheckCircle2, MessageSquare, Save } from '@/components/ui/icons';
import { addCommentAction, saveOutcomeAction, setChecklistStepAction } from '@/app/tasks/agenda-actions';
import type { Saved } from '@/app/tasks/results';
import { useCanEdit } from '@/components/auth/AccessProvider';
import { occurrenceMenu } from '@/components/tasks/occurrence/occurrenceMenu';
import { DueLabel } from '@/components/tasks/shared/DueLabel';
import { OccurrenceStatusBadge } from '@/components/tasks/shared/TaskBadges';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import type { OccurrenceActions, TitledOccurrence } from '@/hooks/useOccurrenceActions';
import { notify } from '@/lib/notify';
import { formatMoment } from '@/lib/tasks/describe';
import type { ChecklistItem, LogEntry } from '@/lib/tasks/types';
import { APP_COPY, fmt } from '@/locales';
import { surfaceClasses } from '@/components/ui/Surface';
import { titleClasses } from '@/components/ui/titleLook';
import { Field } from '@/components/ui/Field';

const copy = APP_COPY.tasks;

interface OccurrenceCardProps {
    occurrence: TitledOccurrence & { suggestedDate: string | null; closedReason: string | null };
    taskId: number;
    repeats: boolean;
    checklist: ChecklistItem[];
    /** Comments written on this occurrence */
    comments: LogEntry[];
    today: string;
    actions: OccurrenceActions;
    reload: () => Promise<void>;
    /** A later one: only its date, state and actions (the first open one shows everything) */
    compact?: boolean;
}

/** An open occurrence on the task page: due date and state, "Fatto", the checklist to tick, its outcome and comments */
export function OccurrenceCard({ occurrence, taskId, repeats, checklist, comments, today, actions, reload, compact = false }: OccurrenceCardProps) {
    const canEdit = useCanEdit();
    const [outcome, setOutcome] = useState(occurrence.outcome ?? '');
    const [comment, setComment] = useState('');
    const [saving, setSaving] = useState(false);

    const run = async (save: Promise<Saved>, success?: string) => {
        setSaving(true);
        try {
            const result = await save;
            if (!result.success) notify.error(result.error);
            else if (success) notify.success(success);
            return result.success;
        } catch (err) {
            notify.failure(err);
            return false;
        } finally {
            setSaving(false);
            await reload();
        }
    };

    const ticked = new Set(occurrence.checklistDone);

    return (
        <div className={surfaceClasses('inset', 'space-y-3', compact ? 'px-3 py-2' : 'p-3 sm:p-4')}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <OccurrenceStatusBadge status={occurrence.status} note={occurrence.statusNote} />
                    {canEdit && (
                        <Button size="sm" onClick={() => actions.done(occurrence)} disabled={actions.busy || saving}>
                            <CheckCircle2 size={14} />
                            {copy.actions.done}
                        </Button>
                    )}
                </div>
                <div className="flex items-start gap-1">
                    <DueLabel
                        dueDate={occurrence.dueDate}
                        dueTime={occurrence.dueTime}
                        today={today}
                        suggestedDate={occurrence.suggestedDate}
                        closedReason={occurrence.closedReason}
                        originalDate={occurrence.originalDate}
                    />
                    {canEdit && <ActionMenu actions={occurrenceMenu(occurrence, repeats, actions)} />}
                </div>
            </div>

            {!compact && checklist.length > 0 && (
                <div>
                    <p className={titleClasses('label', 'mb-1.5')}>
                        {fmt(copy.detail.checklistOf, { done: checklist.filter((step) => ticked.has(step.id)).length, total: checklist.length })}
                    </p>
                    <ul className="space-y-1">
                        {checklist.map((step) => (
                            <li key={step.id}>
                                <Checkbox
                                    id={`step-${occurrence.id}-${step.id}`}
                                    label={step.text}
                                    checked={ticked.has(step.id)}
                                    disabled={!canEdit || saving}
                                    onChange={(e) => run(setChecklistStepAction(occurrence.id, occurrence.version, step.id, e.target.checked))}
                                />
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {!compact && canEdit && (
                <div className="space-y-1.5">
                    <Field label={copy.detail.outcome} htmlFor={`outcome-${occurrence.id}`}>
                        <Textarea id={`outcome-${occurrence.id}`} rows={2} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder={copy.dialogs.outcomePlaceholder} />
                    </Field>
                    {outcome !== (occurrence.outcome ?? '') && (
                        <Button size="sm" variant="secondary" disabled={saving} onClick={() => run(saveOutcomeAction(occurrence.id, occurrence.version, outcome), copy.messages.saved)}>
                            <Save size={14} />
                            {copy.detail.saveOutcome}
                        </Button>
                    )}
                </div>
            )}

            {!compact && (comments.length > 0 || canEdit) && (
                <div className="space-y-1.5">
                    <p className={titleClasses('label', 'flex items-center gap-1.5')}>
                        <MessageSquare size={13} />
                        {copy.detail.comments}
                    </p>
                    {comments.map((entry) => (
                        <p key={entry.id} className="text-xs text-fg">
                            <span className="font-mono text-fg-subtle">{formatMoment(entry.at)}</span>
                            <span className="text-fg-muted"> · {entry.personName}: </span>
                            {String(entry.details?.text ?? '')}
                        </p>
                    ))}
                    {canEdit && (
                        <form
                            className="flex gap-2"
                            onSubmit={async (event) => {
                                event.preventDefault();
                                if (comment.trim() && (await run(addCommentAction(taskId, occurrence.id, comment)))) setComment('');
                            }}
                        >
                            <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={copy.detail.commentPlaceholder} aria-label={copy.detail.addComment} />
                            <Button type="submit" size="sm" variant="secondary" className="h-9 shrink-0 whitespace-nowrap" disabled={saving || !comment.trim()}>
                                {copy.detail.addComment}
                            </Button>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}
