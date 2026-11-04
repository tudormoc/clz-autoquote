'use client';

import { useState } from 'react';
import { CalendarDays, Pencil, Trash2 } from 'lucide-react';
import { deleteEntryAction, type CausalePresets } from '@/app/presence/timesheet-actions';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Row, RowList } from '@/components/ui/RowList';
import { confirmDelete } from '@/lib/confirm';
import { formatWeekdayDate } from '@/lib/format';
import { notify } from '@/lib/notify';
import { KIND_SPECS } from '@/lib/timesheet/kinds';
import { HOUR_FIELDS, type DaySummary, type Entry, type TimesheetPerson } from '@/lib/timesheet/types';
import { APP_COPY, fmt } from '@/locales';
import { DayStatusBadge } from './DayStatusBadge';
import { EntryForm } from './EntryForm';
import { entryText, fieldLabel, formatStepHours, hoursText } from './labels';

const copy = APP_COPY.timesheet.editor;

interface DayEditorProps {
    person: TimesheetPerson;
    summary: DaySummary;
    today: string;
    presets: CausalePresets;
    canEdit: boolean;
    /** Reloads the month, so `summary` comes back fresh */
    onChanged: () => Promise<void>;
    onClose: () => void;
}

/** One day in a window: its lines (change, delete), its total and state, a form for a new line */
export function DayEditor({ person, summary, today, presets, canEdit, onChanged, onClose }: DayEditorProps) {
    const [editing, setEditing] = useState<Entry | null>(null);
    /** A saved line starts the form afresh */
    const [formKey, setFormKey] = useState(0);

    const remove = async (entry: Entry) => {
        if (!(await confirmDelete(fmt(copy.deleteConfirm, { text: entryText(entry) })))) return;
        try {
            const result = await deleteEntryAction(entry.id, entry.version);
            if (result.success) notify.success(APP_COPY.timesheet.messages.deleted);
            else notify.error(result.error);
        } catch (err) {
            notify.failure(err);
        }
        if (editing?.id === entry.id) setEditing(null);
        await onChanged();
    };

    const saved = async () => {
        setEditing(null);
        setFormKey((key) => key + 1);
        await onChanged();
    };

    const totals = HOUR_FIELDS.filter((field) => summary.hours[field] > 0).map((field) => `${fieldLabel(field)} ${hoursText(summary.hours[field])}`);

    return (
        <Modal
            title={formatWeekdayDate(summary.day)}
            subtitle={person.name}
            icon={CalendarDays}
            size="lg"
            onClose={onClose}
            footer={
                <Button variant="secondary" onClick={onClose}>
                    {APP_COPY.common.close}
                </Button>
            }
        >
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-fg-secondary">
                        {copy.total}: <span className="font-mono text-fg-strong">{totals.length > 0 ? totals.join(' · ') : '—'}</span>
                    </span>
                    <span className="flex items-center gap-2">
                        {summary.expected > 0 && <span className="text-xs text-fg-muted">{fmt(APP_COPY.timesheet.day.expected, { hours: formatStepHours(summary.expected) })}</span>}
                        <DayStatusBadge summary={summary} today={today} />
                    </span>
                </div>

                <div>
                    <p className="mb-2 text-xs font-semibold text-fg-soft">{copy.lines}</p>
                    {summary.entries.length === 0 ? (
                        <p className="text-fg-subtle">{summary.status === 'closed' ? summary.closedReason : APP_COPY.timesheet.day.noEntries}</p>
                    ) : (
                        <RowList>
                            {summary.entries.map((entry) => (
                                <Row
                                    key={entry.id}
                                    label={
                                        <>
                                            <span className={KIND_SPECS[entry.kind].input === 'times' ? 'font-mono' : undefined}>{entryText(entry)}</span>
                                            {entry.note && <span className="font-normal text-fg-subtle"> · {entry.note}</span>}
                                        </>
                                    }
                                >
                                    {canEdit && (
                                        <>
                                            <Button variant="ghost" size="sm" onClick={() => setEditing(entry)} title={copy.edit} aria-label={copy.edit}>
                                                <Pencil size={14} />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => remove(entry)} title={copy.delete} aria-label={copy.delete}>
                                                <Trash2 size={14} />
                                            </Button>
                                        </>
                                    )}
                                </Row>
                            ))}
                        </RowList>
                    )}
                </div>

                {canEdit && (
                    <EntryForm
                        key={editing ? `edit-${editing.id}` : `new-${formKey}`}
                        person={person}
                        day={summary.day}
                        today={today}
                        entry={editing}
                        presets={presets}
                        onSaved={saved}
                        onCancel={() => setEditing(null)}
                    />
                )}
            </div>
        </Modal>
    );
}
