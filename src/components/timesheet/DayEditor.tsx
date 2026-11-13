'use client';

import { CalendarDays } from '@/components/ui/icons';
import type { CausalePresets } from '@/app/presence/timesheet-actions';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatWeekdayDate } from '@/lib/format';
import type { DaySummary, NormalDay, TimesheetBounds, TimesheetPerson } from '@/lib/timesheet/types';
import { APP_COPY } from '@/locales';
import { DayPanel } from './DayPanel';

interface DayEditorProps {
    person: TimesheetPerson;
    summary: DaySummary;
    presets: CausalePresets;
    /** The person's giornata normale (src/lib/timesheet/normalDay.ts) */
    normal: NormalDay;
    /** The timesheet settings of Regole Presenze */
    bounds: TimesheetBounds;
    canEdit: boolean;
    /** Reloads the month, so `summary` comes back fresh */
    onChanged: () => Promise<void>;
    onClose: () => void;
}

/** One person's day in a window (Ore Ufficio): the same panel Le mie ore opens in place */
export function DayEditor({ person, summary, presets, normal, bounds, canEdit, onChanged, onClose }: DayEditorProps) {
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
            <DayPanel person={person} summary={summary} presets={presets} normal={normal} bounds={bounds} allKinds canEdit={canEdit} onChanged={onChanged} />
        </Modal>
    );
}
