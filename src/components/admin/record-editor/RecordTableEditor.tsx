'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { AddRecordDialog } from '@/components/admin/record-editor/AddRecordDialog';
import { RecordCell } from '@/components/admin/record-editor/RecordCell';
import type { RecordTableConfig } from '@/components/admin/record-editor/types';
import { Button } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { useRecordTable } from '@/hooks/useRecordTable';
import { toggleInSet } from '@/lib/utils';
import { APP_COPY } from '@/locales';

/**
 * Editor of one settings table, described by a RecordTableConfig: click a value to change it, trash icon to delete,
 * button to add a row. With `groupBy` the rows sit in collapsible sections (all closed at first).
 */
export function RecordTableEditor<T extends object>({ config }: { config: RecordTableConfig<T> }) {
    const { rows, loading, error, update, remove, add } = useRecordTable(config);
    const [adding, setAdding] = useState(false);
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

    const columns: DataTableColumn<T>[] = [
        ...config.columns.map((column) => ({
            key: column.key,
            header: column.label,
            headerTitle: column.title,
            cell: (row: T) => <RecordCell column={column} row={row} onSave={(value) => update(row, column, value)} />,
        })),
        {
            key: 'delete',
            header: '',
            align: 'right' as const,
            cell: (row: T) => (
                <Button variant="ghost" size="sm" title={APP_COPY.common.delete} onClick={() => remove(row)}>
                    <Trash2 size={16} className="text-danger" />
                </Button>
            ),
        },
    ];
    const table = (tableRows: T[]) => (
        <DataTable columns={columns} rows={tableRows} getRowKey={(row) => String((row as { id?: unknown }).id)} loading={loading} error={error} />
    );

    const { groupBy } = config;
    const sections = groupBy
        ? groupBy.groups
              .map((group) => ({ ...group, rows: rows.filter((row) => row[groupBy.key] === group.value) }))
              .filter((section) => section.rows.length > 0)
        : [];

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button size="sm" onClick={() => setAdding(true)}>
                    <Plus size={14} /> {config.add.label}
                </Button>
            </div>

            {!groupBy || sections.length === 0 ? (
                table(rows)
            ) : (
                sections.map((section) => {
                    const open = expanded.has(section.value);
                    return (
                        <div key={section.value} className="space-y-2">
                            <button
                                type="button"
                                onClick={() => setExpanded(toggleInSet(expanded, section.value))}
                                className="w-full px-4 py-2 flex items-center gap-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors"
                            >
                                {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                <span className="font-semibold text-fg">{section.label}</span>
                                <span className="text-xs text-fg-muted">({section.rows.length})</span>
                            </button>
                            {open && table(section.rows)}
                        </div>
                    );
                })
            )}

            {adding && <AddRecordDialog config={config} onSubmit={add} onClose={() => setAdding(false)} />}
        </div>
    );
}
