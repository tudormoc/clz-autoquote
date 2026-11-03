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
    pin: string;
    /** The kind the PIN was drawn from, named ("PIN di 4 cifre"): "Un altro" draws another of it */
    kindLabel: string;
    onReroll: () => Promise<void>;
    onClose: () => void;
}

/**
 * The PIN just given out (a new user, or the dice next to a PIN): big enough to read out, with a button to copy it and
 * one to draw another of the same kind until the superadmin likes it (each draw replaces the stored PIN).
 */
export function NewPinDialog({ name, pin, kindLabel, onReroll, onClose }: NewPinDialogProps) {
    const [rolling, setRolling] = useState(false);

    const rollAgain = async () => {
        setRolling(true);
        try {
            await onReroll();
        } finally {
            setRolling(false);
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
            subtitle={copy.newPinHint}
            icon={KeyRound}
            size="sm"
            onClose={onClose}
            busy={rolling}
            footer={
                <>
                    <Button
                        variant="secondary"
                        onClick={rollAgain}
                        disabled={rolling}
                        aria-label={copy.rollAgain}
                        title={fmt(copy.rollAgainHint, { kind: kindLabel })}
                        className="mr-auto px-3"
                    >
                        <Dices size={16} />
                    </Button>
                    <Button variant="secondary" onClick={copyPin} disabled={rolling}>
                        <Copy size={16} />
                        {APP_COPY.common.copy}
                    </Button>
                    <Button onClick={onClose} disabled={rolling}>{APP_COPY.common.close}</Button>
                </>
            }
        >
            <p className={cn('font-mono text-2xl text-fg-strong text-center tracking-wider break-all select-all py-2', rolling && 'opacity-50')}>{pin}</p>
        </Modal>
    );
}
