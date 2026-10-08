import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { APP_COPY, fmt } from '@/locales';
import { formatNumber } from '@/lib/format';

interface PaginationProps {
    page: number;
    totalPages: number;
    total: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    disabled?: boolean;
}

const Num = ({ children }: { children: React.ReactNode }) => (
    <span className="text-fg-strong font-mono">{children}</span>
);

/**
 * "Showing 1 to 100 of 213 records" with previous / next; on phones "1–100 di 213" and arrow buttons.
 * Hidden when there is nothing to page.
 */
export function Pagination({ page, totalPages, total, pageSize, onPageChange, disabled }: PaginationProps) {
    if (total === 0) return null;
    const copy = APP_COPY.common;
    const from = formatNumber((page - 1) * pageSize + 1);
    const to = formatNumber(Math.min(page * pageSize, total));
    const count = formatNumber(total);

    return (
        <div className="flex items-center justify-between gap-3 text-sm text-fg-muted">
            <div className="min-w-0">
                <span className="sm:hidden">{fmt(copy.rangeShort, { from, to, total: count })}</span>
                <span className="hidden sm:inline">
                    {copy.showing} <Num>{from}</Num> {copy.to} <Num>{to}</Num> {copy.of} <Num>{count}</Num> {copy.records}
                </span>
            </div>
            {totalPages > 1 && (
                <div className="flex items-center gap-2 shrink-0">
                    <Button
                        variant="secondary"
                        className="gap-1 max-sm:px-2.5"
                        onClick={() => onPageChange(page - 1)}
                        disabled={page <= 1 || disabled}
                        aria-label={copy.previous}
                    >
                        <ChevronLeft size={16} />
                        <span className="hidden sm:inline">{copy.previous}</span>
                    </Button>
                    <span className="whitespace-nowrap">
                        <span className="hidden sm:inline">{copy.page} </span>
                        <Num>{page}</Num> {copy.of} <Num>{totalPages}</Num>
                    </span>
                    <Button
                        variant="secondary"
                        className="gap-1 max-sm:px-2.5"
                        onClick={() => onPageChange(page + 1)}
                        disabled={page >= totalPages || disabled}
                        aria-label={copy.next}
                    >
                        <span className="hidden sm:inline">{copy.next}</span>
                        <ChevronRight size={16} />
                    </Button>
                </div>
            )}
        </div>
    );
}
