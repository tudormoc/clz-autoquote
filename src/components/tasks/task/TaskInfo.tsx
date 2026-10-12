import { Info } from 'lucide-react';
import { FormCard } from '@/components/tasks/shared/FormCard';
import { PriorityBadge, TaskStateBadge } from '@/components/tasks/shared/TaskBadges';
import type { TaskOptions } from '@/app/tasks/task-actions';
import { describeRepeat, formatIsoDate, formatMoment, formatShortDay } from '@/lib/tasks/describe';
import type { TaskDetail } from '@/lib/tasks/types';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.tasks;

function Line({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
            <dt className="text-fg-muted">{label}</dt>
            <dd className="text-fg min-w-0 break-words">{children}</dd>
        </div>
    );
}

/** The task's facts: when (rule and next dates), area, priority, who, who sees it, time, tags, made and changed by */
export function TaskInfo({ task, nextDates, options }: { task: TaskDetail; nextDates: string[]; options: TaskOptions }) {
    const detail = copy.detail;
    const groupName = options.groups.find((group) => group.id === task.groupId)?.name;
    const visibility = task.visibility === 'group' && groupName ? `${copy.visibility.group}: ${groupName}` : copy.visibility[task.visibility];
    const when = task.repeat ? describeRepeat(task.repeat) : task.dueDate ? `${copy.repeat.once}, ${formatIsoDate(task.dueDate)}` : copy.repeat.noDate;

    return (
        <FormCard title={detail.info} icon={Info}>
            <dl className="space-y-2">
                <Line label={copy.filters.state}>
                    <TaskStateBadge state={task.state} />
                </Line>
                <Line label={detail.repeat}>
                    {when}
                    {task.dueTime && <span className="text-fg-muted"> · {task.dueTime}</span>}
                    <span className="block text-xs text-fg-subtle">{fmt(detail.showFrom, { days: task.showDays })}</span>
                </Line>
                {nextDates.length > 0 && (
                    <Line label={detail.next}>
                        <span className="font-mono text-xs text-fg-secondary">{nextDates.map(formatShortDay).join(' · ')}</span>
                    </Line>
                )}
                {task.areaName && <Line label={detail.area}>{task.areaName}</Line>}
                {task.priority > 0 && (
                    <Line label={detail.priority}>
                        <PriorityBadge priority={task.priority} />
                    </Line>
                )}
                <Line label={detail.assignee}>{task.assigneeName ?? copy.form.nobody}</Line>
                <Line label={detail.visibility}>{visibility}</Line>
                {task.estimateMinutes && <Line label={detail.estimate}>{fmt(detail.minutes, { n: task.estimateMinutes })}</Line>}
                {task.tags.length > 0 && <Line label={detail.tags}>{task.tags.join(', ')}</Line>}
            </dl>
            <div className="pt-2 border-t border-border text-2xs text-fg-subtle space-y-0.5">
                <p>{fmt(detail.createdBy, { name: task.createdBy, date: formatMoment(task.createdAt) })}</p>
                {task.updatedAt !== task.createdAt && <p>{fmt(detail.updatedBy, { name: task.updatedBy, date: formatMoment(task.updatedAt) })}</p>}
            </div>
        </FormCard>
    );
}
