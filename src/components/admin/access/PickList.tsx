import { cn } from '@/lib/utils';

export interface PickItem {
    id: number;
    label: string;
    /** A number after the name (a group's users) */
    count?: number;
    /** A short warning after the name ("sospeso") */
    note?: string;
}

interface PickListProps {
    items: PickItem[];
    selected: number | null;
    onSelect: (id: number) => void;
}

/** The groups or users to pick from (Gruppi / Utenti): a column on desktop, a row of chips on phones. */
export function PickList({ items, selected, onSelect }: PickListProps) {
    return (
        <nav className="flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap lg:gap-0.5">
            {items.map((item) => (
                <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    aria-current={item.id === selected ? 'true' : undefined}
                    className={cn(
                        'flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm text-left transition-colors',
                        'max-lg:border max-lg:border-border',
                        item.id === selected ? 'bg-primary/10 text-primary font-medium max-lg:border-primary/40' : 'text-fg-secondary hover:bg-muted hover:text-fg'
                    )}
                >
                    <span className="truncate">{item.label}</span>
                    {item.note && <span className="shrink-0 text-xs font-normal text-warning-300">{item.note}</span>}
                    {item.count !== undefined && <span className="shrink-0 text-xs font-mono text-fg-muted">{item.count}</span>}
                </button>
            ))}
        </nav>
    );
}
