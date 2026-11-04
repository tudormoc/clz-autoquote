'use client';

import { useCallback, useState } from 'react';
import { getMyMonthAction } from '@/app/presence/timesheet-actions';
import { useCanEdit } from '@/components/auth/AccessProvider';
import { LoadState } from '@/components/ui/LoadState';
import { useActionData } from '@/hooks/useActionData';
import { thisMonthPeriod, type MonthPeriod } from '@/lib/dateUtils';
import { DayEditor } from './DayEditor';
import { DayList } from './DayList';
import { MonthBar } from './MonthBar';
import { MonthTotals } from './MonthTotals';
import { TodayCard } from './TodayCard';

/** Le mie ore: the logged-in person's month, today on top with Entra / Esci, every day below, a window per day */
export function MyHoursView() {
    const [period, setPeriod] = useState<MonthPeriod>(thisMonthPeriod);
    const load = useCallback(() => getMyMonthAction(period.year, period.month), [period]);
    const { data, loading, error, reload } = useActionData(load);
    const canEdit = useCanEdit();
    const [openDay, setOpenDay] = useState<string | null>(null);

    const todaySummary = data?.days.find((summary) => summary.day === data.today);
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
                    {todaySummary && <TodayCard person={data.person} summary={todaySummary} canEdit={canEdit} onChanged={reload} onOpen={() => setOpenDay(todaySummary.day)} />}
                    <DayList days={data.days} today={data.today} onOpen={setOpenDay} />
                    <MonthTotals days={data.days} />
                    {editing && (
                        <DayEditor
                            person={data.person}
                            summary={editing}
                            today={data.today}
                            presets={data.presets}
                            canEdit={canEdit}
                            onChanged={reload}
                            onClose={() => setOpenDay(null)}
                        />
                    )}
                </>
            )}
        </div>
    );
}
