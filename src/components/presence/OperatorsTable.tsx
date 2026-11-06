'use client';

import { useState } from 'react';
import { FileText, Pencil, Plus } from 'lucide-react';
import { getOperatorStatiAction, getOperatorsAction, saveOperatorAction, type OperatorRow } from '@/app/presence/operators-actions';
import { OperatorChecklistModal } from '@/components/presence/OperatorChecklistModal';
import { OperatorFormModal } from '@/components/presence/OperatorFormModal';
import { Button } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { EditableCell } from '@/components/ui/EditableCell';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { Input } from '@/components/ui/Input';
import { RecordCount } from '@/components/ui/RecordCount';
import { SearchField } from '@/components/ui/SearchField';
import { Select } from '@/components/ui/Select';
import { MissingValue } from '@/components/ui/TableCells';
import { ToggleChips } from '@/components/ui/ToggleChips';
import { useActionData } from '@/hooks/useActionData';
import { useClientSort } from '@/hooks/useClientSort';
import { useListQuery } from '@/hooks/useListQuery';
import { EMPTY_VALUE, formatDbDateTime } from '@/lib/format';
import { EMPLOYEE_CATEGORIES, LEFT_CATEGORY, isLeftCategory, normalizeReparto } from '@/lib/presence/categories';
import type { OperatorFields } from '@/lib/presence/operatorInput';
import type { RowSortColumns } from '@/lib/sort';
import { cn, toggleInSet } from '@/lib/utils';
import { notify } from '@/lib/notify';
import { APP_COPY } from '@/locales';
import { useCanEdit, useCanUse } from '@/components/auth/AccessProvider';
import { PRESENCE_FUNCTIONS } from '@/config/navigation';

/** The cells of the list that edit in place; the window (pencil) has every field */
type EditableColumn = 'BADGE' | 'NOME' | 'STATO_FISICO';

const copy = APP_COPY.analytics.operators;

const SORT_COLUMNS: RowSortColumns<OperatorRow> = {
    OPERATORE: (row) => row.OPERATORE,
    BADGE: (row) => row.BADGE,
    NOME: (row) => row.NOME,
    STATO_FISICO: (row) => row.STATO_FISICO,
    ORA_ST_FISICO: (row) => row.ORA_ST_FISICO?.getTime() ?? null,
};

/** Chip key of a row: its stato fisico, '' when it has none */
const statoKey = (row: OperatorRow) => row.STATO_FISICO || '';

/**
 * Category chips: the tracked categories, on by default, then the people who left (OFF HR), off by default.
 * Operators of no known category are never shown.
 */
const CATEGORY_OPTIONS = [...EMPLOYEE_CATEGORIES.map((c) => ({ key: c.key, label: c.label })), { key: LEFT_CATEGORY.reparto, label: LEFT_CATEGORY.label }];
const DEFAULT_CATEGORIES: ReadonlySet<string> = new Set(EMPLOYEE_CATEGORIES.map((c) => c.key));

/** Chip key of a row's category: a tracked one, the one of the people who left, or 'altro' */
const categoryKey = (row: OperatorRow) => (isLeftCategory(row.ENTITA) ? LEFT_CATEGORY.reparto : normalizeReparto(row.ENTITA));

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
    const canEdit = useCanEdit();
    const canCreate = useCanUse(PRESENCE_FUNCTIONS.manageOperators);
    /** The window: closed, a new operator, or the one being edited */
    const [form, setForm] = useState<{ operator: OperatorRow | null } | null>(null);

    // The stati in use are read when the page opens, so their chips are there before the list is loaded
    const knownStati = useActionData(getOperatorStatiAction);
    const loadedStati = list.result?.allStati;
    const allStati = loadedStati?.length ? loadedStati : (knownStati.data?.data ?? []);
    // null = default: every stato on. Operators without a stato get their own chip, off by default.
    const [chosenStati, setChosenStati] = useState<Set<string> | null>(null);
    const [showChecklist, setShowChecklist] = useState(false);
    const activeStati = chosenStati ?? new Set(allStati);
    const hasNoStato = list.rows.some((row) => statoKey(row) === '');
    const [activeCategories, setActiveCategories] = useState<ReadonlySet<string>>(DEFAULT_CATEGORIES);
    const visibleRows = sorted.filter((row) => activeStati.has(statoKey(row)) && activeCategories.has(categoryKey(row)));

    const saveField = (operatore: string, column: EditableColumn) => async (value: string) => {
        const fields: OperatorFields = {};
        fields[column] = value;
        const result = await saveOperatorAction(operatore, fields);
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
        {
            key: 'ORA_ST_FISICO',
            header: copy.headers.ultimoMovimento,
            className: 'w-44',
            cellClassName: 'font-mono whitespace-nowrap text-fg-secondary',
            cell: (row) => formatDbDateTime(row.ORA_ST_FISICO),
        },
        ...(canEdit
            ? [
                  {
                      key: 'edit',
                      header: '',
                      sortable: false,
                      compact: true,
                      className: 'w-10',
                      mobileLabel: copy.form.edit,
                      cell: (row: OperatorRow) => (
                          <button
                              type="button"
                              title={copy.form.edit}
                              onClick={() => setForm({ operator: row })}
                              className="p-1 rounded text-fg-muted hover:text-fg-strong hover:bg-muted transition-colors"
                          >
                              <Pencil size={14} />
                          </button>
                      ),
                  },
              ]
            : []),
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
                    setActiveCategories(DEFAULT_CATEGORIES);
                }}
                actions={
                    <>
                        {canEdit && canCreate && (
                            <Button type="button" onClick={() => setForm({ operator: null })}>
                                <Plus size={16} />
                                {copy.form.newButton}
                            </Button>
                        )}
                        <Button type="button" variant="secondary" onClick={() => setShowChecklist(true)}>
                            <FileText size={16} />
                            {copy.checklist.button}
                        </Button>
                    </>
                }
                below={
                    <>
                        <ToggleChips
                            label={copy.headers.categoria}
                            options={CATEGORY_OPTIONS}
                            active={activeCategories}
                            onToggle={(key) => setActiveCategories(toggleInSet(activeCategories, key))}
                        />
                        {statoOptions.length > 0 && (
                            <ToggleChips
                                label={copy.headers.statoFisico}
                                options={statoOptions}
                                active={activeStati}
                                onToggle={(key) => setChosenStati(toggleInSet(activeStati, key))}
                            />
                        )}
                    </>
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
                    {canEdit && <span className="hidden sm:inline text-xs text-fg-subtle">{copy.editHint}</span>}
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

            {showChecklist && <OperatorChecklistModal stati={allStati} onClose={() => setShowChecklist(false)} />}
            {form && <OperatorFormModal operator={form.operator} onSaved={list.reload} onClose={() => setForm(null)} />}
        </div>
    );
}
