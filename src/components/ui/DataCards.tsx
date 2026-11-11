import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { CardField } from '@/components/ui/CardField';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { opensElsewhere } from '@/components/ui/ViewLink';
import type { ViewTarget } from '@/hooks/useAddress';
import type { SortState } from '@/lib/sort';
import { APP_COPY } from '@/locales';
import { cn } from '@/lib/utils';

interface DataCardsProps<R> {
    columns: DataTableColumn<R>[];
    rows: R[];
    getRowKey: (row: R, index: number) => React.Key;
    getRowClassName?: (row: R) => string | undefined;
    /** The view a card opens (see rowLinkProps) */
    rowLink?: (row: R) => ViewTarget;
    /** More about a row, shown at the foot of its card */
    rowDetail?: (row: R) => React.ReactNode;
    sort?: SortState | null;
    onSort?: (column: string) => void;
    /** Shown instead of the cards (loading, error, nothing found) */
    message?: React.ReactNode;
    dimmed?: boolean;
    /** Title of each card; default: the first column */
    title?: (row: R) => React.ReactNode;
    /** After the last card (totals) */
    footer?: React.ReactNode;
}

/** Name of a column in a card: its header, or its tooltip when the header is only a symbol */
export function columnLabel<R>(column: DataTableColumn<R>): React.ReactNode {
    if (column.mobileLabel) return column.mobileLabel;
    if (typeof column.header === 'string' && /[A-Za-zÀ-ÿ]/.test(column.header)) return column.header;
    return column.headerTitle ?? column.header;
}

/** Clicks that belong to something inside the row: its own links, buttons and fields act for themselves */
const ownControl = (event: React.SyntheticEvent) => event.defaultPrevented || (event.target as HTMLElement).closest('a, button, input, select, textarea, label') !== null;

/**
 * What makes a whole table row or phone card follow its link (`rowLink`): a click anywhere on it opens the view in
 * place, the middle button or Ctrl + click opens it in a new tab, Enter opens it while the row has the focus.
 * The row's main cell shows the same link as a real one (ViewLink), for "copy link" and the keyboard.
 */
export function rowLinkProps(to: ViewTarget | undefined): React.HTMLAttributes<HTMLElement> {
    if (!to) return {};
    const newTab = () => window.open(to.href, '_blank', 'noopener');
    return {
        tabIndex: 0,
        onClick: (event) => {
            if (ownControl(event)) return;
            if (opensElsewhere(event)) newTab();
            else to.onOpen();
        },
        // The middle button: no scrolling by dragging, a new tab instead
        onMouseDown: (event) => {
            if (event.button === 1 && !ownControl(event)) event.preventDefault();
        },
        onAuxClick: (event) => {
            if (event.button === 1 && !ownControl(event)) newTab();
        },
        onKeyDown: (event) => {
            if (event.key === 'Enter' && event.target === event.currentTarget) to.onOpen();
        },
    };
}

/**
 * The rows of a DataTable on a phone: one card per row, the first column (or `title`) as its title and the others
 * as label / value lines, with a sort picker on top. Built from the same columns as the table.
 */
export function DataCards<R>({ columns, rows, getRowKey, getRowClassName, rowLink, rowDetail, sort, onSort, message, dimmed, title, footer }: DataCardsProps<R>) {
    const shown = columns.filter((column) => !column.mobileHidden);
    const [first, ...rest] = shown;
    const details = title ? shown : rest;
    const sortable = onSort ? columns.filter((column) => column.sortable !== false) : [];
    const copy = APP_COPY.common;
    const detail = (row: R) => {
        const content = rowDetail?.(row);
        return content ? <div className="px-3 pb-3">{content}</div> : null;
    };

    return (
        <div>
            {sortable.length > 0 && onSort && (
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border text-sm">
                    <ArrowUpDown size={14} className="shrink-0 text-fg-muted" />
                    <select
                        value={sort?.column ?? ''}
                        onChange={(e) => onSort(e.target.value)}
                        aria-label={copy.sortBy}
                        className="flex-1 min-w-0 bg-transparent text-fg focus-visible:outline-none"
                    >
                        {!sort && <option value="">{copy.sortBy}</option>}
                        {sortable.map((column) => (
                            <option key={column.key} value={column.key}>
                                {String(columnLabel(column))}
                            </option>
                        ))}
                    </select>
                    {sort && (
                        <button
                            type="button"
                            onClick={() => onSort(sort.column)}
                            aria-label={sort.direction === 'asc' ? copy.sortDescending : copy.sortAscending}
                            className="p-2 -m-1 rounded text-fg-muted hover:text-fg hover:bg-muted transition-colors"
                        >
                            {sort.direction === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                        </button>
                    )}
                </div>
            )}

            {message ? (
                <div className="px-4 py-8 text-center text-sm text-fg-muted">{message}</div>
            ) : (
                <ul className={cn('divide-y divide-border', dimmed && 'opacity-50 transition-opacity')}>
                    {rows.map((row, index) => (
                        <li key={getRowKey(row, index)} className={cn('text-sm', getRowClassName?.(row))}>
                            <div className={cn('px-3 py-3', rowLink && 'cursor-pointer')} {...rowLinkProps(rowLink?.(row))}>
                                <div className="min-w-0 mb-1.5">{title ? title(row) : first?.cell(row, index)}</div>
                                <dl className="space-y-1">
                                    {details.map((column) => (
                                        <CardField key={column.key} label={columnLabel(column)} variant={column.variant}>
                                            {column.cell(row, index)}
                                        </CardField>
                                    ))}
                                </dl>
                            </div>
                            {detail(row)}
                        </li>
                    ))}
                </ul>
            )}
            {!message && footer && <div className="border-t border-border">{footer}</div>}
        </div>
    );
}
