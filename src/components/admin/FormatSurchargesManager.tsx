'use client';

import { useState, useEffect } from 'react';
import { getFormatSurchargesAction } from '@/app/actions';
import { updateRecordAction, deleteRecordAction, insertRecordAction } from '@/app/admin-actions';
import { Plus, Trash2, Save, Edit2, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

import { confirmDelete } from '@/lib/confirm';
import { notify } from '@/lib/notify';
import { APP_COPY } from '@/locales';

interface FormatSurcharge {
    id?: number | string;
    width_min: number;
    width_max: number;
    height_min: number;
    height_max: number;
    surcharge_percentage: number;
}

export function FormatSurchargesManager() {
    const [surcharges, setSurcharges] = useState<FormatSurcharge[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<number | string | null>(null);
    const [editForm, setEditForm] = useState<Partial<FormatSurcharge>>({});
    const [isAdding, setIsAdding] = useState(false);

    const loadData = async () => {
        setLoading(true);
        const data = await getFormatSurchargesAction();
        setSurcharges(data as unknown as FormatSurcharge[]);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleStartEdit = (surcharge: FormatSurcharge) => {
        setEditingId(surcharge.id || null);
        setEditForm(surcharge);
    };

    const handleSave = async (id: number | string) => {
        const res = await updateRecordAction('QUOTES', 'format_surcharges', id, 'id', {
            width_min: Number(editForm.width_min),
            width_max: Number(editForm.width_max),
            height_min: Number(editForm.height_min),
            height_max: Number(editForm.height_max),
            surcharge_percentage: Number(editForm.surcharge_percentage)
        });

        if (res.success) {
            setEditingId(null);
            loadData();
        } else {
            notify.failure(res.error);
        }
    };

    const handleDelete = async (id: number | string) => {
        if (await confirmDelete(APP_COPY.admin.formatSurcharges.deleteConfirm)) {
            const res = await deleteRecordAction('QUOTES', 'format_surcharges', id, 'id');
            if (res.success) loadData();
            else notify.failure(res.error);
        }
    };

    const handleAdd = async () => {
        const res = await insertRecordAction('QUOTES', 'format_surcharges', {
            width_min: Number(editForm.width_min),
            width_max: Number(editForm.width_max),
            height_min: Number(editForm.height_min),
            height_max: Number(editForm.height_max),
            surcharge_percentage: Number(editForm.surcharge_percentage)
        });

        if (res.success) {
            setIsAdding(false);
            setEditForm({});
            loadData();
        } else {
            notify.failure(res.error);
        }
    };

    if (loading && surcharges.length === 0) return <div className="p-8 text-center text-fg-muted">{APP_COPY.admin.formatSurcharges.loading}</div>;

    return (
        <div className="bg-card rounded-lg border border-border  overflow-hidden">
            <div className="p-3 border-b border-border flex justify-end">
                <Button
                    variant="primary"
                    size="sm"
                    onClick={() => { 
                        setIsAdding(true); 
                        setEditingId(null); 
                        setEditForm({ width_min: 0, width_max: 0, height_min: 0, height_max: 0, surcharge_percentage: 0 }); 
                    }}
                    className="flex items-center gap-1.5"
                >
                    <Plus size={14} /> {APP_COPY.admin.formatSurcharges.addSurcharge}
                </Button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-card/50 text-3xs uppercase tracking-wider text-fg-muted font-bold border-b">
                        <tr>
                            <th className="px-6 py-3">{APP_COPY.admin.formatSurcharges.widthMin}</th>
                            <th className="px-6 py-3">{APP_COPY.admin.formatSurcharges.widthMax}</th>
                            <th className="px-6 py-3">{APP_COPY.admin.formatSurcharges.heightMin}</th>
                            <th className="px-6 py-3">{APP_COPY.admin.formatSurcharges.heightMax}</th>
                            <th className="px-6 py-3">{APP_COPY.admin.formatSurcharges.surcharge}</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {isAdding && (
                            <tr className="bg-muted/50">
                                <td className="px-6 py-3">
                                    <input
                                        type="number"
                                        className="w-full px-2 py-1 border rounded text-sm"
                                        value={editForm.width_min || ''}
                                        onChange={e => setEditForm({ ...editForm, width_min: parseInt(e.target.value) })}
                                    />
                                </td>
                                <td className="px-6 py-3">
                                    <input
                                        type="number"
                                        className="w-full px-2 py-1 border rounded text-sm"
                                        value={editForm.width_max || ''}
                                        onChange={e => setEditForm({ ...editForm, width_max: parseInt(e.target.value) })}
                                    />
                                </td>
                                <td className="px-6 py-3">
                                    <input
                                        type="number"
                                        className="w-full px-2 py-1 border rounded text-sm"
                                        value={editForm.height_min || ''}
                                        onChange={e => setEditForm({ ...editForm, height_min: parseInt(e.target.value) })}
                                    />
                                </td>
                                <td className="px-6 py-3">
                                    <input
                                        type="number"
                                        className="w-full px-2 py-1 border rounded text-sm"
                                        value={editForm.height_max || ''}
                                        onChange={e => setEditForm({ ...editForm, height_max: parseInt(e.target.value) })}
                                    />
                                </td>
                                <td className="px-6 py-3">
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full px-2 py-1 border rounded text-sm"
                                        value={editForm.surcharge_percentage || ''}
                                        onChange={e => setEditForm({ ...editForm, surcharge_percentage: parseFloat(e.target.value) })}
                                    />
                                    <span className="text-3xs text-primary ml-1">e.g. 0.20 for 20%</span>
                                </td>
                                <td className="px-6 py-3 text-right space-x-2">
                                    <button onClick={handleAdd} className="text-success-600 hover:text-success-800 p-1 rounded-full hover:bg-success-50 transition-all"><Save size={18} /></button>
                                    <button onClick={() => setIsAdding(false)} className="text-fg-subtle hover:text-fg-secondary p-1 rounded-full hover:bg-card/50 transition-all"><X size={18} /></button>
                                </td>
                            </tr>
                        )}
                        {surcharges.map((surcharge) => (
                            <tr key={surcharge.id} className="hover:bg-card/50 transition-colors group">
                                <td className="px-6 py-4">
                                    {editingId === surcharge.id ? (
                                        <input
                                            type="number"
                                            className="w-20 px-2 py-1 border rounded text-sm"
                                            value={editForm.width_min || ''}
                                            onChange={e => setEditForm({ ...editForm, width_min: parseInt(e.target.value) })}
                                        />
                                    ) : (
                                        <span className="text-sm font-medium text-fg-soft">{surcharge.width_min}</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {editingId === surcharge.id ? (
                                        <input
                                            type="number"
                                            className="w-20 px-2 py-1 border rounded text-sm"
                                            value={editForm.width_max || ''}
                                            onChange={e => setEditForm({ ...editForm, width_max: parseInt(e.target.value) })}
                                        />
                                    ) : (
                                        <span className="text-sm text-fg-secondary font-mono">{surcharge.width_max}</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {editingId === surcharge.id ? (
                                        <input
                                            type="number"
                                            className="w-20 px-2 py-1 border rounded text-sm"
                                            value={editForm.height_min || ''}
                                            onChange={e => setEditForm({ ...editForm, height_min: parseInt(e.target.value) })}
                                        />
                                    ) : (
                                        <span className="text-sm text-fg-secondary font-mono">{surcharge.height_min}</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {editingId === surcharge.id ? (
                                        <input
                                            type="number"
                                            className="w-20 px-2 py-1 border rounded text-sm"
                                            value={editForm.height_max || ''}
                                            onChange={e => setEditForm({ ...editForm, height_max: parseInt(e.target.value) })}
                                        />
                                    ) : (
                                        <span className="text-sm text-fg-secondary font-mono">{surcharge.height_max}</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {editingId === surcharge.id ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="w-20 px-2 py-1 border rounded text-sm font-mono"
                                                value={editForm.surcharge_percentage ?? 0}
                                                onChange={e => setEditForm({ ...editForm, surcharge_percentage: parseFloat(e.target.value) })}
                                            />
                                            <span className="text-3xs text-primary"> (0.20 = 20%)</span>
                                        </div>
                                    ) : (
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                            surcharge.surcharge_percentage === 0 
                                                ? 'bg-card text-fg-secondary border-border' 
                                                : 'bg-warning/20 text-warning-300 border-warning/30'
                                        }`}>
                                            +{(surcharge.surcharge_percentage * 100).toFixed(0)}%
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {editingId === surcharge.id ? (
                                        <div className="flex justify-end gap-3">
                                            <button onClick={() => handleSave(surcharge.id!)} className="text-success-600 hover:text-success-800 p-1 rounded-full hover:bg-success-50 transition-all"><Save size={18} /></button>
                                            <button onClick={() => setEditingId(null)} className="text-fg-subtle hover:text-fg-secondary p-1 rounded-full hover:bg-card/50 transition-all"><X size={18} /></button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => handleStartEdit(surcharge)} className="text-primary hover:text-primary/80 p-1 rounded-full hover:bg-muted transition-all"><Edit2 size={18} /></button>
                                            <button onClick={() => handleDelete(surcharge.id!)} className="text-danger hover:text-danger/80 p-1 rounded-full hover:bg-danger/10 transition-all"><Trash2 size={18} /></button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {surcharges.length === 0 && !isAdding && (
                <div className="p-12 text-center border-t border-border">
                    <div className="inline-flex items-center justify-center p-3 bg-card/50 rounded-full mb-3 text-fg-subtle">
                        <AlertCircle size={24} />
                    </div>
                    <p className="text-fg-muted text-sm">{APP_COPY.admin.formatSurcharges.noSurcharges}</p>
                </div>
            )}
        </div>
    );
}
