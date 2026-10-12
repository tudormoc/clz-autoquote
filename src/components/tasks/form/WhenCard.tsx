'use client';

import { CalendarClock } from 'lucide-react';
import { NextDatesPreview } from '@/components/tasks/form/NextDatesPreview';
import { RepeatEditor } from '@/components/tasks/form/RepeatEditor';
import { FormCard } from '@/components/tasks/shared/FormCard';
import { ChoiceButton } from '@/components/ui/ChoiceButton';
import { Field } from '@/components/ui/Field';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import type { ClosedDay } from '@/lib/tasks/closedDays';
import { isIsoDate } from '@/lib/tasks/dates';
import { repeatDraftFor, type RepeatDraft, type TaskDraft } from '@/lib/tasks/taskDraft';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.tasks;
const form = copy.form;

interface WhenCardProps {
    draft: TaskDraft;
    today: string;
    closedDays: ClosedDay[];
    set: (change: Partial<TaskDraft>) => void;
    setRepeat: (change: Partial<RepeatDraft>) => void;
}

/** "Quando": once (a date, or none yet) or repeating (first date + rule), the time, how early it shows */
export function WhenCard({ draft, today, closedDays, set, setRepeat }: WhenCardProps) {
    const repeating = draft.kind === 'repeat';

    const setKind = (kind: TaskDraft['kind']) => {
        if (kind === draft.kind) return;
        // A repeating task needs a first date: today unless one is set; the rule fields follow it
        const first = draft.dueDate || today;
        set(kind === 'repeat' ? { kind, dueDate: first, repeat: repeatDraftFor(first) } : { kind });
    };
    const setFirstDate = (dueDate: string) =>
        repeating && isIsoDate(dueDate) && isIsoDate(draft.dueDate) ? set({ dueDate, repeat: followDate(draft.repeat, draft.dueDate, dueDate) }) : set({ dueDate });

    return (
        <FormCard title={form.sections.when} icon={CalendarClock}>
            <Field label={form.kind}>
                <div className="flex flex-wrap gap-2">
                    {(['once', 'repeat'] as const).map((kind) => (
                        <ChoiceButton key={kind} size="sm" className="px-3" selected={draft.kind === kind} onClick={() => setKind(kind)}>
                            {copy.kinds[kind]}
                        </ChoiceButton>
                    ))}
                </div>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-[14rem_10rem] gap-4">
                <Field label={repeating ? form.firstDate : form.dueDate} htmlFor="task-due">
                    <DatePicker id="task-due" value={draft.dueDate} onChange={setFirstDate} clearable={!repeating} />
                    {!repeating && <p className="mt-1 text-xs text-fg-subtle">{form.noDateHint}</p>}
                </Field>
                <Field label={form.dueTime} htmlFor="task-time">
                    <Input id="task-time" type="time" value={draft.dueTime} onChange={(e) => set({ dueTime: e.target.value })} />
                </Field>
            </div>

            {repeating && (
                <>
                    <RepeatEditor draft={draft.repeat} onChange={setRepeat} />
                    <NextDatesPreview repeat={draft.repeat} firstDate={draft.dueDate} today={today} closedDays={closedDays} />
                </>
            )}

            <Field label={form.showDays} htmlFor="task-show">
                <div className="flex items-center gap-2">
                    <div className="w-24 shrink-0">
                        <Input id="task-show" type="number" min={0} value={draft.showDays} onChange={(e) => set({ showDays: e.target.value })} />
                    </div>
                    <span className="text-sm text-fg-muted">{form.showDaysSuffix}</span>
                </div>
            </Field>
        </FormCard>
    );
}

/**
 * A new first date: the days that were still the ones taken from the old date (its weekday, its day of the month,
 * its day and month) follow the new date; days the person chose stay.
 */
function followDate(repeat: RepeatDraft, oldDate: string, newDate: string): RepeatDraft {
    const before = repeatDraftFor(oldDate);
    const after = repeatDraftFor(newDate);
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    return {
        ...repeat,
        weekdays: same(repeat.weekdays, before.weekdays) ? after.weekdays : repeat.weekdays,
        monthDays: repeat.monthDays === before.monthDays ? after.monthDays : repeat.monthDays,
        weekday: repeat.weekday === before.weekday ? after.weekday : repeat.weekday,
        yearDates: same(repeat.yearDates, before.yearDates) ? after.yearDates : repeat.yearDates,
    };
}
