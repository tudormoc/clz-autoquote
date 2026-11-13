'use client';

import { Spinner } from '@/components/ui/Spinner';
import { useEffect, useState } from 'react';
import { Layers } from '@/components/ui/icons';
import { BlueprintVisualizer, type BlueprintDimensions } from '@/components/quote/BlueprintVisualizer';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { APP_COPY } from '@/locales';
import { surfaceClasses } from '@/components/ui/Surface';
import { titleClasses } from '@/components/ui/titleLook';

const copy = APP_COPY.blueprint;

type Adjustable = 'bleed' | 'hingeGap' | 'turnIn';
const ADJUSTABLE: { key: Adjustable; label: string }[] = [
    { key: 'bleed', label: copy.bleed },
    { key: 'hingeGap', label: copy.hingeGap },
    { key: 'turnIn', label: copy.turnIn },
];

/**
 * Cover blueprint, opened in its own window by the quote form: it asks the opener for the book dimensions
 * (postMessage, same origin only), lets the user adjust bleed / hinge gap / turn-in and prints landscape.
 */
export default function BlueprintPage() {
    const [dimensions, setDimensions] = useState<BlueprintDimensions | null>(null);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (event.data?.type === 'BLUEPRINT_DATA') setDimensions(event.data.dimensions);
        };
        window.addEventListener('message', handleMessage);
        window.opener?.postMessage({ type: 'REQUEST_BLUEPRINT_DATA' }, window.location.origin);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    if (!dimensions) {
        return (
            <div className="h-screen bg-background text-fg flex items-center justify-center">
                <div className="text-center">
                    <Spinner size={48} className="mx-auto mb-4 text-primary" />
                    <p className="text-fg-muted">{copy.loading}</p>
                </div>
            </div>
        );
    }

    const bookSize: [string, string][] = [
        [copy.width, `${dimensions.boardWidth}mm`],
        [copy.height, `${dimensions.boardHeight}mm`],
        [copy.spine, `${dimensions.spineWidth.toFixed(1)}mm`],
    ];

    return (
        <>
            <style jsx global>{`
                @media print {
                    @page {
                        size: landscape;
                        margin: 0.5cm;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-full {
                        width: 100vw !important;
                        height: 100vh !important;
                        margin: 0 !important;
                        padding: 1cm !important;
                        background: white !important;
                    }
                    .print-full * {
                        background: white !important;
                    }
                }
            `}</style>

            <div className="h-screen bg-background text-fg flex overflow-hidden">
                <aside className={surfaceClasses('chrome', 'w-64 border-r p-4 flex flex-col gap-4 overflow-y-auto no-print')}>
                    <div className="space-y-3">
                        <h2 className={titleClasses('section')}>{copy.settings}</h2>
                        {ADJUSTABLE.map(({ key, label }) => (
                            <Field key={key} label={label}>
                                <Input
                                    type="number"
                                    value={dimensions[key]}
                                    onChange={(e) => setDimensions({ ...dimensions, [key]: Number(e.target.value) })}
                                    step="0.5"
                                    min="0"
                                    className="h-8"
                                />
                            </Field>
                        ))}
                    </div>

                    <div className="pt-3 border-t border-border">
                        <h3 className={titleClasses('label', 'mb-2')}>{copy.bookDimensions}</h3>
                        <div className="space-y-1 text-xs text-fg-subtle">
                            {bookSize.map(([label, value]) => (
                                <div key={label} className="flex justify-between">
                                    <span>{label}</span>
                                    <span className="font-mono text-fg-secondary">{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Button variant="secondary" size="sm" className="mt-auto" onClick={() => window.print()}>
                        {copy.print}
                    </Button>
                </aside>

                <main className="flex-1 overflow-hidden print-full">
                    <header className={surfaceClasses('bar', 'border-b no-print')}>
                        <div className="px-4 h-14 flex items-center gap-3">
                            <div className="bg-primary p-1 rounded text-primary-foreground">
                                <Layers size={20} strokeWidth={2.5} />
                            </div>
                            <h1 className={titleClasses('page')}>
                                {copy.title} <span className="text-primary font-mono">{copy.titleAccent}</span>
                            </h1>
                        </div>
                    </header>

                    <div className="h-[calc(100vh-3.5rem)] p-6">
                        <BlueprintVisualizer dimensions={dimensions} />
                    </div>
                </main>
            </div>
        </>
    );
}
