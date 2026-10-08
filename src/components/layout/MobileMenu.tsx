'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar/Sidebar';
import { APP_COPY } from '@/locales';
import { cn } from '@/lib/utils';

interface MobileMenuProps {
    open: boolean;
    onClose: () => void;
}

/** Below the desktop width the sidebar slides in from the left over the page. Escape, a tap outside or a link closes it. */
export function MobileMenu({ open, onClose }: MobileMenuProps) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    return (
        // Stays mounted so it can slide out; `invisible` waits for the slide to end, `inert` keeps the keyboard out while closed
        <div className={cn('lg:hidden fixed inset-0 z-40 transition-[visibility] duration-200', open ? 'visible' : 'invisible')} inert={!open}>
            <div
                className={cn('absolute inset-0 bg-overlay/60 touch-none transition-opacity duration-200', open ? 'opacity-100' : 'opacity-0')}
                onClick={onClose}
            />
            <aside
                role="dialog"
                aria-modal="true"
                aria-label={APP_COPY.nav.menu}
                className={cn(
                    'absolute inset-y-0 left-0 w-sidebar max-w-[85vw] bg-card border-r border-border shadow-xl transition-transform duration-200',
                    open ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <Sidebar onClose={onClose} />
            </aside>
        </div>
    );
}
