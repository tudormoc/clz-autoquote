'use client';

import { useEffect, useRef } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { DataCards } from '@/components/ui/DataCards';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { APP_COPY } from '@/locales';
import { cn } from '@/lib/utils';
import type { SortState } from '@/hooks/useReportTable';

type Align = 'left' | 'right' | 'center';

export interface DataTableColumn<R> {
    /** Unique id; also the sort key (sent to the server, or used by useClientSort) */
    key: string;
    header: React.ReactNode;
    /** Tooltip on the header */
    headerTitle?: string;
    align?: Align;
    /** number: monospaced, right-aligned · total: the same, bold and bright */
    variant?: 'number' | 'total';
    /** Default true when the table can sort */
    sortable?: boolean;
    /** Narrow padding, for flag / icon columns */
    compact?: boolean;
    /** Classes for the header and every cell of the column (e.g. a width) */
    className?: string;
    /** Extra classes for the cells only */
    cellClassName?: string;
    /** Left out of the phone cards (details that only matter on a big screen) */
    mobileHidden?: boolean;
    /** Name in the phone cards when the header is not plain text */
    mobileLabel?: string;
    cell: (row: R, index: number) => React.ReactNode;
}

interface DataTableProps<R> {
    columns: DataTableColumn<R>[];
    rows: R[];
    getRowKey?: (row: R, index: number) => React.Key;
    getRowClassName?: (row: R) => string | undefined;
    sort?: SortState | null;
    onSort?: (column: string) => void;
    loading?: boolean;
    error?: string | null;
    /** Shown when there are no rows (e.g. "apply the filters" before the first search) */
    emptyMessage?: React.ReactNode;
    /** Totals row(s): <TableRow>s rendered in the table footer when there are rows (table layout only) */
    footer?: React.ReactNode;
    /** Keep every header and cell on one line (wide tables that scroll sideways) */
    nowrap?: boolean;
    /** Desktop: take the free height of a full-height page and scroll inside it, header always in view */
    fill?: boolean;
    /** Phones: one card per row (default), or the table scrolling sideways */
    mobile?: 'cards' | 'table';
    /** Phone cards: title of each card (default: the first column) */
    mobileTitle?: (row: R) => React.ReactNode;
    /** Phone cards: shown after the last card, e.g. the totals of `footer` */
    mobileFooter?: React.ReactNode;
}

const TEXT_ALIGN: Record<Align, string> = { left: 'text-left', right: 'text-right', center: 'text-center' };
const JUSTIFY: Record<Align, string> = { left: '', right: 'justify-end', center: 'justify-center' };
const VARIANT = {
    number: 'font-mono text-fg-secondary',
    total: 'font-mono text-fg-strong font-semibold',
};

function SortIcon({ active, direction }: { active: boolean; direction?: 'asc' | 'desc' }) {
    if (!active) return <ArrowUpDown size={14} className="opacity-50" />;
    return direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
}

/**
 * Column-driven table with sorting, loading, empty and error states and an optional totals footer.
 * On phones the same columns become one card per row (DataCards).
 */
export function DataTable<R>({
    columns,
    rows,
    getRowKey = (_row, index) => index,
    getRowClassName,
    sort,
    onSort,
    loading,
    error,
    emptyMessage = APP_COPY.common.noData,
    footer,
    nowrap,
    fill,
    mobile = 'cards',
    mobileTitle,
    mobileFooter,
}: DataTableProps<R>) {
    const table = useRef<HTMLTableElement>(null);
    const alignOf = (column: DataTableColumn<R>): Align => column.align ?? (column.variant ? 'right' : 'left');
    const cards = mobile === 'cards';

    // New rows (another page, another order) start from the top of a table that scrolls inside
    useEffect(() => {
        table.current?.parentElement?.scrollTo({ top: 0 });
    }, [rows]);

    const message = error
        ? <span className="text-danger">{`${APP_COPY.common.loadError}: ${error}`}</span>
        : rows.length === 0
            ? loading ? APP_COPY.common.loading : emptyMessage
            : null;

    return (
        <div
            className={cn('bg-card border border-border rounded-lg overflow-hidden', fill && 'lg:flex-1 lg:min-h-80 lg:flex lg:flex-col')}
        >
            {cards && (
                <div className="md:hidden">
                    <DataCards
                        columns={columns}
                        rows={rows}
                        getRowKey={getRowKey}
                        getRowClassName={getRowClassName}
                        sort={sort}
                        onSort={onSort}
                        message={message}
                        dimmed={loading && rows.length > 0}
                        title={mobileTitle}
                        footer={mobileFooter}
                    />
                </div>
            )}
            <Table
                ref={table}
                className={cn(nowrap && 'whitespace-nowrap')}
                containerClassName={cn(cards && 'hidden md:block', fill && 'lg:flex-1 lg:min-h-0 lg:overflow-y-auto')}
            >
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        {columns.map((column) => {
                            const align = alignOf(column);
                            const sortable = !!onSort && column.sortable !== false;
                            const sorted = sort?.column === column.key;
                            return (
                                <TableHead
                                    key={column.key}
                                    title={column.headerTitle}
                                    aria-sort={sorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                                    className={cn(TEXT_ALIGN[align], column.compact && 'px-2', column.className)}
                                >
                                    {sortable ? (
                                        <button
                                            type="button"
                                            onClick={() => onSort(column.key)}
                                            className={cn('w-full flex items-center gap-2 font-semibold hover:text-primary transition-colors', JUSTIFY[align])}
                                        >
                                            {column.header}
                                            <SortIcon active={sorted} direction={sort?.direction} />
                                        </button>
                                    ) : (
                                        <div className={cn('flex items-center gap-2', JUSTIFY[align])}>{column.header}</div>
                                    )}
                                </TableHead>
                            );
                        })}
                    </TableRow>
                </TableHeader>
                <TableBody className={cn(loading && rows.length > 0 && 'opacity-50 transition-opacity')}>
                    {message ? (
                        <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={columns.length} className="py-8 text-center text-fg-muted">
                                {message}
                            </TableCell>
                        </TableRow>
                    ) : (
                        rows.map((row, index) => (
                            <TableRow key={getRowKey(row, index)} className={getRowClassName?.(row)}>
                                {columns.map((column) => (
                                    <TableCell
                                        key={column.key}
                                        className={cn(
                                            'text-sm',
                                            TEXT_ALIGN[alignOf(column)],
                                            column.variant && VARIANT[column.variant],
                                            column.compact && 'px-2',
                                            column.className,
                                            column.cellClassName
                                        )}
                                    >
                                        {column.cell(row, index)}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    )}
                </TableBody>
                {footer && !error && rows.length > 0 && <TableFooter>{footer}</TableFooter>}
            </Table>
        </div>
    );
}
