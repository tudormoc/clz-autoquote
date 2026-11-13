import { Ban, Check, CircleAlert, Copy, EqualNot, Layers, Pin, type LucideIcon } from '@/components/ui/icons';
import { articleDiffersText } from '@/components/analytics/order-operations/MisalignedOrderActions';
import { syncBlockText } from '@/lib/orders/syncBlocks';
import type { MisalignedOrder } from '@/lib/orders/types';
import { cn } from '@/lib/utils';
import { APP_COPY } from '@/locales';

const t = APP_COPY.analytics.orderOperations;
const copy = t.misaligned;

const TONES = {
    danger: 'text-danger-400',
    warning: 'text-warning-400',
    success: 'text-success-400',
    muted: 'text-fg-subtle',
} as const;

/** One thing to know about a row: its icon, its name (read on phones and by screen readers) and the full sentence */
interface Mark {
    icon: LucideIcon;
    label: string;
    title: string;
    tone: keyof typeof TONES;
}

/** What stops the realign of the row, or settles it: the most serious first */
function stateMarks(order: MisalignedOrder): Mark[] {
    const marks: Mark[] = [];
    if (order.error) marks.push({ icon: CircleAlert, label: copy.failed, title: `${copy.failed}: ${order.error}`, tone: 'danger' });
    if (order.netproArticle) marks.push({ icon: EqualNot, label: copy.articleDiffers, title: articleDiffersText(order), tone: 'danger' });
    if (order.syncBlocks.length > 0) marks.push({ icon: Ban, label: t.syncBlocked, title: syncBlockText(order.syncBlocks), tone: 'danger' });
    if (!order.error && order.differences.length === 0) marks.push({ icon: Check, label: APP_COPY.common.aligned, title: APP_COPY.common.aligned, tone: 'success' });
    return marks;
}

/**
 * What kind of row this is, as icons right after its buttons, each kind always in the same place so a look down the
 * list tells the rows apart: what stops the realign (comparison failed, another article in NetPro, blocked) or
 * "aligned", then what a realign leaves on the order because it was already used, then the article with several
 * production orders, then the commessa with several editions. The sentence is the icon's tooltip; on phones, where
 * nothing hovers, the name stands next to the icon.
 */
export function MisalignedOrderMarks({ order }: { order: MisalignedOrder }) {
    const state = stateMarks(order);
    const places: (Mark | null)[] = [
        state.length > 0 ? { ...state[0], title: state.map((mark) => mark.title).join('\n') } : null,
        order.syncKeeps.length > 0 ? { icon: Pin, label: t.syncKept, title: order.syncKeeps.join('\n'), tone: 'warning' } : null,
        order.otherOrders.length > 0 ? { icon: Copy, label: copy.duplicate, title: copy.duplicateTitle, tone: 'warning' } : null,
        order.multiEdition ? { icon: Layers, label: copy.multiEdition, title: copy.multiEditionTitle, tone: 'muted' } : null,
    ];

    return (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 md:flex-nowrap md:gap-0.5">
            {places.map((mark, place) => {
                // An empty place keeps the next icons in their column (not on phones, where the marks follow one another)
                if (!mark) return <span key={place} className="hidden h-5 w-5 md:inline-block" />;
                const Icon = mark.icon;
                return (
                    <span key={place} title={mark.title} className={cn('inline-flex h-5 items-center gap-1 md:w-5 md:justify-center', TONES[mark.tone])}>
                        <Icon size={16} aria-hidden />
                        <span className="text-2xs font-medium md:sr-only">{mark.label}</span>
                    </span>
                );
            })}
        </span>
    );
}
