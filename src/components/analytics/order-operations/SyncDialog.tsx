import { Check, Pin } from '@/components/ui/icons';
import { ChangeLines } from '@/components/analytics/order-operations/ChangeLines';
import { AlignIcon } from '@/components/ui/AlignIcon';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import type { SyncChangeGroup } from '@/lib/orders/syncPreview';
import { APP_COPY, fmt } from '@/locales';
import { SURFACE_TONE, surfaceClasses } from '@/components/ui/Surface';

const t = APP_COPY.analytics.orderOperations;

interface SyncDialogProps {
    commessa: string;
    article: string;
    /** What the realign is about to change, by kind (src/lib/orders/syncPreview.ts) */
    changes: SyncChangeGroup[];
    /** What the realign leaves on the order because it was already used, one sentence each (src/lib/orders/syncBlocks.ts) */
    kept: string[];
    syncing: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

/**
 * Shows what Riallinea is about to change, and what it leaves on the order because it was already used, and asks for
 * confirmation (this writes to Business and NetPro).
 */
export function SyncDialog({ commessa, article, changes, kept, syncing, onConfirm, onClose }: SyncDialogProps) {
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
            <div className={surfaceClasses('inset', 'text-xs text-fg-secondary leading-relaxed p-4 space-y-3')}>
                <p className="font-medium text-fg-soft">{t.syncConfirmDescription}</p>
                {kept.length > 0 && (
                    <div className={surfaceClasses('inset', SURFACE_TONE.warning, 'p-3')}>
                        <p className="flex items-center gap-1.5 font-semibold text-warning-300">
                            <Pin size={14} aria-hidden />
                            {t.syncKeepsTitle}
                        </p>
                        <ul className="mt-1 space-y-0.5 list-disc list-inside text-fg-soft">
                            {kept.map((line) => (
                                <li key={line} className="break-words">{line}</li>
                            ))}
                        </ul>
                        <p className="mt-1 text-fg-muted">{t.syncKeepsHint}</p>
                    </div>
                )}
                {changes.length === 0 && <p className="text-fg-muted">{t.syncPreview.none}</p>}
                {changes.map((group) => (
                    <ChangeLines key={group.key} title={t.syncPreview.groups[group.key]} count={group.changes.length} lines={group.changes} />
                ))}
                <p className="text-fg-subtle">{t.syncPreview.refreshed}</p>
            </div>
        </Modal>
    );
}
