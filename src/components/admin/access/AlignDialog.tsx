'use client';

import { Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.admin.person;

interface AlignDialogProps {
    title: string;
    subtitle: string;
    /** What gets written, where, and what is left alone */
    description: string;
    effects: readonly string[];
    note: string;
    aligning: boolean;
    canConfirm: boolean;
    onConfirm: () => void;
    onClose: () => void;
    /** The fields of the value to write */
    children: React.ReactNode;
}

/** The window of an Allinea: the value to write, then what it does, confirmed before NetPro and Business are written (like the order realign). */
export function AlignDialog({ title, subtitle, description, effects, note, aligning, canConfirm, onConfirm, onClose, children }: AlignDialogProps) {
    return (
        <Modal
            title={title}
            subtitle={subtitle}
            icon={Sparkles}
            iconTone="warning"
            size="lg"
            onClose={onClose}
            busy={aligning}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={aligning}>{APP_COPY.common.cancel}</Button>
                    <Button variant="warning" onClick={onConfirm} disabled={aligning || !canConfirm}>
                        {aligning ? <Spinner size={14} /> : <Check size={14} />}
                        {aligning ? copy.aligning : title}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                {children}
                <div className="text-xs text-fg-secondary leading-relaxed bg-background/60 p-4 rounded-lg border border-border space-y-3">
                    <p className="font-medium text-fg-soft">{description}</p>
                    <ul className="space-y-1.5 text-fg-muted list-disc list-inside">
                        {effects.map((effect) => (
                            <li key={effect}>{effect}</li>
                        ))}
                    </ul>
                    <p>{note}</p>
                </div>
            </div>
        </Modal>
    );
}
