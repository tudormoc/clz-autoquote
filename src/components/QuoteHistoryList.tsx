'use client';

import React from 'react';
import { Clock, History, Trash2 } from 'lucide-react';
import { APP_COPY } from '@/locales/en';
import type { Quote } from '@/types';

interface QuoteHistoryListProps {
    history: Quote[];
    onSelectQuote?: (quote: Quote) => void;
    onDeleteQuote?: (id: string) => void;
}

export const QuoteHistoryList = ({ history, onSelectQuote, onDeleteQuote }: QuoteHistoryListProps) => {
    return (
        <div className="space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <History className="h-4 w-4" />
                {APP_COPY.history.title}
            </h2>
            {history.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                    {history.slice(0, 5).map((quote) => (
                        <div
                            key={quote.id}
                            onClick={() => onSelectQuote?.(quote)}
                            className="bg-card border border-zinc-800 p-3 rounded-lg flex items-center justify-between group hover:border-primary transition-colors cursor-pointer"
                        >
                            <div>
                                <p className="font-semibold text-sm text-zinc-100 group-hover:text-primary transition-colors">
                                    {quote.book_name} {quote.customer_name && <span className="text-zinc-400 font-normal"> - {quote.customer_name}</span>}
                                </p>
                                <p className="text-xs text-zinc-500 font-mono">{quote.quantity} units • {quote.pages} pages • {quote.width}x{quote.height}mm</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <p className="text-xs text-zinc-500 flex items-center gap-1">
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
                                        className="text-zinc-500 hover:text-destructive transition-colors md:opacity-0 group-hover:opacity-100 p-1"
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
                <p className="text-sm text-zinc-500 italic">{APP_COPY.history.empty}</p>
            )}
        </div>
    );
};
