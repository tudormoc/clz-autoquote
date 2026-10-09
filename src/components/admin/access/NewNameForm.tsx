'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface NewNameFormProps {
    placeholder: string;
    buttonLabel: string;
    /** Creates it; true when saved (the field then empties) */
    onSubmit: (name: string) => Promise<boolean>;
}

/** "Nuovo utente" / "Nuovo gruppo": a name and a button, Enter creates (the caller places it, e.g. in a Card). */
export function NewNameForm({ placeholder, buttonLabel, onSubmit }: NewNameFormProps) {
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        setBusy(true);
        try {
            if (await onSubmit(name)) setName('');
        } finally {
            setBusy(false);
        }
    };

    return (
        <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
        >
            <div className="flex-1 min-w-48">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} disabled={busy} />
            </div>
            <Button type="submit" disabled={busy || !name.trim()}>
                <Plus size={16} />
                {buttonLabel}
            </Button>
        </form>
    );
}
