'use client';

import { PresenceParametersList } from '@/components/presence/PresenceParametersList';
import { PresetTagEditor } from '@/components/presence/PresetTagEditor';
import { Turno2Operators } from '@/components/presence/Turno2Operators';
import { Card } from '@/components/ui/Card';
import { Row, RowList } from '@/components/ui/RowList';
import { Section } from '@/components/ui/Section';
import { APP_CONFIG } from '@/config/constants';
import { usePresenceSettings } from '@/hooks/usePresenceSettings';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.analytics.presenceSettings;
const { AUTO_EXIT_TIME_WEEKDAY, AUTO_EXIT_TIME_SATURDAY, TRIGGER_HOUR } = APP_CONFIG.PRESENCE;

/** Presence settings page: rule parameters, quick-pick texts, second-shift operators and the automatic exit times. */
export function PresenceSettingsManager() {
    const { settings, loading, valueOf, saveSetting, savePreset, renamePreset } = usePresenceSettings();
    // The two preset lists have their own editors below, the rest are plain parameters
    const parameters = settings.filter((row) => !row.PARAMETRO.includes('PRESETS'));

    return (
        <Card className="p-6 space-y-8">
            <Section title={copy.parametersSection} description={copy.parametersDesc}>
                <PresenceParametersList settings={parameters} loading={loading} onSave={saveSetting} />
            </Section>

            <Section title={copy.presetsSection} description={copy.presetsDesc}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PresetTagEditor
                        title={copy.feriePresetsTitle}
                        description={copy.feriePresetsDesc}
                        value={valueOf('FERIE_PRESETS')}
                        onSave={(value) => savePreset('FERIE_PRESETS', value)}
                        onRename={(oldTag, newTag, value) => renamePreset('FERIE_PRESETS', oldTag, newTag, value)}
                    />
                    <PresetTagEditor
                        title={copy.permessoPresetsTitle}
                        description={copy.permessoPresetsDesc}
                        value={valueOf('PERMESSO_PRESETS')}
                        onSave={(value) => savePreset('PERMESSO_PRESETS', value)}
                        onRename={(oldTag, newTag, value) => renamePreset('PERMESSO_PRESETS', oldTag, newTag, value)}
                    />
                </div>
            </Section>

            <Section title={copy.turno2Section} description={copy.turno2Desc}>
                <Turno2Operators />
            </Section>

            <Section title={copy.autoExitSection} description={copy.autoExitDesc}>
                <RowList>
                    <Row label={copy.autoExitWeekday}><span className="font-mono font-bold text-primary">{AUTO_EXIT_TIME_WEEKDAY}</span></Row>
                    <Row label={copy.autoExitSaturday}><span className="font-mono font-bold text-primary">{AUTO_EXIT_TIME_SATURDAY}</span></Row>
                    <Row label={copy.triggerHour}><span className="font-mono font-bold text-primary">{TRIGGER_HOUR}:00</span></Row>
                </RowList>
            </Section>
        </Card>
    );
}
