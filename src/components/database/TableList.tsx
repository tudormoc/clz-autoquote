import { Surface } from '@/components/ui/Surface';
import { ViewLink } from '@/components/ui/ViewLink';
import type { ViewTarget } from '@/hooks/useAddress';
import { APP_COPY, fmt } from '@/locales';
import { titleClasses } from '@/components/ui/titleLook';
import { menuRowClasses } from '@/components/ui/MenuRow';

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
                        className={menuRowClasses({ selected: table === selected }, 'rounded', table !== selected && 'text-fg-muted')}
                    >
                        {table}
                    </ViewLink>
                ))}
            </div>
        </Surface>
    );
}
