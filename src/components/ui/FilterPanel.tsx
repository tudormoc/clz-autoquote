import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { APP_COPY } from '@/locales';
import { cn } from '@/lib/utils';

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
}

/** Filter box of a report or list: fields, then Apply / Clear and the page actions. Enter applies. */
export function FilterPanel({ children, columns = 4, onApply, onClear, buttons, actions }: FilterPanelProps) {
    return (
        <form
            className="bg-card border border-border rounded-lg p-4"
            onSubmit={(e) => {
                e.preventDefault();
                onApply();
            }}
        >
            <div className={cn('grid grid-cols-1 gap-4', GRID[columns])}>{children}</div>
            <div className="flex gap-2 mt-4">
                <Button type="submit">
                    <Search size={16} />
                    {APP_COPY.common.apply}
                </Button>
                {buttons}
                <Button type="button" variant="secondary" onClick={onClear}>
                    <X size={16} />
                    {APP_COPY.common.clear}
                </Button>
                {actions && <div className="flex gap-2 ml-auto">{actions}</div>}
            </div>
        </form>
    );
}
