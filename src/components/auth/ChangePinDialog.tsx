'use client';

import { useId, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { changeOwnPinAction } from '@/app/auth-actions';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { notify } from '@/lib/notify';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.auth;

/** "Cambia PIN": the new PIN twice; the server checks its length. The person stays logged in. */
export function ChangePinDialog({ onClose }: { onClose: () => void }) {
    const formId = useId();
    const [pin, setPin] = useState('');
    const [repeat, setRepeat] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (pin.trim() !== repeat.trim()) {
            notify.error(copy.pinMismatch);
            return;
        }
        setSaving(true);
        try {
            const res = await changeOwnPinAction(pin);
            if (!res.success) {
                notify.error(res.error);
                return;
            }
            notify.success(copy.pinChanged);
            onClose();
        } catch (err) {
            notify.failure(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            title={copy.changePin}
            icon={KeyRound}
            size="sm"
            onClose={onClose}
            busy={saving}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={saving}>{APP_COPY.common.cancel}</Button>
                    <Button type="submit" form={formId} disabled={saving || !pin}>{APP_COPY.common.save}</Button>
                </>
            }
        >
            <form
                id={formId}
                className="space-y-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
            >
                <Field label={copy.newPin}>
                    <Input type="password" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus />
                </Field>
                <Field label={copy.repeatPin}>
                    <Input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
                </Field>
            </form>
        </Modal>
    );
}
