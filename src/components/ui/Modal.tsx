'use client';

import { useEffect, useId } from 'react';
import { X, type LucideIcon } from '@/components/ui/icons';
import { APP_COPY } from '@/locales';
import { surfaceClasses } from '@/components/ui/Surface';
import { IconButton } from '@/components/ui/IconButton';
import { IconTile, type IconTone } from '@/components/ui/IconTile';
import { titleClasses } from '@/components/ui/titleLook';

const SIZES = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    /** A comparison table with several columns (Scheda persona) */
    '2xl': 'max-w-5xl',
} as const;

interface ModalProps {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    icon?: LucideIcon;
    iconTone?: IconTone;
    size?: keyof typeof SIZES;
    onClose: () => void;
    /** While true (saving, generating …) the window cannot be closed */
    busy?: boolean;
    /** Buttons at the bottom, right-aligned */
    footer?: React.ReactNode;
    children: React.ReactNode;
}

/** The app's popup window: title bar with close button, scrolling body, button row. Escape closes it. */
export function Modal({ title, subtitle, icon: Icon, iconTone = 'primary', size = 'md', onClose, busy, footer, children }: ModalProps) {
    const titleId = useId();

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !busy) onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [busy, onClose]);

    return (
        <div className="fixed inset-0 z-window flex items-center justify-center p-4 bg-overlay/60 backdrop-blur-sm">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className={surfaceClasses('floating', 'w-full max-h-full flex flex-col overflow-hidden shadow-2xl', SIZES[size])}
            >
                <div className="flex items-start justify-between gap-3 p-4 border-b border-border">
                    <div className="flex items-center gap-3 min-w-0">
                        {Icon && (
                            <IconTile tone={iconTone}>
                                <Icon size={18} />
                            </IconTile>
                        )}
                        <div className="min-w-0">
                            <h2 id={titleId} className={titleClasses('panel')}>
                                {title}
                            </h2>
                            {subtitle && <p className="text-xs text-fg-muted mt-0.5">{subtitle}</p>}
                        </div>
                    </div>
                    <IconButton size="sm"
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        title={APP_COPY.common.close}
                        className="disabled:opacity-50"
                    >
                        <X size={18} />
                    </IconButton>
                </div>
                <div className="p-4 overflow-y-auto flex-1 min-h-0 text-sm">{children}</div>
                {footer && <div className="flex justify-end gap-2 p-4 border-t border-border">{footer}</div>}
            </div>
        </div>
    );
}
