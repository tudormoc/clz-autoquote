import { Header } from '@/components/Header';
import { PresenceSidebar } from '@/components/presence/PresenceSidebar';
import { DailyEventsTable } from '@/components/presence/DailyEventsTable';
import { Calendar } from 'lucide-react';
import { APP_COPY } from '@/locales';

export default function DailyEventsPage() {
    const copy = APP_COPY.analytics.dailyEvents;

    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            <Header />
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <PresenceSidebar activeSection="daily-events" />

                {/* Main Content */}
                <main className="flex-1 bg-background overflow-y-auto">
                    <div className="max-w-screen-2xl mx-auto px-6 py-6">
                        {/* Header */}
                        <div className="mb-6">
                            <div className="flex items-center gap-3 mb-2">
                                <Calendar className="text-primary" size={24} />
                                <h1 className="text-2xl font-bold text-zinc-100">
                                    {copy.title}
                                </h1>
                            </div>
                            <p className="text-zinc-400">{copy.subtitle}</p>
                        </div>

                        {/* Dashboard content */}
                        <DailyEventsTable />
                    </div>
                </main>
            </div>
        </div>
    );
}
