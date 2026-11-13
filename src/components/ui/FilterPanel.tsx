'use client';

import { useState } from 'react';
import { Search, SlidersHorizontal, X } from '@/components/ui/icons';
import { FoldArrow } from '@/components/ui/FoldArrow';
import { Button } from '@/components/ui/Button';
import { APP_COPY } from '@/locales';
import { cn } from '@/lib/utils';
import { surfaceClasses } from '@/components/ui/Surface';
import { Pressable } from '@/components/ui/Pressable';
import { StatusBadge } from '@/components/ui/StatusBadge';

export type FilterColumns = 1 | 2 | 3 | 4 | 5;

const GRID: Record<FilterColumns, string> = {
    1: '',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-2 lg:grid-cols-4',
    5: 'md:grid-cols-2 lg:grid-cols-5',
};

interface FilterPanelProps {
    /** The filter fields, laid out in a grid */
    children: React.ReactNode;
    columns?: FilterColumns;
    onApply: () => void;
    onClear: () => void;
    /** Extra buttons between "Apply" and "Clear" (toggles …) */
    buttons?: React.ReactNode;
    /** Buttons on the right (export, PDF …) */
    actions?: React.ReactNode;
    /** Full-width rows under the fields (toggle chips …) */
    below?: React.ReactNode;
    /** Filters set apart from the defaults, counted on the folded phone bar */
    activeCount?: number;
}

/**
 * Filter box of a report or list: fields, then Apply / Clear and the page actions. Enter applies.
 * On phones and tablets it starts open and folds into one "Filtri" bar once applied, so the results come first.
 */
export function FilterPanel({ children, columns = 4, onApply, onClear, buttons, actions, below, activeCount = 0 }: FilterPanelProps) {
    const [open, setOpen] = useState(true);
    const copy = APP_COPY.common;

    return (
        <form
            className={surfaceClasses('panel')}
            onSubmit={(e) => {
                e.preventDefault();
                onApply();
                setOpen(false);
            }}
        >
            <Pressable
                type="button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                className="lg:hidden w-full flex items-center gap-2 px-4 h-12 text-sm font-medium text-fg"
            >
                <SlidersHorizontal size={16} className="text-fg-muted" />
                {copy.filters}
                {activeCount > 0 && (
                    <StatusBadge tone="info" mono>
                        {activeCount}
                    </StatusBadge>
                )}
                <FoldArrow open={open} className="ml-auto text-fg-muted" />
            </Pressable>

            <div className={cn('p-4 lg:block', open ? 'block border-t border-border lg:border-t-0' : 'hidden')}>
                <div className={cn('grid grid-cols-1 gap-4', GRID[columns])}>{children}</div>
                {below && <div className="mt-4 pt-4 border-t border-border space-y-4">{below}</div>}
                <div className="flex flex-wrap gap-2 mt-4">
                    <Button type="submit">
                        <Search size={16} />
                        {copy.apply}
                    </Button>
                    {buttons}
                    <Button type="button" variant="secondary" onClick={onClear}>
                        <X size={16} />
                        {copy.clear}
                    </Button>
                    {actions && <div className="flex flex-wrap items-center gap-2 lg:ml-auto">{actions}</div>}
                </div>
            </div>
        </form>
    );
}
