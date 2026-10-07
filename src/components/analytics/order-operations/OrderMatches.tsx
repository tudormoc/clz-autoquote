import { ArrowRight } from 'lucide-react';
import type { MasterOrderMatch } from '@/app/analytics/queries/order-operations-queries';
import { APP_COPY } from '@/locales';

const t = APP_COPY.analytics.orderOperations;

interface OrderMatchesProps {
    matches: MasterOrderMatch[];
    onSelect: (rootCommessaKey: string) => void;
}

/** Orders found by a search that matched several: click one to open it. */
export function OrderMatches({ matches, onSelect }: OrderMatchesProps) {
    return (
        <div className="space-y-2">
            <p className="text-xs font-semibold text-fg-muted px-1">
                {t.multipleResultsFound}: <span className="text-fg-strong font-bold">{matches.length}</span> — {t.selectOrderToView}
            </p>

            <div className="divide-y divide-border/80 rounded-xl border border-border bg-card/40 overflow-hidden">
                {matches.map((match) => (
                    <button
                        key={match.root_commessa_key}
                        type="button"
                        onClick={() => onSelect(match.root_commessa_key)}
                        className="group w-full flex items-center justify-between gap-4 py-2 px-4 text-left hover:bg-muted/50 transition-colors"
                    >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <div className="flex flex-col items-center justify-center bg-muted/90 border border-border-strong/80 rounded-lg px-2.5 py-0.5 flex-shrink-0 min-w-16">
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
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
