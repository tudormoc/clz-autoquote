'use client';

import { useId, useState } from 'react';
import { saveEntryAction, type CausalePresets } from '@/app/presence/timesheet-actions';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { APP_CONFIG } from '@/config/constants';
import { notify } from '@/lib/notify';
import { cleanEntryInput, inputProblem } from '@/lib/timesheet/input';
import { KIND_SPECS, causaleOptions } from '@/lib/timesheet/kinds';
import { HOURS_OPTIONS, TIME_OPTIONS, nearestStepTime } from '@/lib/timesheet/time';
import { ENTRY_KINDS, type Entry, type EntryInput, type EntryKind, type TimesheetPerson } from '@/lib/timesheet/types';
import { APP_COPY, fmt } from '@/locales';
import { formatStepHours, kindLabel } from './labels';

const copy = APP_COPY.timesheet.editor;
const { DEFAULT_TIME_FROM, MAX_NOTE_LENGTH } = APP_CONFIG.TIMESHEET;

interface EntryFormProps {
    person: TimesheetPerson;
    /** YYYY-MM-DD */
    day: string;
    today: string;
    /** The line being changed, null for a new one */
    entry: Entry | null;
    presets: CausalePresets;
    onSaved: () => Promise<void>;
    onCancel: () => void;
}

/** A new work line starts now (today) or at the usual time; a line being changed starts as it is */
function draftOf(entry: Entry | null, day: string, today: string): EntryInput {
    if (entry) return { kind: entry.kind, timeFrom: entry.timeFrom, timeTo: entry.timeTo, hours: entry.hours, causale: entry.causale, note: entry.note };
    return { kind: 'work', timeFrom: day === today ? nearestStepTime(new Date()) : DEFAULT_TIME_FROM, timeTo: null, hours: null, causale: '', note: '' };
}

const TIME_CHOICES = TIME_OPTIONS.map((time) => ({ value: time, label: time }));
const HOURS_CHOICES = HOURS_OPTIONS.map((hours) => ({ value: String(hours), label: formatStepHours(hours) }));
const KIND_CHOICES = ENTRY_KINDS.map((kind) => ({ value: kind, label: kindLabel(kind) }));

/** One line of a day: its kind, then its times or its hours, its causale when it has one, a note */
export function EntryForm({ person, day, today, entry, presets, onSaved, onCancel }: EntryFormProps) {
    const formId = useId();
    const [draft, setDraft] = useState<EntryInput>(() => draftOf(entry, day, today));
    const [saving, setSaving] = useState(false);
    const spec = KIND_SPECS[draft.kind];
    const set = (change: Partial<EntryInput>) => setDraft((prev) => ({ ...prev, ...change }));

    /** Another kind starts its own fields afresh */
    const changeKind = (kind: EntryKind) => {
        const fresh = draftOf(null, day, today);
        const times = KIND_SPECS[kind].input === 'times';
        setDraft({ kind, timeFrom: times ? fresh.timeFrom : null, timeTo: null, hours: null, causale: '', note: draft.note });
    };

    const save = async () => {
        const input = cleanEntryInput(draft);
        const problem = inputProblem(input);
        if (problem) {
            notify.error(problem);
            return;
        }
        setSaving(true);
        try {
            const result = await saveEntryAction({ operatorCode: person.operatorCode, day, id: entry?.id ?? null, version: entry?.version ?? null, input });
            if (!result.success) {
                notify.error(result.error);
                return;
            }
            notify.success(APP_COPY.timesheet.messages.saved);
            await onSaved();
        } catch (err) {
            notify.failure(err);
        } finally {
            setSaving(false);
        }
    };

    // The line's own causale stays choosable even when the quick texts changed since
    const causali = [...new Set([...causaleOptions(draft.kind, presets), ...(draft.causale ? [draft.causale] : [])])];
    const id = (field: string) => `${formId}-${field}`;

    return (
        <form
            id={formId}
            className="rounded-lg border border-border bg-muted/20 p-3 space-y-3"
            onSubmit={(event) => {
                event.preventDefault();
                save();
            }}
        >
            <p className="text-xs font-semibold text-fg-soft">{entry ? copy.editLine : copy.newLine}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label={copy.kind} htmlFor={id('kind')} className="col-span-2 sm:col-span-1">
                    <Select id={id('kind')} value={draft.kind} options={KIND_CHOICES} onChange={(e) => changeKind(e.target.value as EntryKind)} />
                </Field>
                {spec.input === 'times' ? (
                    <>
                        <Field label={copy.from} htmlFor={id('from')}>
                            <Select id={id('from')} value={draft.timeFrom ?? ''} options={TIME_CHOICES} onChange={(e) => set({ timeFrom: e.target.value })} />
                        </Field>
                        <Field label={copy.to} htmlFor={id('to')}>
                            <Select
                                id={id('to')}
                                value={draft.timeTo ?? ''}
                                options={[{ value: '', label: copy.stillIn }, ...TIME_CHOICES]}
                                onChange={(e) => set({ timeTo: e.target.value || null })}
                            />
                        </Field>
                    </>
                ) : (
                    <>
                        <Field label={copy.hours} htmlFor={id('hours')}>
                            <Select
                                id={id('hours')}
                                value={draft.hours === null ? '' : String(draft.hours)}
                                options={[{ value: '', label: '—' }, ...HOURS_CHOICES]}
                                onChange={(e) => set({ hours: e.target.value ? Number(e.target.value) : null })}
                            />
                        </Field>
                        <div className="flex items-end">
                            <Button type="button" variant="outline" size="sm" onClick={() => set({ hours: person.workdayHours })}>
                                {fmt(copy.wholeDay, { hours: formatStepHours(person.workdayHours) })}
                            </Button>
                        </div>
                    </>
                )}
                {spec.presets && (
                    <Field label={copy.causale} htmlFor={id('causale')}>
                        <Select
                            id={id('causale')}
                            value={draft.causale}
                            options={[{ value: '', label: copy.noCausale }, ...causali.map((causale) => ({ value: causale, label: causale }))]}
                            onChange={(e) => set({ causale: e.target.value })}
                        />
                    </Field>
                )}
                <Field label={copy.note} htmlFor={id('note')} className="col-span-2">
                    <Input id={id('note')} value={draft.note} maxLength={MAX_NOTE_LENGTH} placeholder={copy.notePlaceholder} onChange={(e) => set({ note: e.target.value })} />
                </Field>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" disabled={saving}>
                    {copy.save}
                </Button>
                {entry && (
                    <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
                        {copy.cancelEdit}
                    </Button>
                )}
            </div>
        </form>
    );
}
