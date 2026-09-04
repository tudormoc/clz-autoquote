import { Header } from '@/components/Header';
import { PresenceSidebar } from '@/components/presence/PresenceSidebar';
import { Users } from 'lucide-react';
import { APP_COPY } from '@/locales';

export default function PresencePage() {
    const copy = APP_COPY.analytics;

    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            <Header />
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <PresenceSidebar activeSection="" />

                {/* Main Content */}
                <main className="flex-1 bg-background overflow-y-auto">
                    <div className="max-w-screen-2xl mx-auto px-6 py-6">
                        {/* Header */}
                        <div className="mb-6">
                            <div className="flex items-center gap-3 mb-2">
                                <Users className="text-primary" size={24} />
                                <h1 className="text-2xl font-bold text-white">
                                    {APP_COPY.home.cards.presence.title}
                                </h1>
                            </div>
                            <p className="text-zinc-400">
                                {APP_COPY.home.cards.presence.description}
                            </p>
                        </div>

                        {/* Welcome Message */}
                        <div className="bg-card border border-zinc-800 rounded-lg p-8 text-center">
                            <p className="text-zinc-300 text-lg mb-2">
                                {copy.presenceSidebar.heading}: {APP_COPY.home.cards.presence.title}
                            </p>
                            <p className="text-zinc-500 text-sm">
                                {APP_COPY.home.cards.presence.description}
                            </p>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

