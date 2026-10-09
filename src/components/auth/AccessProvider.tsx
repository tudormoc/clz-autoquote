'use client';

import { createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import { findNavLocation } from '@/config/navigation';
import { canOpen, type UserAccess } from '@/lib/auth/permissions';

const AccessContext = createContext<UserAccess | null>(null);

/** The logged-in person (from the root layout) for the browser parts: menu, home cards, edit buttons */
export function AccessProvider({ access, children }: { access: UserAccess | null; children: React.ReactNode }) {
    return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>;
}

/** The logged-in person, null on the login page */
export const useAccess = () => useContext(AccessContext);

/**
 * May the person change data on the page they are on? Edit buttons and click-to-edit cells hide when not.
 * Only for the look: every save is checked again on the server.
 */
export function useCanEdit(): boolean {
    const access = useAccess();
    const { area, page } = findNavLocation(usePathname());
    const href = page?.href ?? area?.href;
    return !!access && !!href && canOpen(access, href, 'edit');
}
