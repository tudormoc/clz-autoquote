'use client';

import React from 'react';
import { Clock, History, Trash2 } from 'lucide-react';
import { ViewLink } from '@/components/ui/ViewLink';
import type { ViewTarget } from '@/hooks/useAddress';
import { confirmDelete } from '@/lib/confirm';
import { APP_COPY, fmt } from '@/locales';
import type { Quote } from '@/types';
import { formatDate } from '@/lib/format';

interface QuoteHistoryListProps {
    history: Quote[];
    /** The link that opens a saved quote in the form */
    linkOf: (quote: Quote) => ViewTarget;
    onDeleteQuote?: (id: string) => void;
}

export const QuoteHistoryList = ({ history, linkOf, onDeleteQuote }: QuoteHistoryListProps) => {
    return (
        <div className="space-y-4">
            <h2 className="text-sm font-semibold text-fg-strong flex items-center gap-2">
                <History className="h-4 w-4" />
                {APP_COPY.history.title}
            </h2>
            {history.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                    {history.slice(0, 5).map((quote) => (
                        <div
                            key={quote.id}
                            className="relative bg-card border border-border p-3 rounded-lg flex items-center justify-between group hover:border-primary transition-colors"
                        >
                            {/* The link covers the whole card (after:inset-0); the delete button sits above it */}
                            <ViewLink to={linkOf(quote)} className="after:absolute after:inset-0 after:content-['']">
                                <p className="font-semibold text-sm text-fg group-hover:text-primary transition-colors">
                                    {quote.book_name} {quote.customer_name && <span className="text-fg-muted font-normal"> - {quote.customer_name}</span>}
                                </p>
                                <p className="text-xs text-fg-subtle font-mono">{fmt(APP_COPY.history.specs, { quantity: quote.quantity, pages: quote.pages, width: quote.width, height: quote.height })}</p>
                            </ViewLink>
                            <div className="flex flex-col items-end gap-2">
                                <p className="text-xs text-fg-subtle flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDate(quote.created_at)}
                                </p>
                                {onDeleteQuote && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (await confirmDelete(APP_COPY.history.deleteConfirm)) {
                                                onDeleteQuote(quote.id);
                                            }
                                        }}
                                        className="relative z-10 text-fg-subtle hover:text-danger transition-colors md:opacity-0 group-hover:opacity-100 p-1"
                                        title={APP_COPY.common.delete}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-fg-subtle italic">{APP_COPY.history.empty}</p>
            )}
        </div>
    );
};
