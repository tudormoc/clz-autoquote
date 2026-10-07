import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { APP_COPY } from '@/locales';
import type { ConnectedEvent } from '@/types';

interface DeleteEventsDialogProps {
    items: ConnectedEvent[];
    checked: boolean[];
    deleting: boolean;
    onToggle: (index: number) => void;
    onConfirm: () => void;
    onClose: () => void;
}

const copy = APP_COPY.analytics.dailyEvents.delete;

/** Confirmation window of Daily Events: tick the events to delete, then OK. */
export function DeleteEventsDialog({ items, checked, deleting, onToggle, onConfirm, onClose }: DeleteEventsDialogProps) {
    return (
        <Modal
            title={copy.title}
            subtitle={copy.hint}
            icon={Trash2}
            iconTone="danger"
            onClose={onClose}
            busy={deleting}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={deleting}>
                        {APP_COPY.common.cancel}
                    </Button>
                    <Button variant="danger" onClick={onConfirm} disabled={deleting || checked.every((on) => !on)}>
                        {deleting ? copy.deleting : copy.confirm}
                    </Button>
                </>
            }
        >
            <div className="space-y-2">
                {items.map((item, i) => (
                    <label key={i} className="flex items-center gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={checked[i]}
                            onChange={() => onToggle(i)}
                            className="w-4 h-4 accent-danger-500 cursor-pointer"
                        />
                        <span className="text-fg-soft group-hover:text-fg-strong transition-colors font-mono">{item.label}</span>
                    </label>
                ))}
            </div>
        </Modal>
    );
}
