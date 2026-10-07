import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';

interface TableListProps {
    tables: string[];
    selected: string | null;
    onSelect: (table: string) => void;
}

/** Tables of the chosen database, one click opens a table. */
export function TableList({ tables, selected, onSelect }: TableListProps) {
    return (
        <Card className="lg:col-span-1 p-4 h-[70vh] overflow-y-auto">
            <h2 className="font-semibold text-fg mb-4 sticky top-0 bg-card pb-2 border-b border-border">
                {fmt(APP_COPY.database.tables, { count: tables.length })}
            </h2>
            <div className="space-y-1">
                {tables.map((table) => (
                    <button
                        key={table}
                        type="button"
                        onClick={() => onSelect(table)}
                        className={cn(
                            'w-full text-left px-3 py-2 rounded text-sm transition-colors',
                            table === selected ? 'bg-muted text-primary font-medium' : 'text-fg-muted hover:bg-muted'
                        )}
                    >
                        {table}
                    </button>
                ))}
            </div>
        </Card>
    );
}
