import { Header } from '@/components/Header';
import { PresenceSidebar } from '@/components/presence/PresenceSidebar';
import { Calendar } from 'lucide-react';

export default function BadgeTimbraturePage() {
    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            <Header />
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <PresenceSidebar activeSection="badge-timbrature" />

                {/* Main Content */}
                <main className="flex-1 bg-background overflow-y-auto">
                    <div className="max-w-screen-2xl mx-auto px-6 py-6">
                        {/* Header */}
                        <div className="mb-6">
                            <div className="flex items-center gap-3 mb-2">
                                <Calendar className="text-primary" size={24} />
                                <h1 className="text-2xl font-bold text-white">
                                    Badge Timbrature
                                </h1>
                            </div>
                            <p className="text-zinc-400">
                                Raw badge clock-in/clock-out data for sync verification
                            </p>
                        </div>

                        {/* Empty State */}
                        <div className="bg-card border border-zinc-800 rounded-lg p-8 text-center">
                            <p className="text-zinc-300 text-lg mb-2">
                                Badge Timbrature Dashboard
                            </p>
                            <p className="text-zinc-500 text-sm">
                                This dashboard will display raw timbrature data from the badge system once configured.
                            </p>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
