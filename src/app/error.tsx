'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from '@/components/ui/icons';
import { Button, buttonClasses } from '@/components/ui/Button';
import { APP_COPY } from '@/locales';
import { Surface } from '@/components/ui/Surface';
import { titleClasses } from '@/components/ui/titleLook';

/** Shown instead of a page that crashed while rendering. "Riprova" renders the page again. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error('Page error:', error);
    }, [error]);

    const copy = APP_COPY.errors;

    return (
        <div className="flex justify-center py-12">
            <Surface className="w-full max-w-md border-danger/40 p-6 space-y-4">
                <div className="flex items-center gap-3 text-danger">
                    <AlertTriangle size={20} />
                    <h1 className={titleClasses('panel')}>{copy.title}</h1>
                </div>
                <p className="text-sm text-fg-muted">{copy.generic}</p>
                {error.digest && <p className="text-xs font-mono text-fg-subtle">{error.digest}</p>}
                <div className="flex gap-2">
                    <Button onClick={reset}>
                        <RotateCcw size={16} />
                        {copy.retry}
                    </Button>
                    <Link href="/" className={buttonClasses({ variant: 'secondary' })}>
                        {copy.goHome}
                    </Link>
                </div>
            </Surface>
        </div>
    );
}
