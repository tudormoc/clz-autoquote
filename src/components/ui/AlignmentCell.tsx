import { StatusBadge } from '@/components/ui/StatusBadge';
import { APP_COPY } from '@/locales';

interface AlignmentCellProps {
    issues: string[];
    /** Said in place of "Allineato" on a row that counts as matching by exception: what it is and why it stays so */
    note?: string;
}

/**
 * Last cell of a comparison row: "Allineato" when the row matches, otherwise one line for each difference found.
 * The same cell in every comparison of the app (order ↔ DiBa, person ↔ programs).
 */
export function AlignmentCell({ issues, note }: AlignmentCellProps) {
    if (issues.length === 0) return note ? <StatusBadge tone="info">{note}</StatusBadge> : <StatusBadge tone="success">{APP_COPY.common.aligned}</StatusBadge>;

    return (
        <div className="flex flex-col gap-0.5">
            {issues.map((issue, index) => (
                <span key={index} className="text-3xs font-semibold text-warning-300">• {issue}</span>
            ))}
        </div>
    );
}
