import { ChevronLeft, Package, Printer } from '@/components/ui/icons';
import { buttonClasses } from '@/components/ui/Button';
import { ViewLink } from '@/components/ui/ViewLink';
import type { ViewTarget } from '@/hooks/useAddress';
import type { buildProductionFlow } from '@/lib/orders/flow';
import { APP_COPY } from '@/locales';
import type { OrderEdition } from '@/types';
import { Surface } from '@/components/ui/Surface';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { IconTile } from '@/components/ui/IconTile';
import { iconButtonClasses } from '@/components/ui/IconButton';
import { titleClasses } from '@/components/ui/titleLook';

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
        <Surface className="flex-shrink-0 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {backTo && (
                    <ViewLink
                        to={backTo}
                        className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                        title={t.backToResults}
                    >
                        <ChevronLeft size={16} className="text-primary" />
                        <span>{matchCount}</span>
                    </ViewLink>
                )}

                <div className="flex items-center gap-2.5 min-w-0">
                    <IconTile>
                        <Package size={16} />
                    </IconTile>
                    <h2 className={titleClasses('page', 'whitespace-nowrap')}>
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
                        {flow.running > 0 && <StatusBadge tone="info">{flow.running} {t.statusActive}</StatusBadge>}
                        {flow.paused > 0 && <StatusBadge tone="warning">{flow.paused} {t.statusPaused}</StatusBadge>}
                    </div>
                )}

                <div className="ml-auto flex items-center gap-2 flex-wrap">
                    {editions.map((edition, index) => (
                        <Surface kind="inset" key={edition.commessa_full} className="flex items-center gap-1.5 pl-2" title={edition.order_description}>
                            {editions.length > 1 && <span className="text-3xs font-bold text-primary">{t.editionSingle} {index + 1}</span>}
                            <span className="font-mono text-xs text-fg-secondary">{edition.commessa_full}</span>
                            {edition.ordine && (
                                <a
                                    href={printUrl('netproId', edition.ordine)}
                                    target="_blank"
                                    rel="noopener"
                                    className={iconButtonClasses()}
                                    title={t.printCommessa}
                                >
                                    <Printer size={14} />
                                </a>
                            )}
                        </Surface>
                    ))}
                    {editions.length > 1 && printable.length > 0 && (
                        <a href={printUrl('netproIds', printable.join(','))} target="_blank" rel="noopener" className={buttonClasses({ size: 'sm' })}>
                            <Printer size={14} />
                            {t.printAllEditions} ({editions.length})
                        </a>
                    )}
                </div>
            </div>
        </Surface>
    );
}
