'use client';

import { useMemo, useState } from 'react';
import { Eye, Pencil, type LucideIcon } from '@/components/ui/icons';
import { Light } from '@/components/admin/access/Light';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import type { ChoiceTone } from '@/components/ui/ChoiceButton';
import { pageFunctions, type NavAreaId, type NavItem } from '@/config/navigation';
import { LIGHTS, functionOn, lightState, withFunction, withLight, type LightKind } from '@/lib/auth/lights';
import { ACCESS_AREAS, GRANTABLE_PAGES, type PagePermissions } from '@/lib/auth/permissions';
import { cn, foldText, toggleInSet } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';
import { Surface } from '@/components/ui/Surface';
import { FoldToggle } from '@/components/ui/FoldToggle';

const copy = APP_COPY.admin.groups;

/** How each light is drawn: its icon and its colour when on */
const LOOK: Record<LightKind, { icon: LucideIcon; tone: ChoiceTone }> = {
    see: { icon: Eye, tone: 'primary' },
    modify: { icon: Pencil, tone: 'warning' },
};

interface LightRow {
    key: string;
    label: string;
    /** Tooltip of the label */
    hint?: string;
    /** all = every page, area = the pages of an area, page = one page (of an area, or an area that is one page) */
    variant: 'all' | 'area' | 'page';
    areaId?: NavAreaId;
    /** A page listed under its area: shown when the area is open */
    nested: boolean;
    /** The pages the row's lights switch */
    pages: NavItem[];
    /** What the search looks in: the label and, for a page, its functions (folded, see foldText) */
    search: string;
}

const pageRow = (page: NavItem, areaId: NavAreaId, nested: boolean): LightRow => ({
    key: page.href,
    label: page.label,
    hint: page.description,
    variant: 'page',
    areaId,
    nested,
    pages: [page],
    search: foldText([page.label, ...pageFunctions(page).map((fn) => fn.label)].join(' ')),
});

/** Every row, in menu order: all pages, then each area followed by its pages (an area that is one page is one row) */
const ROWS: LightRow[] = [
    { key: 'all', label: copy.allPages, variant: 'all', nested: false, pages: GRANTABLE_PAGES, search: '' },
    ...ACCESS_AREAS.flatMap(({ area, pages }): LightRow[] =>
        area.groups
            ? [
                  { key: area.id, label: area.label, variant: 'area', areaId: area.id, nested: false, pages, search: foldText(area.label) },
                  ...pages.map((page) => pageRow(page, area.id, true)),
              ]
            : [pageRow(area, area.id, false)]
    ),
];

/** Areas with pages to open under them */
const FOLDABLE: ReadonlySet<NavAreaId> = new Set(ROWS.flatMap((row) => (row.variant === 'area' && row.areaId ? [row.areaId] : [])));

interface GroupLightsProps {
    /** The group's grants as shown (with clicks not yet saved) */
    pages: PagePermissions;
    onChange: (pages: PagePermissions) => void;
}

/**
 * The lights of one group: a row per area, opening to its pages; two lights per row (Vede, Modifica) and a page's
 * functions as named lights. An area row and "Tutte le pagine" switch a light for all their pages; a dashed light
 * means only some of them have it. The search shows the matching pages with their area, open.
 */
