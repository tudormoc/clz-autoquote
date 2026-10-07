import { APP_COPY } from '@/locales';

interface RecordCountProps {
    count: number;
    /** Shown on the right (a hint, a status badge …) */
    children?: React.ReactNode;
}

/** "42 record" above a list that shows all its rows (paged lists use Pagination). */
export function RecordCount({ count, children }: RecordCountProps) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-fg-muted">
            <span>
                <span className="text-fg-strong font-mono">{count}</span> {APP_COPY.common.records}
            </span>
            {children}
        </div>
    );
}
