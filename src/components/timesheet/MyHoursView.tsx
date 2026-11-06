'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getMyMonthAction } from '@/app/presence/timesheet-actions';
import { useCanEdit } from '@/components/auth/AccessProvider';
import { LoadState } from '@/components/ui/LoadState';
import { useActionData } from '@/hooks/useActionData';
import { thisMonthPeriod, type MonthPeriod } from '@/lib/dateUtils';
import { remainingToWorkday } from '@/lib/timesheet/day';
import { DayList } from './DayList';
import { DayPanel } from './DayPanel';
import { MonthBar } from './MonthBar';
import { MonthTotals } from './MonthTotals';

/** Le mie ore: the logged-in person's month, every day a row, a click opens the day in place (today like any other) */
export function MyHoursView() {
    const [period, setPeriod] = useState<MonthPeriod>(thisMonthPeriod);
    const load = useCallback(() => getMyMonthAction(period.year, period.month), [period]);
    const { data, loading, error, reload } = useActionData(load);
    const canEdit = useCanEdit();
    const [openDay, setOpenDay] = useState<string | null>(null);
    const toggle = (day: string) => setOpenDay((current) => (current === day ? null : day));

    // After a write the open day closes by itself once it reaches the workday (a Saturday too), or was emptied (Svuota giorno)
    const closeWhenCovered = useRef(false);
    const changed = useCallback(async () => {
        closeWhenCovered.current = true;
        await reload();
    }, [reload]);
    useEffect(() => {
        if (!closeWhenCovered.current || !data || !openDay) return;
        closeWhenCovered.current = false;
        const summary = data.days.find((day) => day.day === openDay);
        if (summary && (summary.entries.length === 0 || remainingToWorkday(summary.entries, data.person.workdayHours) === 0)) setOpenDay(null);
    }, [data, openDay]);

    const editing = openDay ? data?.days.find((summary) => summary.day === openDay) : undefined;

    return (
        <div className="flex flex-col gap-4 lg:h-full">
            <MonthBar period={period} onChange={setPeriod}>
                {data && <span className="font-medium text-fg-strong">{data.person.name}</span>}
            </MonthBar>
            {!data ? (
                <LoadState loading={loading} error={error} />
            ) : (
                <>
                    <DayList
                        days={data.days}
                        today={data.today}
                        startDay={data.bounds.startDay}
                        expanded={openDay}
                        onToggle={toggle}
                        panel={
                            editing && (
                                <DayPanel
                                    person={data.person}
                                    summary={editing}
                                    presets={data.presets}
                                    normal={data.normal}
                                    bounds={data.bounds}
                                    allKinds={false}
                                    canEdit={canEdit}
                                    onChanged={changed}
                                />
                            )
                        }
                    />
                    <MonthTotals days={data.days} />
                </>
            )}
        </div>
    );
}
