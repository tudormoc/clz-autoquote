import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { APP_COPY } from '@/locales';

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

/** "Showing 1 to 100 of 213 records" with previous / next. Hidden when there is nothing to page. */
export function Pagination({ page, totalPages, total, pageSize, onPageChange, disabled }: PaginationProps) {
    if (total === 0) return null;
    const copy = APP_COPY.common;
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);

    return (
        <div className="flex items-center justify-between text-sm text-fg-muted">
            <div>
                {copy.showing} <Num>{from}</Num> {copy.to} <Num>{to}</Num> {copy.of} <Num>{total}</Num> {copy.records}
            </div>
            <div className="flex items-center gap-2">
                <Button variant="secondary" className="gap-1" onClick={() => onPageChange(page - 1)} disabled={page <= 1 || disabled}>
                    <ChevronLeft size={16} />
                    {copy.previous}
                </Button>
                <span>
                    {copy.page} <Num>{page}</Num> {copy.of} <Num>{totalPages}</Num>
                </span>
                <Button variant="secondary" className="gap-1" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages || disabled}>
                    {copy.next}
                    <ChevronRight size={16} />
                </Button>
            </div>
        </div>
    );
}
