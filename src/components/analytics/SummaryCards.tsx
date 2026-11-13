'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Copy } from '@/components/ui/icons';
import { FoldArrow } from '@/components/ui/FoldArrow';
import { Button } from '@/components/ui/Button';
import { APP_COPY } from '@/locales';
import type { SummaryStatus } from '@/hooks/useReportTable';
import { Surface } from '@/components/ui/Surface';
import { Fold } from '@/components/ui/Fold';

export interface SummaryItem {
    label: string | React.ReactNode;
    value: string | number;
    subItems?: { label: string | React.ReactNode; value: string | number }[];
}

interface SummaryCardsProps {
    items: SummaryItem[];
    status: SummaryStatus;
    /** Called when the panel is shown and its data is not loaded yet (also after the filters change) */
    onLoad: () => void;
    onCopy?: () => void;
    /** No filters applied yet: nothing to summarise */
    disabled?: boolean;
}

/** "Mostra Riepilogo": a collapsible panel of totals for the current report filters. */
export function SummaryCards({ items, status, onLoad, onCopy, disabled }: SummaryCardsProps) {
    const [isVisible, setIsVisible] = useState(false);
    const open = isVisible && !disabled;
    const copy = APP_COPY.common;

    useEffect(() => {
        if (open && status === 'idle') onLoad();
    }, [open, status, onLoad]);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Button onClick={() => setIsVisible(!isVisible)} variant="secondary" disabled={disabled}>
                    <BarChart3 size={16} />
                    {open ? copy.hideSummary : copy.showSummary}
                    <FoldArrow open={open} />
                </Button>

                {open && onCopy && status === 'ready' && (
                    <Button onClick={onCopy} variant="secondary" size="sm">
                        <Copy size={14} />
                        {copy.copy}
                    </Button>
                )}
            </div>

            <Fold open={open}>
                <Surface className="p-4">
                    {status === 'error' ? (
                        <div className="text-center py-4 text-danger">{copy.loadError}</div>
                    ) : status !== 'ready' ? (
                        <div className="text-center py-4 text-fg-muted">{copy.loading}</div>
                    ) : (
                        <div className="space-y-4">
                            {items.map((item, idx) => (
                                <div key={idx}>
                                    <div className="flex items-center justify-between gap-4 mb-2">
                                        <span
                                            className="text-sm font-medium text-fg-muted truncate flex-1"
                                            title={typeof item.label === 'string' ? item.label : undefined}
                                        >
                                            {item.label}
                                        </span>
                                        <span className="text-lg font-semibold text-fg-strong font-mono shrink-0">
                                            {item.value}
                                        </span>
                                    </div>
                                    {item.subItems && item.subItems.length > 0 && (
                                        <div className="ml-4 space-y-1 border-l-2 border-border pl-4">
                                            {item.subItems.map((subItem, subIdx) => (
                                                <div key={subIdx} className="flex items-center justify-between gap-4">
                                                    <span
                                                        className="text-xs text-fg-subtle truncate flex-1"
                                                        title={typeof subItem.label === 'string' ? subItem.label : undefined}
                                                    >
                                                        {subItem.label}
                                                    </span>
                                                    <span className="text-sm font-mono text-fg-secondary shrink-0">
                                                        {subItem.value}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </Surface>
            </Fold>
        </div>
    );
}
