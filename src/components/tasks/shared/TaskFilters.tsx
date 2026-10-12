'use client';

import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { NamedItem, Person } from '@/lib/tasks/types';
import { APP_COPY } from '@/locales';
import { cn } from '@/lib/utils';

const copy = APP_COPY.tasks.filters;

/** Value of the area filter: '' = all, 'none' = without area, else the area id */
export const NO_AREA = 'none';

export interface TaskFilterValues {
    search: string;
    area: string;
    person: string;
}

export const EMPTY_FILTERS: TaskFilterValues = { search: '', area: '', person: '' };

interface TaskFiltersProps {
    values: TaskFilterValues;
    onChange: (values: TaskFilterValues) => void;
    areas: NamedItem[];
    /** The person filter shows only when more than one person has something in the list */
    people: Person[];
    /** One line without labels (Da fare: next to the quick add) */
    compact?: boolean;
    /** More filters at the end of the row */
    children?: React.ReactNode;
}

/** Text, area and person filters of the Agenda lists; they filter at once, on screen */
export function TaskFilters({ values, onChange, areas, people, compact = false, children }: TaskFiltersProps) {
    const set = (change: Partial<TaskFilterValues>) => onChange({ ...values, ...change });
    /** A control with its label above, or alone (label kept for screen readers) in the compact line */
    const labelled = (label: string, width: string, control: React.ReactNode) =>
        compact ? (
            <div className={cn('w-full sm:w-auto', width)}>{control}</div>
        ) : (
            <Field label={label} className={cn('w-full', width)}>
                {control}
            </Field>
        );

    return (
        <div className={cn('flex flex-wrap gap-3', compact ? 'items-center gap-2' : 'items-end')}>
            {labelled(
                copy.search,
                'sm:w-64',
                <Input value={values.search} onChange={(e) => set({ search: e.target.value })} placeholder={copy.searchPlaceholder} aria-label={copy.search} />
            )}
            {areas.length > 0 &&
                labelled(
                    copy.area,
                    'sm:w-52',
                    <Select
                        aria-label={copy.area}
                        value={values.area}
                        onChange={(e) => set({ area: e.target.value })}
                        options={[{ value: '', label: copy.allAreas }, ...areas.map((area) => ({ value: String(area.id), label: area.name })), { value: NO_AREA, label: copy.noArea }]}
                    />
                )}
            {people.length > 1 &&
                labelled(
                    copy.person,
                    'sm:w-52',
                    <Select
                        aria-label={copy.person}
                        value={values.person}
                        onChange={(e) => set({ person: e.target.value })}
                        options={[{ value: '', label: copy.everyone }, ...people.map((person) => ({ value: person.name, label: person.name }))]}
                    />
                )}
            {children}
        </div>
    );
}

/** The row passes the filters (title, tags and notes for the text; area by id or "none"; person by name) */
export function matchesFilters(
    row: { title: string; areaId?: number | null; areaName: string | null; assigneeName: string | null; text?: string },
    values: TaskFilterValues,
    areas: NamedItem[]
): boolean {
    const term = values.search.trim().toLowerCase();
    if (term && !`${row.title} ${row.areaName ?? ''} ${row.text ?? ''}`.toLowerCase().includes(term)) return false;
    if (values.area === NO_AREA && row.areaName) return false;
    if (values.area && values.area !== NO_AREA) {
        const area = areas.find((item) => String(item.id) === values.area);
        if (!area || (row.areaId !== undefined ? row.areaId !== area.id : row.areaName !== area.name)) return false;
    }
    if (values.person && row.assigneeName !== values.person) return false;
    return true;
}
