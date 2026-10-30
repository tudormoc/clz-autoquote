import { GroupHeader } from '@/components/admin/access/GroupHeader';
import { LevelToggle } from '@/components/admin/access/LevelToggle';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import type { NavItem } from '@/config/navigation';
import type { Group } from '@/lib/auth/accounts';
import { ACCESS_AREAS, GRANTABLE_PAGES, nextLevel, sharedLevel, withLevel, type Grantable, type PagePermissions } from '@/lib/auth/permissions';
import { cn } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.groups;

interface MatrixRow {
    key: string;
    label: string;
    /** Tooltip of the label */
    hint?: string;
    /**
     * all = every page, area = all pages of an area (or a single-page area), page = one page of an area,
     * function = one function of a page (Sì / No), given apart: the area and all rows never touch it
     */
    variant: 'all' | 'area' | 'page' | 'function';
    /** How far in the label sits: 0 area, 1 page of an area, 2 function of such a page */
    depth: 0 | 1 | 2;
    items: Grantable[];
}

/** A page's functions, as rows under it */
const functionRows = (page: NavItem, depth: 1 | 2): MatrixRow[] =>
    (page.functions ?? []).map((fn) => ({ key: fn.href, label: fn.label, hint: fn.description, variant: 'function', depth, items: [{ href: fn.href, editable: true }] }));

/** The rows, in menu order: all pages, then each area followed by its pages (a single-page area is one row) and their functions */
const ROWS: MatrixRow[] = [
    { key: 'all', label: copy.allPages, variant: 'all', depth: 0, items: GRANTABLE_PAGES },
    ...ACCESS_AREAS.flatMap(({ area, pages }): MatrixRow[] => [
        { key: area.id, label: area.label, variant: 'area', depth: 0, items: pages },
        ...(area.groups
            ? pages.flatMap((page): MatrixRow[] => [{ key: page.href, label: page.label, variant: 'page', depth: 1, items: [page] }, ...functionRows(page, 2)])
            : functionRows(area, 1)),
    ]),
];

const ROW_LOOK = {
    all: 'font-semibold text-fg-strong',
    area: 'font-semibold text-fg-strong border-border-strong',
    page: 'text-fg-secondary',
    function: 'text-fg-muted',
} as const;

const DEPTH_LOOK = { 0: '', 1: 'pl-8', 2: 'pl-12' } as const;

/** Where a click takes a row: a function goes No ↔ Sì, a page No → Vede → Modifica → No */
const clickedLevel = (row: MatrixRow, level: ReturnType<typeof sharedLevel>) =>
    row.variant === 'function' ? (level === 'edit' ? null : 'edit') : nextLevel(level, row.items.some((item) => item.editable));

/** The first column stays in view when the table scrolls sideways (phones, many groups) */
const STICKY = 'sticky left-0 bg-card';

interface GroupsMatrixProps {
    groups: Group[];
    /** A group's pages as shown (with clicks not yet saved) */
    pagesOf: (group: Group) => PagePermissions;
    /** Users' names per group id */
    members: Map<number, string[]>;
    onChange: (group: Group, pages: PagePermissions) => void;
    onRename: (group: Group, name: string) => Promise<boolean>;
    onDuplicate: (group: Group) => void;
    onDelete: (group: Group) => void;
}

/** Gruppi: one column per group, one row per page; area rows and "Tutte le pagine" set all their pages at once. */
export function GroupsMatrix({ groups, pagesOf, members, onChange, onRename, onDuplicate, onDelete }: GroupsMatrixProps) {
    return (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
            <Table containerClassName="max-h-panel overflow-y-auto">
                <TableHeader className="z-20">
                    <TableRow className="hover:bg-transparent">
                        <TableHead className={cn(STICKY, 'align-bottom')}>{copy.page}</TableHead>
                        {groups.map((group) => (
                            <TableHead key={group.id} className="px-2 align-bottom">
                                <GroupHeader
                                    group={group}
                                    members={members.get(group.id) ?? []}
                                    onRename={(name) => onRename(group, name)}
                                    onDuplicate={() => onDuplicate(group)}
                                    onDelete={() => onDelete(group)}
                                />
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {ROWS.map((row) => (
                        <TableRow key={row.key} className={cn('hover:bg-transparent', ROW_LOOK[row.variant])}>
                            <TableCell className={cn(STICKY, 'py-2 max-sm:max-w-40', DEPTH_LOOK[row.depth])} title={row.hint}>
                                {row.label}
                            </TableCell>
                            {groups.map((group) => {
                                const pages = pagesOf(group);
                                const level = sharedLevel(pages, row.items);
                                return (
                                    <TableCell key={group.id} className="px-2 py-1.5 text-center">
                                        <LevelToggle
                                            level={level}
                                            variant={row.variant === 'function' ? 'function' : 'page'}
                                            label={(shown) => fmt(copy.cell, { group: group.name, page: row.label, level: shown })}
                                            onClick={() => onChange(group, withLevel(pages, row.items, clickedLevel(row, level)))}
                                        />
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
