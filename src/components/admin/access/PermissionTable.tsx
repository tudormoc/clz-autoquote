import { LEVEL_COLUMN, LEVEL_COLUMNS, PermissionRow } from '@/components/admin/access/PermissionRow';
import type { NavItem } from '@/config/navigation';
import { ACCESS_AREAS, sharedLevel, withLevel, type AccessLevel, type PagePermissions } from '@/lib/auth/permissions';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.admin.groups;

const ALL_PAGES = ACCESS_AREAS.flatMap((entry) => entry.pages);

interface PermissionTableProps {
    pages: PagePermissions;
    onChange: (pages: PagePermissions) => void;
}

/**
 * What a group may open, in menu order: one row for all pages, one per area (sets all its pages at once), one per page.
 * An area with a single page is just that row.
 */
export function PermissionTable({ pages, onChange }: PermissionTableProps) {
    const levelsOf = (items: NavItem[]) => new Set<AccessLevel | null>(items.map((item) => pages[item.href] ?? null));
    const row = (label: string, variant: 'all' | 'area' | 'page', items: NavItem[], count?: string) => (
        <PermissionRow
            key={`${variant}:${items.map((item) => item.href).join()}`}
            label={label}
            variant={variant}
            level={sharedLevel(pages, items)}
            present={levelsOf(items)}
            count={count}
            editable={items.some((item) => item.editable)}
            onPick={(level) => onChange(withLevel(pages, items, level))}
        />
    );

    return (
        // No overflow clipping here: it would stop the header row from sticking
        <div className="border border-border rounded-lg divide-y divide-border/60">
            {/* Names of the columns; stays in view while scrolling (under the phone's top bar) */}
            <div className="sticky top-14 lg:top-0 z-10 flex items-center gap-2 px-3 py-2 rounded-t-lg bg-card text-xs font-semibold text-fg-muted">
                <div className="flex-1" />
                {LEVEL_COLUMNS.map((column) => (
                    <div key={column.label} className={LEVEL_COLUMN}>
                        {column.label}
                    </div>
                ))}
            </div>

            {row(copy.allPages, 'all', ALL_PAGES)}

            {ACCESS_AREAS.map(({ area, pages: items }) =>
                area.groups ? (
                    <div key={area.id} className="divide-y divide-border/60">
                        {row(area.label, 'area', items, `${items.filter((item) => pages[item.href]).length}/${items.length}`)}
                        {items.map((item) => row(item.label, 'page', [item]))}
                    </div>
                ) : (
                    row(area.label, 'area', items)
                )
            )}
        </div>
    );
}
