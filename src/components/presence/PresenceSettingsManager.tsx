'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, ShieldCheck, Info, Edit2, Check, X, Database, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { APP_COPY } from '@/locales';
import { APP_CONFIG } from '@/config/constants';
import {
    getAllPresenceSettingsAction,
    updatePresenceSettingAction,
    renamePresencePresetAction,
    getTurno2OperatorsAction,
    searchOperatorsAction,
    setOperatorGruppoAction,
} from '@/app/presence/presence-actions';
import type { PresenceSettingRow } from '@/types';
import { PresetTagEditor } from './PresetTagEditor';
import { getPresenceSettingDefinition } from '@/lib/presence';

type Turno2Operator = { OPERATORE: string; NOME: string; GRUPPO: string };
type SearchOperator = { OPERATORE: string; NOME: string; GRUPPO: string | null };

function sortSettings(list: PresenceSettingRow[]): PresenceSettingRow[] {
    const order = (key: string) => getPresenceSettingDefinition(key)?.order ?? 99;
    return [...list].sort((a, b) => {
        const diff = order(a.PARAMETRO) - order(b.PARAMETRO);
        return diff !== 0 ? diff : a.PARAMETRO.localeCompare(b.PARAMETRO);
    });
}

export function PresenceSettingsManager() {
    const copy = APP_COPY.analytics.presenceSettings;
    const presenceConfig = APP_CONFIG.PRESENCE;

    const [settings, setSettings] = useState<PresenceSettingRow[]>([]);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Collapsible tab states (collapsed by default)
    const [isMonthlyHoursOpen, setIsMonthlyHoursOpen] = useState(false);
    const [isSystemOpen, setIsSystemOpen] = useState(false);

    // TURNO2 operator management
    const [turno2List, setTurno2List] = useState<Turno2Operator[]>([]);
    const [turno2Loading, setTurno2Loading] = useState(false);
    const [turno2Mutating, setTurno2Mutating] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<SearchOperator[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    const loadSettings = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getAllPresenceSettingsAction();
            if (res.success) {
                setSettings(sortSettings(res.data));
            }
        } catch {
            // Keep current settings
        } finally {
            setLoading(false);
        }
    }, []);

    const loadTurno2 = useCallback(async () => {
        setTurno2Loading(true);
        try {
            const res = await getTurno2OperatorsAction();
            if (res.success) setTurno2List(res.data);
        } catch { /* keep existing */ } finally {
            setTurno2Loading(false);
        }
    }, []);

    useEffect(() => {
        loadSettings();
        loadTurno2();
    }, [loadSettings, loadTurno2]);

    const handleStartEdit = (item: PresenceSettingRow) => {
        setEditingKey(item.PARAMETRO);
        setEditValue(item.VALORE);
        setStatusMessage(null);
    };

    const handleCancelEdit = () => {
        setEditingKey(null);
        setEditValue('');
        setStatusMessage(null);
    };

    const handleSaveSetting = async (parametro: string, defaultDesc: string | null) => {
        if (!editValue.trim()) {
            setStatusMessage({ type: 'error', text: 'Il valore non può essere vuoto' });
            return;
        }

        setSaving(true);
        setStatusMessage(null);

        try {
            const res = await updatePresenceSettingAction(
                parametro,
                editValue.trim(),
                defaultDesc || undefined
            );

            if (res.success) {
                setSettings((prev) =>
                    prev.map((s) =>
                        s.PARAMETRO === parametro
                            ? { ...s, VALORE: editValue.trim(), FVALUE01: parseFloat(editValue.trim()) || null }
                            : s
                    )
                );
                setEditingKey(null);
                setStatusMessage({ type: 'success', text: copy.savedSuccess });
                setTimeout(() => setStatusMessage(null), 4000);
            } else {
                setStatusMessage({ type: 'error', text: res.error ?? 'Errore nel salvataggio' });
            }
        } catch (err: any) {
            setStatusMessage({ type: 'error', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleSavePresetTag = async (parametro: string, newValue: string): Promise<boolean> => {
        const defaultDesc = parametro === 'FERIE_PRESETS'
            ? copy.feriePresetsDesc
            : copy.permessoPresetsDesc;

        try {
            const res = await updatePresenceSettingAction(parametro, newValue, defaultDesc);
            if (res.success) {
                setSettings((prev) => {
                    const exists = prev.some((s) => s.PARAMETRO === parametro);
                    if (exists) {
                        return prev.map((s) => (s.PARAMETRO === parametro ? { ...s, VALORE: newValue } : s));
                    }
                    return [...prev, { TABELLA: 'PRESENZE', PARAMETRO: parametro, VALORE: newValue, DESCRIZIONE: defaultDesc, FVALUE01: null }];
                });
                setStatusMessage({ type: 'success', text: copy.savedSuccess });
                setTimeout(() => setStatusMessage(null), 4000);
                return true;
            } else {
                setStatusMessage({ type: 'error', text: res.error ?? 'Errore nel salvataggio' });
                return false;
            }
        } catch (err: any) {
            setStatusMessage({ type: 'error', text: err.message });
            return false;
        }
    };

    const handleRenamePresetTag = async (
        parametro: 'FERIE_PRESETS' | 'PERMESSO_PRESETS',
        oldTag: string,
        newTag: string,
        updatedPresetsValue: string
    ): Promise<boolean> => {
        try {
            const res = await renamePresencePresetAction(parametro, oldTag, newTag, updatedPresetsValue);
            if (res.success) {
                setSettings((prev) =>
                    prev.map((s) => (s.PARAMETRO === parametro ? { ...s, VALORE: updatedPresetsValue } : s))
                );
                setStatusMessage({ type: 'success', text: copy.savedSuccess });
                setTimeout(() => setStatusMessage(null), 4000);
                return true;
            } else {
                setStatusMessage({ type: 'error', text: res.error ?? 'Errore nel salvataggio' });
                return false;
            }
        } catch (err: any) {
            setStatusMessage({ type: 'error', text: err.message });
            return false;
        }
    };

    const getSettingUnit = (parametro: string) => getPresenceSettingDefinition(parametro)?.unit ?? '';
    const getInputType = (parametro: string) => getPresenceSettingDefinition(parametro)?.kind === 'time' ? 'time' : 'text';


    const handleRemoveFromTurno2 = async (operatore: string) => {
        setTurno2Mutating(operatore);
        const res = await setOperatorGruppoAction(operatore, '');
        if (res.success) {
            setTurno2List((prev) => prev.filter((o) => o.OPERATORE !== operatore));
        }
        setTurno2Mutating(null);
    };

    const handleSearch = async (term: string) => {
        setSearchTerm(term);
        if (!term.trim()) { setSearchResults([]); return; }
        setSearchLoading(true);
        try {
            const res = await searchOperatorsAction(term);
            if (res.success) setSearchResults(res.data);
        } catch { /* ignore */ } finally {
            setSearchLoading(false);
        }
    };

    const handleAddToTurno2 = async (op: SearchOperator) => {
        if ((op.GRUPPO ?? '').toUpperCase() === 'TURNO2') return; // already assigned
        setTurno2Mutating(op.OPERATORE);
        const res = await setOperatorGruppoAction(op.OPERATORE, 'TURNO2');
        if (res.success) {
            setTurno2List((prev) => {
                const already = prev.find((o) => o.OPERATORE === op.OPERATORE);
                if (already) return prev;
                return [...prev, { OPERATORE: op.OPERATORE, NOME: op.NOME, GRUPPO: 'TURNO2' }]
                    .sort((a, b) => a.NOME.localeCompare(b.NOME));
            });
            setSearchResults((prev) =>
                prev.map((o) => o.OPERATORE === op.OPERATORE ? { ...o, GRUPPO: 'TURNO2' } : o)
            );
        }
        setTurno2Mutating(null);
    };


    return (
        <div className="space-y-6">
            {/* Status Feedback Message */}
            {statusMessage && (
                <div
                    className={`p-3 rounded-lg border text-sm flex items-center justify-between ${
                        statusMessage.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}
                >
                    <span>{statusMessage.text}</span>
                    <button
                        onClick={() => setStatusMessage(null)}
                        className="text-zinc-400 hover:text-white ml-2"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Tab 1: Calcolo Ore Mensile Settings (Collapsible) */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md overflow-hidden transition-all duration-300 shadow-xl">
                <button
                    type="button"
                    onClick={() => setIsMonthlyHoursOpen(!isMonthlyHoursOpen)}
                    className="w-full p-5 flex items-center justify-between gap-4 text-left hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                >
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 text-primary flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                            <Database className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-base font-bold text-white tracking-wide group-hover:text-primary transition-colors">
                                    {copy.monthlyHoursSection}
                                </h2>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700/80 font-mono">
                                    {settings.length} parametri
                                </span>
                                {turno2List.length > 0 && (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950/40 text-blue-300 border border-blue-700/50 font-mono">
                                        {turno2List.length} in Turno 2
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Parametri e orari per il calcolo presenze (NETPRO.VALORI_TABELLE)
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 group-hover:text-white transition-all transform duration-300 ${isMonthlyHoursOpen ? 'rotate-180 bg-primary/10 border-primary/30 text-primary' : ''}`}>
                            <ChevronDown className="w-4 h-4" />
                        </div>
                    </div>
                </button>

                {isMonthlyHoursOpen && (
                    <div className="p-6 pt-4 border-t border-zinc-800/80 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Section 1: Parametri Orari e Pausa */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
                                <div>
                                    <h3 className="text-sm font-semibold text-zinc-200">
                                        Parametri Orari e Pausa
                                    </h3>
                                    <p className="text-xs text-zinc-400">
                                        Valori orari standard e speciali per il calcolo presenze
                                    </p>
                                </div>
                                <span className="text-[11px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
                                    NETPRO.VALORI_TABELLE
                                </span>
                            </div>

                            {loading ? (
                                <div className="p-8 text-center text-zinc-500">
                                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2" />
                                    <div className="text-xs">{APP_COPY.analytics.common.loading}</div>
                                </div>
                            ) : settings.length === 0 ? (
                                <div className="p-6 text-center text-zinc-500 text-sm">
                                    Nessun parametro trovato in VALORI_TABELLE.
                                </div>
                            ) : (
                                <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800/60 bg-zinc-900/40">
                                    {settings
                                        .filter((item) => !item.PARAMETRO.includes('PRESETS'))
                                        .map((item) => {
                                        const isEditing = editingKey === item.PARAMETRO;
                                        const unit = getSettingUnit(item.PARAMETRO);

                                        return (
                                            <div
                                                key={item.PARAMETRO}
                                                className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-zinc-800/20 transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-zinc-300 font-medium">
                                                        {item.DESCRIZIONE || item.PARAMETRO}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-500 font-mono">
                                                        ({item.PARAMETRO})
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {!isEditing ? (
                                                        <>
                                                            <span className="font-mono font-bold text-primary">
                                                                {item.VALORE} {unit}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleStartEdit(item)}
                                                                className="p-1 text-zinc-500 hover:text-primary transition-colors cursor-pointer rounded hover:bg-zinc-800"
                                                                title={copy.edit}
                                                            >
                                                                <Edit2 size={12} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5">
                                                            <Input
                                                                type={getInputType(item.PARAMETRO)}
                                                                value={editValue}
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                className="h-6 w-40 text-xs font-mono text-center px-1"
                                                                autoFocus
                                                            />
                                                            {unit && <span className="text-xs text-zinc-400">{unit}</span>}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSaveSetting(item.PARAMETRO, item.DESCRIZIONE)}
                                                                disabled={saving}
                                                                className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer rounded hover:bg-zinc-800"
                                                                title={copy.save}
                                                            >
                                                                <Check size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={handleCancelEdit}
                                                                disabled={saving}
                                                                className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer rounded hover:bg-zinc-800"
                                                            >
                                                                <X size={13} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Section: Opzioni Rapide Testo (Ferie e Permessi) */}
                        <div className="pt-4 border-t border-zinc-800/60 space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
                                <div>
                                    <h3 className="text-sm font-semibold text-zinc-200">
                                        {copy.presetsSection}
                                    </h3>
                                    <p className="text-xs text-zinc-400">
                                        {copy.presetsDesc}
                                    </p>
                                </div>
                                <span className="text-[11px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
                                    NETPRO.VALORI_TABELLE
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <PresetTagEditor
                                    title={copy.feriePresetsTitle}
                                    description={copy.feriePresetsDesc}
                                    parametro="FERIE_PRESETS"
                                    value={settings.find((s) => s.PARAMETRO === 'FERIE_PRESETS')?.VALORE ?? 'FESTA'}
                                    onSave={handleSavePresetTag}
                                    onRename={handleRenamePresetTag}
                                />
                                <PresetTagEditor
                                    title={copy.permessoPresetsTitle}
                                    description={copy.permessoPresetsDesc}
                                    parametro="PERMESSO_PRESETS"
                                    value={settings.find((s) => s.PARAMETRO === 'PERMESSO_PRESETS')?.VALORE ?? 'ROL,VISITA MEDICA,LUTTO'}
                                    onSave={handleSavePresetTag}
                                    onRename={handleRenamePresetTag}
                                />
                            </div>
                        </div>

                        {/* Section 2: Operatori Turno 2 */}
                        <div className="pt-4 border-t border-zinc-800/60 space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-semibold text-zinc-200">
                                            Operatori Turno 2
                                        </h3>
                                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-950/40 text-blue-300 border border-blue-700/50 font-mono">
                                            {turno2List.length} operatori
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-400 mt-0.5">
                                        Gestisci quali operatori usano l&apos;orario speciale (campo GRUPPO = TURNO2)
                                    </p>
                                </div>
                            </div>

                            {/* Search & Add */}
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-2">
                                    Cerca operatore e aggiungilo a Turno 2
                                </label>
                                <div className="relative">
                                    <Input
                                        type="text"
                                        placeholder="Nome o codice operatore..."
                                        value={searchTerm}
                                        onChange={(e) => handleSearch(e.target.value)}
                                    />
                                    {searchLoading && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    )}
                                </div>

                                {searchResults.length > 0 && (
                                    <div className="mt-2 border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800/60 bg-zinc-900/40">
                                        {searchResults.map((op) => {
                                            const isAlready = (op.GRUPPO ?? '').toUpperCase() === 'TURNO2';
                                            const isMutating = turno2Mutating === op.OPERATORE;
                                            return (
                                                <div
                                                    key={op.OPERATORE}
                                                    className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-zinc-800/20 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-zinc-300 font-medium">{op.NOME}</span>
                                                        <span className="text-[10px] text-zinc-500 font-mono">({op.OPERATORE})</span>
                                                        {isAlready && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/50 border border-blue-700/50 text-blue-300 font-mono">
                                                                TURNO2
                                                            </span>
                                                        )}
                                                    </div>
                                                    {!isAlready && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddToTurno2(op)}
                                                            disabled={isMutating}
                                                            className="p-1 text-primary hover:text-primary-focus transition-colors cursor-pointer rounded hover:bg-zinc-800 flex items-center gap-1 text-xs"
                                                        >
                                                            {isMutating ? (
                                                                <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                                                            ) : (
                                                                <Check size={13} />
                                                            )}
                                                            <span>Aggiungi</span>
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Current TURNO2 list */}
                            <div>
                                <div className="text-xs font-medium text-zinc-400 mb-2">
                                    Operatori attualmente in Turno 2
                                </div>

                                {turno2Loading ? (
                                    <div className="p-6 text-center text-zinc-500 text-xs">
                                        <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-primary mb-1" />
                                    </div>
                                ) : turno2List.length === 0 ? (
                                    <div className="p-6 text-center text-zinc-500 text-sm border border-zinc-800/60 rounded-lg">
                                        Nessun operatore assegnato a Turno 2
                                    </div>
                                ) : (
                                    <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800/60 bg-zinc-900/40">
                                        {turno2List.map((op) => {
                                            const isMutating = turno2Mutating === op.OPERATORE;
                                            return (
                                                <div
                                                    key={op.OPERATORE}
                                                    className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-zinc-800/20 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-zinc-300 font-medium">{op.NOME}</span>
                                                        <span className="text-[10px] text-zinc-500 font-mono">({op.OPERATORE})</span>
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/50 border border-blue-700/50 text-blue-300 font-semibold font-mono">
                                                            TURNO2
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveFromTurno2(op.OPERATORE)}
                                                        disabled={isMutating}
                                                        className="p-1 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer rounded hover:bg-zinc-800 flex items-center gap-1 text-xs"
                                                    >
                                                        {isMutating ? (
                                                            <div className="w-3 h-3 border border-zinc-400 border-t-transparent rounded-full animate-spin" />
                                                        ) : (
                                                            <X size={13} />
                                                        )}
                                                        <span>Rimuovi</span>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Tab 2: Sistema Presenze & Auto-Uscita (EXT) (Combined & Compact) */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md overflow-hidden transition-all duration-300 shadow-xl">
                <button
                    type="button"
                    onClick={() => setIsSystemOpen(!isSystemOpen)}
                    className="w-full p-5 flex items-center justify-between gap-4 text-left hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                >
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-base font-bold text-white tracking-wide group-hover:text-primary transition-colors">
                                    Sistema Presenze & Auto-Uscita (EXT)
                                </h2>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950/40 text-blue-400 border border-blue-800/50">
                                    Automatico
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-800/50">
                                    Attivo
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Orari di auto-uscita per timbrature feriali/sabati e regole di sistema
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 group-hover:text-white transition-all transform duration-300 ${isSystemOpen ? 'rotate-180 bg-primary/10 border-primary/30 text-primary' : ''}`}>
                            <ChevronDown className="w-4 h-4" />
                        </div>
                    </div>
                </button>

                {isSystemOpen && (
                    <div className="p-6 pt-4 border-t border-zinc-800/80 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Section A: Orari Auto-Uscita */}
                        <div className="space-y-3">
                            <div className="pb-2 border-b border-zinc-800/60">
                                <h3 className="text-sm font-semibold text-zinc-200">
                                    {copy.autoExitSection}
                                </h3>
                                <p className="text-xs text-zinc-400">
                                    Orari predefiniti assegnati in caso di mancata timbratura in uscita
                                </p>
                            </div>

                            <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800/60 bg-zinc-900/40">
                                <div className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-zinc-800/20 transition-colors">
                                    <span className="text-zinc-300 font-medium">
                                        {copy.autoExitWeekday}
                                    </span>
                                    <span className="font-mono font-bold text-primary">
                                        {presenceConfig.AUTO_EXIT_TIME_WEEKDAY}
                                    </span>
                                </div>

                                <div className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-zinc-800/20 transition-colors">
                                    <span className="text-zinc-300 font-medium">
                                        {copy.autoExitSaturday}
                                    </span>
                                    <span className="font-mono font-bold text-primary">
                                        {presenceConfig.AUTO_EXIT_TIME_SATURDAY}
                                    </span>
                                </div>

                                <div className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-zinc-800/20 transition-colors">
                                    <span className="text-zinc-300 font-medium">
                                        {copy.triggerHour}
                                    </span>
                                    <span className="font-mono font-bold text-primary">
                                        {presenceConfig.TRIGGER_HOUR}:00
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Section B: Stato Sistema & Regole */}
                        <div className="pt-4 border-t border-zinc-800/60 space-y-3">
                            <div className="pb-2 border-b border-zinc-800/60">
                                <h3 className="text-sm font-semibold text-zinc-200">
                                    {copy.systemInfo}
                                </h3>
                                <p className="text-xs text-zinc-400">
                                    Regole attive e sincronizzazione background
                                </p>
                            </div>

                            <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800/60 bg-zinc-900/40">
                                <div className="px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs hover:bg-zinc-800/20 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <Info className="text-primary flex-shrink-0" size={15} />
                                        <span className="text-zinc-300 font-medium">{copy.activeStatus}</span>
                                    </div>
                                    <span className="text-zinc-400 text-[11px]">
                                        {copy.activeDesc}
                                    </span>
                                </div>

                                <div className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-zinc-800/20 transition-colors">
                                    <span className="text-zinc-300 font-medium">
                                        Modulo Calcolo Ore Mensile
                                    </span>
                                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/50">
                                        ATTIVO
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}
