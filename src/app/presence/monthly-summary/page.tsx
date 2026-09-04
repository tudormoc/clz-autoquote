import { Header } from '@/components/Header';
import { PresenceSidebar } from '@/components/presence/PresenceSidebar';
import { MonthlyHoursTable } from '@/components/presence/MonthlyHoursTable';
import { CalendarDays } from 'lucide-react';
import { APP_COPY } from '@/locales';

/**
 * Monthly Presence Summary Dashboard
 * For calculating and managing operator hours, missing hours, holidays, sickness, etc.
 */
export default function MonthlySummaryPage() {
    const copy = APP_COPY.analytics.monthlySummary;

    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            <Header />
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <PresenceSidebar activeSection="monthly-summary" />

                {/* Main Content */}
                <main className="flex-1 bg-background overflow-y-auto">
                    <div className="max-w-screen-2xl mx-auto px-6 py-6">
                        {/* Header */}
                        <div className="mb-6">
                            <div className="flex items-center gap-3 mb-2">
                                <CalendarDays className="text-primary" size={24} />
                                <h1 className="text-2xl font-bold text-zinc-100">
                                    {copy.title}
                                </h1>
                            </div>
                            <p className="text-zinc-400">{copy.subtitle}</p>
                        </div>

                        {/* Dashboard Table */}
                        <MonthlyHoursTable />
                    </div>
                </main>
            </div>
        </div>
    );
}
