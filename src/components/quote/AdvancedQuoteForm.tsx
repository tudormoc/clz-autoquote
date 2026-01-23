'use client';

import React from 'react';
import { useAdvancedQuote } from '@/hooks/useAdvancedQuote';
import { GeneralSection } from './sections/GeneralSection';
import { InternalSection } from './sections/InternalSection';
import { CoverSection } from './sections/CoverSection';
import { LiveBreakdown } from './LiveBreakdown';
import { Button } from '@/components/ui/Button';
import { QuoteHistoryList } from '@/components/QuoteHistoryList';
import { Quote } from '@/types/database';

export function AdvancedQuoteForm() {
    const { form, estimate, isSaving, saveError, history, resetToDefault, handleSave } = useAdvancedQuote();

    const handleSelectQuote = (quote: Quote) => {
        // Populate form from history
        if (quote.specifications) {
            // If we have full specs, use them. 
            // We cast because DB JSON type is generic, ensuring it matches QuoteInput is up to us.
            form.reset(quote.specifications as any);
        } else {
            // Backward compatibility for old quotes
            form.reset({
                project_title: quote.book_name,
                client_name: quote.customer_email || undefined,
                quantity: quote.quantity,
                format: { width: Number(quote.width), height: Number(quote.height) },
                pages: quote.pages,
                cover_details: {
                    type: 'hardcover',
                    spine_type: 'square',
                    board_thickness: 2.5,
                    headbands_enabled: false,
                    finishings: []
                },
                internals: {
                    sheet_width: 700,
                    sheet_height: 1000,
                    endpapers_enabled: false
                }
            } as any);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">
            <div className="lg:col-span-8 space-y-8">
                <form onSubmit={handleSave} className="space-y-6">
                    <GeneralSection control={form.control} errors={form.formState.errors} />
                    <InternalSection control={form.control} errors={form.formState.errors} />
                    <CoverSection control={form.control} errors={form.formState.errors} />

                    {saveError && (
                        <div className="text-red-500 bg-red-50 p-4 rounded border border-red-200">
                            {saveError}
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row justify-end gap-4 pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={resetToDefault}
                            className="w-full md:w-auto min-w-[150px] h-12 text-lg bg-white border-[#E5E5E0] text-[#6B6B5F] hover:bg-gray-50"
                        >
                            New Quote
                        </Button>
                        <Button type="submit" disabled={isSaving} className="w-full md:w-auto min-w-[200px] h-12 text-lg">
                            {isSaving ? 'Processing...' : 'Calculate Quote'}
                        </Button>
                    </div>
                </form>

                <div className="pt-12 border-t border-gray-100">
                    <QuoteHistoryList history={history} onSelectQuote={handleSelectQuote} />
                </div>
            </div>

            <div className="lg:col-span-4">
                <div className="sticky top-20">
                    <LiveBreakdown breakdown={estimate} />
                </div>
            </div>
        </div>
    );
}
