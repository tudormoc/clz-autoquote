'use client';

import { useState } from 'react';
import { AlignDialog } from '@/components/admin/access/AlignDialog';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.person.alignEmail;

interface AlignEmailDialogProps {
    name: string;
    /** The addresses found, one of which will be written everywhere */
    options: string[];
    aligning: boolean;
    onConfirm: (email: string) => void;
    onClose: () => void;
}

/** Asks which e-mail to keep before it is written into NetPro and Business. */
export function AlignEmailDialog({ name, options, aligning, onConfirm, onClose }: AlignEmailDialogProps) {
    const [chosen, setChosen] = useState(options[0] ?? '');

    return (
        <AlignDialog
            title={copy.align}
            subtitle={fmt(copy.subtitle, { name })}
            description={copy.description}
            effects={copy.effects}
            note={copy.note}
            aligning={aligning}
            canConfirm={Boolean(chosen)}
            onConfirm={() => onConfirm(chosen)}
            onClose={onClose}
        >
            <Field label={copy.value}>
                <Select value={chosen} onChange={(e) => setChosen(e.target.value)} options={options.map((value) => ({ value, label: value }))} disabled={aligning} />
            </Field>
        </AlignDialog>
    );
}
