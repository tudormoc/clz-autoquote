import Link from 'next/link';
import { CalendarCheck, ChevronRight } from 'lucide-react';
import { TASK_PAGES } from '@/config/navigation';
import type { UserAccess } from '@/lib/auth/permissions';
import { loadPeople } from '@/lib/tasks/db/shared';
import { agendaCounts } from '@/lib/tasks/db/views';
import { APP_COPY, fmt } from '@/locales';
import { cn } from '@/lib/utils';

const copy = APP_COPY.tasks.home;

/** Home page: the person's Agenda in one line (overdue · today · coming), a link to "Da fare". Nothing when it cannot load. */
export async function AgendaSummary({ access }: { access: UserAccess }) {
    let counts: Awaited<ReturnType<typeof agendaCounts>>;
    try {
        counts = await agendaCounts(access, await loadPeople());
    } catch (error) {
        console.error('Agenda summary failed:', error);
        return null;
    }
    const urgent = counts.overdue > 0;
    const nothing = counts.overdue + counts.today + counts.soon === 0;

    return (
        <Link
            href={TASK_PAGES.todo}
            className={cn(
                'mb-6 flex items-center gap-3 p-4 rounded-lg border bg-card transition-colors hover:bg-muted/50',
                urgent ? 'border-danger-500/40 hover:border-danger-500/70' : 'border-border hover:border-primary/50'
            )}
        >
            <span className={cn('shrink-0 p-2 rounded-md', urgent ? 'bg-danger-500/15 text-danger-400' : 'bg-primary/10 text-primary')}>
                <CalendarCheck size={20} />
            </span>
            <span className="flex-1 min-w-0">
                <span className="block font-semibold text-fg-strong">{copy.title}</span>
                <span className={cn('block text-sm', urgent ? 'text-danger-300' : 'text-fg-muted')}>
                    {nothing ? copy.nothing : fmt(copy.summary, { overdue: counts.overdue, today: counts.today, soon: counts.soon })}
                </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-fg-muted" />
        </Link>
    );
}
