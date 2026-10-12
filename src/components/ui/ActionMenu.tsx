'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { APP_COPY } from '@/locales';
import { cn } from '@/lib/utils';

export interface MenuAction {
    label: string;
    icon?: LucideIcon;
    onSelect: () => void;
    /** danger: red text (cancel, archive) */
    tone?: 'danger';
}

interface ActionMenuProps {
    actions: MenuAction[];
    /** Tooltip / screen-reader name of the button (default "Altre azioni") */
    label?: string;
}

/** Room kept between the menu and the button / the window edge (px) */
const GAP = 4;

/**
 * "⋯" button opening a short list of actions; a click outside, Escape or scrolling closes it. The list floats above the
 * page (it is not cut off by a panel that scrolls) and opens upwards when there is no room below the button.
 */
export function ActionMenu({ actions, label = APP_COPY.common.moreActions }: ActionMenuProps) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<React.CSSProperties>({});
    const button = useRef<HTMLButtonElement>(null);
    const menu = useRef<HTMLDivElement>(null);

    // Placed under the button, right edges aligned; above it when the window has no room below
    useLayoutEffect(() => {
        if (!open || !button.current || !menu.current) return;
        const anchor = button.current.getBoundingClientRect();
        const height = menu.current.offsetHeight;
        const below = anchor.bottom + GAP + height <= window.innerHeight;
        setPosition({
            right: Math.max(GAP, window.innerWidth - anchor.right),
            ...(below ? { top: anchor.bottom + GAP } : { bottom: Math.max(GAP, window.innerHeight - anchor.top + GAP) }),
        });
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const close = (event: Event) => {
            const target = event.target as Node;
            if (!button.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };
        const away = (event: Event) => {
            if (!menu.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', escape);
        window.addEventListener('scroll', away, true);
        window.addEventListener('resize', away);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', escape);
            window.removeEventListener('scroll', away, true);
            window.removeEventListener('resize', away);
        };
    }, [open]);

    if (actions.length === 0) return null;

    return (
        <>
            <button
                ref={button}
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    setPosition({});
                    setOpen(!open);
                }}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={label}
                title={label}
                className="p-1.5 rounded text-fg-muted hover:text-fg-strong hover:bg-muted transition-colors"
            >
                <MoreHorizontal size={18} />
            </button>
            {open &&
                createPortal(
                    <div
                        ref={menu}
                        role="menu"
                        style={{ position: 'fixed', ...position }}
                        className={cn('z-[60] min-w-52 py-1 rounded-lg border border-border-strong bg-card shadow-lg', !('right' in position) && 'invisible')}
                    >
                        {actions.map(({ label: text, icon: Icon, onSelect, tone }) => (
                            <button
                                key={text}
                                type="button"
                                role="menuitem"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setOpen(false);
                                    onSelect();
                                }}
                                className={cn(
                                    'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted transition-colors',
                                    tone === 'danger' ? 'text-danger-400' : 'text-fg'
                                )}
                            >
                                {Icon && <Icon size={15} className="shrink-0 opacity-80" />}
                                {text}
                            </button>
                        ))}
                    </div>,
                    document.body
                )}
        </>
    );
}
