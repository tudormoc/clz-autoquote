'use client';

import { useState } from 'react';
import { getOperatorsAction, updateOperatorAction, type OperatorRow } from '@/app/presence/operators-actions';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { EditableCell } from '@/components/ui/EditableCell';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { Input } from '@/components/ui/Input';
import { RecordCount } from '@/components/ui/RecordCount';
import { SearchField } from '@/components/ui/SearchField';
import { Select } from '@/components/ui/Select';
import { MissingValue } from '@/components/ui/TableCells';
import { ToggleChips } from '@/components/ui/ToggleChips';
import { useClientSort } from '@/hooks/useClientSort';
import { useListQuery } from '@/hooks/useListQuery';
import { EMPTY_VALUE } from '@/lib/format';
import type { RowSortColumns } from '@/lib/sort';
import { cn, toggleInSet } from '@/lib/utils';
import { notify } from '@/lib/notify';
import { APP_COPY } from '@/locales';

type EditableColumn = 'BADGE' | 'NOME' | 'STATO_FISICO';

const copy = APP_COPY.analytics.operators;

const SORT_COLUMNS: RowSortColumns<OperatorRow> = {
    OPERATORE: (row) => row.OPERATORE,
    BADGE: (row) => row.BADGE,
    NOME: (row) => row.NOME,
    STATO_FISICO: (row) => row.STATO_FISICO,
};

/** Chip key of a row: its stato fisico, '' when it has none */
const statoKey = (row: OperatorRow) => row.STATO_FISICO || '';

/** Editor of a text cell, for EditableCell's renderEditor */
function textEditor(className?: string) {
    return function TextEditor(draft: string, setDraft: (value: string) => void) {
        return <Input type="text" value={draft} onChange={(e) => setDraft(e.target.value)} className={cn('h-8 text-xs', className)} autoFocus />;
    };
}

export function OperatorsTable() {
    const list = useListQuery({
        initialFilters: () => ({ search: '' }),
        load: (filters: { search: string }) => getOperatorsAction(filters.search || undefined),
    });
    const { sorted, sort, toggleSort } = useClientSort(list.rows, SORT_COLUMNS, { column: 'OPERATORE', direction: 'asc' });

    const allStati = list.result?.allStati ?? [];
    // null = default: every stato on. Operators without a stato get their own chip, off by default.
    const [chosenStati, setChosenStati] = useState<Set<string> | null>(null);
    const activeStati = chosenStati ?? new Set(allStati);
    const hasNoStato = list.rows.some((row) => statoKey(row) === '');
    const visibleRows = sorted.filter((row) => activeStati.has(statoKey(row)));

    const saveField = (operatore: string, column: EditableColumn) => async (value: string) => {
        const result = await updateOperatorAction(operatore, column, value.trim() || null);
        if (!result.success) {
            notify.failure(result.error);
            return false;
        }
        await list.reload();
        return true;
    };

    const editable = (row: OperatorRow, column: EditableColumn, editor: (draft: string, setDraft: (value: string) => void) => React.ReactNode) => (
        <EditableCell
            display={row[column] ?? <MissingValue />}
            startValue={() => row[column] ?? ''}
            renderEditor={editor}
            onSave={saveField(row.OPERATORE, column)}
        />
    );

    const columns: DataTableColumn<OperatorRow>[] = [
        { key: 'OPERATORE', header: copy.headers.id, className: 'w-32', cellClassName: 'font-mono text-fg-secondary', cell: (row) => row.OPERATORE },
        {
            key: 'BADGE',
            header: copy.headers.badge,
            className: 'w-56',
            cellClassName: 'font-mono text-fg-secondary',
            cell: (row) => editable(row, 'BADGE', textEditor('font-mono w-48')),
        },
        { key: 'NOME', header: copy.headers.nome, cellClassName: 'text-fg-secondary', cell: (row) => editable(row, 'NOME', textEditor()) },
        {
            key: 'STATO_FISICO',
            header: copy.headers.statoFisico,
            className: 'w-44',
            cellClassName: 'text-fg-secondary',
            cell: (row) =>
                editable(row, 'STATO_FISICO', (draft, setDraft) => (
                    <Select
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        options={allStati.map((stato) => ({ label: stato, value: stato }))}
                        className="h-8 text-xs w-36"
                        autoFocus
                    />
                )),
        },
    ];

    const statoOptions = [
        ...allStati.map((stato) => ({ key: stato, label: stato })),
        ...(hasNoStato ? [{ key: '', label: EMPTY_VALUE }] : []),
    ];

    return (
        <div className="flex flex-col gap-4 lg:h-full">
            <FilterPanel
                columns={3}
                activeCount={list.activeFilterCount}
                onApply={list.apply}
                onClear={() => {
                    list.clear();
                    setChosenStati(null);
                }}
                below={
                    statoOptions.length > 0 && (
                        <ToggleChips
                            label={copy.headers.statoFisico}
                            options={statoOptions}
                            active={activeStati}
                            onToggle={(key) => setChosenStati(toggleInSet(activeStati, key))}
                        />
                    )
                }
            >
                <div className="md:col-span-2">
                    <SearchField
                        label={APP_COPY.analytics.common.search}
                        placeholder={copy.searchPlaceholder}
                        value={list.filters.search}
                        onChange={(search) => list.updateFilters({ search })}
                    />
                </div>
            </FilterPanel>

            {visibleRows.length > 0 && (
                <RecordCount count={visibleRows.length}>
                    <span className="hidden sm:inline text-xs text-fg-subtle">{copy.editHint}</span>
                </RecordCount>
            )}

            <DataTable
                columns={columns}
                rows={visibleRows}
                getRowKey={(row) => row.OPERATORE}
                sort={sort}
                onSort={toggleSort}
                loading={list.loading}
                error={list.error}
                fill
                emptyMessage={list.applied ? copy.noResults : APP_COPY.analytics.applyFiltersHint}
            />
        </div>
    );
}
