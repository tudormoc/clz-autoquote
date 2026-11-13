import { ArrowDownToLine, ArrowUpToLine, Copy, ExternalLink, Flag, Trash2 } from '@/components/ui/icons';
import { occurrenceMenu } from '@/components/tasks/occurrence/occurrenceMenu';
import { confirmAndDeleteTask } from '@/components/tasks/shared/deleteTask';
import type { MenuAction } from '@/components/ui/FloatingMenu';
import type { AgendaCalendar } from '@/hooks/useAgendaCalendar';
import { PRIORITIES, isOpenStatus, type AgendaItem } from '@/lib/tasks/types';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.tasks;
const labels = copy.actions;

/** The first action of each block after the first gets a line above it */
const block = (actions: MenuAction[]): MenuAction[] => actions.map((action, index) => (index === 0 ? { ...action, divider: true } : action));

/**
 * The right-click menu of a calendar card, in blocks: the occurrence's actions (the same as "⋯" in Da fare); "In cima"
 * / "In fondo" while it can change place in its day; the other priorities while it is to do; its page and "Duplica";
 * "Elimina attività…" for whoever may delete it.
 */
export function cardMenu(item: AgendaItem, calendar: AgendaCalendar): MenuAction[] {
    const place = calendar.placeOf(item);
    const moves: MenuAction[] = [];
    if (place && !place.first) moves.push({ label: labels.toTop, icon: ArrowUpToLine, onSelect: () => calendar.toEdge(item, 'top') });
    if (place && !place.last) moves.push({ label: labels.toBottom, icon: ArrowDownToLine, onSelect: () => calendar.toEdge(item, 'bottom') });

    const priorities: MenuAction[] = isOpenStatus(item.status)
        ? PRIORITIES.filter((priority) => priority !== item.priority).map((priority) => ({
              label: fmt(labels.setPriority, { name: copy.priority[priority].toLowerCase() }),
              icon: Flag,
              onSelect: () => calendar.setPriority(item, priority),
          }))
        : [];

    const task: MenuAction[] = [
        { label: copy.calendar.openTask, icon: ExternalLink, onSelect: () => calendar.openTask(item.taskId) },
        { label: labels.duplicate, icon: Copy, onSelect: () => calendar.openTask(item.taskId, true) },
    ];
    if (item.deletable) {
        task.push({
            label: labels.deleteTask,
            icon: Trash2,
            tone: 'danger',
            onSelect: async () => {
                if (await confirmAndDeleteTask({ id: item.taskId, title: item.title })) await calendar.taskDeleted(item.taskId);
            },
        });
    }

    return [...occurrenceMenu(item, item.repeats, calendar.actions), ...block(moves), ...block(priorities), ...block(task)];
}
