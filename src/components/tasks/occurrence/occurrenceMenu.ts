import { CalendarClock, CheckCircle2, CircleDot, Hourglass, PlayCircle, RotateCcw, SkipForward, XCircle } from 'lucide-react';
import type { MenuAction } from '@/components/ui/FloatingMenu';
import type { OccurrenceActions, TitledOccurrence } from '@/hooks/useOccurrenceActions';
import { isOpenStatus } from '@/lib/tasks/types';
import { APP_COPY } from '@/locales';

const labels = APP_COPY.tasks.actions;

/**
 * The "⋯" actions of an occurrence. Open: done with a note, postpone, in progress / back to open, waiting, and skip
 * (repeating) or cancel (one-time). Closed: reopen.
 */
export function occurrenceMenu(occurrence: TitledOccurrence, repeats: boolean, actions: OccurrenceActions): MenuAction[] {
    if (!isOpenStatus(occurrence.status)) return [{ label: labels.reopen, icon: RotateCcw, onSelect: () => actions.reopen(occurrence) }];
    const list: MenuAction[] = [
        { label: labels.doneWithNote, icon: CheckCircle2, onSelect: () => actions.open('done', occurrence) },
        { label: labels.postpone, icon: CalendarClock, onSelect: () => actions.open('postpone', occurrence) },
    ];
    if (occurrence.status === 'open') list.push({ label: labels.progress, icon: PlayCircle, onSelect: () => actions.setStatus(occurrence, 'progress') });
    else list.push({ label: labels.backToOpen, icon: CircleDot, onSelect: () => actions.setStatus(occurrence, 'open') });
    list.push({ label: labels.waiting, icon: Hourglass, onSelect: () => actions.open('waiting', occurrence) });
    list.push(
        repeats
            ? { label: labels.skip, icon: SkipForward, onSelect: () => actions.open('skip', occurrence) }
            : { label: labels.cancel, icon: XCircle, onSelect: () => actions.open('cancel', occurrence), tone: 'danger' }
    );
    return list;
}
