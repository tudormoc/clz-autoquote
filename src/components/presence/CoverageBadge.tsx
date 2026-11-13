import { presenceFieldLabel } from '@/components/presence/presenceLabels';
import { AlertTriangle, Check } from '@/components/ui/icons';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { MissingValue } from '@/components/ui/TableCells';
import { getDayStatus, rulesForOperator, type PresenceRulesConfig } from '@/lib/presence';
import { APP_COPY, fmt } from '@/locales';
import type { OperatorHoursRow } from '@/types';

const copy = APP_COPY.analytics.monthlySummary.verification;

/** "8.0 h" */
const hours = (value: string) => fmt(APP_COPY.timesheet.hoursUnit, { hours: value });
const OK = <Check size={12} />;
const WARNING = <AlertTriangle size={12} />;

interface CoverageBadgeProps {
    row: OperatorHoursRow;
    todayStr: string;
    rules: PresenceRulesConfig;
}

/** Workday coverage check of one row: the covered fields must add up to the workday hours of the rules. */
export function CoverageBadge({ row, todayStr, rules: baseRules }: CoverageBadgeProps) {
    const rules = rulesForOperator(row.operatore, baseRules);
    const status = getDayStatus(row, todayStr, rules);
    const covered = status.covered.toFixed(1);
    const expected = rules.workdayHours.toFixed(1);

    if (status.dayKind === 'extra') {
        if (status.kind === 'ok' || (status.kind === 'future' && status.covered > 0)) {
            return (
                <StatusBadge tone="info" title={fmt(copy.badgeExtraOkTitle, { covered, field: presenceFieldLabel(rules.extraField) })}>
                    {hours(covered)}
                    {OK}
                </StatusBadge>
            );
        }
        if (status.kind === 'empty') {
            return (
                <StatusBadge tone="warning" title={copy.badgeExtraEmptyTitle}>
                    {WARNING}
                    {hours(covered)}
                </StatusBadge>
            );
        }
        return <MissingValue />;
    }

    switch (status.kind) {
        case 'non-working':
            return status.covered > 0 ? <StatusBadge tone="info">{hours(covered)}</StatusBadge> : <MissingValue />;
        case 'ok':
            return (
                <StatusBadge tone="success" title={fmt(copy.badgeOkTitle, { h: expected })}>
                    {hours(expected)}
                    {OK}
                </StatusBadge>
            );
        case 'mismatch':
            return (
                <StatusBadge tone="warning" title={fmt(copy.badgeMismatchTitle, { covered, h: expected })}>
                    {WARNING}
                    {hours(covered)}
                </StatusBadge>
            );
        case 'empty':
            return (
                <StatusBadge tone="muted" mono title={copy.badgeEmptyTitle}>
                    {hours(covered)}
                </StatusBadge>
            );
        case 'future':
            // Today / future: informational only, never counted as anomaly
            if (status.covered === rules.workdayHours) {
                return (
                    <StatusBadge tone="success">
                        {hours(expected)}
                        {OK}
                    </StatusBadge>
                );
            }
            return status.covered > 0 ? <StatusBadge tone="warning">{hours(covered)}</StatusBadge> : <MissingValue />;
    }
}
