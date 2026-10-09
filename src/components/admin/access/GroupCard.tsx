'use client';

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChoiceButton } from '@/components/ui/ChoiceButton';
import { EditableCell } from '@/components/ui/EditableCell';
import { Input } from '@/components/ui/Input';
import type { Group } from '@/lib/auth/accounts';
import { ACCESS_AREAS, type AccessLevel, type PagePermissions } from '@/lib/auth/permissions';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.groups;

/** The three choices of a page; "Modifica" only where the page changes data */
const LEVELS: { level: AccessLevel | null; label: string }[] = [
    { level: null, label: copy.levels.none },
    { level: 'view', label: copy.levels.view },
    { level: 'edit', label: copy.levels.edit },
];

interface GroupCardProps {
    group: Group;
    members: number;
    onRename: (name: string) => Promise<boolean>;
    onPages: (pages: PagePermissions) => void;
    onDelete: () => void;
}

/** One group: name (click to change), how many users have it, and per menu page: No / Vede / Modifica. */
export function GroupCard({ group, members, onRename, onPages, onDelete }: GroupCardProps) {
    const setLevel = (href: string, level: AccessLevel | null) => {
        const pages = { ...group.pages };
        if (level) pages[href] = level;
        else delete pages[href];
        onPages(pages);
    };

    return (
        <Card className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-baseline gap-3">
                    <div className="text-base font-semibold text-fg-strong">
                        <EditableCell
                            display={group.name}
                            startValue={() => group.name}
                            renderEditor={(draft, setDraft) => (
                                <div className="w-56">
                                    <Input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                                </div>
                            )}
                            onSave={onRename}
                        />
                    </div>
                    <span className="text-sm text-fg-muted">{fmt(copy.members, { count: members })}</span>
                </div>
                <Button variant="ghost" size="sm" title={APP_COPY.common.delete} onClick={onDelete}>
                    <Trash2 size={16} className="text-danger" />
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {ACCESS_AREAS.map(({ area, pages }) => (
                    <section key={area.id}>
                        <h3 className="mb-1.5 text-sm font-semibold text-fg-muted">{area.label}</h3>
                        <div className="divide-y divide-border/60 border border-border rounded-lg">
                            {pages.map((page) => (
                                <div key={page.href} className="flex items-center justify-between gap-3 px-3 py-2">
                                    <span className="min-w-0 text-sm text-fg-secondary truncate">{page.label}</span>
                                    <div className="flex shrink-0 gap-1">
                                        {LEVELS.filter(({ level }) => level !== 'edit' || page.editable).map(({ level, label }) => (
                                            <ChoiceButton
                                                key={label}
                                                size="sm"
                                                className="px-2.5"
                                                selected={(group.pages[page.href] ?? null) === level}
                                                onClick={() => setLevel(page.href, level)}
                                            >
                                                {label}
                                            </ChoiceButton>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </Card>
    );
}
