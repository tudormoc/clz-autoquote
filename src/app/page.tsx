import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { MAIN_NAV } from '@/config/navigation';
import { APP_COPY } from '@/locales';

export default function Home() {
    return (
        <AppShell>
            <div className="py-6">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-fg-strong mb-3">
                        {APP_COPY.home.welcome}
                    </h1>
                    <p className="text-fg-muted text-lg">
                        {APP_COPY.home.subtitle}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
                    {MAIN_NAV.filter((item) => item.showOnHome).map(({ id, href, label, description, icon: Icon }) => (
                        <Link
                            key={id}
                            href={href}
                            className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 hover:bg-muted/50 transition-all group"
                        >
                            <div className="flex flex-col items-center text-center gap-3">
                                <div className="p-3 bg-primary/10 rounded-lg text-primary group-hover:bg-primary/20 transition-colors">
                                    <Icon size={24} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-fg-strong mb-1">{label}</h3>
                                    <p className="text-sm text-fg-muted">{description}</p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </AppShell>
    );
}
