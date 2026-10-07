import { Spinner } from '@/components/ui/Spinner';
import { CalendarCheck } from 'lucide-react';
import { presenceFieldLabel as fieldLabel } from '@/components/presence/presenceLabels';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { PrefillSummary } from '@/hooks/usePrefillAbsences';
import { PREFILL_CATEGORIES, type PresenceRulesConfig } from '@/lib/presence';
import { APP_COPY, fmt } from '@/locales';

interface PrefillConfirmDialogProps {
    summary: PrefillSummary;
    rules: PresenceRulesConfig;
    period: { dateFrom: string; dateTo: string };
    prefilling: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

const copy = APP_COPY.analytics.monthlySummary;

/** "Precompila e Distribuisci Ore": what will be filled in, by kind of day, before the user confirms. */
export function PrefillConfirmDialog({ summary, rules, period, prefilling, onConfirm, onClose }: PrefillConfirmDialogProps) {
    const workdayLabel = `${rules.workdayHours.toFixed(1)}h`;
    const weekdays = (days: number[]) => days.map((d) => copy.weekdays[d - 1]).join(', ');
    const fixedCategories = PREFILL_CATEGORIES.filter((c) => c.profile === 'fixed');
    const standardCategoriesLabel = PREFILL_CATEGORIES.filter((c) => c.profile === 'standard').map((c) => c.label).join(', ');

    const card = (title: string, detail: React.ReactNode, count: number) => (
        <div className="flex items-center justify-between gap-3 p-2.5 rounded bg-card/80 border border-border">
            <div>
                <div className="font-semibold text-xs text-fg-soft">{title}</div>
                <div className="text-2xs text-fg-muted">{detail}</div>
            </div>
            <span className="font-mono font-bold text-fg text-sm bg-muted px-2 py-0.5 rounded">{count}</span>
        </div>
    );

    return (
        <Modal
            title={copy.prefill.modalTitle}
            icon={CalendarCheck}
            iconTone="warning"
            size="xl"
            onClose={onClose}
            busy={prefilling}
            footer={
                <>
                    <Button type="button" variant="secondary" onClick={onClose} disabled={prefilling}>
                        {APP_COPY.common.cancel}
                    </Button>
                    <Button type="button" onClick={onConfirm} disabled={prefilling} className="bg-warning-600 hover:bg-warning-500 text-fg-strong">
                        {prefilling ? <Spinner size={16} /> : <CalendarCheck size={16} />}
                        {copy.prefill.confirmButton} ({summary.totalCount})
                    </Button>
                </>
            }
        >
            <div className="space-y-3">
                <p className="text-fg-soft">
                    {copy.prefill.found} <strong className="text-warning-400 font-bold text-base">{summary.totalCount}</strong>{' '}
                    {copy.prefill.summaryText}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {card(
                        fmt(copy.prefill.fullTitle, { h: workdayLabel }),
                        <>
                            {fmt(copy.prefill.fullDetail, { h: workdayLabel })}
                            {summary.overflowCount > 0 && (
                                <span className="text-warning-400 ml-1">
                                    ({summary.overflowCount}{' '}
                                    {fmt(copy.prefill.overflowDetail, { min: rules.overflowMinHours, field: fieldLabel(rules.overflowField) })})
                                </span>
                            )}
                        </>,
                        summary.fullCount
                    )}
                    {card(
                        fmt(copy.prefill.partialTitle, { h: workdayLabel }),
                        fmt(copy.prefill.partialDetail, { h: workdayLabel, step: rules.ordinarieRounding.step, field: fieldLabel(rules.partialFillField) }),
                        summary.partialCount
                    )}
                    {card(
                        copy.prefill.absencesTitle,
                        fmt(copy.prefill.absencesDetail, { h: workdayLabel, field: fieldLabel(rules.absenceField) }),
                        summary.absencesCount
                    )}
                    {fixedCategories.length > 0 &&
                        card(
                            fmt(copy.prefill.fixedTitle, { categories: fixedCategories.map((c) => c.label).join(', ') }),
                            fmt(copy.prefill.fixedDetail, { h: workdayLabel }),
                            summary.fixedCount
                        )}
                    {rules.extraDays.length > 0 &&
                        card(
                            fmt(copy.prefill.extraTitle, { days: weekdays(rules.extraDays) }),
                            fmt(copy.prefill.extraDetail, { max: rules.extraMaxHours, field: fieldLabel(rules.extraField), step: rules.extraRounding.step }),
                            summary.extraCount
                        )}
                </div>

                <div className="bg-success-950/30 border border-success-800/40 rounded p-3 text-xs space-y-1">
                    <div className="font-semibold text-success-300 flex items-center gap-1.5">
                        <span>✓</span> {fmt(copy.prefill.ruleTitle, { h: workdayLabel })}
                    </div>
                    <div className="text-success-400/90 text-2xs">
                        {fmt(copy.prefill.ruleDesc, { h: rules.workdayHours, fields: rules.coveredFields.map(fieldLabel).join(' + ') })}
                    </div>
                </div>

                <div className="bg-background/60 border border-border/80 rounded p-3 text-xs text-fg-muted space-y-1">
                    <div className="font-medium text-2xs">
                        {copy.prefill.period} <span className="text-fg font-semibold font-mono">{period.dateFrom}</span> &rarr;{' '}
                        <span className="text-fg font-semibold font-mono">{period.dateTo}</span>
                    </div>
                    <div>&bull; {fmt(copy.prefill.workingDaysOnly, { days: weekdays(rules.workingDays) })}</div>
                    <div>&bull; {copy.prefill.pastDatesOnly}</div>
                    <div>&bull; {copy.prefill.noOverwrite}</div>
                    <div>&bull; {fmt(copy.prefill.categoriesOnly, { categories: standardCategoriesLabel })}</div>
                </div>
            </div>
        </Modal>
    );
}
