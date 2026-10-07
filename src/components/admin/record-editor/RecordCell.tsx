import { RecordInput } from '@/components/admin/record-editor/RecordInput';
import { draftOf, parseDraft } from '@/components/admin/record-editor/fields';
import type { RecordColumn } from '@/components/admin/record-editor/types';
import { EditableCell } from '@/components/ui/EditableCell';
import { notify } from '@/lib/notify';
import { APP_COPY } from '@/locales';

interface RecordCellProps<T> {
    column: RecordColumn<T>;
    row: T;
    /** Saves the typed value; true when it was saved */
    onSave: (value: unknown) => Promise<boolean>;
}

/** One value of a row: click to edit, Enter saves. */
export function RecordCell<T>({ column, row, onSave }: RecordCellProps<T>) {
    const value = (row as Record<string, unknown>)[column.key];
    const wide = column.kind === 'text' || column.kind === 'choice';

    return (
        <EditableCell
            display={column.show ? column.show(row) : String(value ?? '')}
            startValue={() => draftOf(column.kind, value)}
            renderEditor={(draft, setDraft) => (
                <div className={wide ? 'w-44' : 'w-28'}>
                    <RecordInput column={column} value={draft} onChange={setDraft} autoFocus />
                </div>
            )}
            onSave={async (draft) => {
                const parsed = parseDraft(column.kind, draft);
                if (parsed === undefined) {
                    notify.error(APP_COPY.admin.records.invalidValue);
                    return false;
                }
                return onSave(parsed);
            }}
        />
    );
}
