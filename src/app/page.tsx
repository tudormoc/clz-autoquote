import { Header } from '@/components/Header';
import { APP_COPY } from '@/locales';
import Link from 'next/link';
import { FileText, BarChart3, Database, Users, Wallet } from 'lucide-react';

export default function Home() {
    const navigationCards = [
        {
            href: '/quotes',
            icon: FileText,
            title: APP_COPY.home.cards.quotes.title,
            description: APP_COPY.home.cards.quotes.description,
        },
        {
            href: '/analytics',
            icon: BarChart3,
            title: APP_COPY.home.cards.analytics.title,
            description: APP_COPY.home.cards.analytics.description,
        },
        {
            href: '/presence',
            icon: Users,
            title: 'Operator Presence',
            description: 'Manage and monitor operator presence events',
        },
        {
            href: '/cashflow',
            icon: Wallet,
            title: APP_COPY.home.cards.cashflow.title,
            description: APP_COPY.home.cards.cashflow.description,
        },
        {
            href: '/db-test',
            icon: Database,
            title: APP_COPY.home.cards.database.title,
            description: APP_COPY.home.cards.database.description,
        },
    ];

    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            <Header />
            
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-screen-2xl mx-auto px-4 py-12">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-white mb-3">
                        {APP_COPY.home.welcome}
                    </h1>
                    <p className="text-zinc-400 text-lg">
                        {APP_COPY.home.subtitle}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 max-w-6xl mx-auto">
                    {navigationCards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <Link
                                key={card.href}
                                href={card.href}
                                className="bg-card border border-zinc-800 rounded-lg p-6 hover:border-primary/50 hover:bg-zinc-800/50 transition-all group"
                            >
                                <div className="flex flex-col items-center text-center gap-3">
                                    <div className="p-3 bg-primary/10 rounded-lg text-primary group-hover:bg-primary/20 transition-colors">
                                        <Icon size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white mb-1">
                                            {card.title}
                                        </h3>
                                        <p className="text-sm text-zinc-400">
                                            {card.description}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
                </div>
            </main>
        </div>
    );
}
