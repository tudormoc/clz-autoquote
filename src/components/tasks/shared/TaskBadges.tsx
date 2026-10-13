import { AlertTriangle, History, Repeat } from 'lucide-react';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { APP_CONFIG } from '@/config/constants';
import type { RepeatRule } from '@/lib/tasks/repeat';
import { describeRepeat } from '@/lib/tasks/describe';
import type { OccurrenceStatus, Priority, TaskState } from '@/lib/tasks/types';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.tasks;

/** "Alta" / "Critica" (nothing for normale) */
export function PriorityBadge({ priority }: { priority: Priority }) {
    if (priority === 0) return null;
    return (
        <StatusBadge tone={priority === 2 ? 'danger' : 'warning'} title={copy.priorityHint[priority]}>
            {priority === 2 && <AlertTriangle size={11} />}
            {copy.priority[priority]}
        </StatusBadge>
    );
}

const STATUS_TONES: Record<OccurrenceStatus, StatusTone> = {
    open: 'neutral',
    progress: 'info',
    waiting: 'warning',
    done: 'success',
    skipped: 'muted',
    cancelled: 'muted',
    replaced: 'muted',
};

/** The state of an occurrence; "waiting" shows for whom */
export function OccurrenceStatusBadge({ status, note }: { status: OccurrenceStatus; note?: string | null }) {
    const title = status === 'replaced' ? copy.statusHints.replaced : note ?? undefined;
    return (
        <StatusBadge tone={STATUS_TONES[status]} title={title}>
            {copy.status[status]}
            {status === 'waiting' && note && <span className="font-normal truncate max-w-48">· {note}</span>}
        </StatusBadge>
    );
}

/** "Rimandata N volte" on a date that keeps slipping (from APP_CONFIG.TASKS.POSTPONED_BADGE_FROM times); short: "N×" */
export function PostponedBadge({ count, short = false }: { count: number; short?: boolean }) {
    if (count < APP_CONFIG.TASKS.POSTPONED_BADGE_FROM) return null;
    const text = fmt(copy.messages.postponedTimes, { n: count });
    return (
        <span title={text} className="inline-flex items-center gap-1 text-warning-300">
            <History size={11} className="shrink-0" aria-hidden />
            {short ? <span className="font-mono">{count}×</span> : text}
        </span>
    );
}

const STATE_TONES: Record<TaskState, StatusTone> = { active: 'success', paused: 'warning', archived: 'muted' };

export function TaskStateBadge({ state }: { state: TaskState }) {
    return <StatusBadge tone={STATE_TONES[state]}>{copy.states[state]}</StatusBadge>;
}

/** A small repeat sign, the rule as tooltip */
export function RepeatMark({ rule }: { rule: RepeatRule | null }) {
    if (!rule) return null;
    const text = describeRepeat(rule);
    return (
        <span title={text} aria-label={text} className="inline-flex text-fg-muted">
            <Repeat size={13} />
        </span>
    );
}
