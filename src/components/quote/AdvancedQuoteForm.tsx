'use client';

import React from 'react';
import { useAdvancedQuote } from '@/hooks/useAdvancedQuote';
import { GeneralSection } from './sections/GeneralSection';
import { InternalSection } from './sections/InternalSection';
import { CoverSection } from './sections/CoverSection';
import { LiveBreakdown } from './LiveBreakdown';
import { Button } from '@/components/ui/Button';
import { QuoteHistoryList } from '@/components/QuoteHistoryList';
import { Quote } from '@/types';

export function AdvancedQuoteForm() {
    const {
        form,
        estimate,
        isSaving,
        saveError,
        history,
        signatureTypes,
        selectedQuoteId,
        resetToDefault,
        handleSave,
        handleDeleteQuote,
        selectQuote
    } = useAdvancedQuote();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pb-12">
            <div className="lg:col-span-7 space-y-4">
                <form onSubmit={handleSave} className="space-y-4">
                    <GeneralSection
                        control={form.control}
                        errors={form.formState.errors}
                        setValue={form.setValue}
                    />
                    <InternalSection
                        control={form.control}
                        errors={form.formState.errors}
                        setValue={form.setValue}
                        signatureTypes={signatureTypes}
                    />
                    <CoverSection control={form.control} errors={form.formState.errors} />

                    {saveError && (
                        <div className="text-destructive bg-destructive/10 p-3 rounded border border-destructive/20 text-sm">
                            {saveError}
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={resetToDefault}
                            className="sm:w-auto"
                        >
                            New Quote
                        </Button>
                        <Button type="submit" disabled={isSaving} className="sm:w-auto">
                            {isSaving ? 'Processing...' : (selectedQuoteId ? 'Update Quote' : 'Calculate Quote')}
                        </Button>
                    </div>
                </form>

                <div className="pt-8 border-t border-zinc-800">
                    <QuoteHistoryList
                        history={history}
                        onSelectQuote={selectQuote}
                        onDeleteQuote={handleDeleteQuote}
                    />
                </div>
            </div>

            <div className="lg:col-span-5">
                <div className="sticky top-20">
                    <LiveBreakdown breakdown={estimate} />
                </div>
            </div>
        </div>
    );
}
