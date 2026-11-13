import Link from 'next/link';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { APP_COPY } from '@/locales';

export const metadata = { title: APP_COPY.errors.notFound };

/** Shown for an address that matches no page (and when a page calls notFound()). */
export default function NotFound() {
    const copy = APP_COPY.errors;

    return (
        <div className="flex justify-center py-12">
            <EmptyState className="w-full max-w-md" title={copy.notFound} description={copy.notFoundHint}>
                <Link href="/" className={buttonClasses({ variant: 'secondary', className: 'mt-4' })}>
                    {copy.goHome}
                </Link>
            </EmptyState>
        </div>
    );
}
