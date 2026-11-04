'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, LogIn, LogOut } from 'lucide-react';
import { saveEntryAction } from '@/app/presence/timesheet-actions';
import { Button } from '@/components/ui/Button';
import { APP_CONFIG } from '@/config/constants';
import { formatWeekdayDate } from '@/lib/format';
import { notify } from '@/lib/notify';
import { openEntry } from '@/lib/timesheet/day';
import { nearestStepTime } from '@/lib/timesheet/time';
import type { DaySummary, TimesheetPerson } from '@/lib/timesheet/types';
import { APP_COPY, fmt } from '@/locales';
import { DayStatusBadge } from './DayStatusBadge';
import { formatStepHours } from './labels';

const copy = APP_COPY.timesheet.today;

interface TodayCardProps {
    person: TimesheetPerson;
    /** Today's summary */
    summary: DaySummary;
    canEdit: boolean;
    onChanged: () => Promise<void>;
    /** Opens today's editor */
    onOpen: () => void;
}

/** Today on top of Le mie ore: one big button that stamps now, Entra or Esci, and what the day holds so far */
export function TodayCard({ person, summary, canEdit, onChanged, onOpen }: TodayCardProps) {
    // The button says the time it will stamp, read again now and then
    const [now, setNow] = useState(() => nearestStepTime(new Date()));
    useEffect(() => {
        const timer = setInterval(() => setNow(nearestStepTime(new Date())), APP_CONFIG.TIMESHEET.CLOCK_REFRESH_MS);
        return () => clearInterval(timer);
    }, []);
    const [busy, setBusy] = useState(false);
    const open = openEntry(summary);

    const stamp = async () => {
        const time = nearestStepTime(new Date());
        setBusy(true);
        try {
            const result = open
                ? await saveEntryAction({
                      operatorCode: person.operatorCode,
                      day: summary.day,
                      id: open.id,
                      version: open.version,
                      input: { kind: 'work', timeFrom: open.timeFrom, timeTo: time, hours: null, causale: '', note: open.note },
                  })
                : await saveEntryAction({
                      operatorCode: person.operatorCode,
                      day: summary.day,
                      id: null,
                      version: null,
                      input: { kind: 'work', timeFrom: time, timeTo: null, hours: null, causale: '', note: '' },
                  });
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

    const worked = summary.hours.ordinarie > 0 ? ` · ${fmt(copy.worked, { hours: formatStepHours(summary.hours.ordinarie) })}` : '';

    return (
        <div className="bg-card border border-primary/40 rounded-lg p-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="min-w-0">
                <p className="text-xs font-medium text-fg-muted">{copy.title}</p>
                <p className="text-base font-semibold text-fg-strong">{formatWeekdayDate(summary.day)}</p>
                <p className="mt-0.5 text-sm text-fg-secondary">
                    {open ? fmt(copy.inSince, { time: open.timeFrom ?? '' }) : copy.notIn}
                    {worked}
                </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                <DayStatusBadge summary={summary} today={summary.day} />
                {canEdit && (
                    <Button size="lg" variant={open ? 'secondary' : 'primary'} onClick={stamp} disabled={busy}>
                        {open ? <LogOut size={18} /> : <LogIn size={18} />}
                        {fmt(open ? copy.exit : copy.enter, { time: now })}
                    </Button>
                )}
                <Button variant="outline" onClick={onOpen}>
                    <CalendarDays size={16} />
                    {copy.details}
                </Button>
            </div>
        </div>
    );
}
