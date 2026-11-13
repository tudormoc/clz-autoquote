import { ViewLink } from '@/components/ui/ViewLink';
import type { ViewTarget } from '@/hooks/useAddress';
import type { Group } from '@/lib/auth/accounts';
import { lightCounts } from '@/lib/auth/lights';
import { GRANTABLE_PAGES, type PagePermissions } from '@/lib/auth/permissions';
import { APP_COPY, fmt } from '@/locales';
import { pressableSurfaceClasses } from '@/components/ui/SurfaceButton';

const copy = APP_COPY.admin.groups;

/** Share of all the pages, as a whole percent for a bar's width */
const share = (count: number) => Math.round((count / GRANTABLE_PAGES.length) * 100);

interface GroupCardsProps {
    groups: Group[];
    selectedId: number;
    /** A group's pages as shown (with clicks not yet saved) */
    pagesOf: (group: Group) => PagePermissions;
    /** Users' names per group id */
    members: Map<number, string[]>;
    /** The link that shows a group */
    linkOf: (group: Group) => ViewTarget;
}

/**
 * Gruppi: one card per group, the one being worked on marked. Each says how many users and pages it has; the bar
 * shows how much of the app it opens: the part it modifies, then the part it only sees.
 */
export function GroupCards({ groups, selectedId, pagesOf, members, linkOf }: GroupCardsProps) {
    return (
        <div className="flex flex-wrap gap-2 xl:flex-col xl:flex-nowrap">
            {groups.map((group) => {
                const counts = lightCounts(pagesOf(group));
                const names = members.get(group.id) ?? [];
                const selected = group.id === selectedId;
                return (
                    <ViewLink
                        key={group.id}
                        to={linkOf(group)}
                        aria-current={selected ? 'page' : undefined}
                        title={names.length > 0 ? names.join(', ') : copy.noMembers}
                        className={pressableSurfaceClasses({ selected }, 'block min-w-40 flex-1 px-3 py-2 xl:flex-none')}
                    >
                        <span className="block truncate text-sm font-semibold text-fg-strong">{group.name}</span>
                        <span className="block text-xs text-fg-muted">
                            {fmt(copy.members, { count: names.length })} · {fmt(copy.cardPages, { count: counts.see })}
                        </span>
                        <span className="mt-2 flex h-1 overflow-hidden rounded-full bg-muted-strong">
                            <span className="bg-warning-500" style={{ width: `${share(counts.modify)}%` }} />
                            <span className="bg-primary" style={{ width: `${share(counts.see - counts.modify)}%` }} />
                        </span>
                    </ViewLink>
                );
            })}
        </div>
    );
}
