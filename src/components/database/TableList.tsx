import { Surface } from '@/components/ui/Surface';
import { ViewLink } from '@/components/ui/ViewLink';
import type { ViewTarget } from '@/hooks/useAddress';
import { cn } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';
import { titleClasses } from '@/components/ui/titleLook';

interface TableListProps {
    tables: string[];
    selected: string | null;
    /** The link that opens a table */
    linkOf: (table: string) => ViewTarget;
}

/** Tables of the chosen database: each one is a link that opens it. */
export function TableList({ tables, selected, linkOf }: TableListProps) {
    return (
        <Surface className="lg:col-span-1 p-4 h-[70vh] overflow-y-auto">
            <h2 className={titleClasses('panel', 'mb-4 sticky top-0 bg-card pb-2 border-b border-border')}>
                {fmt(APP_COPY.database.tables, { count: tables.length })}
            </h2>
            <div className="space-y-1">
                {tables.map((table) => (
                    <ViewLink
                        key={table}
                        to={linkOf(table)}
                        aria-current={table === selected ? 'page' : undefined}
                        className={cn(
                            'block w-full text-left px-3 py-2 rounded text-sm transition-colors',
                            table === selected ? 'bg-muted text-primary font-medium' : 'text-fg-muted hover:bg-muted'
                        )}
                    >
                        {table}
                    </ViewLink>
                ))}
            </div>
        </Surface>
    );
}
