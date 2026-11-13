import Link from 'next/link';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { requireLogin } from '@/lib/auth/access';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.auth;

export const metadata = { title: copy.noAccessTitle };

/** Where a page the person may not open sends them (src/lib/auth/access.ts → requirePage) */
export default async function NoAccessPage() {
    await requireLogin();

    return (
        <div className="flex justify-center py-12">
            <EmptyState className="w-full max-w-md" title={copy.noAccessTitle} description={copy.noAccessHint}>
                <Link href="/" className={buttonClasses({ variant: 'secondary', className: 'mt-4' })}>
                    {APP_COPY.errors.goHome}
                </Link>
            </EmptyState>
        </div>
    );
}
