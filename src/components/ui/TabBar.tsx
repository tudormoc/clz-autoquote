import { cn } from '@/lib/utils';

export interface TabItem<K extends string> {
    id: K;
    label: React.ReactNode;
    icon?: React.ReactNode;
    /** Number shown after the label */
    count?: number;
    /** Anything else shown after the label (a warning, a check) instead of a count */
    badge?: React.ReactNode;
}

interface TabBarProps<K extends string> {
    tabs: TabItem<K>[];
    active: K;
    onChange: (id: K) => void;
    className?: string;
}

/** Row of tabs with an underline on the open one; a tab can carry a count or a small badge. */
export function TabBar<K extends string>({ tabs, active, onChange, className }: TabBarProps<K>) {
    return (
        <div className={cn('flex items-center gap-1 overflow-x-auto', className)}>
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    onClick={() => onChange(tab.id)}
                    className={cn(
                        'flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-semibold whitespace-nowrap border-b-2 transition-colors',
                        active === tab.id ? 'border-primary text-fg-strong bg-muted/60' : 'border-transparent text-fg-muted hover:text-fg-soft hover:bg-muted/30'
                    )}
                >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.count !== undefined && <span className="text-3xs px-1.5 rounded-full bg-muted text-fg-secondary">{tab.count}</span>}
                    {tab.badge}
                </button>
            ))}
        </div>
    );
}
