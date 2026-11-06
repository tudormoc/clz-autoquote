'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { saveEntryAction, type CausalePresets } from '@/app/presence/timesheet-actions';
import { Button } from '@/components/ui/Button';
import { ChoiceButton } from '@/components/ui/ChoiceButton';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { APP_CONFIG } from '@/config/constants';
import { notify } from '@/lib/notify';
import { cleanEntryInput, inputProblem } from '@/lib/timesheet/input';
import { KIND_SPECS, causaleDefault, causaleOptions } from '@/lib/timesheet/kinds';
import type { SpanSuggestion } from '@/lib/timesheet/normalDay';
import { hoursOptions, shiftedEnd, timeOptions } from '@/lib/timesheet/time';
import type { Entry, EntryInput, EntryKind, TimesheetBounds, TimesheetPerson } from '@/lib/timesheet/types';
import { APP_COPY, fmt } from '@/locales';
import { formatStepHours, kindLabel } from './labels';

const copy = APP_COPY.timesheet.editor;
const { DEFAULT_TIME_FROM, MAX_NOTE_LENGTH } = APP_CONFIG.TIMESHEET;

interface EntryFormProps {
    person: TimesheetPerson;
    /** YYYY-MM-DD */
    day: string;
    /** The line being changed, null for a new one */
    entry: Entry | null;
    presets: CausalePresets;
    /** What a new work line starts as: the next span of the day, or the first of the giornata normale */
    prefill: SpanSuggestion | null;
    /** The picks of Dalle / Alle (Regole Presenze) */
    bounds: TimesheetBounds;
    /** The kinds this page offers (SELF_KINDS on Le mie ore, every kind on Ore Ufficio) */
    kinds: readonly EntryKind[];
    /** What the day still misses: a new permesso proposes it (owner, 2026-11-05) */
    missingHours: number;
    onSaved: () => Promise<void>;
    /** Shown as Annulla when given; an empty day's form has nothing to go back to */
    onCancel?: () => void;
    /** Set to "save any change and close": the pencil of the line being changed closes through it */
    closeRef?: React.MutableRefObject<(() => void) | null>;
}

/** A new work line starts as the day suggests; a line being changed starts as it is */
function draftOf(entry: Entry | null, prefill: SpanSuggestion | null): EntryInput {
    if (entry) return { kind: entry.kind, timeFrom: entry.timeFrom, timeTo: entry.timeTo, hours: entry.hours, causale: entry.causale, note: entry.note };
    return { kind: 'work', timeFrom: prefill?.from ?? DEFAULT_TIME_FROM, timeTo: prefill?.to ?? null, hours: null, causale: '', note: '' };
}

/** One line of a day: its kind picked with one click, then its times or its hours, its causale when it has one, a note */
export function EntryForm({ person, day, entry, presets, prefill, bounds, kinds, missingHours, onSaved, onCancel, closeRef }: EntryFormProps) {
    const formId = useId();
    const initial = useRef('');
    const [draft, setDraft] = useState<EntryInput>(() => {
        const fresh = draftOf(entry, prefill);
        initial.current = JSON.stringify(cleanEntryInput(fresh));
        return fresh;
    });
    const [saving, setSaving] = useState(false);
    const spec = KIND_SPECS[draft.kind];
    const set = (change: Partial<EntryInput>) => setDraft((prev) => ({ ...prev, ...change }));

    /** Another kind starts its own fields afresh: a whole day brings its hours and its named quick text, a permesso the hours still missing */
    const changeKind = (kind: EntryKind) => {
        const fresh = draftOf(null, prefill);
        const next = KIND_SPECS[kind];
        setDraft({
            kind,
            timeFrom: next.input === 'times' ? fresh.timeFrom : null,
            timeTo: next.input === 'times' ? fresh.timeTo : null,
            hours: next.wholeDay ? person.workdayHours : next.input === 'hours' && next.covers && missingHours > 0 ? missingHours : null,
            causale: next.wholeDay ? causaleDefault(kind, presets) : '',
            note: draft.note,
        });
    };

    /** A new work line proposes Alle along with Dalle: the span kept, half the workday on the first line */
    const setFrom = (from: string) => {
        if (entry) return set({ timeFrom: from });
        set({ timeFrom: from, timeTo: shiftedEnd(from, draft.timeFrom, draft.timeTo, person.workdayHours, bounds.lastTime) });
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

    // Closing from outside (the pencil clicked again) saves what changed, or just closes when nothing did
    const dirty = JSON.stringify(cleanEntryInput(draft)) !== initial.current;
    useEffect(() => {
        if (closeRef) closeRef.current = () => (dirty ? save() : onCancel?.());
    });

    // A line of a kind this page no longer offers keeps its kind choosable, like a causale that changed since
    const kindChoices = entry && !kinds.includes(entry.kind) ? [...kinds, entry.kind] : kinds;
    const causali = [...new Set([...causaleOptions(draft.kind, presets), ...(draft.causale ? [draft.causale] : [])])];
    const timeChoices = timeOptions(bounds.firstTime, bounds.lastTime).map((time) => ({ value: time, label: time }));
    const hoursChoices = hoursOptions(person.workdayHours).map((hours) => ({ value: String(hours), label: formatStepHours(hours) }));
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
            <div className="flex flex-wrap gap-1.5">
                {kindChoices.map((kind) => (
                    <ChoiceButton key={kind} size="sm" className="px-3" selected={draft.kind === kind} onClick={() => changeKind(kind)} disabled={saving}>
                        {kindLabel(kind)}
                    </ChoiceButton>
                ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {spec.input === 'times' ? (
                    <>
                        <Field label={copy.from} htmlFor={id('from')}>
                            <Select id={id('from')} value={draft.timeFrom ?? ''} options={timeChoices} onChange={(e) => setFrom(e.target.value)} />
                        </Field>
                        <Field label={copy.to} htmlFor={id('to')}>
                            <Select
                                id={id('to')}
                                value={draft.timeTo ?? ''}
                                options={[{ value: '', label: '—' }, ...timeChoices]}
                                onChange={(e) => set({ timeTo: e.target.value || null })}
                            />
                        </Field>
                    </>
                ) : spec.wholeDay ? (
                    <Field label={copy.hours}>
                        <p className="flex h-9 items-center text-sm font-medium text-fg-strong">{fmt(copy.wholeDay, { hours: formatStepHours(person.workdayHours) })}</p>
                    </Field>
                ) : (
                    <Field label={copy.hours} htmlFor={id('hours')}>
                        <Select
                            id={id('hours')}
                            value={draft.hours === null ? '' : String(draft.hours)}
                            options={[{ value: '', label: '—' }, ...hoursChoices]}
                            onChange={(e) => set({ hours: e.target.value ? Number(e.target.value) : null })}
                        />
                    </Field>
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
                {onCancel && (
                    <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
                        {entry ? copy.cancelEdit : APP_COPY.common.cancel}
                    </Button>
                )}
            </div>
        </form>
    );
}
