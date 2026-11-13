import { CheckCircle, Database, XCircle } from '@/components/ui/icons';
import type { DbConnectionStatus } from '@/app/db-actions';
import { Spinner } from '@/components/ui/Spinner';
import { ViewLink } from '@/components/ui/ViewLink';
import { APP_CONFIG } from '@/config/constants';
import type { ViewTarget } from '@/hooks/useAddress';
import type { MSSQL_DB } from '@/lib/mssql';
import { cn } from '@/lib/utils';
import { APP_COPY } from '@/locales';
import { SURFACE_SELECTED, surfaceClasses } from '@/components/ui/Surface';

const copy = APP_COPY.database;

interface DatabaseCardsProps {
    selected: MSSQL_DB;
    /** The link that shows a database's tables */
    linkOf: (db: MSSQL_DB) => ViewTarget;
    /** Null until the connection checks have answered */
    connections: Record<MSSQL_DB, DbConnectionStatus> | null;
}

/** One card per database: whether it answers, and a click opens its tables. */
export function DatabaseCards({ selected, linkOf, connections }: DatabaseCardsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {APP_CONFIG.DATABASES.map((db) => {
                const status = connections?.[db];
                return (
                    <ViewLink
                        key={db}
                        to={linkOf(db)}
                        aria-current={db === selected ? 'page' : undefined}
                        className={surfaceClasses('panel', 'block p-4 text-left transition-colors', db === selected ? SURFACE_SELECTED : 'hover:bg-muted')}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2 font-semibold text-sm text-fg">
                                <Database size={16} className="text-primary" />
                                {copy.names[db]}
                            </span>
                            {!status ? (
                                <Spinner size={20} className="text-fg-subtle" />
                            ) : status.ok ? (
                                <CheckCircle size={20} className="text-success-500" />
                            ) : (
                                <XCircle size={20} className="text-danger" />
                            )}
                        </div>
                        {status && (
                            <p className={cn('mt-2 text-xs', status.ok ? 'text-success-500' : 'text-danger')}>
                                {status.ok ? copy.connected : status.error}
                            </p>
                        )}
                    </ViewLink>
                );
            })}
        </div>
    );
}
