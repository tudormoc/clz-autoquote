import { FileText } from 'lucide-react';
import { APP_COPY } from '@/locales';

const highlight = (differs?: boolean) => (differs ? 'text-warning-300 bg-warning-500/15 rounded px-1 -mx-1' : '');

interface OperationCellProps {
    /** Operation name and its code */
    operation?: string;
    code?: number;
    center?: string | number;
    centerName?: string;
    note?: string;
    /** Parts that differ from the DiBa are highlighted */
    differs?: { operation?: boolean; center?: boolean; note?: boolean };
}

/** A phase in the comparison table: operation · work centre · note. */
export function OperationCell({ operation, code, center, centerName, note, differs }: OperationCellProps) {
    return (
        <div className="leading-tight min-w-0">
            <p className="font-semibold text-fg truncate" title={operation}>
                <span className={highlight(differs?.operation)}>{operation || '-'}</span>
                {code !== undefined && <span className="ml-1 text-3xs text-fg-subtle font-mono">({code})</span>}
            </p>
            <p className="text-2xs text-fg-muted truncate" title={centerName}>
                <span className={highlight(differs?.center)}>{center || '-'}{centerName ? ` · ${centerName}` : ''}</span>
            </p>
            {(note || differs?.note) && (
                <p className="text-2xs text-fg-subtle truncate max-w-72 flex items-center gap-1" title={note}>
                    <FileText className="w-3 h-3 flex-shrink-0" />
                    <span className={highlight(differs?.note)}>{note || APP_COPY.analytics.orderOperations.noNote}</span>
                </p>
            )}
        </div>
    );
}
