'use client';

import React, { useRef } from 'react';
import { useAdvancedQuote } from '@/hooks/useAdvancedQuote';
import { GeneralSection } from './sections/GeneralSection';
import { InternalSection } from './sections/InternalSection';
import { CoverSection } from './sections/CoverSection';
import { LiveBreakdown } from './LiveBreakdown';
import { Button } from '@/components/ui/Button';
import { QuoteHistoryList } from '@/components/QuoteHistoryList';
import { Quote } from '@/types';
import { APP_COPY } from '@/locales';
import { APP_CONFIG } from '@/config/constants';
import { calculateBlockThickness } from '@/lib/pricing/formulas/block';
import { Layers } from 'lucide-react';

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

    const blueprintWindowRef = useRef<Window | null>(null);

    const handleBlueprintPreview = () => {
        const values = form.getValues();

        // Calculate spine width using block thickness + board thickness
        const blockThickness = calculateBlockThickness(values);
        const spineWidth = blockThickness + (values.cover_details?.board_thickness || APP_CONFIG.DEFAULTS.BOARD_THICKNESS);

        const blueprintData = {
            boardWidth: values.format?.width || APP_CONFIG.DEFAULTS.WIDTH,
            boardHeight: values.format?.height || APP_CONFIG.DEFAULTS.HEIGHT,
            spineWidth: spineWidth,
            hingeGap: APP_CONFIG.BLUEPRINT.HINGE_GAP,
            turnIn: APP_CONFIG.BLUEPRINT.TURN_IN,
            bleed: APP_CONFIG.BLUEPRINT.BLEED,
        };

        // Open blueprint in new window
        const blueprintWindow = window.open('/blueprint', 'blueprint', 'width=1200,height=800');
        blueprintWindowRef.current = blueprintWindow;

        // Send data when window is ready
        if (blueprintWindow) {
            const sendData = () => {
                blueprintWindow.postMessage({
                    type: 'BLUEPRINT_DATA',
                    dimensions: blueprintData
                }, '*');
            };

            // Listen for data request from blueprint window
            const handleMessage = (event: MessageEvent) => {
                if (event.data.type === 'REQUEST_BLUEPRINT_DATA' && event.source === blueprintWindow) {
                    sendData();
                }
            };

            window.addEventListener('message', handleMessage);

            // Also send immediately in case window loads fast
            setTimeout(sendData, 100);

            // Cleanup
            const checkClosed = setInterval(() => {
                if (blueprintWindow.closed) {
                    window.removeEventListener('message', handleMessage);
                    clearInterval(checkClosed);
                    blueprintWindowRef.current = null;
                }
            }, 500);
        }
    };

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
                        <div className="text-danger bg-danger/10 p-3 rounded border border-danger/20 text-sm">
                            {saveError}
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleBlueprintPreview}
                            className="sm:w-auto"
                        >
                            <Layers size={16} className="mr-2" />
                            {APP_COPY.form.blueprintButton}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={resetToDefault}
                            className="sm:w-auto"
                        >
                            {APP_COPY.form.newQuote}
                        </Button>
                        <Button type="submit" disabled={isSaving} className="sm:w-auto">
                            {isSaving ? APP_COPY.form.processing : (selectedQuoteId ? APP_COPY.form.updateQuote : APP_COPY.form.calculateQuote)}
                        </Button>
                    </div>
                </form>

                <div className="pt-8 border-t border-border">
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
