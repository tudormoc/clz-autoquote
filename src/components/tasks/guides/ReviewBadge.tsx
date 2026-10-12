import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatIsoDate } from '@/lib/tasks/describe';
import type { GuideSummary } from '@/lib/tasks/types';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.tasks.guides;

/** The review state of a procedure: due, checked on, never checked */
export function ReviewBadge({ guide }: { guide: Pick<GuideSummary, 'toReview' | 'reviewedAt'> }) {
    if (guide.toReview) return <StatusBadge tone="warning">{copy.toReview}</StatusBadge>;
    if (guide.reviewedAt) return <span className="text-xs text-fg-subtle">{fmt(copy.reviewedAt, { date: formatIsoDate(guide.reviewedAt) })}</span>;
    return <span className="text-xs text-fg-faint">{copy.neverReviewed}</span>;
}
