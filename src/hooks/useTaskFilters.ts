'use client';

import { useCallback, useMemo } from 'react';
import type { TaskFilterValues } from '@/components/tasks/shared/TaskFilters';
import { useAddress } from '@/hooks/useAddress';
import { useAddressText } from '@/hooks/useAddressText';
import { textParam } from '@/lib/address';

/** The Agenda's text / area / person filters, in the address (?q=…&area=…&person=…) */
const VIEW = { q: textParam(), area: textParam(), person: textParam() };

/**
 * The filters of an Agenda list or calendar (TaskFilters): they filter on screen at once and live in the address on
 * the same history step, so a link or a refresh keeps them.
 */
export function useTaskFilters(): [TaskFilterValues, (next: TaskFilterValues) => void] {
    const { values, set } = useAddress(VIEW);
    const [search, typeSearch] = useAddressText(
        values.q,
        useCallback((text: string) => set({ q: text }, 'replace'), [set])
    );
    const { area, person } = values;
    const filters = useMemo<TaskFilterValues>(() => ({ search, area, person }), [search, area, person]);

    const setFilters = (next: TaskFilterValues) => {
        if (next.search !== search) typeSearch(next.search);
        if (next.area !== area || next.person !== person) set({ area: next.area, person: next.person }, 'replace');
    };

    return [filters, setFilters];
}
