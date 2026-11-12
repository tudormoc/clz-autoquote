'use client';

import { useMemo } from 'react';
import { getAgendaAction } from '@/app/tasks/agenda-actions';
import { useCanEdit } from '@/components/auth/AccessProvider';
import { AgendaRow } from '@/components/tasks/agenda/AgendaRow';
import { AgendaSection, type SectionTone } from '@/components/tasks/agenda/AgendaSection';
import { QuickAdd } from '@/components/tasks/agenda/QuickAdd';
import { OccurrenceDialog } from '@/components/tasks/occurrence/OccurrenceDialog';
import { TaskFilters, matchesFilters } from '@/components/tasks/shared/TaskFilters';
import { LoadState } from '@/components/ui/LoadState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useActionData } from '@/hooks/useActionData';
import { useTaskFilters } from '@/hooks/useTaskFilters';
import { useOccurrenceActions } from '@/hooks/useOccurrenceActions';
import { AGENDA_GROUPS, agendaGroup, type AgendaGroup } from '@/lib/tasks/agenda';
import { compareByDate } from '@/lib/tasks/dayOrder';
import type { AgendaItem } from '@/lib/tasks/types';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.tasks;

const GROUP_TONES: Record<AgendaGroup, SectionTone> = { overdue: 'danger', today: 'warning', soon: 'primary', later: 'muted', nodate: 'muted' };

/** Left column: what needs doing now; right column: what is coming */
const NOW_GROUPS: AgendaGroup[] = ['overdue', 'today'];
const NEXT_GROUPS: AgendaGroup[] = ['soon', 'later', 'nodate'];

/**
 * "Da fare": opens filled (no "Applica"). Left: Scadute · Oggi, then "Fatte oggi" to see and undo; right: In arrivo ·
 * Più avanti (folded) · Senza data. Quick add and filters in one line on top. Desktop: fits the screen, each column
 * scrolls on its own (one column below xl).
 */
export function TodoView() {
    const { data, loading, error, reload } = useActionData(getAgendaAction);
    const agenda = data?.data;
    const canEdit = useCanEdit();
    const [filters, setFilters] = useTaskFilters();
    const actions = useOccurrenceActions(reload, agenda?.today ?? '');

    const groups = useMemo(() => {
        const result = Object.fromEntries(AGENDA_GROUPS.map((group) => [group, [] as AgendaItem[]])) as Record<AgendaGroup, AgendaItem[]>;
        if (!agenda) return result;
        for (const item of agenda.items) {
            if (matchesFilters(item, filters, agenda.areas)) result[agendaGroup(item, agenda.today)].push(item);
        }
        // By date, and inside a day in the order set on the calendar
        for (const group of AGENDA_GROUPS) result[group].sort(compareByDate);
        return result;
    }, [agenda, filters]);
    const doneToday = useMemo(() => (agenda ? agenda.doneToday.filter((item) => matchesFilters(item, filters, agenda.areas)) : []), [agenda, filters]);

    if (!agenda) return <LoadState loading={loading} error={error} />;

    const showAssignee = agenda.people.length > 1;
    const total = AGENDA_GROUPS.reduce((sum, group) => sum + groups[group].length, 0);

    const section = (group: AgendaGroup) =>
        groups[group].length > 0 && (
            <AgendaSection
                key={group}
                title={copy.groups[group]}
                count={groups[group].length}
                tone={GROUP_TONES[group]}
                folded={group === 'later'}
            >
                {groups[group].map((item) => (
                    <AgendaRow key={item.id} item={item} today={agenda.today} actions={actions} showAssignee={showAssignee} />
                ))}
            </AgendaSection>
        );
    const nothingNow = NOW_GROUPS.every((group) => groups[group].length === 0) && doneToday.length === 0;
    const nothingNext = NEXT_GROUPS.every((group) => groups[group].length === 0);

    return (
        <div className="flex flex-col gap-3 lg:h-full">
            <div className="shrink-0 flex flex-wrap items-center gap-2">
                {canEdit && (
                    <div className="flex-1 min-w-64">
                        <QuickAdd onAdded={reload} />
                    </div>
                )}
                {(agenda.items.length > 0 || agenda.doneToday.length > 0) && (
                    <TaskFilters values={filters} onChange={setFilters} areas={agenda.areas} people={agenda.people} compact />
                )}
            </div>
            {error && <p className="text-sm text-danger">{`${APP_COPY.common.loadError}: ${error}`}</p>}

            {total === 0 && doneToday.length === 0 ? (
                <EmptyState title={copy.allClear} />
            ) : (
                // Wide screens: what is late and for today on the left, what is coming on the right, each scrolling on its own
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 lg:flex-1 lg:min-h-0 lg:overflow-y-auto xl:overflow-hidden">
                    <div className="space-y-4 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
                        {nothingNow ? <p className="py-6 text-center text-sm text-fg-subtle">{copy.nothingNow}</p> : NOW_GROUPS.map(section)}
                        {doneToday.length > 0 && (
                            <AgendaSection title={copy.groups.doneToday} count={doneToday.length} tone="success">
                                {doneToday.map((item) => (
                                    <AgendaRow key={item.id} item={item} today={agenda.today} actions={actions} showAssignee={showAssignee} />
                                ))}
                            </AgendaSection>
                        )}
                    </div>
                    <div className="space-y-4 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
                        {nothingNext ? <p className="py-6 text-center text-sm text-fg-subtle">{copy.nothingNext}</p> : NEXT_GROUPS.map(section)}
                    </div>
                </div>
            )}

            {actions.dialog && (
                <OccurrenceDialog
                    kind={actions.dialog.kind}
                    occurrence={actions.dialog.occurrence}
                    today={agenda.today}
                    busy={actions.busy}
                    onSubmit={actions.submitDialog}
                    onClose={actions.close}
                />
            )}
        </div>
    );
}
