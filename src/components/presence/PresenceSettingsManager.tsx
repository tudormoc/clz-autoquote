'use client';

import { PresenceParametersList } from '@/components/presence/PresenceParametersList';
import { PresetTagEditor } from '@/components/presence/PresetTagEditor';
import { Turno2Operators } from '@/components/presence/Turno2Operators';
import { LoadState } from '@/components/ui/LoadState';
import { Row, RowList } from '@/components/ui/RowList';
import { Panel } from '@/components/ui/Panel';
import { APP_CONFIG } from '@/config/constants';
import { usePresenceSettings } from '@/hooks/usePresenceSettings';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.analytics.presenceSettings;
const { AUTO_EXIT_TIME_WEEKDAY, AUTO_EXIT_TIME_SATURDAY, TRIGGER_HOUR, USUAL_EXIT } = APP_CONFIG.PRESENCE;

/** Presence settings page: rule parameters, quick-pick texts, second-shift operators and the automatic exit times. */
export function PresenceSettingsManager() {
    const { settings, loading, error, valueOf, saveSetting, savePreset, renamePreset } = usePresenceSettings();
    // The two preset lists have their own editors below, the rest are plain parameters
    const parameters = settings.filter((row) => !row.PARAMETRO.includes('PRESETS'));
    // The stored values are on screen: before that, an editor would show the defaults and save them over the stored list
    const read = !loading && !error;

    return (
        <div className="space-y-4">
            <Panel title={copy.parametersSection}>
                <PresenceParametersList settings={parameters} loading={loading} error={error} onSave={saveSetting} />
            </Panel>

            <Panel title={copy.presetsSection}>
                <LoadState loading={loading} error={error} />
                {read && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <PresetTagEditor
                            title={copy.feriePresetsTitle}
                            value={valueOf('FERIE_PRESETS')}
                            onSave={(value) => savePreset('FERIE_PRESETS', value)}
                            onRename={(oldTag, newTag, value) => renamePreset('FERIE_PRESETS', oldTag, newTag, value)}
                        />
                        <PresetTagEditor
                            title={copy.permessoPresetsTitle}
                            value={valueOf('PERMESSO_PRESETS')}
                            onSave={(value) => savePreset('PERMESSO_PRESETS', value)}
                            onRename={(oldTag, newTag, value) => renamePreset('PERMESSO_PRESETS', oldTag, newTag, value)}
                        />
                    </div>
                )}
            </Panel>

            <Panel title={copy.turno2Section}>
                <Turno2Operators />
            </Panel>

            <Panel title={copy.autoExitSection}>
                <RowList>
                    <Row label={copy.autoExitWeekday}><span className="font-mono font-bold text-primary">{AUTO_EXIT_TIME_WEEKDAY}</span></Row>
                    <Row label={copy.autoExitSaturday}><span className="font-mono font-bold text-primary">{AUTO_EXIT_TIME_SATURDAY}</span></Row>
                    <Row label={copy.autoExitRecent}>
                        <span className="font-mono font-bold text-primary">{fmt(copy.autoExitRecentValue, { recent: USUAL_EXIT.RECENT_EXITS, step: USUAL_EXIT.STEP_MINUTES })}</span>
                    </Row>
                    <Row label={copy.triggerHour}><span className="font-mono font-bold text-primary">{TRIGGER_HOUR}:00</span></Row>
                </RowList>
            </Panel>
        </div>
    );
}
