import { ArrowRight } from '@/components/ui/icons';
import { ViewLink } from '@/components/ui/ViewLink';
import type { ViewTarget } from '@/hooks/useAddress';
import type { MasterOrderMatch } from '@/lib/orders/types';
import { APP_COPY } from '@/locales';
import { Surface, surfaceClasses } from '@/components/ui/Surface';
import { menuRowClasses } from '@/components/ui/MenuRow';

const t = APP_COPY.analytics.orderOperations;

interface OrderMatchesProps {
    matches: MasterOrderMatch[];
    /** The link that opens an order (the first characters of its commessa) */
    linkOf: (rootCommessaKey: string) => ViewTarget;
}

/** Orders found by a search that matched several: each one is the link that opens it. */
export function OrderMatches({ matches, linkOf }: OrderMatchesProps) {
    return (
        <div className="space-y-2">
            <p className="text-xs font-semibold text-fg-muted px-1">
                {t.multipleResultsFound}: <span className="text-fg-strong font-bold">{matches.length}</span> — {t.selectOrderToView}
            </p>

            <Surface className="divide-y divide-border/80 overflow-hidden">
                {matches.map((match) => (
                    <ViewLink
                        key={match.root_commessa_key}
                        to={linkOf(match.root_commessa_key)}
                        className={menuRowClasses({}, 'group justify-between gap-4 px-4')}
                    >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <div className={surfaceClasses('inset', 'flex flex-col items-center justify-center px-2.5 py-0.5 flex-shrink-0 min-w-16')}>
                                <span className="text-sm font-bold text-fg-strong font-mono leading-tight">{match.commessa_display}</span>
                                <span className="text-3xs text-fg-muted font-medium">20{match.year_code}</span>
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-fg-soft group-hover:text-primary transition-colors truncate">{match.master_order_title}</p>
                                <div className="flex items-center gap-2 text-xs text-fg-muted">
                                    <span className="truncate max-w-80">{match.client_name || '-'}</span>
                                    <span>•</span>
                                    <span className="text-fg-subtle font-medium">
                                        {match.edition_count} {match.edition_count === 1 ? t.editionSingle : t.editions}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 text-fg-subtle group-hover:text-primary transition-colors text-xs font-semibold">
                            <span className="hidden sm:inline">{t.openOrder}</span>
                            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                    </ViewLink>
                ))}
            </Surface>
        </div>
    );
}
