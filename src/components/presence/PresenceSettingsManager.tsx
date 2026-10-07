'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Info, Edit2, Check, X, Database, ChevronDown } from 'lucide-react';
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
                            ? 'bg-success-500/10 border-success-500/30 text-success-400'
                            : 'bg-danger-500/10 border-danger-500/30 text-danger-400'
                    }`}
                >
                    <span>{statusMessage.text}</span>
                    <button
                        onClick={() => setStatusMessage(null)}
                        className="text-fg-muted hover:text-fg-strong ml-2"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Tab 1: Calcolo Ore Mensile Settings (Collapsible) */}
            <div className="rounded-2xl border border-border/80 bg-card/40 backdrop-blur-md overflow-hidden transition-all duration-300 shadow-xl">
                <button
                    type="button"
                    onClick={() => setIsMonthlyHoursOpen(!isMonthlyHoursOpen)}
                    className="w-full p-5 flex items-center justify-between gap-4 text-left hover:bg-muted/40 transition-colors cursor-pointer group"
                >
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 text-primary flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                            <Database className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-base font-bold text-fg-strong tracking-wide group-hover:text-primary transition-colors">
                                    {copy.monthlyHoursSection}
                                </h2>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-fg-secondary border border-border-strong/80 font-mono">
                                    {settings.length} parametri
                                </span>
                                {turno2List.length > 0 && (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-info-950/40 text-info-300 border border-info-700/50 font-mono">
                                        {turno2List.length} in Turno 2
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-fg-muted mt-0.5">
                                Parametri e orari per il calcolo presenze (NETPRO.VALORI_TABELLE)
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg bg-muted/60 border border-border-strong/50 text-fg-muted group-hover:text-fg-strong transition-all transform duration-300 ${isMonthlyHoursOpen ? 'rotate-180 bg-primary/10 border-primary/30 text-primary' : ''}`}>
                            <ChevronDown className="w-4 h-4" />
                        </div>
                    </div>
                </button>

                {isMonthlyHoursOpen && (
                    <div className="p-6 pt-4 border-t border-border/80 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Section 1: Parametri Orari e Pausa */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-border/60">
                                <div>
                                    <h3 className="text-sm font-semibold text-fg-soft">
                                        Parametri Orari e Pausa
                                    </h3>
                                    <p className="text-xs text-fg-muted">
                                        Valori orari standard e speciali per il calcolo presenze
                                    </p>
                                </div>
                                <span className="text-2xs font-mono text-fg-muted bg-card border border-border px-2 py-0.5 rounded">
                                    NETPRO.VALORI_TABELLE
                                </span>
                            </div>

                            {loading ? (
                                <div className="p-8 text-center text-fg-subtle">
                                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2" />
                                    <div className="text-xs">{APP_COPY.analytics.common.loading}</div>
                                </div>
                            ) : settings.length === 0 ? (
                                <div className="p-6 text-center text-fg-subtle text-sm">
                                    Nessun parametro trovato in VALORI_TABELLE.
                                </div>
                            ) : (
                                <div className="border border-border rounded-lg overflow-hidden divide-y divide-border/60 bg-card/40">
                                    {settings
                                        .filter((item) => !item.PARAMETRO.includes('PRESETS'))
                                        .map((item) => {
                                        const isEditing = editingKey === item.PARAMETRO;
                                        const unit = getSettingUnit(item.PARAMETRO);

                                        return (
                                            <div
                                                key={item.PARAMETRO}
                                                className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-muted/20 transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-fg-secondary font-medium">
                                                        {item.DESCRIZIONE || item.PARAMETRO}
                                                    </span>
                                                    <span className="text-3xs text-fg-subtle font-mono">
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
                                                                className="p-1 text-fg-subtle hover:text-primary transition-colors cursor-pointer rounded hover:bg-muted"
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
                                                            {unit && <span className="text-xs text-fg-muted">{unit}</span>}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSaveSetting(item.PARAMETRO, item.DESCRIZIONE)}
                                                                disabled={saving}
                                                                className="p-1 text-success-400 hover:text-success-300 transition-colors cursor-pointer rounded hover:bg-muted"
                                                                title={copy.save}
                                                            >
                                                                <Check size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={handleCancelEdit}
                                                                disabled={saving}
                                                                className="p-1 text-fg-muted hover:text-fg-soft transition-colors cursor-pointer rounded hover:bg-muted"
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
                        <div className="pt-4 border-t border-border/60 space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-border/60">
                                <div>
                                    <h3 className="text-sm font-semibold text-fg-soft">
                                        {copy.presetsSection}
                                    </h3>
                                    <p className="text-xs text-fg-muted">
                                        {copy.presetsDesc}
                                    </p>
                                </div>
                                <span className="text-2xs font-mono text-fg-muted bg-card border border-border px-2 py-0.5 rounded">
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
                        <div className="pt-4 border-t border-border/60 space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-border/60">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-semibold text-fg-soft">
                                            Operatori Turno 2
                                        </h3>
                                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-info-950/40 text-info-300 border border-info-700/50 font-mono">
                                            {turno2List.length} operatori
                                        </span>
                                    </div>
                                    <p className="text-xs text-fg-muted mt-0.5">
                                        Gestisci quali operatori usano l&apos;orario speciale (campo GRUPPO = TURNO2)
                                    </p>
                                </div>
                            </div>

                            {/* Search & Add */}
                            <div>
                                <label className="block text-xs font-medium text-fg-muted mb-2">
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
                                    <div className="mt-2 border border-border rounded-lg overflow-hidden divide-y divide-border/60 bg-card/40">
                                        {searchResults.map((op) => {
                                            const isAlready = (op.GRUPPO ?? '').toUpperCase() === 'TURNO2';
                                            const isMutating = turno2Mutating === op.OPERATORE;
                                            return (
                                                <div
                                                    key={op.OPERATORE}
                                                    className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-muted/20 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-fg-secondary font-medium">{op.NOME}</span>
                                                        <span className="text-3xs text-fg-subtle font-mono">({op.OPERATORE})</span>
                                                        {isAlready && (
                                                            <span className="text-3xs px-1.5 py-0.5 rounded bg-info-950/50 border border-info-700/50 text-info-300 font-mono">
                                                                TURNO2
                                                            </span>
                                                        )}
                                                    </div>
                                                    {!isAlready && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddToTurno2(op)}
                                                            disabled={isMutating}
                                                            className="p-1 text-primary hover:text-primary-focus transition-colors cursor-pointer rounded hover:bg-muted flex items-center gap-1 text-xs"
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
                                <div className="text-xs font-medium text-fg-muted mb-2">
                                    Operatori attualmente in Turno 2
                                </div>

                                {turno2Loading ? (
                                    <div className="p-6 text-center text-fg-subtle text-xs">
                                        <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-primary mb-1" />
                                    </div>
                                ) : turno2List.length === 0 ? (
                                    <div className="p-6 text-center text-fg-subtle text-sm border border-border/60 rounded-lg">
                                        Nessun operatore assegnato a Turno 2
                                    </div>
                                ) : (
                                    <div className="border border-border rounded-lg overflow-hidden divide-y divide-border/60 bg-card/40">
                                        {turno2List.map((op) => {
                                            const isMutating = turno2Mutating === op.OPERATORE;
                                            return (
                                                <div
                                                    key={op.OPERATORE}
                                                    className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-muted/20 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-fg-secondary font-medium">{op.NOME}</span>
                                                        <span className="text-3xs text-fg-subtle font-mono">({op.OPERATORE})</span>
                                                        <span className="text-3xs px-1.5 py-0.5 rounded bg-info-950/50 border border-info-700/50 text-info-300 font-semibold font-mono">
                                                            TURNO2
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveFromTurno2(op.OPERATORE)}
                                                        disabled={isMutating}
                                                        className="p-1 text-fg-subtle hover:text-danger-400 transition-colors cursor-pointer rounded hover:bg-muted flex items-center gap-1 text-xs"
                                                    >
                                                        {isMutating ? (
                                                            <div className="w-3 h-3 border border-fg-muted border-t-transparent rounded-full animate-spin" />
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
            <div className="rounded-2xl border border-border/80 bg-card/40 backdrop-blur-md overflow-hidden transition-all duration-300 shadow-xl">
                <button
                    type="button"
                    onClick={() => setIsSystemOpen(!isSystemOpen)}
                    className="w-full p-5 flex items-center justify-between gap-4 text-left hover:bg-muted/40 transition-colors cursor-pointer group"
                >
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-info-500/10 border border-info-500/25 text-info-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-base font-bold text-fg-strong tracking-wide group-hover:text-primary transition-colors">
                                    Sistema Presenze & Auto-Uscita (EXT)
                                </h2>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-info-950/40 text-info-400 border border-info-800/50">
                                    Automatico
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success-950/40 text-success-400 border border-success-800/50">
                                    Attivo
                                </span>
                            </div>
                            <p className="text-xs text-fg-muted mt-0.5">
                                Orari di auto-uscita per timbrature feriali/sabati e regole di sistema
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg bg-muted/60 border border-border-strong/50 text-fg-muted group-hover:text-fg-strong transition-all transform duration-300 ${isSystemOpen ? 'rotate-180 bg-primary/10 border-primary/30 text-primary' : ''}`}>
                            <ChevronDown className="w-4 h-4" />
                        </div>
                    </div>
                </button>

                {isSystemOpen && (
                    <div className="p-6 pt-4 border-t border-border/80 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Section A: Orari Auto-Uscita */}
                        <div className="space-y-3">
                            <div className="pb-2 border-b border-border/60">
                                <h3 className="text-sm font-semibold text-fg-soft">
                                    {copy.autoExitSection}
                                </h3>
                                <p className="text-xs text-fg-muted">
                                    Orari predefiniti assegnati in caso di mancata timbratura in uscita
                                </p>
                            </div>

                            <div className="border border-border rounded-lg overflow-hidden divide-y divide-border/60 bg-card/40">
                                <div className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-muted/20 transition-colors">
                                    <span className="text-fg-secondary font-medium">
                                        {copy.autoExitWeekday}
                                    </span>
                                    <span className="font-mono font-bold text-primary">
                                        {presenceConfig.AUTO_EXIT_TIME_WEEKDAY}
                                    </span>
                                </div>

                                <div className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-muted/20 transition-colors">
                                    <span className="text-fg-secondary font-medium">
                                        {copy.autoExitSaturday}
                                    </span>
                                    <span className="font-mono font-bold text-primary">
                                        {presenceConfig.AUTO_EXIT_TIME_SATURDAY}
                                    </span>
                                </div>

                                <div className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-muted/20 transition-colors">
                                    <span className="text-fg-secondary font-medium">
                                        {copy.triggerHour}
                                    </span>
                                    <span className="font-mono font-bold text-primary">
                                        {presenceConfig.TRIGGER_HOUR}:00
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Section B: Stato Sistema & Regole */}
                        <div className="pt-4 border-t border-border/60 space-y-3">
                            <div className="pb-2 border-b border-border/60">
                                <h3 className="text-sm font-semibold text-fg-soft">
                                    {copy.systemInfo}
                                </h3>
                                <p className="text-xs text-fg-muted">
                                    Regole attive e sincronizzazione background
                                </p>
                            </div>

                            <div className="border border-border rounded-lg overflow-hidden divide-y divide-border/60 bg-card/40">
                                <div className="px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs hover:bg-muted/20 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <Info className="text-primary flex-shrink-0" size={15} />
                                        <span className="text-fg-secondary font-medium">{copy.activeStatus}</span>
                                    </div>
                                    <span className="text-fg-muted text-2xs">
                                        {copy.activeDesc}
                                    </span>
                                </div>

                                <div className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-muted/20 transition-colors">
                                    <span className="text-fg-secondary font-medium">
                                        Modulo Calcolo Ore Mensile
                                    </span>
                                    <span className="text-2xs font-semibold text-success-400 bg-success-950/40 px-2 py-0.5 rounded border border-success-800/50">
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
