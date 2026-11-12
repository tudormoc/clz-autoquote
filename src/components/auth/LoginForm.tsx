'use client';

import { useState } from 'react';
import { BookOpen, LogIn } from 'lucide-react';
import { loginAction } from '@/app/auth-actions';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { errorMessage } from '@/lib/utils';
import { APP_COPY } from '@/locales';
import { surfaceClasses } from '@/components/ui/Surface';

const copy = APP_COPY.auth;

/** Nome + PIN. On success the server sets the login and opens `next` (the page that asked for it) or home. */
export function LoginForm({ next }: { next?: string }) {
    const [name, setName] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        setBusy(true);
        setError(null);
        try {
            const res = await loginAction(name, pin, next);
            // On success the action has already moved to the next page
            if (!res.success) {
                setError(res.error);
                setPin('');
            }
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <form
            className={surfaceClasses('panel', 'w-full max-w-sm p-6 space-y-5')}
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
        >
            <div className="flex items-center gap-3">
                <span className="p-1.5 rounded bg-primary text-primary-foreground">
                    <BookOpen size={20} strokeWidth={2.5} />
                </span>
                <div>
                    <h1 className="font-bold text-lg text-fg-strong leading-tight">{APP_COPY.header.title}</h1>
                    <p className="text-sm text-fg-muted">{copy.title}</p>
                </div>
            </div>

            <Field label={copy.name}>
                <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" autoCapitalize="none" autoFocus required />
            </Field>
            <Field label={copy.pin}>
                <Input type="password" value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="current-password" required />
            </Field>

            {error && <p role="alert" className="text-sm text-danger-400">{error}</p>}

            <Button type="submit" className="w-full" disabled={busy || !name || !pin}>
                <LogIn size={16} />
                {copy.submit}
            </Button>
        </form>
    );
}
