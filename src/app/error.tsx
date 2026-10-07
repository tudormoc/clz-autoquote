'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button, buttonClasses } from '@/components/ui/Button';
import { APP_COPY } from '@/locales';

/** Shown instead of a page that crashed while rendering. "Riprova" renders the page again. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error('Page error:', error);
    }, [error]);

    const copy = APP_COPY.errors;

    return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4">
            <div className="w-full max-w-md bg-card border border-danger/40 rounded-lg p-6 space-y-4">
                <div className="flex items-center gap-3 text-danger">
                    <AlertTriangle size={20} />
                    <h1 className="text-lg font-semibold">{copy.title}</h1>
                </div>
                <p className="text-sm text-fg-muted">{copy.generic}</p>
                {error.digest && <p className="text-xs font-mono text-fg-subtle">{error.digest}</p>}
                <div className="flex gap-2">
                    <Button onClick={reset}>
                        <RotateCcw size={16} />
                        {copy.retry}
                    </Button>
                    <Link href="/" className={buttonClasses({ variant: 'outline' })}>
                        {copy.goHome}
                    </Link>
                </div>
            </div>
        </div>
    );
}
