'use client';

import React from 'react';
import { BookOpen, Database, ShieldCheck } from 'lucide-react';
import { APP_COPY } from '@/locales/en';
import Link from 'next/link';

export const Header = () => {
    return (
        <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
            <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <div className="bg-primary p-1.5 rounded text-primary-foreground">
                        <BookOpen className="h-5 w-5" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg tracking-tight text-white leading-none">
                            {APP_COPY.header.title}
                        </h1>
                        <p className="text-[10px] text-zinc-500 font-mono hidden sm:block uppercase tracking-widest mt-0.5">
                            {APP_COPY.header.subtitle}
                        </p>
                    </div>
                </Link>

                <div className="flex items-center gap-1">
                    <Link
                        href="/admin"
                        className="p-2 text-zinc-400 hover:text-primary hover:bg-zinc-800 rounded-md transition-all"
                        title="Control Center"
                    >
                        <ShieldCheck className="h-5 w-5" />
                    </Link>
                    <Link
                        href="/db-test"
                        className="p-2 text-zinc-400 hover:text-primary hover:bg-zinc-800 rounded-md transition-all"
                        title="Database Explorer"
                    >
                        <Database className="h-5 w-5" />
                    </Link>
                </div>
            </div>
        </header>
    );
};
