import { redirect } from 'next/navigation';
import { HOME_PATH } from '@/config/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { getAccess } from '@/lib/auth/access';
import { APP_COPY } from '@/locales';

export const metadata = { title: APP_COPY.auth.title };

interface LoginPageProps {
    searchParams: Promise<{ next?: string }>;
}

/** The only page open without a login; someone already logged in goes home */
export default async function LoginPage({ searchParams }: LoginPageProps) {
    if (await getAccess().catch(() => null)) redirect(HOME_PATH);
    const { next } = await searchParams;

    return (
        <main className="min-h-dvh flex items-center justify-center p-4 bg-background">
            <LoginForm next={next} />
        </main>
    );
}
