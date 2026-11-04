'use client';

import { useState } from 'react';
import { AlignDialog } from '@/components/admin/access/AlignDialog';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { NAME_MAX_LENGTH, NamePartsSchema, joinNameParts, proposeNameParts, type NameParts, type PersonRecords } from '@/lib/persons/places';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.person.alignName;

interface AlignNameDialogProps {
    name: string;
    /** The names found, the NetPro operator's first: the chosen one fills cognome and nome */
    options: string[];
    records: PersonRecords;
    aligning: boolean;
    onConfirm: (parts: NameParts) => void;
    onClose: () => void;
}

/** Asks for cognome and nome, proposed from a name found, and shows the text that will be written in capitals everywhere. */
export function AlignNameDialog({ name, options, records, aligning, onConfirm, onClose }: AlignNameDialogProps) {
    const [from, setFrom] = useState(options[0] ?? '');
    const [parts, setParts] = useState<NameParts>(() => proposeNameParts(records, options[0] ?? ''));
    const checked = NamePartsSchema.safeParse(parts);

    const pick = (value: string) => {
        setFrom(value);
        setParts(proposeNameParts(records, value));
    };

    return (
        <AlignDialog
            title={copy.align}
            subtitle={fmt(copy.subtitle, { name })}
            description={copy.description}
            effects={copy.effects}
            note={copy.note}
            aligning={aligning}
            canConfirm={checked.success}
            onConfirm={() => checked.success && onConfirm(checked.data)}
            onClose={onClose}
        >
            <Field label={copy.from}>
                <Select value={from} onChange={(e) => pick(e.target.value)} options={options.map((value) => ({ value, label: value }))} disabled={aligning} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={copy.surname}>
                    <Input value={parts.surname} maxLength={NAME_MAX_LENGTH.surname} onChange={(e) => setParts({ ...parts, surname: e.target.value })} disabled={aligning} />
                </Field>
                <Field label={copy.firstName}>
                    <Input value={parts.firstName} maxLength={NAME_MAX_LENGTH.firstName} onChange={(e) => setParts({ ...parts, firstName: e.target.value })} disabled={aligning} />
                </Field>
            </div>
            <p className={checked.success ? 'text-sm text-fg-soft' : 'text-sm text-danger-400'}>{checked.success ? fmt(copy.preview, { value: joinNameParts(checked.data) }) : copy.invalid}</p>
        </AlignDialog>
    );
}
