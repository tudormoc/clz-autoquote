import { Repeat } from '@/components/ui/icons';
import type { PlannedEntry } from '@/lib/tasks/types';
import { APP_COPY } from '@/locales';
import { cn } from '@/lib/utils';
import { Pressable } from '@/components/ui/Pressable';

/** A date a repeating task will have (not a deadline yet): dashed, quiet, opens the side panel */
export function PlannedCard({ entry, selected, onOpen }: { entry: PlannedEntry; selected: boolean; onOpen: () => void }) {
    return (
        <Pressable
            type="button"
            onClick={onOpen}
            data-calendar-card
            title={APP_COPY.tasks.calendar.plannedHint}
            className={cn(
                'w-full flex items-start gap-2 rounded-md border border-dashed border-border-strong px-2 py-1.5 text-left text-xs text-fg-subtle transition-colors hover:text-fg-secondary hover:border-fg-faint',
                selected && 'ring-1 ring-primary'
            )}
        >
            <Repeat size={12} className="mt-0.5 shrink-0" />
            <span className="min-w-0 break-words">
                {entry.time && <span className="font-mono mr-1">{entry.time}</span>}
                {entry.title}
            </span>
        </Pressable>
    );
}
