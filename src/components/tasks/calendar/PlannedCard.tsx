import { Repeat } from '@/components/ui/icons';
import type { PlannedEntry } from '@/lib/tasks/types';
import { APP_COPY } from '@/locales';
import { cn } from '@/lib/utils';
import { SurfaceButton } from '@/components/ui/SurfaceButton';

const copy = APP_COPY.tasks.calendar;

interface PlannedCardProps {
    entry: PlannedEntry;
    selected: boolean;
    /** One line only, for a cell of the month */
    compact?: boolean;
    onOpen: () => void;
}

/** A date a repeating task will have (not a deadline yet): dashed, quiet, opens the side panel */
export function PlannedCard({ entry, selected, compact = false, onOpen }: PlannedCardProps) {
    return (
        <SurfaceButton
            kind="inset"
            selected={selected}
            onClick={onOpen}
            data-calendar-card
            title={compact ? `${entry.title} — ${copy.plannedHint}` : copy.plannedHint}
            className={cn('w-full flex border-dashed text-fg-subtle', compact ? 'items-center gap-1 px-1.5 py-0.5 text-2xs' : 'items-start gap-2 px-2 py-1.5 text-xs')}
        >
            <Repeat size={compact ? 10 : 12} className={cn('shrink-0', !compact && 'mt-0.5')} />
            <span className={cn('min-w-0', compact ? 'truncate' : 'break-words')}>
                {!compact && entry.time && <span className="font-mono mr-1">{entry.time}</span>}
                {entry.title}
            </span>
        </SurfaceButton>
    );
}
