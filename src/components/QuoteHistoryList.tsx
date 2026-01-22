'use client';

import React from 'react';
import { Clock, History } from 'lucide-react';
import { APP_COPY } from '@/locales/en';
import type { Quote } from '@/types/database';

interface QuoteHistoryListProps {
    history: Quote[];
    onSelectQuote?: (quote: Quote) => void;
}

export const QuoteHistoryList = ({ history, onSelectQuote }: QuoteHistoryListProps) => {
    return (
        <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[#414131] flex items-center gap-2 uppercase tracking-widest">
                <History className="h-4 w-4 opacity-70" />
                {APP_COPY.history.title}
            </h2>
            {history.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                    {history.slice(0, 5).map((quote) => (
                        <div
                            key={quote.id}
                            onClick={() => onSelectQuote?.(quote)}
                            className="bg-white border border-[#E5E5E0] p-4 rounded-lg flex items-center justify-between group hover:border-[#414131] transition-colors cursor-pointer"
                        >
                            <div>
                                <p className="font-semibold text-sm group-hover:text-[#414131] transition-colors">{quote.book_name}</p>
                                <p className="text-xs text-[#6B6B5F]">{quote.quantity} units • {quote.pages} pages • {quote.width}x{quote.height}mm</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-[#A1A19A] flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(quote.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-[#A1A19A] italic">{APP_COPY.history.empty}</p>
            )}
        </div>
    );
};
