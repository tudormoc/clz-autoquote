import { CalendarView } from '@/components/tasks/calendar/CalendarView';
import { requirePage } from '@/lib/auth/access';
import { APP_COPY } from '@/locales';

export const metadata = { title: APP_COPY.tasks.pages.calendar.label };

/** The calendar fills the screen: its toolbar is the page title (the week or month on screen) */
export default async function CalendarPage() {
    await requirePage('tasks', 'calendar');
    return <CalendarView />;
}
