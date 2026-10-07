import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { APP_COPY } from '@/locales';
import { MAIN_NAV } from '@/config/navigation';

/** Top bar: brand on the left, one icon link per main area (MAIN_NAV) on the right. */
export function Header() {
    return (
        <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-10">
            <div className="w-full px-6 h-14 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <div className="bg-primary p-1.5 rounded text-primary-foreground">
                        <BookOpen className="h-5 w-5" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg tracking-tight text-fg-strong leading-none">
                            {APP_COPY.header.title}
                        </h1>
                        <p className="text-3xs text-fg-subtle font-mono hidden sm:block mt-0.5">
                            {APP_COPY.header.subtitle}
                        </p>
                    </div>
                </Link>

                <nav className="flex items-center gap-1">
                    {MAIN_NAV.map(({ id, href, label, icon: Icon }) => (
                        <Link
                            key={id}
                            href={href}
                            className="p-2 text-fg-muted hover:text-primary hover:bg-muted rounded-md transition-all"
                            title={label}
                        >
                            <Icon className="h-5 w-5" />
                        </Link>
                    ))}
                </nav>
            </div>
        </header>
    );
}
