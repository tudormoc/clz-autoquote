'use client';

import { AlertCircle, CheckCircle2, Info, X } from '@/components/ui/icons';
import { dismissNotice, noticeStore, type Notice, type NoticeTone } from '@/lib/notify';
import { useStore } from '@/lib/store';
import { APP_COPY } from '@/locales';
import { surfaceClasses } from '@/components/ui/Surface';
import { IconButton } from '@/components/ui/IconButton';

const TONES: Record<NoticeTone, { icon: typeof Info; className: string }> = {
    success: { icon: CheckCircle2, className: 'border-success-600/50 text-success-300' },
    info: { icon: Info, className: 'border-info-600/50 text-info-300' },
    error: { icon: AlertCircle, className: 'border-danger-600/60 text-danger-300' },
};

const NO_NOTICES: Notice[] = [];

/** Stack of notices from notify(), bottom right; mounted once in the root layout. */
export function Notices() {
    const notices = useStore(noticeStore, NO_NOTICES);
    if (notices.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-notice flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]" aria-live="polite">
            {notices.map(({ id, tone, message }) => {
                const { icon: Icon, className } = TONES[tone];
                return (
                    <div
                        key={id}
                        role={tone === 'error' ? 'alert' : 'status'}
                        className={surfaceClasses('floating', 'flex items-start gap-2 p-3 text-sm', className)}
                    >
                        <Icon size={16} className="mt-0.5 shrink-0" />
                        <p className="flex-1 text-fg-soft break-words">{message}</p>
                        <IconButton type="button" size="sm" onClick={() => dismissNotice(id)} title={APP_COPY.common.close} aria-label={APP_COPY.common.close}>
                            <X size={14} />
                        </IconButton>
                    </div>
                );
            })}
        </div>
    );
}
