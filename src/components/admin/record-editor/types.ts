import type { ReactNode } from 'react';
import type { EditableTableName } from '@/config/editableTables';

/**
 * How a value is typed and shown:
 * text · integer · decimal · optionalInteger (empty = none, stored as null) · percent (typed as 10, stored as 0.10) · choice (one of `options`)
 * · date (YYYY-MM-DD, the browser's date field) · flag (Sì / No, stored as 1 / 0)
 */
export type RecordKind = 'text' | 'integer' | 'decimal' | 'optionalInteger' | 'percent' | 'choice' | 'date' | 'flag';

export interface RecordColumn<T> {
    /** Property of the row, also the column name in the database */
    key: string;
    label: string;
    /** Tooltip on the column header */
    title?: string;
    kind: RecordKind;
    /** Input step of a decimal / percent value */
    step?: string;
    /** Largest value accepted in the input (percent: 100) */
    max?: number;
    options?: { value: string; label: string }[];
    placeholder?: string;
    /** How the value looks in the table; default is the value itself */
    show?: (row: T) => ReactNode;
    /** Where the value is stored when it is not the table of the editor (e.g. an operation's name lives in `operations`) */
    storedIn?: { table: EditableTableName; idKey: string };
}

export interface RecordTableConfig<T> {
    /** Settings table (src/config/editableTables.ts: which columns the server lets it change); rows are identified by their `id` */
    table: EditableTableName;
    load: () => Promise<T[]>;
    columns: RecordColumn<T>[];
    /** Rows are shown in one section per value of this column (price rules per category) */
    groupBy?: { key: keyof T & string; groups: { value: string; label: string }[] };
    add: {
        label: string;
        dialogTitle: string;
        /** Fields of the "add" window (default: the table columns) */
        columns?: RecordColumn<T>[];
        /** What the fields start with (as typed: "0", "16") */
        initial: Record<string, string>;
        /** Columns written only when a row is created (id, sort order ...) */
        extras?: () => Record<string, unknown>;
        /** Replaces the plain insert, for a row made of several tables */
        create?: (values: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
    };
    deleteConfirm: string;
    /** Replaces the plain delete, for a row made of several tables */
    remove?: (row: T) => Promise<{ success: boolean; error?: string }>;
    /**
     * Rows kept in the order of this integer column, changed with ↑ ↓ arrows (the column itself is not shown or typed);
     * a new row goes to the end. Rows must come from `load` already in this order.
     */
    reorder?: { key: string };
    /** Rows that cannot be deleted: a lock with this tooltip instead of the trash icon */
    locked?: { rows: (row: T) => boolean; title: string };
}
