import { ChevronLeft, Package, Printer } from 'lucide-react';
import { buttonClasses } from '@/components/ui/Button';
import { ViewLink } from '@/components/ui/ViewLink';
import type { ViewTarget } from '@/hooks/useAddress';
import type { buildProductionFlow } from '@/lib/orders/flow';
import { APP_COPY } from '@/locales';
import type { OrderEdition } from '@/types';

const t = APP_COPY.analytics.orderOperations;

const printUrl = (param: string, value: string) => `/api/reports/commessa?${param}=${encodeURIComponent(value)}`;

interface OrderHeaderProps {
    editions: OrderEdition[];
    flow: ReturnType<typeof buildProductionFlow>;
    /** The link back to the list the order was picked from, when there is one to go back to */
    backTo?: ViewTarget;
    /** How many orders that list has, when it is known */
    matchCount?: number;
}

/** Strip above the order: title, client, progress, the editions with a print link for each (the PDF opens in another tab). */
export function OrderHeader({ editions, flow, matchCount, backTo }: OrderHeaderProps) {
    const info = editions[0];
    if (!info) return null;

    const title = info.master_order_title || info.order_description;
    const printable = editions.map((edition) => edition.ordine).filter((id): id is string => !!id);

    return (
        <div className="flex-shrink-0 rounded-xl border border-border bg-card/60 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {backTo && (
                    <ViewLink
                        to={backTo}
                        className="flex items-center gap-1 text-xs text-fg-secondary hover:text-fg-strong px-2 py-1 rounded-lg border border-border bg-card/60 hover:bg-muted"
                        title={t.backToResults}
                    >
                        <ChevronLeft className="w-4 h-4 text-primary" />
                        <span>{matchCount}</span>
                    </ViewLink>
                )}

                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                        <Package className="w-4 h-4" />
                    </div>
                    <h2 className="text-lg font-bold text-fg-strong whitespace-nowrap">
                        {t.orderTitle} <span className="text-primary">{info.commessa_display}</span>
                    </h2>
                </div>

                {title && (
                    <div className="min-w-0 max-w-[40%]">
                        <p className="text-3xs text-fg-subtle font-semibold leading-none">{t.title}</p>
                        <p className="text-sm font-semibold text-fg truncate" title={title}>{title}</p>
                    </div>
                )}

                {info.client_name && (
                    <div className="min-w-0">
                        <p className="text-3xs text-fg-subtle font-semibold leading-none">{t.client}</p>
                        <p className="text-sm font-semibold text-fg-soft truncate">{info.client_name}</p>
                    </div>
                )}

                {flow.total > 0 && (
                    <div className="flex items-center gap-2 min-w-[180px]">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-success-600" style={{ width: `${flow.progressPercent}%` }} />
                        </div>
                        <span className="text-xs font-mono text-fg-secondary whitespace-nowrap">{flow.completed}/{flow.total}</span>
                        {flow.running > 0 && <span className="text-3xs px-1.5 rounded bg-info/15 text-info-400 border border-info/30">{flow.running} {t.statusActive}</span>}
                        {flow.paused > 0 && <span className="text-3xs px-1.5 rounded bg-warning/15 text-warning-300 border border-warning/30">{flow.paused} {t.statusPaused}</span>}
                    </div>
                )}

                <div className="ml-auto flex items-center gap-2 flex-wrap">
                    {editions.map((edition, index) => (
                        <div key={edition.commessa_full} className="flex items-center gap-1.5 pl-2 rounded-lg bg-card/70 border border-border" title={edition.order_description}>
                            {editions.length > 1 && <span className="text-3xs font-bold text-primary">{t.editionSingle} {index + 1}</span>}
                            <span className="font-mono text-xs text-fg-secondary">{edition.commessa_full}</span>
                            {edition.ordine && (
                                <a
                                    href={printUrl('netproId', edition.ordine)}
                                    target="_blank"
                                    rel="noopener"
                                    className="p-1.5 rounded-r-lg text-fg-secondary hover:text-primary hover:bg-primary/15 border-l border-border"
                                    title={t.printCommessa}
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                </a>
                            )}
                        </div>
                    ))}
                    {editions.length > 1 && printable.length > 0 && (
                        <a href={printUrl('netproIds', printable.join(','))} target="_blank" rel="noopener" className={buttonClasses({ size: 'sm' })}>
                            <Printer className="w-3.5 h-3.5" />
                            {t.printAllEditions} ({editions.length})
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
