'use client';

import { EditableCell } from '@/components/ui/EditableCell';
import { Input } from '@/components/ui/Input';
import { LoadState } from '@/components/ui/LoadState';
import { Row, RowList } from '@/components/ui/RowList';
import { EMPTY_VALUE } from '@/lib/format';
import { getPresenceSettingDefinition } from '@/lib/presence';
import { APP_COPY } from '@/locales';
import type { PresenceSettingRow } from '@/types';

interface PresenceParametersListProps {
    settings: PresenceSettingRow[];
    loading: boolean;
    /** Why the stored values could not be read (shown instead of the list) */
    error: string | null;
    /** Saves a typed value; true when it was saved */
    onSave: (row: PresenceSettingRow, value: string) => Promise<boolean>;
}

/** The parameters of the presence rules (pause, rounding, working days …), each value editable in place. */
export function PresenceParametersList({ settings, loading, error, onSave }: PresenceParametersListProps) {
    if (loading || error) return <LoadState loading={loading} error={error} />;
    if (settings.length === 0) return <div className="p-6 text-center text-fg-subtle text-sm">{APP_COPY.analytics.presenceSettings.noParameters}</div>;

    return (
        <RowList>
            {settings.map((row) => {
                const definition = getPresenceSettingDefinition(row.PARAMETRO);
                const unit = definition?.unit ?? '';
                return (
                    <Row key={row.PARAMETRO} label={row.DESCRIZIONE || row.PARAMETRO} code={row.PARAMETRO}>
                        <EditableCell
                            display={<span className="font-mono font-bold text-primary">{row.VALORE ? `${row.VALORE} ${unit}` : EMPTY_VALUE}</span>}
                            startValue={() => row.VALORE}
                            renderEditor={(draft, setDraft) => (
                                <div className="flex items-center gap-1.5">
                                    <div className="w-40">
                                        <Input
                                            type={definition?.kind === 'time' ? 'time' : definition?.kind === 'date' ? 'date' : 'text'}
                                            value={draft}
                                            onChange={(e) => setDraft(e.target.value)}
                                            className="h-8 text-xs font-mono text-center"
                                            autoFocus
                                        />
                                    </div>
                                    {unit && <span className="text-xs text-fg-muted">{unit}</span>}
                                </div>
                            )}
                            onSave={(draft) => onSave(row, draft)}
                        />
                    </Row>
                );
            })}
        </RowList>
    );
}
