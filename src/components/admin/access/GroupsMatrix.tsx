'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FunctionTick } from '@/components/admin/access/FunctionTick';
import { GroupHeader } from '@/components/admin/access/GroupHeader';
import { LevelSegments } from '@/components/admin/access/LevelSegments';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import type { NavAreaId, NavItem } from '@/config/navigation';
import type { Group } from '@/lib/auth/accounts';
import { ACCESS_AREAS, GRANTABLE_PAGES, functionKey, grantable, sharedLevel, withLevel, type Grantable, type PagePermissions } from '@/lib/auth/permissions';
import { cn, foldText, toggleInSet } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.groups;

interface MatrixRow {
    key: string;
    label: string;
    /** Tooltip of the label */
    hint?: string;
    /**
     * all = every page, area = all pages of an area (or a single-page area), page = one page of an area,
     * function = one function of a page (ticked or not), given apart: the area and all rows never touch it
     */
    variant: 'all' | 'area' | 'page' | 'function';
    /** The area the row belongs to (none for "Tutte le pagine") */
    areaId?: NavAreaId;
    /** How far in the label sits: 0 area, 1 page of an area, 2 function of such a page */
    depth: 0 | 1 | 2;
    items: Grantable[];
}

/** A page's functions, as rows under it */
const functionRows = (page: NavItem, areaId: NavAreaId, depth: 1 | 2): MatrixRow[] =>
    (page.functions ?? []).map((fn) => ({
        key: fn.href,
        label: fn.label,
        hint: fn.description,
        variant: 'function',
        areaId,
        depth,
        items: [{ key: functionKey(page, fn), editable: true }],
    }));

/** Every row, in menu order: all pages, then each area followed by its pages (a single-page area is one row) and their functions */
const ROWS: MatrixRow[] = [
    { key: 'all', label: copy.allPages, variant: 'all', depth: 0, items: GRANTABLE_PAGES.map(grantable) },
    ...ACCESS_AREAS.flatMap(({ area, pages }): MatrixRow[] => [
        { key: area.id, label: area.label, variant: 'area', areaId: area.id, depth: 0, items: pages.map(grantable) },
        ...(area.groups
            ? pages.flatMap((page): MatrixRow[] => [
                  { key: page.href, label: page.label, variant: 'page', areaId: area.id, depth: 1, items: [grantable(page)] },
                  ...functionRows(page, area.id, 2),
              ])
            : functionRows(area, area.id, 1)),
    ]),
];

/** Areas with rows to open under them */
const FOLDABLE = new Set(ROWS.filter((row) => row.depth > 0).map((row) => row.areaId));

const ROW_LOOK = {
    all: 'font-semibold text-fg-strong',
    area: 'font-semibold text-fg-strong border-border-strong',
    page: 'text-fg-secondary',
    function: 'text-fg-muted',
} as const;

const DEPTH_LOOK = { 0: '', 1: 'pl-8', 2: 'pl-12' } as const;

/** The first column stays in view when the table scrolls sideways (phones, many groups) */
const STICKY = 'sticky left-0 bg-card';

/** The row's name contains the search text (folded, see foldText); nothing matches an empty search */
const labelMatches = (row: MatrixRow, text: string) => text !== '' && foldText(row.label).includes(text);

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

/**
 * Gruppi: one column per group, one row per area; an area opens to its pages and functions on a click on its name.
 * The search shows every area with a matching page or function, open. Area rows and "Tutte le pagine" set all
 * their pages at once; functions are ticked one by one.
 */
export function GroupsMatrix({ groups, pagesOf, members, onChange, onRename, onDuplicate, onDelete }: GroupsMatrixProps) {
    const [open, setOpen] = useState<ReadonlySet<NavAreaId>>(new Set());
    const [query, setQuery] = useState('');
    const text = foldText(query.trim());

    const rows = useMemo(() => {
        if (!text) return ROWS.filter((row) => row.depth === 0 || (row.areaId && open.has(row.areaId)));
        // An area shows, open, when its name or one of its rows matches; a matching area shows all its rows
        const areaHit = new Set(ROWS.filter((row) => row.variant === 'area' && labelMatches(row, text)).map((row) => row.areaId));
        const rowHit = new Set(ROWS.filter((row) => row.depth > 0 && labelMatches(row, text)).map((row) => row.areaId));
        return ROWS.filter((row) => {
            if (row.variant === 'all') return false;
            if (row.variant === 'area') return areaHit.has(row.areaId) || rowHit.has(row.areaId);
            return areaHit.has(row.areaId) || labelMatches(row, text);
        });
    }, [text, open]);

    const label = (row: MatrixRow) => {
        if (row.variant !== 'area' || !row.areaId || !FOLDABLE.has(row.areaId)) return <span title={row.hint}>{row.label}</span>;
        const areaId = row.areaId;
        const isOpen = text !== '' || open.has(areaId);
        const Chevron = isOpen ? ChevronDown : ChevronRight;
        return (
            <button
                type="button"
                onClick={() => setOpen((prev) => toggleInSet(prev, areaId))}
                aria-expanded={isOpen}
                title={fmt(APP_COPY.nav.showPages, { area: row.label })}
                className="inline-flex items-center gap-1 -ml-1 rounded px-1 hover:bg-muted transition-colors"
            >
                <Chevron size={14} className="text-fg-muted" />
                {row.label}
            </button>
        );
    };

    return (
        <div className="space-y-2">
            <div className="md:w-72">
                <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={copy.search} aria-label={copy.search} />
            </div>
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
                        {rows.length === 0 && (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={groups.length + 1} className="py-6 text-center text-sm text-fg-subtle">
                                    {copy.noMatch}
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row) => (
                            <TableRow key={row.key} className={cn('hover:bg-transparent', ROW_LOOK[row.variant], labelMatches(row, text) && 'bg-primary/5')}>
                                <TableCell className={cn(STICKY, 'py-2 max-sm:max-w-40', DEPTH_LOOK[row.depth])}>{label(row)}</TableCell>
                                {groups.map((group) => {
                                    const pages = pagesOf(group);
                                    const level = sharedLevel(pages, row.items);
                                    const name = fmt(copy.cellName, { group: group.name, page: row.label });
                                    return (
                                        <TableCell key={group.id} className="px-2 py-1.5 text-center">
                                            {row.variant === 'function' ? (
                                                <FunctionTick on={level === 'edit'} name={name} onChange={(on) => onChange(group, withLevel(pages, row.items, on ? 'edit' : null))} />
                                            ) : (
                                                <LevelSegments
                                                    level={level}
                                                    editable={row.items.some((item) => item.editable)}
                                                    name={name}
                                                    onChange={(next) => onChange(group, withLevel(pages, row.items, next))}
                                                />
                                            )}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
