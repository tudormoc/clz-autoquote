'use client';

import { useState } from 'react';
import { ClosedOccurrences } from '@/components/tasks/task/ClosedOccurrences';
import { TaskLog } from '@/components/tasks/task/TaskLog';
import { TabBar } from '@/components/ui/TabBar';
import type { OccurrenceActions, TitledOccurrence } from '@/hooks/useOccurrenceActions';
import type { ChecklistItem, LogEntry } from '@/lib/tasks/types';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.tasks.detail;

interface TaskTimelineProps {
    closed: TitledOccurrence[];
    log: LogEntry[];
    checklist: ChecklistItem[];
    actions: OccurrenceActions;
}

/** The task's past in one box: its closed occurrences, or everything that happened (log), one tab at a time */
export function TaskTimeline({ closed, log, checklist, actions }: TaskTimelineProps) {
    const [tab, setTab] = useState<'closed' | 'log'>('closed');
    return (
        <section className="bg-card border border-border rounded-lg">
            <TabBar
                className="px-3 pt-2 border-b border-border"
                tabs={[
                    { id: 'closed', label: copy.past, count: closed.length },
                    { id: 'log', label: copy.log, count: log.length },
                ]}
                active={tab}
                onChange={setTab}
            />
            <div className="p-4">
                {tab === 'closed' ? <ClosedOccurrences occurrences={closed} actions={actions} /> : <TaskLog entries={log} checklist={checklist} />}
            </div>
        </section>
    );
}
