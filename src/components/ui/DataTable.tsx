import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
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
    /** Totals row(s): <TableRow>s rendered in the table footer when there are rows */
    footer?: React.ReactNode;
    /** Keep every header and cell on one line (wide tables that scroll sideways) */
    nowrap?: boolean;
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

/** Column-driven table with sorting, loading, empty and error states and an optional totals footer. */
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
}: DataTableProps<R>) {
    const alignOf = (column: DataTableColumn<R>): Align => column.align ?? (column.variant ? 'right' : 'left');
    const statusRow = (content: React.ReactNode, tone = 'text-fg-muted') => (
        <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columns.length} className={cn('py-8 text-center', tone)}>
                {content}
            </TableCell>
        </TableRow>
    );

    return (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
            <Table className={cn(nowrap && 'whitespace-nowrap')}>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        {columns.map((column) => {
                            const align = alignOf(column);
                            const sortable = !!onSort && column.sortable !== false;
                            return (
                                <TableHead
                                    key={column.key}
                                    title={column.headerTitle}
                                    className={cn(
                                        TEXT_ALIGN[align],
                                        column.compact && 'px-2',
                                        sortable && 'cursor-pointer hover:text-primary transition-colors',
                                        column.className
                                    )}
                                    onClick={sortable ? () => onSort(column.key) : undefined}
                                >
                                    <div className={cn('flex items-center gap-2', JUSTIFY[align])}>
                                        {column.header}
                                        {sortable && <SortIcon active={sort?.column === column.key} direction={sort?.direction} />}
                                    </div>
                                </TableHead>
                            );
                        })}
                    </TableRow>
                </TableHeader>
                <TableBody className={cn(loading && rows.length > 0 && 'opacity-50 transition-opacity')}>
                    {error
                        ? statusRow(`${APP_COPY.common.loadError}: ${error}`, 'text-danger')
                        : rows.length === 0
                            ? statusRow(loading ? APP_COPY.common.loading : emptyMessage)
                            : rows.map((row, index) => (
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
                            ))}
                </TableBody>
                {footer && !error && rows.length > 0 && <TableFooter>{footer}</TableFooter>}
            </Table>
        </div>
    );
}
