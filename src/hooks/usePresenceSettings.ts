'use client';

import { useEffect, useState } from 'react';
import {
    getAllPresenceSettingsAction,
    renamePresencePresetAction,
    updatePresenceSettingAction,
} from '@/app/presence/presence-settings-actions';
import { getPresenceSettingDefinition } from '@/lib/presence';
import { notify } from '@/lib/notify';
import { errorMessage } from '@/lib/utils';
import { APP_COPY } from '@/locales';
import type { PresenceSettingRow } from '@/types';

const copy = APP_COPY.analytics.presenceSettings;

type PresetKey = 'FERIE_PRESETS' | 'PERMESSO_PRESETS';
const PRESET_DESCRIPTIONS: Record<PresetKey, string> = { FERIE_PRESETS: copy.feriePresetsDesc, PERMESSO_PRESETS: copy.permessoPresetsDesc };

/** The presence parameters (NETPRO.VALORI_TABELLE, table PRESENZE) and the saves on them; each save says how it went. */
export function usePresenceSettings() {
    const [settings, setSettings] = useState<PresenceSettingRow[]>([]);
    const [loading, setLoading] = useState(true);
    // Why the stored values could not be read. Until they are read nothing is shown as a value and nothing can be
    // saved: a list shown from the defaults would be saved, with one change, over the stored one
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getAllPresenceSettingsAction()
            .then((res) => {
                if (res.success) setSettings(res.data);
                else setError(res.error ?? APP_COPY.common.loadError);
            })
            .catch((err: unknown) => setError(errorMessage(err)))
            .finally(() => setLoading(false));
    }, []);

    /** Replaces the value of a parameter in the list (adds the row when it was not stored yet) */
    const setValue = (parametro: string, value: string, description: string | null, fvalue: number | null) =>
        setSettings((current) =>
            current.some((row) => row.PARAMETRO === parametro)
                ? current.map((row) => (row.PARAMETRO === parametro ? { ...row, VALORE: value, FVALUE01: fvalue } : row))
                : [...current, { TABELLA: 'PRESENZE', PARAMETRO: parametro, VALORE: value, DESCRIZIONE: description, FVALUE01: fvalue }]
        );

    /** Runs a save; true when it worked */
    const finish = async (write: Promise<{ success: boolean; error?: string }>, onSaved: () => void) => {
        try {
            const res = await write;
            if (!res.success) {
                notify.error(res.error ?? copy.saveError);
                return false;
            }
            onSaved();
            notify.success(copy.savedSuccess);
            return true;
        } catch (err) {
            notify.failure(err);
            return false;
        }
    };

    return {
        settings,
        loading,
        error,
        /** Stored (or default) value of a parameter */
        valueOf: (parametro: string) => settings.find((row) => row.PARAMETRO === parametro)?.VALORE ?? getPresenceSettingDefinition(parametro)?.defaultValue ?? '',
        saveSetting: async (row: PresenceSettingRow, input: string) => {
            const value = input.trim();
            if (!value) {
                notify.error(copy.valueRequired);
                return false;
            }
            return finish(updatePresenceSettingAction(row.PARAMETRO, value, row.DESCRIZIONE || undefined), () =>
                setValue(row.PARAMETRO, value, row.DESCRIZIONE, parseFloat(value) || null)
            );
        },
        savePreset: (parametro: PresetKey, value: string) =>
            finish(updatePresenceSettingAction(parametro, value, PRESET_DESCRIPTIONS[parametro]), () =>
                setValue(parametro, value, PRESET_DESCRIPTIONS[parametro], null)
            ),
        /** Renames a preset text and updates the hours already entered with it */
        renamePreset: (parametro: PresetKey, oldTag: string, newTag: string, value: string) =>
            finish(renamePresencePresetAction(parametro, oldTag, newTag, value), () => setValue(parametro, value, PRESET_DESCRIPTIONS[parametro], null)),
    };
}
