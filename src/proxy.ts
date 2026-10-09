import { NextResponse, type NextRequest } from 'next/server';
import { LOGIN_PATH } from '@/config/navigation';
import { SESSION_COOKIE, parseSession } from '@/lib/auth/session';

/**
 * First gate of every page request: without a valid login cookie, off to the login page (which then returns here).
 * Only the cookie is checked (fast, no database); each page and server action checks the person's pages itself
 * (src/lib/auth/access.ts). Server actions (POST) are left to those checks.
 */
export function proxy(request: NextRequest) {
    const { pathname, search } = request.nextUrl;
    if (request.method !== 'GET' || pathname === LOGIN_PATH) return NextResponse.next();
    if (parseSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

    const login = new URL(LOGIN_PATH, request.url);
    if (pathname !== '/') login.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(login);
}

// Not for the build's files, the icon, or the scheduler's call (/api/auto-exit checks its own key)
export const config = {
    matcher: ['/((?!_next/static|_next/image|icon.svg|favicon.ico|api/auto-exit).*)'],
};
