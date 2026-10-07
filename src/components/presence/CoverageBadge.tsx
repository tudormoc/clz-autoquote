import { presenceFieldLabel } from '@/components/presence/presenceLabels';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { MissingValue } from '@/components/ui/TableCells';
import { getDayStatus, rulesForOperator, type PresenceRulesConfig } from '@/lib/presence';
import { APP_COPY, fmt } from '@/locales';
import type { OperatorHoursRow } from '@/types';

const copy = APP_COPY.analytics.monthlySummary.verification;

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
                    {covered}h ✓
                </StatusBadge>
            );
        }
        if (status.kind === 'empty') {
            return (
                <StatusBadge tone="warning" title={copy.badgeExtraEmptyTitle}>
                    ⚠️ 0.0h
                </StatusBadge>
            );
        }
        return <MissingValue />;
    }

    switch (status.kind) {
        case 'non-working':
            return status.covered > 0 ? <StatusBadge tone="info">{covered}h</StatusBadge> : <MissingValue />;
        case 'ok':
            return (
                <StatusBadge tone="success" title={fmt(copy.badgeOkTitle, { h: expected })}>
                    {expected}h ✓
                </StatusBadge>
            );
        case 'mismatch':
            return (
                <StatusBadge tone="warning" title={fmt(copy.badgeMismatchTitle, { covered, h: expected })}>
                    ⚠️ {covered}h
                </StatusBadge>
            );
        case 'empty':
            return (
                <StatusBadge tone="muted" mono title={copy.badgeEmptyTitle}>
                    0.0h
                </StatusBadge>
            );
        case 'future':
            // Today / future: informational only, never counted as anomaly
            if (status.covered === rules.workdayHours) return <StatusBadge tone="success">{expected}h ✓</StatusBadge>;
            return status.covered > 0 ? <StatusBadge tone="warning">{covered}h</StatusBadge> : <MissingValue />;
    }
}
