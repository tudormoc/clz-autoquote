'use client';

import { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.person;

interface AlignEmailDialogProps {
    name: string;
    /** The addresses found, one of which will be written everywhere */
    options: string[];
    aligning: boolean;
    onConfirm: (email: string) => void;
    onClose: () => void;
}

/** Asks which e-mail to keep and confirms before it is written into NetPro and Business (like the order realign). */
export function AlignEmailDialog({ name, options, aligning, onConfirm, onClose }: AlignEmailDialogProps) {
    const [chosen, setChosen] = useState(options[0] ?? '');

    return (
        <Modal
            title={copy.align}
            subtitle={fmt(copy.alignSubtitle, { name })}
            icon={Sparkles}
            iconTone="warning"
            size="lg"
            onClose={onClose}
            busy={aligning}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={aligning}>{APP_COPY.common.cancel}</Button>
                    <Button variant="warning" onClick={() => onConfirm(chosen)} disabled={aligning || !chosen}>
                        {aligning ? <Spinner size={14} /> : <Check size={14} />}
                        {aligning ? copy.aligning : copy.align}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <Field label={copy.alignValue}>
                    <Select value={chosen} onChange={(e) => setChosen(e.target.value)} options={options.map((value) => ({ value, label: value }))} disabled={aligning} />
                </Field>
                <div className="text-xs text-fg-secondary leading-relaxed bg-background/60 p-4 rounded-lg border border-border space-y-3">
                    <p className="font-medium text-fg-soft">{copy.alignDescription}</p>
                    <ul className="space-y-1.5 text-fg-muted list-disc list-inside">
                        {copy.alignEffects.map((effect) => (
                            <li key={effect}>{effect}</li>
                        ))}
                    </ul>
                    <p>{copy.alignMailboxNote}</p>
                </div>
            </div>
        </Modal>
    );
}
