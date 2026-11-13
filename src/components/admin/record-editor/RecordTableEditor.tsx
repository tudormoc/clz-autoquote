'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Lock, Plus, Trash2 } from '@/components/ui/icons';
import { AddRecordDialog } from '@/components/admin/record-editor/AddRecordDialog';
import { RecordCell } from '@/components/admin/record-editor/RecordCell';
import type { RecordTableConfig } from '@/components/admin/record-editor/types';
import { Button } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { useRecordTable } from '@/hooks/useRecordTable';
import { toggleInSet } from '@/lib/utils';
import { APP_COPY } from '@/locales';
import { useCanEdit } from '@/components/auth/AccessProvider';
import { FoldToggle } from '@/components/ui/FoldToggle';
import { titleClasses } from '@/components/ui/titleLook';
import { IconButton } from '@/components/ui/IconButton';

/**
 * Editor of one settings table, described by a RecordTableConfig: click a value to change it, trash icon to delete
 * (a lock on rows that cannot be deleted), button to add a row. With `groupBy` the rows sit in collapsible sections (all closed at first).
 */
export function RecordTableEditor<T extends object>({ config }: { config: RecordTableConfig<T> }) {
    const { rows, loading, error, update, remove, add, move } = useRecordTable(config);
    const [adding, setAdding] = useState(false);
    const canEdit = useCanEdit();
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

    const deleteColumn: DataTableColumn<T> = {
        key: 'delete',
        header: '',
        align: 'right',
        cell: (row: T) =>
            config.locked?.rows(row) ? (
                <span className="inline-flex p-2 text-fg-faint" title={config.locked.title}>
                    <Lock size={16} />
                </span>
            ) : (
                <Button variant="ghost" size="sm" title={APP_COPY.common.delete} onClick={() => remove(row)}>
                    <Trash2 size={16} className="text-danger" />
                </Button>
            ),
    };
    // ↑ ↓ to change the order of a list kept in order
    const orderColumn: DataTableColumn<T> = {
        key: 'order',
        header: '',
        compact: true,
        className: 'w-20',
        cell: (row: T) => {
            const index = rows.indexOf(row);
            return (
                <div className="flex items-center gap-0.5">
                    <IconButton title={APP_COPY.admin.records.moveUp} aria-label={APP_COPY.admin.records.moveUp} disabled={index <= 0} onClick={() => move(row, -1)}>
                        <ArrowUp size={14} />
                    </IconButton>
                    <IconButton
                        title={APP_COPY.admin.records.moveDown}
                        aria-label={APP_COPY.admin.records.moveDown}
                        disabled={index === rows.length - 1}
                        onClick={() => move(row, 1)}
                    >
                        <ArrowDown size={14} />
                    </IconButton>
                </div>
            );
        },
    };
    const columns: DataTableColumn<T>[] = [
        ...(canEdit && config.reorder ? [orderColumn] : []),
        ...config.columns.map((column) => ({
            key: column.key,
            header: column.label,
            headerTitle: column.title,
            cell: (row: T) => <RecordCell column={column} row={row} onSave={(value) => update(row, column, value)} />,
        })),
        // Deleting only for someone who may change the page
        ...(canEdit ? [deleteColumn] : []),
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
            {canEdit && (
                <div className="flex justify-end">
                    <Button size="sm" onClick={() => setAdding(true)}>
                        <Plus size={14} /> {config.add.label}
                    </Button>
                </div>
            )}

            {!groupBy || sections.length === 0 ? (
                table(rows)
            ) : (
                sections.map((section) => {
                    const open = expanded.has(section.value);
                    return (
                        <div key={section.value} className="space-y-2">
                            <FoldToggle open={open} count={section.rows.length} onClick={() => setExpanded(toggleInSet(expanded, section.value))}>
                                <span className={titleClasses('section')}>{section.label}</span>
                            </FoldToggle>
                            {open && table(section.rows)}
                        </div>
                    );
                })
            )}

            {adding && <AddRecordDialog config={config} onSubmit={add} onClose={() => setAdding(false)} />}
        </div>
    );
}
