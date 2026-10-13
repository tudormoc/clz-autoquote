'use client';

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MenuAction {
    label: string;
    icon?: LucideIcon;
    onSelect: () => void;
    /** danger: red text (cancel, archive) */
    tone?: 'danger';
    /** A thin line above it, setting it apart from the actions before */
    divider?: boolean;
}

/** Where the list opens: under its "⋯" button (right edges aligned), or at the mouse (right-click) */
export type MenuAnchor = { button: React.RefObject<HTMLElement | null> } | { x: number; y: number };

/** Room kept between the list and its button / the window edge (px) */
const GAP = 4;

/** Fixed position of the list; it opens upwards (and, at the mouse, to the left) where the window has no room */
function place(anchor: MenuAnchor, menu: HTMLElement): React.CSSProperties | null {
    const { offsetWidth: width, offsetHeight: height } = menu;
    if ('button' in anchor) {
        const box = anchor.button.current?.getBoundingClientRect();
        if (!box) return null;
        const below = box.bottom + GAP + height <= window.innerHeight;
        return {
            right: Math.max(GAP, window.innerWidth - box.right),
            ...(below ? { top: box.bottom + GAP } : { bottom: Math.max(GAP, window.innerHeight - box.top + GAP) }),
        };
    }
    return {
        left: anchor.x + width + GAP <= window.innerWidth ? anchor.x : Math.max(GAP, anchor.x - width),
        top: anchor.y + height + GAP <= window.innerHeight ? anchor.y : Math.max(GAP, anchor.y - height),
    };
}

interface FloatingMenuProps {
    actions: MenuAction[];
    anchor: MenuAnchor;
    onClose: () => void;
}

/**
 * A short list of actions floating above the page (not cut off by a panel that scrolls). A click outside, Escape,
 * scrolling or resizing the window closes it. Used by `ActionMenu` ("⋯") and by right-click menus (`useContextMenu`).
 */
export function FloatingMenu({ actions, anchor, onClose }: FloatingMenuProps) {
    const menu = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<React.CSSProperties | null>(null);
    const button = 'button' in anchor ? anchor.button : null;
    const x = 'x' in anchor ? anchor.x : null;
    const y = 'y' in anchor ? anchor.y : null;

    useLayoutEffect(() => {
        if (menu.current) setPosition(place(button ? { button } : { x: x ?? 0, y: y ?? 0 }, menu.current));
    }, [button, x, y]);

    useEffect(() => {
        // A click on the "⋯" button is left to the button (it toggles the list)
        const outside = (event: Event) => {
            const target = event.target as Node;
            if (!menu.current?.contains(target) && !button?.current?.contains(target)) onClose();
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        // Scrolling the page (not the list itself) or resizing the window (its target is not a Node)
        const away = (event: Event) => {
            if (!(event.target instanceof Node) || !menu.current?.contains(event.target)) onClose();
        };
        document.addEventListener('mousedown', outside);
        document.addEventListener('keydown', escape);
        window.addEventListener('scroll', away, true);
        window.addEventListener('resize', away);
        return () => {
            document.removeEventListener('mousedown', outside);
            document.removeEventListener('keydown', escape);
            window.removeEventListener('scroll', away, true);
            window.removeEventListener('resize', away);
        };
    }, [button, onClose]);

    return createPortal(
        <div
            ref={menu}
            role="menu"
            style={{ position: 'fixed', ...position }}
            // Events of a portal still reach the components around it: a right-click here must not open another menu
            onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
            }}
            className={cn('z-[60] min-w-52 max-h-[calc(100vh-0.5rem)] overflow-y-auto py-1 rounded-lg border border-border-strong bg-card shadow-lg', !position && 'invisible')}
        >
            {actions.map(({ label, icon: Icon, onSelect, tone, divider }) => (
                <Fragment key={label}>
                    {divider && <div role="separator" className="my-1 border-t border-border" />}
                    <button
                        type="button"
                        role="menuitem"
                        onClick={(event) => {
                            event.stopPropagation();
                            onClose();
                            onSelect();
                        }}
                        className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted transition-colors',
                            tone === 'danger' ? 'text-danger-400' : 'text-fg'
                        )}
                    >
                        {Icon && <Icon size={15} className="shrink-0 opacity-80" />}
                        {label}
                    </button>
                </Fragment>
            ))}
        </div>,
        document.body
    );
}
