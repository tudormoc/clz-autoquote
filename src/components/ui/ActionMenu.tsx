'use client';

import { useCallback, useRef, useState } from 'react';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { FloatingMenu, type MenuAction } from '@/components/ui/FloatingMenu';
import { APP_COPY } from '@/locales';
import { IconButton } from '@/components/ui/IconButton';

interface ActionMenuProps {
    actions: MenuAction[];
    /** Tooltip / screen-reader name of the button (default "Altre azioni") */
    label?: string;
    /** The button's icon (default "⋯") */
    icon?: LucideIcon;
}

/**
 * "⋯" button opening a short list of actions (`FloatingMenu`): under the button, or above it when there is no room
 * below; a click outside, Escape or scrolling closes it.
 */
export function ActionMenu({ actions, label = APP_COPY.common.moreActions, icon: Icon = MoreHorizontal }: ActionMenuProps) {
    const [open, setOpen] = useState(false);
    const button = useRef<HTMLButtonElement>(null);
    const close = useCallback(() => setOpen(false), []);

    if (actions.length === 0) return null;

    return (
        <>
            <IconButton
                ref={button}
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    setOpen(!open);
                }}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={label}
                title={label}
            >
                <Icon size={18} />
            </IconButton>
            {open && <FloatingMenu actions={actions} anchor={{ button }} onClose={close} />}
        </>
    );
}
