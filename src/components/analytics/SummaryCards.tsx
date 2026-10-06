'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, BarChart3, Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { APP_COPY } from '@/locales';

interface SummaryItem {
    label: string | React.ReactNode;
    value: string | number;
    subItems?: { label: string | React.ReactNode; value: string | number }[];
}

interface SummaryCardsProps {
    items: SummaryItem[];
    loading?: boolean;
    onLoad: () => void;
    onCopy?: () => void;
}

export function SummaryCards({ items, loading, onLoad, onCopy }: SummaryCardsProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    const handleToggle = () => {
        if (!isVisible && !hasLoaded) {
            onLoad();
            setHasLoaded(true);
        }
        setIsVisible(!isVisible);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Button
                    onClick={handleToggle}
                    variant="secondary"
                    className="flex items-center gap-2"
                >
                    <BarChart3 size={16} />
                    {isVisible ? APP_COPY.analytics.common.hideSummary : APP_COPY.analytics.common.showSummary}
                    {isVisible ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </Button>

                {isVisible && onCopy && !loading && (
                    <Button
                        onClick={onCopy}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 border-border text-fg-muted hover:text-fg-strong"
                    >
                        <Copy size={14} />
                        {APP_COPY.analytics.common.copy}
                    </Button>
                )}
            </div>

            {isVisible && (
                <div className="bg-card border border-border rounded-lg p-4">
                    {loading ? (
                        <div className="text-center py-4 text-fg-muted">
                            {APP_COPY.analytics.common.loading}
                        </div>
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
                </div>
            )}
        </div>
    );
}
