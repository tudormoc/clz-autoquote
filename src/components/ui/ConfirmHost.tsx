'use client';

import { AlertTriangle, HelpCircle } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { answerConfirm, confirmStore } from '@/lib/confirm';
import { useStore } from '@/lib/store';
import { APP_COPY } from '@/locales';

/** Shows the question asked with askConfirm(); mounted once in the root layout. */
export function ConfirmHost() {
    const request = useStore(confirmStore, null);
    if (!request) return null;

    const danger = request.tone === 'danger';
    return (
        <Modal
            title={request.title}
            icon={danger ? AlertTriangle : HelpCircle}
            iconTone={danger ? 'danger' : 'primary'}
            size="sm"
            onClose={() => answerConfirm(false)}
            footer={
                <>
                    {/* Deletions start on "Annulla", so a stray Enter does not delete */}
                    <Button variant="secondary" onClick={() => answerConfirm(false)} autoFocus={danger}>
                        {APP_COPY.common.cancel}
                    </Button>
                    <Button variant={danger ? 'danger' : 'primary'} onClick={() => answerConfirm(true)} autoFocus={!danger}>
                        {request.confirmLabel ?? APP_COPY.common.confirm}
                    </Button>
                </>
            }
        >
            {request.message && <p className="text-fg-secondary">{request.message}</p>}
        </Modal>
    );
}
