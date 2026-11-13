import { FileText } from '@/components/ui/icons';
import { APP_COPY } from '@/locales';
import { VALUE_WARNING } from '@/components/ui/Table';

const highlight = (differs?: boolean) => (differs ? VALUE_WARNING : '');

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
                    <FileText size={12} className="flex-shrink-0" />
                    <span className={highlight(differs?.note)}>{note || APP_COPY.analytics.orderOperations.noNote}</span>
                </p>
            )}
        </div>
    );
}
