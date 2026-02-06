'use client';

import React from 'react';
import { Clock, History, Trash2 } from 'lucide-react';
import { APP_COPY } from '@/locales/en';
import type { Quote } from '@/types/database';

interface QuoteHistoryListProps {
    history: Quote[];
    onSelectQuote?: (quote: Quote) => void;
    onDeleteQuote?: (id: string) => void;
}

export const QuoteHistoryList = ({ history, onSelectQuote, onDeleteQuote }: QuoteHistoryListProps) => {
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
                                <p className="font-semibold text-sm group-hover:text-[#414131] transition-colors">
                                    {quote.book_name} {quote.customer_name && <span className="text-[#A1A19A] font-normal"> - {quote.customer_name}</span>}
                                </p>
                                <p className="text-xs text-[#6B6B5F]">{quote.quantity} units • {quote.pages} pages • {quote.width}x{quote.height}mm</p>
                            </div>
                            <div className="flex flex-col items-end">
                                <p className="text-xs text-[#A1A19A] flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(quote.created_at).toLocaleDateString()}
                                </p>
                                {onDeleteQuote && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('Are you sure you want to delete this quote?')) {
                                                onDeleteQuote(quote.id);
                                            }
                                        }}
                                        className="mt-2 text-[#A1A19A] hover:text-red-500 transition-colors md:opacity-0 group-hover:opacity-100 p-1"
                                        title="Delete quote"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
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
