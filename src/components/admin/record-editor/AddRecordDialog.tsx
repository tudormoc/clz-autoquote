import { useId, useState } from 'react';
import { Plus } from '@/components/ui/icons';
import { RecordInput } from '@/components/admin/record-editor/RecordInput';
import { parseDraft } from '@/components/admin/record-editor/fields';
import type { RecordTableConfig } from '@/components/admin/record-editor/types';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { notify } from '@/lib/notify';
import { APP_COPY } from '@/locales';

interface AddRecordDialogProps<T> {
    config: RecordTableConfig<T>;
    /** Writes the new row; true when it was saved */
    onSubmit: (values: Record<string, unknown>) => Promise<boolean>;
    onClose: () => void;
}

/** "New row" window: one field per column, saved only when every field holds a valid value. */
export function AddRecordDialog<T>({ config, onSubmit, onClose }: AddRecordDialogProps<T>) {
    const formId = useId();
    const columns = config.add.columns ?? config.columns;
    const [draft, setDraft] = useState<Record<string, string>>(config.add.initial);
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        const values: Record<string, unknown> = {};
        for (const column of columns) {
            const value = parseDraft(column.kind, draft[column.key] ?? '');
            if (value === undefined) {
                notify.error(APP_COPY.admin.records.fillAll);
                return;
            }
            values[column.key] = value;
        }
        setSaving(true);
        try {
            if (await onSubmit(values)) onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            title={config.add.dialogTitle}
            icon={Plus}
            size="lg"
            onClose={onClose}
            busy={saving}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={saving}>{APP_COPY.common.cancel}</Button>
                    <Button type="submit" form={formId} disabled={saving}>{APP_COPY.common.save}</Button>
                </>
            }
        >
            <form
                id={formId}
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
                className="grid grid-cols-2 gap-3"
            >
                {columns.map((column, index) => (
                    <Field key={column.key} label={column.label}>
                        <RecordInput
                            column={column}
                            value={draft[column.key] ?? ''}
                            onChange={(value) => setDraft({ ...draft, [column.key]: value })}
                            autoFocus={index === 0}
                        />
                    </Field>
                ))}
            </form>
        </Modal>
    );
}
