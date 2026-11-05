import { Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import type { SyncChangeGroup } from '@/lib/orders/syncPreview';
import { APP_COPY, fmt } from '@/locales';

const t = APP_COPY.analytics.orderOperations;

interface SyncDialogProps {
    commessa: string;
    article: string;
    /** What the realign is about to change, by kind (src/lib/orders/syncPreview.ts) */
    changes: SyncChangeGroup[];
    syncing: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

/** Shows what Riallinea is about to change and asks for confirmation (this writes to Business and NetPro). */
export function SyncDialog({ commessa, article, changes, syncing, onConfirm, onClose }: SyncDialogProps) {
    return (
        <Modal
            title={t.syncConfirmTitle}
            subtitle={fmt(t.syncConfirmSubtitle, { commessa: commessa || '-', article: article || '-' })}
            icon={Sparkles}
            iconTone="warning"
            size="xl"
            onClose={onClose}
            busy={syncing}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={syncing}>{t.cancel}</Button>
                    <Button variant="warning" onClick={onConfirm} disabled={syncing}>
                        {syncing ? <Spinner size={14} /> : <Check size={14} />}
                        {syncing ? t.syncing : t.syncConfirmButton}
                    </Button>
                </>
            }
        >
            <div className="text-xs text-fg-secondary leading-relaxed bg-background/60 p-4 rounded-lg border border-border space-y-3">
                <p className="font-medium text-fg-soft">{t.syncConfirmDescription}</p>
                {changes.length === 0 && <p className="text-fg-muted">{t.syncPreview.none}</p>}
                {changes.map((group) => (
                    <div key={group.key}>
                        <p className="font-semibold text-fg">
                            {t.syncPreview.groups[group.key]} <span className="font-normal text-fg-muted">({group.changes.length})</span>
                        </p>
                        <ul className="mt-1 space-y-0.5 list-disc list-inside text-fg-muted">
                            {group.changes.map((line, index) => (
                                <li key={index} className="break-words">{line}</li>
                            ))}
                        </ul>
                    </div>
                ))}
                <p className="text-fg-subtle">{t.syncPreview.refreshed}</p>
            </div>
        </Modal>
    );
}
