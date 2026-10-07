/** Bordered list of label / value rows (settings, operators). */
export function RowList({ children }: { children: React.ReactNode }) {
    return <div className="border border-border rounded-lg overflow-hidden divide-y divide-border/60 bg-card/40">{children}</div>;
}

interface RowProps {
    /** Main text of the row */
    label: React.ReactNode;
    /** Small mono text next to the label (a code) */
    code?: string;
    /** Right side: a value, a badge, buttons */
    children?: React.ReactNode;
}

export function Row({ label, code, children }: RowProps) {
    return (
        <div className="px-4 py-2.5 flex items-center justify-between gap-4 text-xs hover:bg-muted/20 transition-colors">
            <div className="flex items-center gap-2 min-w-0">
                <span className="text-fg-secondary font-medium">{label}</span>
                {code && <span className="text-3xs text-fg-subtle font-mono">({code})</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0">{children}</div>
        </div>
    );
}
