'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { sameMonthPeriod, shiftMonthPeriod, thisMonthPeriod, type MonthPeriod } from '@/lib/dateUtils';
import { monthName } from '@/lib/format';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.timesheet.month;

interface MonthBarProps {
    period: MonthPeriod;
    onChange: (period: MonthPeriod) => void;
    /** Shown on the right (the person's name) */
    children?: React.ReactNode;
}

/** The month shown, with a step back and forward and a way back to the current one */
export function MonthBar({ period, onChange, children }: MonthBarProps) {
    const current = sameMonthPeriod(period, thisMonthPeriod());
    return (
        <div className="bg-card border border-border rounded-lg px-3 py-2 flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onChange(shiftMonthPeriod(period, -1))} title={copy.previous} aria-label={copy.previous}>
                <ChevronLeft size={16} />
            </Button>
            <span className="min-w-36 text-center text-sm font-semibold text-fg-strong">
                {monthName(period.month)} {period.year}
            </span>
            <Button variant="ghost" size="sm" onClick={() => onChange(shiftMonthPeriod(period, 1))} title={copy.next} aria-label={copy.next}>
                <ChevronRight size={16} />
            </Button>
            {!current && (
                <Button variant="outline" size="sm" onClick={() => onChange(thisMonthPeriod())}>
                    {copy.thisMonth}
                </Button>
            )}
            {children && <div className="ml-auto flex flex-wrap items-center gap-3 text-sm text-fg-secondary">{children}</div>}
        </div>
    );
}
