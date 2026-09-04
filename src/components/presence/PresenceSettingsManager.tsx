'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, ShieldCheck, Info, Edit2, Check, X, Database, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { APP_COPY } from '@/locales';
import { APP_CONFIG } from '@/config/constants';
import { getAllPresenceSettingsAction, updatePresenceSettingAction, getTurno2OperatorsAction, searchOperatorsAction, setOperatorGruppoAction } from '@/app/presence/presence-actions';
import type { PresenceSettingRow } from '@/types';

type Turno2Operator = { OPERATORE: string; NOME: string; GRUPPO: string };
type SearchOperator = { OPERATORE: string; NOME: string; GRUPPO: string | null };

const PARAMETER_ORDER: Record<string, number> = {
    'STD_START': 1,
    'STD_END': 2,
    'SPEC_START': 3,
    'SPEC_END': 4,
    'PAUSA_MINUTI': 5,
};

function sortSettings(list: PresenceSettingRow[]): PresenceSettingRow[] {
    return [...list].sort((a, b) => {
        const orderA = PARAMETER_ORDER[a.PARAMETRO] ?? 99;
        const orderB = PARAMETER_ORDER[b.PARAMETRO] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.PARAMETRO.localeCompare(b.PARAMETRO);
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
    const [isAutoExitOpen, setIsAutoExitOpen] = useState(false);
    const [isSystemInfoOpen, setIsSystemInfoOpen] = useState(false);
    const [isTurno2Open, setIsTurno2Open] = useState(false);

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

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

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

    const getSettingUnit = (parametro: string) => {
        if (parametro.includes('MINUTI') || parametro.includes('PAUSA')) return 'min';
        return '';
    };

    const loadTurno2 = useCallback(async () => {
        setTurno2Loading(true);
        try {
            const res = await getTurno2OperatorsAction();
            if (res.success) setTurno2List(res.data);
        } catch { /* keep existing */ } finally {
            setTurno2Loading(false);
        }
    }, []);

    // Load TURNO2 list when that tab opens
    useEffect(() => {
        if (isTurno2Open) loadTurno2();
    }, [isTurno2Open, loadTurno2]);

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
                    <div className="p-6 pt-4 border-t border-zinc-800/80 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
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
                            settings.map((item) => {
                                const isEditing = editingKey === item.PARAMETRO;
                                const unit = getSettingUnit(item.PARAMETRO);

                                return (
                                    <div
                                        key={item.PARAMETRO}
                                        className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-zinc-200">
                                                    {item.DESCRIZIONE || item.PARAMETRO}
                                                </span>
                                                <code className="text-[11px] text-zinc-500 font-mono bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                                                    PRESENZE.{item.PARAMETRO}
                                                </code>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {!isEditing ? (
                                                <div className="flex items-center gap-3">
                                                    <div className="text-right">
                                                        <div className="text-base font-mono font-bold text-primary">
                                                            {item.VALORE} {unit}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        onClick={() => handleStartEdit(item)}
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex items-center gap-1.5"
                                                        title={copy.edit}
                                                    >
                                                        <Edit2 size={13} />
                                                        {copy.edit}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-28">
                                                        <Input
                                                            type={item.PARAMETRO.includes('START') || item.PARAMETRO.includes('END') ? 'time' : 'text'}
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            className="h-8 text-sm font-mono text-center"
                                                            autoFocus
                                                        />
                                                    </div>
                                                    {unit && <span className="text-xs text-zinc-400">{unit}</span>}
                                                    <Button
                                                        type="button"
                                                        onClick={() => handleSaveSetting(item.PARAMETRO, item.DESCRIZIONE)}
                                                        disabled={saving}
                                                        variant="primary"
                                                        size="sm"
                                                        className="flex items-center gap-1"
                                                    >
                                                        <Check size={14} />
                                                        {copy.save}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        onClick={handleCancelEdit}
                                                        disabled={saving}
                                                        variant="secondary"
                                                        size="sm"
                                                    >
                                                        <X size={14} />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            {/* Tab 2: Configurazione Auto-Uscita (EXT) (Collapsible) */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md overflow-hidden transition-all duration-300 shadow-xl">
                <button
                    type="button"
                    onClick={() => setIsAutoExitOpen(!isAutoExitOpen)}
                    className="w-full p-5 flex items-center justify-between gap-4 text-left hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                >
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-base font-bold text-white tracking-wide group-hover:text-primary transition-colors">
                                    {copy.autoExitSection}
                                </h2>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950/40 text-blue-400 border border-blue-800/50">
                                    Automatico
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Orari di auto-uscita per timbrature feriali e sabati
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 group-hover:text-white transition-all transform duration-300 ${isAutoExitOpen ? 'rotate-180 bg-primary/10 border-primary/30 text-primary' : ''}`}>
                            <ChevronDown className="w-4 h-4" />
                        </div>
                    </div>
                </button>

                {isAutoExitOpen && (
                    <div className="p-6 pt-4 border-t border-zinc-800/80 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex justify-between items-center bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/80">
                                <span className="text-sm text-zinc-300 font-medium">
                                    {copy.autoExitWeekday}
                                </span>
                                <span className="text-sm font-mono text-primary bg-primary/10 px-2.5 py-1 rounded">
                                    {presenceConfig.AUTO_EXIT_TIME_WEEKDAY}
                                </span>
                            </div>

                            <div className="flex justify-between items-center bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/80">
                                <span className="text-sm text-zinc-300 font-medium">
                                    {copy.autoExitSaturday}
                                </span>
                                <span className="text-sm font-mono text-primary bg-primary/10 px-2.5 py-1 rounded">
                                    {presenceConfig.AUTO_EXIT_TIME_SATURDAY}
                                </span>
                            </div>

                            <div className="flex justify-between items-center bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/80">
                                <span className="text-sm text-zinc-300 font-medium">
                                    {copy.triggerHour}
                                </span>
                                <span className="text-sm font-mono text-primary bg-primary/10 px-2.5 py-1 rounded">
                                    {presenceConfig.TRIGGER_HOUR}:00
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Tab 3: Informazioni Sistema & Regole Presenze (Collapsible) */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md overflow-hidden transition-all duration-300 shadow-xl">
                <button
                    type="button"
                    onClick={() => setIsSystemInfoOpen(!isSystemInfoOpen)}
                    className="w-full p-5 flex items-center justify-between gap-4 text-left hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                >
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-base font-bold text-white tracking-wide group-hover:text-primary transition-colors">
                                    {copy.systemInfo}
                                </h2>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-800/50">
                                    Attivo
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Regole di sistema, stato moduli e sincronizzazione presenze
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 group-hover:text-white transition-all transform duration-300 ${isSystemInfoOpen ? 'rotate-180 bg-primary/10 border-primary/30 text-primary' : ''}`}>
                            <ChevronDown className="w-4 h-4" />
                        </div>
                    </div>
                </button>

                {isSystemInfoOpen && (
                    <div className="p-6 pt-4 border-t border-zinc-800/80 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-start gap-3 bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/80">
                                <Info className="text-primary flex-shrink-0 mt-0.5" size={18} />
                                <div>
                                    <div className="text-sm font-medium text-zinc-200">
                                        {copy.activeStatus}
                                    </div>
                                    <div className="text-xs text-zinc-400 mt-1">
                                        {copy.activeDesc}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/80">
                                <div>
                                    <div className="text-sm text-zinc-200 font-medium">
                                        Modulo Calcolo Ore Mensile
                                    </div>
                                    <div className="text-xs text-zinc-400 mt-0.5">
                                        Calcolo presenze e gestione parametri
                                    </div>
                                </div>
                                <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-800/50">
                                    ATTIVO
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Tab 4: Gestione Operatori TURNO2 */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md overflow-hidden transition-all duration-300 shadow-xl">
                <button
                    type="button"
                    onClick={() => setIsTurno2Open(!isTurno2Open)}
                    className="w-full p-5 flex items-center justify-between gap-4 text-left hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                >
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                            <span className="text-xs font-bold">T2</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-base font-bold text-white tracking-wide group-hover:text-primary transition-colors">
                                    Operatori Turno 2
                                </h2>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950/40 text-blue-300 border border-blue-700/50">
                                    {turno2List.length} operatori
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Gestisci quali operatori usano l&apos;orario speciale (GRUPPO = TURNO2)
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 group-hover:text-white transition-all transform duration-300 ${isTurno2Open ? 'rotate-180 bg-primary/10 border-primary/30 text-primary' : ''}`}>
                            <ChevronDown className="w-4 h-4" />
                        </div>
                    </div>
                </button>

                {isTurno2Open && (
                    <div className="p-6 pt-4 border-t border-zinc-800/80 animate-in fade-in slide-in-from-top-2 duration-300 space-y-6">

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
                                <div className="mt-2 border border-zinc-800 rounded-lg overflow-hidden">
                                    {searchResults.map((op) => {
                                        const isAlready = (op.GRUPPO ?? '').toUpperCase() === 'TURNO2';
                                        const isMutating = turno2Mutating === op.OPERATORE;
                                        return (
                                            <div
                                                key={op.OPERATORE}
                                                className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/50 border-b border-zinc-800/60 last:border-0"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono text-zinc-500">{op.OPERATORE}</span>
                                                    <span className="text-sm text-zinc-200">{op.NOME}</span>
                                                    {isAlready && (
                                                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-950/50 border border-blue-700/50 text-blue-300">
                                                            TURNO2
                                                        </span>
                                                    )}
                                                </div>
                                                {!isAlready && (
                                                    <Button
                                                        type="button"
                                                        onClick={() => handleAddToTurno2(op)}
                                                        disabled={isMutating}
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex items-center gap-1"
                                                    >
                                                        {isMutating ? (
                                                            <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                                                        ) : (
                                                            <Check size={13} />
                                                        )}
                                                        Aggiungi
                                                    </Button>
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
                                <div className="border border-zinc-800 rounded-lg overflow-hidden">
                                    {turno2List.map((op) => {
                                        const isMutating = turno2Mutating === op.OPERATORE;
                                        return (
                                            <div
                                                key={op.OPERATORE}
                                                className="flex items-center justify-between px-4 py-3 bg-zinc-900/50 border-b border-zinc-800/60 last:border-0"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-mono text-zinc-500">{op.OPERATORE}</span>
                                                    <span className="text-sm text-zinc-200">{op.NOME}</span>
                                                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-950/50 border border-blue-700/50 text-blue-300 font-semibold">
                                                        TURNO2
                                                    </span>
                                                </div>
                                                <Button
                                                    type="button"
                                                    onClick={() => handleRemoveFromTurno2(op.OPERATORE)}
                                                    disabled={isMutating}
                                                    variant="secondary"
                                                    size="sm"
                                                    className="flex items-center gap-1"
                                                >
                                                    {isMutating ? (
                                                        <div className="w-3 h-3 border border-zinc-400 border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <X size={13} />
                                                    )}
                                                    Rimuovi
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
