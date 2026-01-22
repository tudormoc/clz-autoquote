'use client';

import React from 'react';
import { BookOpen } from 'lucide-react';
import { APP_COPY } from '@/locales/en';

export const Header = () => {
    return (
        <header className="bg-white/80 backdrop-blur-md border-b border-[#E5E5E0] sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-[#414131] p-2 rounded-lg">
                        <BookOpen className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-[#1A1A1A]">{APP_COPY.header.title}</h1>
                        <p className="text-xs text-[#6B6B5F] hidden sm:block">{APP_COPY.header.subtitle}</p>
                    </div>
                </div>
            </div>
        </header>
    );
};
