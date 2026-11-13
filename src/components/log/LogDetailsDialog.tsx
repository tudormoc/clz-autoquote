'use client';

import { useEffect, useState } from 'react';
import { ScrollText } from '@/components/ui/icons';
import { getLogDetailsAction } from '@/app/log-actions';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { describeDetails } from '@/lib/log/describe';
import type { LogEntryRow } from '@/lib/log/entries';
import { APP_COPY } from '@/locales';
import { surfaceClasses } from '@/components/ui/Surface';

const copy = APP_COPY.log;

interface LogDetailsDialogProps {
    entry: LogEntryRow;
    onClose: () => void;
}

/** The full record of one log entry: the rows changed, the values before and after. */
export function LogDetailsDialog({ entry, onClose }: LogDetailsDialogProps) {
    const [lines, setLines] = useState<string[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let open = true;
        getLogDetailsAction(entry.source, entry.id).then((result) => {
            if (!open) return;
            if (result.success) setLines(describeDetails(result.details));
            else setError(result.error);
        });
        return () => {
            open = false;
        };
    }, [entry.source, entry.id]);

    return (
        <Modal title={copy.detailsTitle} subtitle={entry.summary} icon={ScrollText} size="2xl" onClose={onClose}>
            {error && <p className="text-sm text-danger">{error}</p>}
            {!error && lines === null && <Spinner size={18} />}
            {lines && lines.length === 0 && <p className="text-sm text-fg-muted">{copy.noDetails}</p>}
            {lines && lines.length > 0 && (
                <pre className={surfaceClasses('inset', 'text-2xs font-mono text-fg-soft leading-relaxed whitespace-pre-wrap break-words p-3')}>
                    {lines.join('\n')}
                </pre>
            )}
        </Modal>
    );
}
