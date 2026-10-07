'use client';

import { useState } from 'react';
import { createEventAction } from '@/app/presence/presence-actions';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { APP_CONFIG } from '@/config/constants';
import { getTodayDate } from '@/lib/dateUtils';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.analytics.dailyEvents.add;
const DEFAULTS = APP_CONFIG.PRESENCE.NEW_EVENT_DEFAULTS;
const EVENT_OPTIONS = APP_CONFIG.PRESENCE.NEW_EVENT_TYPES.map((type) => ({ label: type, value: type }));

interface AddEventFormProps {
    onCreated: () => void;
    onCancel: () => void;
}

/** Row of fields under the Daily Events filters that adds one presence event (ENT / EXT) by hand. */
export function AddEventForm({ onCreated, onCancel }: AddEventFormProps) {
    const [operator, setOperator] = useState<string>(DEFAULTS.operator);
    const [event, setEvent] = useState<string>(DEFAULTS.event);
    const [date, setDate] = useState(getTodayDate());
    const [time, setTime] = useState<string>(DEFAULTS.time);
    const [creating, setCreating] = useState(false);

    const create = async () => {
        if (!operator.trim() || !event.trim() || !date || !time) return;
        setCreating(true);
        try {
            const result = await createEventAction(operator.trim(), event.trim(), `${date} ${time}`);
            if (result.success) onCreated();
            else alert(fmt(APP_COPY.common.actionError, { error: result.error ?? '' }));
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="bg-card border border-border rounded-lg p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <Field label={copy.operator}>
                <Input type="text" value={operator} onChange={(e) => setOperator(e.target.value)} placeholder={DEFAULTS.operator} />
            </Field>
            <Field label={copy.event}>
                <Select value={event} onChange={(e) => setEvent(e.target.value)} options={EVENT_OPTIONS} />
            </Field>
            <Field label={copy.date}>
                <DatePicker value={date} onChange={setDate} />
            </Field>
            <Field label={copy.time}>
                <Input type="time" step="1" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
            <div className="flex gap-2">
                <Button onClick={create} disabled={creating} className="flex-1">
                    {APP_COPY.common.save}
                </Button>
                <Button onClick={onCancel} variant="secondary">
                    {APP_COPY.common.cancel}
                </Button>
            </div>
        </div>
    );
}
