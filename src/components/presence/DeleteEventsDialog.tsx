import { Button } from '@/components/ui/Button';
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/60 backdrop-blur-sm">
            <div className="bg-card border border-border-strong rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
                <h3 className="text-base font-semibold text-fg-strong mb-1">{copy.title}</h3>
                <p className="text-xs text-fg-muted mb-4">{copy.hint}</p>
                <div className="space-y-2 mb-6">
                    {items.map((item, i) => (
                        <label key={i} className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={checked[i]}
                                onChange={() => onToggle(i)}
                                className="w-4 h-4 accent-danger-500 cursor-pointer"
                            />
                            <span className="text-sm text-fg-soft group-hover:text-fg-strong transition-colors font-mono">{item.label}</span>
                        </label>
                    ))}
                </div>
                <div className="flex gap-2 justify-end">
                    <Button variant="ghost" onClick={onClose}>
                        {APP_COPY.common.cancel}
                    </Button>
                    <Button variant="danger" onClick={onConfirm} disabled={deleting || checked.every((on) => !on)}>
                        {deleting ? copy.deleting : copy.confirm}
                    </Button>
                </div>
            </div>
        </div>
    );
}
