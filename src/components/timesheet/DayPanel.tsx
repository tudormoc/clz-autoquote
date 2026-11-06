'use client';

import { useRef, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { clearDayAction, deleteEntryAction, fillNormalDayAction, type CausalePresets } from '@/app/presence/timesheet-actions';
import { Button } from '@/components/ui/Button';
import { Row, RowList } from '@/components/ui/RowList';
import { confirmDelete } from '@/lib/confirm';
import { notify } from '@/lib/notify';
import { remainingToWorkday } from '@/lib/timesheet/day';
import { KIND_SPECS, SELF_KINDS } from '@/lib/timesheet/kinds';
import { nextWorkSpan, spansText } from '@/lib/timesheet/normalDay';
import { ENTRY_KINDS, HOUR_FIELDS, type DaySummary, type Entry, type NormalDay, type TimesheetBounds, type TimesheetPerson } from '@/lib/timesheet/types';
import { APP_COPY, fmt } from '@/locales';
import { EntryForm } from './EntryForm';
import { entryText, fieldLabel, formatStepHours, hoursText } from './labels';

const copy = APP_COPY.timesheet.editor;
const quick = APP_COPY.timesheet.quick;

interface DayPanelProps {
    person: TimesheetPerson;
    summary: DaySummary;
    presets: CausalePresets;
    /** The person's giornata normale: what the one-click chip writes (src/lib/timesheet/normalDay.ts) */
    normal: NormalDay;
    /** The timesheet's first day and the picks of Dalle / Alle (Regole Presenze) */
    bounds: TimesheetBounds;
    /** Ore Ufficio (the owner) offers every kind; a person on Le mie ore only SELF_KINDS */
    allKinds: boolean;
    canEdit: boolean;
    /** Reloads the month, so `summary` comes back fresh */
    onChanged: () => Promise<void>;
}

/**
 * One day, opened in place (Le mie ore) or in a window (Ore Ufficio): an empty day shows the Giornata normale chip
 * and the form already open, a filled one its lines (change, delete) and "Aggiungi riga".
 */
export function DayPanel({ person, summary, presets, normal, bounds, allKinds, canEdit, onChanged }: DayPanelProps) {
    const [editing, setEditing] = useState<Entry | null>(null);
    const [adding, setAdding] = useState(false);
    const [busy, setBusy] = useState(false);
    /** "Save any change and close", set by the open form: the pencil clicked again goes through it */
    const closeEdit = useRef<(() => void) | null>(null);

    /** Runs a one-click write and reloads */
    const write = async (work: () => Promise<{ success: true } | { success: false; error: string }>) => {
        setBusy(true);
        try {
            const result = await work();
            if (!result.success) {
                notify.error(result.error);
                return;
            }
            notify.success(APP_COPY.timesheet.messages.saved);
            await onChanged();
        } catch (err) {
            notify.failure(err);
        } finally {
            setBusy(false);
        }
    };

    const fillNormal = () => write(() => fillNormalDayAction(person.operatorCode, summary.day));

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

    const closeForm = () => {
        setEditing(null);
        setAdding(false);
    };

    /** "Svuota giorno": one confirm, every line of the day deleted together (each kept in the log) */
    const clearDay = async () => {
        if (!(await confirmDelete(fmt(copy.clearConfirm, { count: summary.entries.length })))) return;
        setBusy(true);
        try {
            const result = await clearDayAction(person.operatorCode, summary.day);
            if (result.success) notify.success(APP_COPY.timesheet.messages.dayCleared);
            else notify.error(result.error);
            closeForm();
            await onChanged();
        } catch (err) {
            notify.failure(err);
        } finally {
            setBusy(false);
        }
    };
    const saved = async () => {
        closeForm();
        await onChanged();
    };

    const totals = HOUR_FIELDS.filter((field) => summary.hours[field] > 0).map((field) => `${fieldLabel(field)} ${hoursText(summary.hours[field])}`);
    const empty = summary.entries.length === 0;
    // Days before the start of the timesheet are shown but locked (owner, 2026-11-05)
    const editable = canEdit && summary.day >= bounds.startDay;
    // An empty day opens with the form already there (owner, 2026-11-05: no extra click)
    const formOpen = editable && (editing !== null || adding || empty);
    // A whole-day line (ferie, malattia) holds the day alone; writing one over other lines replaces them (owner, 2026-11-05)
    const full = summary.entries.some((entry) => KIND_SPECS[entry.kind].wholeDay);
    const kinds = allKinds ? ENTRY_KINDS : SELF_KINDS;
    // A new work line starts where the day left off, Alle completing the workday (a Saturday or a day ahead too)
    const prefill = nextWorkSpan(summary.entries, remainingToWorkday(summary.entries, person.workdayHours), bounds.lastTime) ?? normal.spans[0] ?? null;
    // The hours still needed to reach the workday, the line being changed counted out: a new permesso proposes it
    const missingHours = remainingToWorkday(summary.entries, person.workdayHours, editing);

    const clearable = editable && summary.entries.length > 1;

    return (
        <div className="space-y-3">
            {(totals.length > 0 || clearable) && (
                <div className="flex flex-wrap items-center gap-2">
                    {totals.length > 0 && (
                        <p className="text-sm text-fg-secondary">
                            {copy.total}: <span className="font-mono text-fg-strong">{totals.join(' · ')}</span>
                        </p>
                    )}
                    {clearable && (
                        <Button size="sm" variant="ghost" className="ml-auto" onClick={clearDay} disabled={busy}>
                            <Trash2 size={14} />
                            {copy.clearDay}
                        </Button>
                    )}
                </div>
            )}
            {empty && summary.status === 'closed' && <p className="text-sm text-fg-subtle">{summary.closedReason}</p>}

            {!empty && (
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
                            {editable && (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => (editing?.id === entry.id ? closeEdit.current?.() : setEditing(entry))}
                                        title={copy.edit}
                                        aria-label={copy.edit}
                                    >
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

            {editable && empty && summary.expected > 0 && normal.spans.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={fillNormal} disabled={busy} title={spansText(normal.spans)}>
                        {fmt(quick.normal, { hours: formatStepHours(normal.hours) })}
                    </Button>
                </div>
            )}

            {editable && !empty && !formOpen && !full && (
                <Button size="sm" variant="outline" onClick={() => setAdding(true)} disabled={busy}>
                    <Plus size={14} />
                    {copy.addLine}
                </Button>
            )}

            {formOpen && (
                <EntryForm
                    key={editing ? `edit-${editing.id}` : 'new'}
                    person={person}
                    day={summary.day}
                    entry={editing}
                    presets={presets}
                    prefill={prefill}
                    bounds={bounds}
                    kinds={kinds}
                    missingHours={missingHours}
                    onSaved={saved}
                    onCancel={editing !== null || !empty ? closeForm : undefined}
                    closeRef={closeEdit}
                />
            )}
        </div>
    );
}
