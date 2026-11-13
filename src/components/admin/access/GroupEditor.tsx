import { Check, Copy, Trash2, Undo2 } from '@/components/ui/icons';
import { GroupLights } from '@/components/admin/access/GroupLights';
import { Button } from '@/components/ui/Button';
import { Surface } from '@/components/ui/Surface';
import { EditableCell } from '@/components/ui/EditableCell';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import type { SaveState } from '@/hooks/useGroupDrafts';
import type { Group } from '@/lib/auth/accounts';
import { PRESETS, lightCounts, withPreset } from '@/lib/auth/lights';
import { GRANTABLE_PAGES, type PagePermissions } from '@/lib/auth/permissions';
import { APP_COPY, fmt } from '@/locales';
import { titleClasses } from '@/components/ui/titleLook';

const copy = APP_COPY.admin.groups;

interface GroupEditorProps {
    group: Group;
    /** Its grants as shown (with clicks not yet saved) */
    pages: PagePermissions;
    /** Names of its users */
    members: string[];
    saveState: SaveState;
    /** There is a click to take back */
    canUndo: boolean;
    onChange: (pages: PagePermissions) => void;
    onUndo: () => void;
    onRename: (name: string) => Promise<boolean>;
    onDuplicate: () => void;
    onDelete: () => void;
}

/**
 * The group being worked on in Gruppi: its name (click to change) and users, what it has in one line, the starting
 * points (Niente, Solo lettura, Tutto), Annulla, duplicate and delete, then its lights. Every click saves itself.
 */
export function GroupEditor({ group, pages, members, saveState, canUndo, onChange, onUndo, onRename, onDuplicate, onDelete }: GroupEditorProps) {
    const counts = lightCounts(pages);

    return (
        <div className="min-w-0 space-y-3">
            <Surface className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                        <div className={titleClasses('panel')}>
                            <EditableCell
                                key={group.id}
                                display={group.name}
                                startValue={() => group.name}
                                renderEditor={(draft, setDraft) => (
                                    <div className="w-48">
                                        <Input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                                    </div>
                                )}
                                onSave={onRename}
                            />
                        </div>
                        <p className="text-xs text-fg-muted">{members.length > 0 ? fmt(copy.memberNames, { names: members.join(', ') }) : copy.noMembers}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                        <span className="w-28 text-right text-xs" aria-live="polite">
                            {saveState === 'saving' && (
                                <span className="inline-flex items-center gap-1.5 text-fg-muted">
                                    <Spinner size={12} />
                                    {copy.saving}
                                </span>
                            )}
                            {saveState === 'saved' && (
                                <span className="inline-flex items-center gap-1 text-success-400">
                                    <Check size={14} />
                                    {copy.saved}
                                </span>
                            )}
                        </span>
                        <Button variant="ghost" size="sm" title={copy.undoHint} onClick={onUndo} disabled={!canUndo}>
                            <Undo2 size={14} />
                            {copy.undo}
                        </Button>
                        <Button variant="ghost" size="sm" title={copy.duplicate} aria-label={`${copy.duplicate} ${group.name}`} onClick={onDuplicate}>
                            <Copy size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" title={APP_COPY.common.delete} aria-label={`${APP_COPY.common.delete} ${group.name}`} onClick={onDelete}>
                            <Trash2 size={14} className="text-danger" />
                        </Button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <p className="text-sm text-fg-secondary">{fmt(copy.summary, { ...counts, total: GRANTABLE_PAGES.length })}</p>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-fg-muted">{copy.presets.label}</span>
                        {PRESETS.map((preset) => (
                            <Button key={preset} variant="secondary" size="sm" title={copy.presets[preset].hint} onClick={() => onChange(withPreset(pages, preset))}>
                                {copy.presets[preset].label}
                            </Button>
                        ))}
                    </div>
                </div>
            </Surface>
            <GroupLights pages={pages} onChange={onChange} />
        </div>
    );
}
