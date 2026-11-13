import { statusBadgeClasses } from '@/components/ui/StatusBadge';

interface InfoBadgeProps {
    label: string;
    value: string | number;
    detail?: string;
    className?: string;
}

/** A grey badge with a name and its value (a total, a computed size) beside a form's fields. */
export function InfoBadge({ label, value, detail, className }: InfoBadgeProps) {
    return (
        <div className={statusBadgeClasses({ tone: 'neutral', size: 'md', className })}>
            <span className="text-3xs">{label}</span>
            <span className="text-fg font-mono">
                {value}
                {detail && <span className="text-3xs text-fg-muted ml-1">{detail}</span>}
            </span>
        </div>
    );
}
