'use client';

import { errorMessage } from '@/lib/utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_CONFIG } from '@/config/constants';
import { nextSort, type SortState } from '@/lib/sort';

export type { SortState };

/** Shape returned by every paginated analytics server action */
export interface PageResult<R> {
    success: boolean;
    data: R[];
    pagination?: { total: number; totalPages: number };
    error?: string | null;
}

export type SummaryStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PageQuery<F> {
    filters: F;
    page: number;
    limit: number;
    /** null when the report has no default order and the user has not sorted yet */
    sort: SortState | null;
}

interface UseReportTableOptions<F, R, S> {
    /** Fresh filter values (called again by "Pulisci", so dates are recomputed) */
    initialFilters: () => F;
    defaultSort: SortState | null;
    fetchPage: (query: PageQuery<F>) => Promise<PageResult<R>>;
    /** Optional summary panel data, loaded on demand for the applied filters */
    fetchSummary?: (filters: F) => Promise<{ success: boolean; data?: S | null }>;
    /** Load straight away with the initial filters instead of waiting for "Applica" */
    autoApply?: boolean;
    pageSize?: number;
}

/** Row limit when every row is fetched (exports, summaries): no paging */
export const EXPORT_LIMIT = APP_CONFIG.ANALYTICS.ALL_ROWS_LIMIT;
const DEFAULT_PAGE_SIZE = 100;

/**
 * State and loading logic shared by every paginated report:
 * filters (edited vs applied), paging, server-side sorting, stale-response protection,
 * export of all rows and the optional summary panel.
 */
export function useReportTable<F, R, S = never>({
    initialFilters,
    defaultSort,
    fetchPage,
    fetchSummary,
    autoApply = false,
    pageSize = DEFAULT_PAGE_SIZE,
}: UseReportTableOptions<F, R, S>) {
    const [filters, setFilters] = useState<F>(initialFilters);
    const [applied, setApplied] = useState<F | null>(() => (autoApply ? initialFilters() : null));
    const [sort, setSort] = useState<SortState | null>(defaultSort);
    const [page, setPage] = useState(1);

    const [rows, setRows] = useState<R[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(autoApply);
    const [error, setError] = useState<string | null>(null);

    const [summaryData, setSummaryData] = useState<S | null>(null);
    const [summaryStatus, setSummaryStatus] = useState<SummaryStatus>('idle');

    // Only the latest request may update the table (a slow old response must not win)
    const requestId = useRef(0);
    const summaryRequestId = useRef(0);

    // The latest callbacks, so the loading effect does not re-run when a report passes inline functions
    const fetchPageRef = useRef(fetchPage);
    const fetchSummaryRef = useRef(fetchSummary);
    useEffect(() => {
        fetchPageRef.current = fetchPage;
        fetchSummaryRef.current = fetchSummary;
    });

    useEffect(() => {
        if (applied === null) return;
        const id = ++requestId.current;
        setLoading(true);
        fetchPageRef.current({ filters: applied, page, limit: pageSize, sort })
            .then((result) => {
                if (id !== requestId.current) return;
                if (result.success) {
                    setRows(result.data);
                    setTotal(result.pagination?.total ?? result.data.length);
                    setTotalPages(result.pagination?.totalPages ?? 1);
                    setError(null);
                } else {
                    setError(result.error ?? null);
                }
            })
            .catch((err: unknown) => {
                if (id === requestId.current) setError(errorMessage(err));
            })
            .finally(() => {
                if (id === requestId.current) setLoading(false);
            });
    }, [applied, page, sort, pageSize]);

    const updateFilters = useCallback((patch: Partial<F>) => {
        setFilters((prev) => ({ ...prev, ...patch }));
    }, []);

    const resetSummary = () => {
        summaryRequestId.current++;
        setSummaryData(null);
        setSummaryStatus('idle');
    };

    const apply = () => {
        setApplied({ ...filters });
        setPage(1);
        resetSummary();
    };

    const clear = () => {
        const fresh = initialFilters();
        requestId.current++;
        setFilters(fresh);
        setApplied(autoApply ? fresh : null);
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        setError(null);
        setLoading(autoApply);
        setSort(defaultSort);
        setPage(1);
        resetSummary();
    };

    const toggleSort = (column: string) => {
        setSort((prev) => nextSort(prev, column));
        setPage(1);
    };

    /** Every row for the applied filters and current order (used by exports) */
    const fetchAll = async (): Promise<R[]> => {
        if (applied === null) return [];
        const result = await fetchPageRef.current({ filters: applied, page: 1, limit: EXPORT_LIMIT, sort });
        return result.success ? result.data : [];
    };

    const loadSummary = useCallback(async () => {
        const loader = fetchSummaryRef.current;
        if (!loader || applied === null) return;
        const id = ++summaryRequestId.current;
        setSummaryStatus('loading');
        try {
            const result = await loader(applied);
            if (id !== summaryRequestId.current) return;
            setSummaryData(result.success ? result.data ?? null : null);
            setSummaryStatus(result.success ? 'ready' : 'error');
        } catch (err) {
            console.error('Summary failed:', err);
            if (id === summaryRequestId.current) setSummaryStatus('error');
        }
    }, [applied]);

    return {
        filters,
        updateFilters,
        applied,
        apply,
        clear,
        rows,
        total,
        totalPages,
        page,
        setPage,
        pageSize,
        loading,
        error,
        sort,
        toggleSort,
        fetchAll,
        summary: { data: summaryData, status: summaryStatus, load: loadSummary },
    };
}

export type ReportTable<F, R, S = never> = ReturnType<typeof useReportTable<F, R, S>>;
