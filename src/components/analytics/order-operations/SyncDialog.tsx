import { Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { APP_COPY, fmt } from '@/locales';

const t = APP_COPY.analytics.orderOperations;

interface SyncDialogProps {
    commessa: string;
    article: string;
    businessOrderNumber?: number;
    syncing: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

/** Asks for confirmation before the order is rewritten from the DiBa (this writes to Business and NetPro). */
export function SyncDialog({ commessa, article, businessOrderNumber, syncing, onConfirm, onClose }: SyncDialogProps) {
    return (
        <Modal
            title={t.syncConfirmTitle}
            subtitle={fmt(t.syncConfirmSubtitle, { commessa: commessa || '-', article: article || '-' })}
            icon={Sparkles}
            iconTone="warning"
            size="lg"
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
                <ul className="space-y-1.5 text-fg-muted list-disc list-inside">
                    {t.syncConfirmEffects.map((effect) => (
                        <li key={effect.title}>
                            <strong className="text-fg-soft">{effect.title}</strong> {fmt(effect.text, { order: businessOrderNumber || '-' })}
                        </li>
                    ))}
                </ul>
            </div>
        </Modal>
    );
}
