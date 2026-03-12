'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface SummaryItem {
    label: string;
    value: string | number;
    subItems?: { label: string; value: string | number }[];
}

interface SummaryCardsProps {
    items: SummaryItem[];
    loading?: boolean;
    onLoad: () => void;
}

export function SummaryCards({ items, loading, onLoad }: SummaryCardsProps) {
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
            <Button
                onClick={handleToggle}
                variant="secondary"
                className="flex items-center gap-2"
            >
                <BarChart3 size={16} />
                {isVisible ? 'Hide Summary' : 'Show Summary'}
                {isVisible ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </Button>

            {isVisible && (
                <div className="bg-card border border-zinc-800 rounded-lg p-4">
                    {loading ? (
                        <div className="text-center py-4 text-zinc-400">
                            Loading summary...
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {items.map((item, idx) => (
                                <div key={idx}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-zinc-400">
                                            {item.label}
                                        </span>
                                        <span className="text-lg font-semibold text-white font-mono">
                                            {item.value}
                                        </span>
                                    </div>
                                    {item.subItems && item.subItems.length > 0 && (
                                        <div className="ml-4 space-y-1 border-l-2 border-zinc-800 pl-4">
                                            {item.subItems.map((subItem, subIdx) => (
                                                <div key={subIdx} className="flex items-center justify-between">
                                                    <span className="text-xs text-zinc-500">
                                                        {subItem.label}
                                                    </span>
                                                    <span className="text-sm font-mono text-zinc-300">
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