export function GroupLights({ pages, onChange }: GroupLightsProps) {
    const [open, setOpen] = useState<ReadonlySet<NavAreaId>>(new Set());
    const [query, setQuery] = useState('');
    const text = foldText(query.trim());
    const allOpen = open.size === FOLDABLE.size;

    const rows = useMemo(() => {
        if (!text) return ROWS.filter((row) => !row.nested || (row.areaId && open.has(row.areaId)));
        const hit = (row: LightRow) => row.search.includes(text);
        // An area shows, open, when its name or one of its pages matches; a matching area shows all its pages
        const areaHit = new Set(ROWS.filter((row) => row.variant === 'area' && hit(row)).map((row) => row.areaId));
        const pageHit = new Set(ROWS.filter((row) => row.nested && hit(row)).map((row) => row.areaId));
        return ROWS.filter((row) => {
            if (row.variant === 'all') return false;
            if (row.variant === 'area') return areaHit.has(row.areaId) || pageHit.has(row.areaId);
            return row.nested ? areaHit.has(row.areaId) || hit(row) : hit(row);
        });
    }, [text, open]);

    const label = (row: LightRow) => {
        if (row.variant !== 'area' || !row.areaId) {
            // A row with no arrow keeps the arrow's room, so the names of all top rows start at the same point
            return (
                <span title={row.hint} className={cn(!row.nested && 'inline-flex items-center gap-1')}>
                    {!row.nested && <span className="w-3.5 shrink-0" />}
                    {row.label}
                </span>
            );
        }
        const areaId = row.areaId;
        const isOpen = text !== '' || open.has(areaId);
        return (
            <FoldToggle
                size="sm"
                open={isOpen}
                onClick={() => setOpen((prev) => toggleInSet(prev, areaId))}
                title={fmt(APP_COPY.nav.showPages, { area: row.label })}
                className="-ml-1"
            >
                {row.label}
            </FoldToggle>
        );
    };

    /** A page's functions, as named lights */
    const functionLights = (row: LightRow) => {
        const page = row.variant === 'page' ? row.pages[0] : undefined;
        if (!page) return [];
        const level = copy.lights[page.editable ? 'modify' : 'see'].label;
        return pageFunctions(page).map((fn) => {
            const on = functionOn(pages, page, fn);
            return (
                <Light
                    key={fn.href}
                    label={fn.label}
                    tone="warning"
                    state={on ? 'on' : 'off'}
                    name={fmt(copy.lightName, { page: row.label, light: fn.label })}
                    hint={fmt(copy.functionHint, { description: fn.description ?? fn.label, level })}
                    onToggle={() => onChange(withFunction(pages, page, fn, !on))}
                />
            );
        });
    };

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-48 md:max-w-72">
                    <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={copy.search} aria-label={copy.search} />
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(allOpen ? new Set() : FOLDABLE)}>
                    {allOpen ? copy.closeAll : copy.openAll}
                </Button>
            </div>
            <Surface className="overflow-hidden">
                <Table containerClassName="lg:max-h-panel lg:overflow-y-auto">
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>{copy.page}</TableHead>
                            {LIGHTS.map((kind) => {
                                const Icon = LOOK[kind].icon;
                                return (
                                    <TableHead key={kind} className="w-16 px-1 text-center sm:w-20" title={copy.lights[kind].hint}>
                                        <span className="inline-flex flex-col items-center gap-0.5">
                                            <Icon size={16} />
                                            {copy.lights[kind].label}
                                        </span>
                                    </TableHead>
                                );
                            })}
                            <TableHead className="hidden md:table-cell">{copy.functions}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 && (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={LIGHTS.length + 2} className="py-6 text-center text-sm text-fg-subtle">
                                    {copy.noMatch}
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row) => {
                            const functions = functionLights(row);
                            return (
                                <TableRow
                                    key={row.key}
                                    className={cn(
                                        'hover:bg-transparent',
                                        row.nested ? 'text-fg-secondary' : 'bg-muted/40 font-semibold text-fg-strong',
                                        text !== '' && row.search.includes(text) && 'bg-primary/5'
                                    )}
                                >
                                    <TableCell className={cn('py-2', row.nested && 'pl-10')}>
                                        {label(row)}
                                        {functions.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5 md:hidden">{functions}</div>}
                                    </TableCell>
                                    {LIGHTS.map((kind) => {
                                        const state = lightState(pages, row.pages, kind);
                                        return (
                                            <TableCell key={kind} className="px-1 py-1.5 text-center">
                                                {state === null ? (
                                                    <span className="inline-block h-1 w-1 rounded-full bg-border-strong" title={copy.noModify} />
                                                ) : (
                                                    <Light
                                                        icon={LOOK[kind].icon}
                                                        tone={LOOK[kind].tone}
                                                        state={state}
                                                        name={fmt(copy.lightName, { page: row.label, light: copy.lights[kind].label })}
                                                        hint={state === 'some' ? copy.someHint : row.variant === 'page' ? copy.lights[kind].hint : undefined}
                                                        onToggle={() => onChange(withLight(pages, row.pages, kind, state !== 'on'))}
                                                    />
                                                )}
                                            </TableCell>
                                        );
                                    })}
                                    <TableCell className="hidden py-1.5 md:table-cell">
                                        <div className="flex flex-wrap gap-1.5">{functions}</div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Surface>
        </div>
    );
}
