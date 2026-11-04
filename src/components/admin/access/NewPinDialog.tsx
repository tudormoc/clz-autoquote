'use client';

import { useState } from 'react';
import { Copy, Dices, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { copyToClipboard } from '@/lib/clipboard';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.users;

interface NewPinDialogProps {
    name: string;
    /** The PIN shown: a proposal, or the one already stored (a user just created) */
    pin: string;
    /** The PIN the user has now; while the shown one equals it there is nothing to save */
    storedPin: string;
    /** The kind the PIN was drawn from, named ("PIN di 4 cifre"): the dice draws another of it */
    kindLabel: string;
    /** Draws another PIN of the same kind, without writing anything */
    onReroll: () => Promise<void>;
    /** Writes the shown PIN; true when saved */
    onSave: (pin: string) => Promise<boolean>;
    onClose: () => void;
}

/**
 * A PIN proposed for the person (the dice next to a PIN, or the one a new user got): big enough to read out, a button
 * to copy it, the dice to draw another of the same kind. Nothing is written until Salva; Annulla leaves the stored
 * PIN as it is.
 */
export function NewPinDialog({ name, pin, storedPin, kindLabel, onReroll, onSave, onClose }: NewPinDialogProps) {
    const [busy, setBusy] = useState(false);
    const isStored = pin === storedPin;

    const act = async (work: () => Promise<unknown>) => {
        setBusy(true);
        try {
            await work();
        } catch (err) {
            notify.failure(err);
        } finally {
            setBusy(false);
        }
    };

    const copyPin = async () => {
        try {
            await copyToClipboard(pin);
            notify.success(copy.pinCopied);
        } catch (err) {
            notify.failure(err);
        }
    };

    return (
        <Modal
            title={fmt(copy.newPinTitle, { name })}
            subtitle={isStored ? copy.newPinHint : copy.draftPinHint}
            icon={KeyRound}
            size="sm"
            onClose={onClose}
            busy={busy}
            footer={
                <>
                    <Button
                        variant="secondary"
                        onClick={() => act(onReroll)}
                        disabled={busy}
                        aria-label={copy.rollAgain}
                        title={fmt(copy.rollAgainHint, { kind: kindLabel })}
                        className="mr-auto px-3"
                    >
                        <Dices size={16} />
                    </Button>
                    <Button variant="secondary" onClick={copyPin} disabled={busy}>
                        <Copy size={16} />
                        {APP_COPY.common.copy}
                    </Button>
                    {isStored ? (
                        <Button onClick={onClose} disabled={busy}>{APP_COPY.common.close}</Button>
                    ) : (
                        <>
                            <Button variant="secondary" onClick={onClose} disabled={busy}>{APP_COPY.common.cancel}</Button>
                            <Button onClick={() => act(() => onSave(pin))} disabled={busy}>{APP_COPY.common.save}</Button>
                        </>
                    )}
                </>
            }
        >
            <p className={cn('font-mono text-2xl text-fg-strong text-center tracking-wider break-all select-all py-2', busy && 'opacity-50')}>{pin}</p>
        </Modal>
    );
}
