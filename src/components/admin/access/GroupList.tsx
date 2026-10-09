import type { Group } from '@/lib/auth/accounts';
import { cn } from '@/lib/utils';

interface GroupListProps {
    groups: Group[];
    /** Users per group id */
    members: Map<number, number>;
    selected: number | null;
    onSelect: (id: number) => void;
}

/** The groups to pick from, with how many users each has: a column on desktop, a row of chips on phones. */
export function GroupList({ groups, members, selected, onSelect }: GroupListProps) {
    return (
        <nav className="flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap lg:gap-0.5">
            {groups.map((group) => (
                <button
                    key={group.id}
                    type="button"
                    onClick={() => onSelect(group.id)}
                    aria-current={group.id === selected ? 'true' : undefined}
                    className={cn(
                        'flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm text-left transition-colors',
                        'max-lg:border max-lg:border-border',
                        group.id === selected ? 'bg-primary/10 text-primary font-medium max-lg:border-primary/40' : 'text-fg-secondary hover:bg-muted hover:text-fg'
                    )}
                >
                    <span className="truncate">{group.name}</span>
                    <span className="shrink-0 text-xs font-mono text-fg-muted">{members.get(group.id) ?? 0}</span>
                </button>
            ))}
        </nav>
    );
}
