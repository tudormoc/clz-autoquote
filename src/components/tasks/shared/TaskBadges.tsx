import { AlertTriangle, Repeat } from 'lucide-react';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import type { RepeatRule } from '@/lib/tasks/repeat';
import { describeRepeat } from '@/lib/tasks/describe';
import type { OccurrenceStatus, Priority, TaskState } from '@/lib/tasks/types';
import { APP_COPY } from '@/locales';

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
