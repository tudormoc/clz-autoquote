'use client';

import { useState } from 'react';
import { FileText } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { ChoiceButton } from '@/components/ui/ChoiceButton';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { APP_CONFIG } from '@/config/constants';
import { monthName, monthShortName } from '@/lib/format';
import { APP_COPY, fmt } from '@/locales';
import { pressableSurfaceClasses } from '@/components/ui/SurfaceButton';
import { Checkbox } from '@/components/ui/Checkbox';

type PageFormat = 'A4' | 'A3';
type PeriodMode = 'months' | 'weeks';

interface MonthSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (year: number, months: number[], separateByArea: boolean, format: PageFormat, mode?: PeriodMode, weeks?: number[]) => void;
    loading?: boolean;
    /** The report's name as in the menu */
    title: string;
    hideSeparateToggle?: boolean;
    /** Opt-in: shows Mesi / Settimane toggle — only used by area-summary */
    showWeekMode?: boolean;
    /** When true, hides the A4/A3 page format selector (e.g. client summary always uses A4 portrait) */
    hideFormatSelector?: boolean;
}

const copy = APP_COPY.analytics.pdfPicker;
const MONTH_NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1);
const PAGE_FORMATS: PageFormat[] = ['A4', 'A3'];
const MODES: PeriodMode[] = ['months', 'weeks'];

/** Number of ISO weeks in a year: 53 when 1 January or 31 December is a Thursday, else 52 */
const isoWeeksInYear = (year: number): number => {
    const jan1Day = new Date(year, 0, 1).getDay();
    const dec31Day = new Date(year, 11, 31).getDay();
    return jan1Day === 4 || dec31Day === 4 ? 53 : 52;
};

const toggle = (list: number[], value: number) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value].sort((a, b) => a - b);

/** Period picker before a PDF report: year, months (or ISO weeks), page format, one file per area. */
export function MonthSelectorModal({ isOpen, onClose, onGenerate, loading, title, hideSeparateToggle, showWeekMode, hideFormatSelector }: MonthSelectorModalProps) {
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState<number>(currentYear);
    const [months, setMonths] = useState<number[]>([]);
    const [weeks, setWeeks] = useState<number[]>([]);
    const [separateByArea, setSeparateByArea] = useState(false);
    const [pageFormat, setPageFormat] = useState<PageFormat>('A4');
    const [mode, setMode] = useState<PeriodMode>('months');

    if (!isOpen) return null;

    const firstYear = APP_CONFIG.ANALYTICS.PDF_FIRST_YEAR;
    const years = Array.from({ length: currentYear - firstYear + 2 }, (_, i) => firstYear + i);
    const totalWeeks = isoWeeksInYear(year);
    const weekNumbers = Array.from({ length: totalWeeks }, (_, i) => i + 1);
    const hasSelection = mode === 'weeks' ? weeks.length > 0 : months.length > 0;

    // Changing year or mode clears the chosen months / weeks
    const resetPeriod = () => {
        setMonths([]);
        setWeeks([]);
    };

    const generate = () => {
        if (mode === 'weeks') onGenerate(year, [], separateByArea, pageFormat, 'weeks', weeks.length > 0 ? weeks : weekNumbers);
        else onGenerate(year, months.length > 0 ? months : MONTH_NUMBERS, separateByArea, pageFormat, 'months', []);
    };

    const areaCopy = APP_COPY.analytics.areaSummary;

    return (
        <Modal
            title={title}
            icon={FileText}
            onClose={onClose}
            busy={loading}
            footer={
                <>
                    <Button onClick={onClose} variant="secondary" className="flex-1" disabled={loading}>
                        {APP_COPY.common.cancel}
                    </Button>
                    <Button onClick={generate} className="flex-1" disabled={loading}>
                        {loading ? copy.generating : hasSelection ? copy.generate : copy.generateYear}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <Field label={copy.year}>
                    <div className="flex gap-2">
                        {years.map((y) => (
                            <ChoiceButton
                                key={y}
                                selected={year === y}
                                disabled={loading}
                                onClick={() => {
                                    setYear(y);
                                    resetPeriod();
                                }}
                            >
                                {y}
                            </ChoiceButton>
                        ))}
                    </div>
                </Field>

                {showWeekMode && (
                    <Field label={copy.periodType}>
                        <div className="flex gap-2">
                            {MODES.map((m) => (
                                <ChoiceButton
                                    key={m}
                                    selected={mode === m}
                                    disabled={loading}
                                    className="flex-1"
                                    onClick={() => {
                                        setMode(m);
                                        resetPeriod();
                                    }}
                                >
                                    {m === 'months' ? copy.months : copy.weeks}
                                </ChoiceButton>
                            ))}
                        </div>
                    </Field>
                )}

                {mode === 'months' ? (
                    <Field label={copy.months}>
                        <div className="grid grid-cols-3 gap-2">
                            {MONTH_NUMBERS.map((m) => (
                                <ChoiceButton key={m} selected={months.includes(m)} disabled={loading} onClick={() => setMonths(toggle(months, m))}>
                                    {monthShortName(m)}
                                </ChoiceButton>
                            ))}
                        </div>
                    </Field>
                ) : (
                    <Field label={fmt(copy.weeksRange, { n: totalWeeks })}>
                        {/* 8 columns: 7 rows for 52 weeks, scrolls for 53 */}
                        <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto pr-1">
                            {weekNumbers.map((w) => (
                                <ChoiceButton key={w} size="sm" className="px-0" selected={weeks.includes(w)} disabled={loading} onClick={() => setWeeks(toggle(weeks, w))}>
                                    {w}
                                </ChoiceButton>
                            ))}
                        </div>
                    </Field>
                )}

                {!hideFormatSelector && (
                    <Field label={copy.pageFormat}>
                        <div className="flex gap-2">
                            {PAGE_FORMATS.map((format) => (
                                <ChoiceButton
                                    key={format}
                                    selected={pageFormat === format}
                                    disabled={loading}
                                    className="flex-1"
                                    onClick={() => setPageFormat(format)}
                                >
                                    {format}
                                </ChoiceButton>
                            ))}
                        </div>
                    </Field>
                )}

                {!hideSeparateToggle && (
                    <label className={pressableSurfaceClasses({ kind: 'inset' }, 'flex items-center gap-3 p-3')}>
                        <Checkbox checked={separateByArea} onChange={(e) => setSeparateByArea(e.target.checked)} disabled={loading} />
                        <span className="font-medium text-fg-strong">{areaCopy.separateReports}</span>
                    </label>
                )}

                {hasSelection && (
                    <p className="text-xs text-fg-muted">
                        {mode === 'months'
                            ? fmt(copy.selectedMonths, { year, months: months.map(monthName).join(', ') })
                            : fmt(copy.selectedWeeks, { year, weeks: weeks.join(', ') })}
                    </p>
                )}
            </div>
        </Modal>
    );
}
