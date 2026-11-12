'use client';

import { useId, useState } from 'react';
import { CalendarClock, CheckCircle2, Hourglass, SkipForward, XCircle, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import type { OccurrenceDialogKind, OccurrenceDialogValues, TitledOccurrence } from '@/hooks/useOccurrenceActions';
import { addDays } from '@/lib/dateUtils';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.tasks.dialogs;

interface DialogSetup {
    title: string;
    icon: LucideIcon;
    tone: 'primary' | 'success' | 'warning' | 'danger';
    /** The date field: done on (today or earlier) or the new due date */
    date?: { label: string; max?: 'today' };
    text: { label: string; placeholder?: string; required: boolean; long: boolean };
    confirm: string;
}

const SETUP: Record<OccurrenceDialogKind, DialogSetup> = {
    done: {
        title: copy.doneTitle,
        icon: CheckCircle2,
        tone: 'success',
        date: { label: copy.doneOn, max: 'today' },
        text: { label: copy.outcome, placeholder: copy.outcomePlaceholder, required: false, long: true },
        confirm: APP_COPY.tasks.actions.markDone,
    },
    postpone: {
        title: copy.postponeTitle,
        icon: CalendarClock,
        tone: 'primary',
        date: { label: copy.postponeTo },
        text: { label: copy.postponeReason, required: false, long: false },
        confirm: APP_COPY.common.save,
    },
    waiting: {
        title: copy.waitingTitle,
        icon: Hourglass,
        tone: 'warning',
        text: { label: copy.waitingFor, placeholder: copy.waitingPlaceholder, required: true, long: false },
        confirm: APP_COPY.common.save,
    },
    skip: {
        title: copy.skipTitle,
        icon: SkipForward,
        tone: 'warning',
        text: { label: copy.skipReason, placeholder: copy.skipPlaceholder, required: true, long: false },
        confirm: APP_COPY.common.confirm,
    },
    cancel: {
        title: copy.cancelTitle,
        icon: XCircle,
        tone: 'danger',
        text: { label: copy.cancelReason, required: true, long: false },
        confirm: APP_COPY.common.confirm,
    },
};

interface OccurrenceDialogProps {
    kind: OccurrenceDialogKind;
    occurrence: TitledOccurrence;
    today: string;
    busy: boolean;
    onSubmit: (values: OccurrenceDialogValues) => void;
    onClose: () => void;
}

/** The small window of an occurrence action: a date and / or a short text, then save */
export function OccurrenceDialog({ kind, occurrence, today, busy, onSubmit, onClose }: OccurrenceDialogProps) {
    const setup = SETUP[kind];
    const formId = useId();
    const [date, setDate] = useState(() => (kind === 'postpone' ? addDays(occurrence.dueDate && occurrence.dueDate > today ? occurrence.dueDate : today, 7) : today));
    const [text, setText] = useState(kind === 'done' ? occurrence.outcome ?? '' : kind === 'waiting' ? occurrence.statusNote ?? '' : '');
    const ready = (!setup.date || date.length === 10) && (!setup.text.required || text.trim().length > 0);

    return (
        <Modal
            title={setup.title}
            subtitle={occurrence.title}
            icon={setup.icon}
            iconTone={setup.tone}
            onClose={onClose}
            busy={busy}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={busy}>
                        {APP_COPY.common.cancel}
                    </Button>
                    <Button type="submit" form={formId} disabled={busy || !ready}>
                        {setup.confirm}
                    </Button>
                </>
            }
        >
            <form
                id={formId}
                className="space-y-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (ready) onSubmit({ date, text });
                }}
            >
                {setup.date && (
                    <Field label={setup.date.label} htmlFor={`${formId}-date`}>
                        <DatePicker id={`${formId}-date`} value={date} max={setup.date.max === 'today' ? today : undefined} min={kind === 'postpone' ? today : undefined} onChange={setDate} />
                    </Field>
                )}
                <Field label={setup.text.label} htmlFor={`${formId}-text`}>
                    {setup.text.long ? (
                        <Textarea id={`${formId}-text`} value={text} onChange={(e) => setText(e.target.value)} placeholder={setup.text.placeholder} rows={4} autoFocus={!setup.date} />
                    ) : (
                        <Input id={`${formId}-text`} value={text} onChange={(e) => setText(e.target.value)} placeholder={setup.text.placeholder} autoFocus />
                    )}
                </Field>
            </form>
        </Modal>
    );
}
