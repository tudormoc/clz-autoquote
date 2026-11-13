'use client';

import { useMemo } from 'react';
import { CalendarDays } from '@/components/ui/icons';
import { APP_CONFIG } from '@/config/constants';
import { closedDayChecker, type ClosedDay } from '@/lib/tasks/closedDays';
import { formatShortDay } from '@/lib/tasks/describe';
import { isIsoDate } from '@/lib/dateUtils';
import { upcomingDates } from '@/lib/tasks/projection';
import { RepeatRuleSchema } from '@/lib/tasks/repeat';
import { toRepeatRule, type RepeatDraft } from '@/lib/tasks/taskDraft';
import { APP_COPY, fmt } from '@/locales';
import { surfaceClasses } from '@/components/ui/Surface';
import { titleClasses } from '@/components/ui/titleLook';

const copy = APP_COPY.tasks;

interface NextDatesPreviewProps {
    repeat: RepeatDraft;
    firstDate: string;
    today: string;
    closedDays: ClosedDay[];
}

/** The next dates the rule gives, as it is typed, with the "meglio entro" hint on closed days */
export function NextDatesPreview({ repeat, firstDate, today, closedDays }: NextDatesPreviewProps) {
    const checker = useMemo(() => closedDayChecker(closedDays), [closedDays]);
    const dates = useMemo(() => {
        if (!isIsoDate(firstDate)) return [];
        const rule = RepeatRuleSchema.safeParse(toRepeatRule(repeat));
        return rule.success ? upcomingDates(rule.data, firstDate, today, APP_CONFIG.TASKS.NEXT_DATES_PREVIEW) : [];
    }, [repeat, firstDate, today]);

    return (
        <div className={surfaceClasses('inset', 'px-3 py-2')}>
            <p className={titleClasses('label', 'flex items-center gap-1.5')}>
                <CalendarDays size={13} />
                {copy.form.nextDates}
            </p>
            {dates.length === 0 ? (
                <p className="mt-1 text-xs text-fg-subtle">{copy.form.noNextDates}</p>
            ) : (
                <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {dates.map((date) => {
                        const reason = checker.reason(date);
                        return (
                            <li key={date} className="text-sm font-mono text-fg-secondary">
                                {formatShortDay(date)}
                                {reason && (
                                    <span className="ml-1 font-sans text-2xs text-warning-300">
                                        ({fmt(copy.when.closedDay, { reason, suggested: formatShortDay(checker.workingDayOnOrBefore(date)) })})
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
