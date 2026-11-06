import { Check } from 'lucide-react';
import { ChangeLines } from '@/components/analytics/order-operations/ChangeLines';
import { AlignIcon } from '@/components/ui/AlignIcon';
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
            icon={AlignIcon}
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
                    <ChangeLines key={group.key} title={t.syncPreview.groups[group.key]} count={group.changes.length} lines={group.changes} />
                ))}
                <p className="text-fg-subtle">{t.syncPreview.refreshed}</p>
            </div>
        </Modal>
    );
}
