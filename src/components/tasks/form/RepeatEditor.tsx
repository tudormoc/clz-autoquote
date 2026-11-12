'use client';

import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ChoiceButton } from '@/components/ui/ChoiceButton';
import { DatePicker } from '@/components/ui/DatePicker';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { INTERVAL_UNITS, type IntervalUnit } from '@/lib/tasks/repeat';
import type { Nth, RepeatDraft } from '@/lib/tasks/taskDraft';
import { APP_COPY } from '@/locales';

const form = APP_COPY.tasks.form;
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const NTHS: Nth[] = [1, 2, 3, 4, -1];

interface RepeatEditorProps {
    draft: RepeatDraft;
    onChange: (change: Partial<RepeatDraft>) => void;
}

/** Row of pick-one buttons */
function Choices<K extends string>({ options, value, onChange }: { options: [K, string][]; value: K; onChange: (value: K) => void }) {
    return (
        <div className="flex flex-wrap gap-2">
            {options.map(([key, label]) => (
                <ChoiceButton key={key} size="sm" className="px-3" selected={value === key} onClick={() => onChange(key)}>
                    {label}
                </ChoiceButton>
            ))}
        </div>
    );
}

/** How a task repeats: calendar or after the last time, every N units, which days, what if one is missed, until when */
export function RepeatEditor({ draft, onChange }: RepeatEditorProps) {
    const calendar = draft.mode === 'calendar';
    const unitOptions = INTERVAL_UNITS.map((unit) => ({ value: unit, label: form.units[unit] }));

    return (
        <div className="space-y-4">
            <Field label={form.mode}>
                <Choices options={[['calendar', form.modes.calendar], ['after', form.modes.after]]} value={draft.mode} onChange={(mode) => onChange({ mode })} />
            </Field>

            <Field label={form.every}>
                <div className="flex gap-2 max-w-xs">
                    <div className="w-20 shrink-0">
                        <Input type="number" min={1} value={draft.every} onChange={(e) => onChange({ every: e.target.value })} aria-label={form.every} />
                    </div>
                    <Select options={unitOptions} value={draft.unit} onChange={(e) => onChange({ unit: e.target.value as IntervalUnit })} aria-label={form.every} />
                </div>
            </Field>

            {calendar && draft.unit === 'weeks' && (
                <Field label={form.weekdays}>
                    <div className="flex flex-wrap gap-1.5">
                        {WEEKDAYS.map((day) => (
                            <ChoiceButton
                                key={day}
                                size="sm"
                                className="w-12"
                                selected={draft.weekdays.includes(day)}
                                onClick={() => onChange({ weekdays: draft.weekdays.includes(day) ? draft.weekdays.filter((d) => d !== day) : [...draft.weekdays, day].sort((a, b) => a - b) })}
                            >
                                {APP_COPY.weekdays.short[day - 1]}
                            </ChoiceButton>
                        ))}
                    </div>
                </Field>
            )}

            {calendar && draft.unit === 'months' && (
                <Field label={form.monthOn}>
                    <Choices
                        options={[['days', form.monthOnOptions.days], ['last', form.monthOnOptions.last], ['weekday', form.monthOnOptions.weekday]]}
                        value={draft.monthOn}
                        onChange={(monthOn) => onChange({ monthOn })}
                    />
                    {draft.monthOn === 'days' && (
                        <div className="mt-2 max-w-xs">
                            <Input value={draft.monthDays} onChange={(e) => onChange({ monthDays: e.target.value })} placeholder={form.monthDaysPlaceholder} aria-label={form.monthDays} />
                        </div>
                    )}
                    {draft.monthOn === 'weekday' && (
                        <div className="mt-2 flex gap-2 max-w-sm">
                            <Select
                                aria-label={form.nth}
                                options={NTHS.map((nth) => ({ value: String(nth), label: form.nthOptions[String(nth) as keyof typeof form.nthOptions] }))}
                                value={String(draft.nth)}
                                onChange={(e) => onChange({ nth: Number(e.target.value) as Nth })}
                            />
                            <Select
                                aria-label={form.weekday}
                                options={WEEKDAYS.map((day) => ({ value: String(day), label: APP_COPY.weekdays.long[day - 1] }))}
                                value={String(draft.weekday)}
                                onChange={(e) => onChange({ weekday: Number(e.target.value) })}
                            />
                        </div>
                    )}
                </Field>
            )}

            {calendar && draft.unit === 'years' && (
                <Field label={form.yearDates}>
                    <div className="space-y-2">
                        {draft.yearDates.map((date, index) => (
                            <div key={index} className="flex gap-2 max-w-sm">
                                <div className="w-20 shrink-0">
                                    <Input
                                        type="number"
                                        min={1}
                                        max={31}
                                        aria-label={form.day}
                                        value={String(date.day)}
                                        onChange={(e) => onChange({ yearDates: draft.yearDates.map((d, i) => (i === index ? { ...d, day: Number(e.target.value) } : d)) })}
                                    />
                                </div>
                                <Select
                                    aria-label={form.month}
                                    options={APP_COPY.months.long.map((name, i) => ({ value: String(i + 1), label: name }))}
                                    value={String(date.month)}
                                    onChange={(e) => onChange({ yearDates: draft.yearDates.map((d, i) => (i === index ? { ...d, month: Number(e.target.value) } : d)) })}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    title={form.remove}
                                    aria-label={form.remove}
                                    onClick={() => onChange({ yearDates: draft.yearDates.filter((_, i) => i !== index) })}
                                >
                                    <X size={16} />
                                </Button>
                            </div>
                        ))}
                        <Button type="button" variant="secondary" size="sm" onClick={() => onChange({ yearDates: [...draft.yearDates, { month: 1, day: 1 }] })}>
                            <Plus size={14} />
                            {form.addYearDate}
                        </Button>
                    </div>
                </Field>
            )}

            {calendar && (
                <Field label={form.missed}>
                    <Choices options={[['keep', form.missedOptions.keep], ['latest', form.missedOptions.latest]]} value={draft.missed} onChange={(missed) => onChange({ missed })} />
                </Field>
            )}

            <Field label={form.end}>
                <Choices
                    options={[['never', form.endOptions.never], ['until', form.endOptions.until], ['count', form.endOptions.count]]}
                    value={draft.end}
                    onChange={(end) => onChange({ end })}
                />
                {draft.end === 'until' && (
                    <div className="mt-2 max-w-xs">
                        <DatePicker value={draft.until} onChange={(until) => onChange({ until })} ariaLabel={form.endOptions.until} />
                    </div>
                )}
                {draft.end === 'count' && (
                    <div className="mt-2 max-w-32">
                        <Input type="number" min={1} value={draft.count} onChange={(e) => onChange({ count: e.target.value })} aria-label={form.endCount} />
                    </div>
                )}
            </Field>
        </div>
    );
}
