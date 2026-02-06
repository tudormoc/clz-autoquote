'use client';

import React from 'react';
import { BookOpen, Database, ShieldCheck } from 'lucide-react';
import { APP_COPY } from '@/locales/en';
import Link from 'next/link';

export const Header = () => {
    return (
        <header className="bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <div className="bg-primary p-2 rounded-lg">
                        <BookOpen className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-foreground">{APP_COPY.header.title}</h1>
                        <p className="text-xs text-muted-foreground hidden sm:block">{APP_COPY.header.subtitle}</p>
                    </div>
                </Link>

                <div className="flex items-center gap-2">
                    <Link
                        href="/admin"
                        className="p-2 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                        title="Control Center"
                    >
                        <ShieldCheck className="h-5 w-5" />
                    </Link>
                    <Link
                        href="/db-test"
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-gray-100 rounded-full transition-all"
                        title="Database Explorer"
                    >
                        <Database className="h-5 w-5" />
                    </Link>
                </div>
            </div>
        </header>
    );
};
