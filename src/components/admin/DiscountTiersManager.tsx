'use client';

import React, { useState, useEffect } from 'react';
import { getDiscountTiersAction } from '@/app/actions';
import { updateRecordAction, deleteRecordAction, insertRecordAction } from '@/app/admin-actions';
import { DiscountTier } from '@/lib/pricing/types';
import { Plus, Trash2, Save, Edit2, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

import { APP_COPY } from '@/locales/en';

export function DiscountTiersManager() {
    const [tiers, setTiers] = useState<DiscountTier[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<number | string | null>(null);
    const [editForm, setEditForm] = useState<Partial<DiscountTier>>({});
    const [isAdding, setIsAdding] = useState(false);

    const loadData = async () => {
        setLoading(true);
        const data = await getDiscountTiersAction();
        // The action returns simple objects, we need to handle the typing for local state
        setTiers(data as unknown as DiscountTier[]);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleStartEdit = (tier: DiscountTier) => {
        setEditingId(tier.id || null);
        setEditForm(tier);
    };

    const handleSave = async (id: number | string) => {
        const res = await updateRecordAction('QUOTES', 'discount_tiers', id, 'id', {
            min_quantity: Number(editForm.min_quantity),
            max_quantity: editForm.max_quantity ? Number(editForm.max_quantity) : null,
            discount_percentage: Number(editForm.discount_percentage)
        });

        if (res.success) {
            setEditingId(null);
            loadData();
        } else {
            alert('Error: ' + res.error);
        }
    };

    const handleDelete = async (id: number | string) => {
        if (confirm(APP_COPY.admin.discountTiers.deleteConfirm)) {
            const res = await deleteRecordAction('QUOTES', 'discount_tiers', id, 'id');
            if (res.success) loadData();
        }
    };

    const handleAdd = async () => {
        const res = await insertRecordAction('QUOTES', 'discount_tiers', {
            min_quantity: Number(editForm.min_quantity),
            max_quantity: editForm.max_quantity ? Number(editForm.max_quantity) : null,
            discount_percentage: Number(editForm.discount_percentage)
        });

        if (res.success) {
            setIsAdding(false);
            setEditForm({});
            loadData();
        } else {
            alert('Error adding: ' + res.error);
        }
    };

    if (loading && tiers.length === 0) return <div className="p-8 text-center text-gray-500">{APP_COPY.admin.discountTiers.loading}</div>;

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <div>
                    <h2 className="font-bold text-gray-800">{APP_COPY.admin.discountTiers.title}</h2>
                    <p className="text-xs text-gray-500">{APP_COPY.admin.discountTiers.subtitle}</p>
                </div>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={() => { setIsAdding(true); setEditingId(null); setEditForm({ min_quantity: 0, max_quantity: 0, discount_percentage: 0 }); }}
                    className="flex items-center gap-1"
                >
                    <Plus size={16} /> {APP_COPY.admin.discountTiers.addTier}
                </Button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 font-bold border-b">
                        <tr>
                            <th className="px-6 py-3">{APP_COPY.admin.discountTiers.minQty}</th>
                            <th className="px-6 py-3">{APP_COPY.admin.discountTiers.maxQty}</th>
                            <th className="px-6 py-3">{APP_COPY.admin.discountTiers.discount}</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isAdding && (
                            <tr className="bg-blue-50/50">
                                <td className="px-6 py-3">
                                    <input
                                        type="number"
                                        className="w-full px-2 py-1 border rounded text-sm"
                                        value={editForm.min_quantity || ''}
                                        onChange={e => setEditForm({ ...editForm, min_quantity: parseInt(e.target.value) })}
                                    />
                                </td>
                                <td className="px-6 py-3">
                                    <input
                                        type="text"
                                        placeholder="Max Qty (null for ∞)"
                                        className="w-full px-2 py-1 border rounded text-sm"
                                        value={editForm.max_quantity === null ? 'null' : (editForm.max_quantity ?? '')}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setEditForm({ ...editForm, max_quantity: val === 'null' ? null : (parseInt(val) || 0) });
                                        }}
                                    />
                                </td>
                                <td className="px-6 py-3">
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full px-2 py-1 border rounded text-sm"
                                        value={editForm.discount_percentage || ''}
                                        onChange={e => setEditForm({ ...editForm, discount_percentage: parseFloat(e.target.value) })}
                                    />
                                    <span className="text-[10px] text-blue-600 ml-1">e.g. 0.10 for 10%</span>
                                </td>
                                <td className="px-6 py-3 text-right space-x-2">
                                    <button onClick={handleAdd} className="text-emerald-600 hover:text-emerald-800 p-1 rounded-full hover:bg-emerald-50 transition-all"><Save size={18} /></button>
                                    <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-50 transition-all"><X size={18} /></button>
                                </td>
                            </tr>
                        )}
                        {tiers.map((tier) => (
                            <tr key={tier.id} className="hover:bg-gray-50 transition-colors group">
                                <td className="px-6 py-4">
                                    {editingId === tier.id ? (
                                        <input
                                            type="number"
                                            className="w-24 px-2 py-1 border rounded text-sm"
                                            value={editForm.min_quantity || ''}
                                            onChange={e => setEditForm({ ...editForm, min_quantity: parseInt(e.target.value) })}
                                        />
                                    ) : (
                                        <span className="text-sm font-medium text-gray-700">{tier.min_quantity}</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {editingId === tier.id ? (
                                        <input
                                            type="text"
                                            placeholder="null"
                                            className="w-24 px-2 py-1 border rounded text-sm"
                                            value={editForm.max_quantity === null ? 'null' : (editForm.max_quantity ?? '')}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setEditForm({ ...editForm, max_quantity: val === 'null' ? null : (parseInt(val) || 0) });
                                            }}
                                        />
                                    ) : (
                                        <span className="text-sm text-gray-600 font-mono">{tier.max_quantity || '∞'}</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {editingId === tier.id ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="w-20 px-2 py-1 border rounded text-sm font-mono"
                                                value={editForm.discount_percentage ?? 0}
                                                onChange={e => setEditForm({ ...editForm, discount_percentage: parseFloat(e.target.value) })}
                                            />
                                            <span className="text-[10px] text-blue-600"> (0.10 = 10%)</span>
                                        </div>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                                            {(tier.discount_percentage * 100).toFixed(0)}%
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {editingId === tier.id ? (
                                        <div className="flex justify-end gap-3">
                                            <button onClick={() => handleSave(tier.id!)} className="text-emerald-600 hover:text-emerald-800 p-1 rounded-full hover:bg-emerald-50 transition-all"><Save size={18} /></button>
                                            <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-50 transition-all"><X size={18} /></button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => handleStartEdit(tier)} className="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50 transition-all"><Edit2 size={18} /></button>
                                            <button onClick={() => handleDelete(tier.id!)} className="text-red-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-all"><Trash2 size={18} /></button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {tiers.length === 0 && !isAdding && (
                <div className="p-12 text-center border-t border-gray-100">
                    <div className="inline-flex items-center justify-center p-3 bg-gray-50 rounded-full mb-3 text-gray-400">
                        <AlertCircle size={24} />
                    </div>
                    <p className="text-gray-500 text-sm">{APP_COPY.admin.discountTiers.noTiers}</p>
                </div>
            )}
        </div>
    );
}
