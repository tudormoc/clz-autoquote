'use client';

import React, { useState, useEffect } from 'react';
import { getSignatureTypesAction } from '@/app/actions';
import { updateRecordAction, deleteRecordAction, insertRecordAction } from '@/app/admin-actions';
import { SignatureType } from '@/lib/pricing/types';
import { Plus, Trash2, Save, Edit2, X, AlertCircle, Layers, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { APP_COPY } from '@/locales/en';

export function SignaturesManager() {
    const [signatures, setSignatures] = useState<SignatureType[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<SignatureType>>({});
    const [isAdding, setIsAdding] = useState(false);

    const loadData = async () => {
        setLoading(true);
        const data = await getSignatureTypesAction();
        setSignatures(data as SignatureType[]);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleStartEdit = (sig: SignatureType) => {
        setEditingId(sig.id);
        setEditForm(sig);
    };

    const handleSave = async (id: string) => {
        const res = await updateRecordAction('QUOTES', 'signature_types', id, 'id', {
            name: editForm.name,
            pages: Number(editForm.pages),
            unit_price: Number(editForm.unit_price)
        });

        if (res.success) {
            setEditingId(null);
            loadData();
        } else {
            alert('Error: ' + res.error);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm(APP_COPY.admin.signatureTypes.deleteConfirm)) {
            const res = await deleteRecordAction('QUOTES', 'signature_types', id, 'id');
            if (res.success) loadData();
        }
    };

    const handleAdd = async () => {
        // Simple UUID generation for manual inserts if DB doesn't handle it
        const id = crypto.randomUUID();
        const res = await insertRecordAction('QUOTES', 'signature_types', {
            id,
            name: editForm.name,
            pages: Number(editForm.pages),
            unit_price: Number(editForm.unit_price),
            sort_order: 100, // Default sorting
            is_active: 1
        });

        if (res.success) {
            setIsAdding(false);
            setEditForm({});
            loadData();
        } else {
            alert('Error adding: ' + res.error);
        }
    };



    if (loading && signatures.length === 0) return <div className="p-8 text-center text-gray-500 font-medium italic">{APP_COPY.admin.signatureTypes.loading}</div>;

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <div>
                    <h2 className="font-bold text-gray-800 flex items-center gap-2">
                        <Layers size={18} className="text-blue-600" />
                        {APP_COPY.admin.signatureTypes.title}
                    </h2>
                    <p className="text-xs text-gray-500">{APP_COPY.admin.signatureTypes.subtitle}</p>
                </div>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={() => { setIsAdding(true); setEditingId(null); setEditForm({ name: '', pages: 16, unit_price: 0, sort_order: 100 }); }}
                    className="flex items-center gap-1"
                >
                    <Plus size={16} /> {APP_COPY.admin.signatureTypes.addType}
                </Button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 font-bold border-b">
                        <tr>
                            <th className="px-6 py-3">{APP_COPY.admin.signatureTypes.nameLabel}</th>
                            <th className="px-6 py-3 text-center">{APP_COPY.admin.signatureTypes.pagesLabel}</th>
                            <th className="px-6 py-3 text-center">{APP_COPY.admin.signatureTypes.unitPriceLabel}</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isAdding && (
                            <tr className="bg-emerald-50/30">
                                <td className="px-6 py-3">
                                    <input
                                        type="text"
                                        placeholder="e.g. 16 pages"
                                        className="w-full px-2 py-1 border border-border rounded text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={editForm.name || ''}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        autoFocus
                                    />
                                </td>
                                <td className="px-6 py-3">
                                    <input
                                        type="number"
                                        className="w-full px-2 py-1 border border-border rounded text-sm bg-white text-center"
                                        value={editForm.pages || ''}
                                        onChange={e => setEditForm({ ...editForm, pages: parseInt(e.target.value) })}
                                    />
                                </td>
                                <td className="px-6 py-3">
                                    <input
                                        type="number"
                                        step="0.0001"
                                        className="w-full px-2 py-1 border border-border rounded text-sm bg-white font-mono text-center"
                                        value={editForm.unit_price ?? ''}
                                        onChange={e => setEditForm({ ...editForm, unit_price: parseFloat(e.target.value) })}
                                    />
                                </td>
                                <td className="px-6 py-3 text-right space-x-2">
                                    <button onClick={handleAdd} className="text-emerald-600 hover:text-emerald-800 p-1 rounded-full hover:bg-emerald-50 transition-colors"><Save size={18} /></button>
                                    <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-50 transition-colors"><X size={18} /></button>
                                </td>
                            </tr>
                        )}
                        {signatures.map((sig) => (
                            <tr key={sig.id} className="hover:bg-gray-50 transition-colors group">
                                <td className="px-6 py-4">
                                    {editingId === sig.id ? (
                                        <input
                                            type="text"
                                            className="w-full px-2 py-1 border border-border rounded text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={editForm.name || ''}
                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        />
                                    ) : (
                                        <span className="text-sm font-semibold text-gray-900">
                                            {sig.name}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {editingId === sig.id ? (
                                        <input
                                            type="number"
                                            className="w-full max-w-[100px] px-2 py-1 border border-border rounded text-sm bg-white text-center focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={editForm.pages || ''}
                                            onChange={e => setEditForm({ ...editForm, pages: parseInt(e.target.value) })}
                                        />
                                    ) : (
                                        <span className="text-sm font-mono text-gray-600">
                                            {sig.pages} pp
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {editingId === sig.id ? (
                                        <input
                                            type="number"
                                            step="0.0001"
                                            className="w-full max-w-[120px] px-2 py-1 border border-border rounded text-sm bg-white font-mono text-center focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={editForm.unit_price ?? 0}
                                            onChange={e => setEditForm({ ...editForm, unit_price: parseFloat(e.target.value) })}
                                        />
                                    ) : (
                                        <span className="text-sm font-mono text-blue-600 font-semibold">
                                            €{sig.unit_price.toFixed(4)}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {editingId === sig.id ? (
                                        <div className="flex justify-end gap-3">
                                            <button onClick={() => handleSave(sig.id)} className="text-emerald-600 hover:text-emerald-800 p-1 rounded-full hover:bg-emerald-50 transition-colors"><Save size={18} /></button>
                                            <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-50 transition-colors"><X size={18} /></button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleStartEdit(sig)} className="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50 transition-colors"><Edit2 size={18} /></button>
                                            <button onClick={() => handleDelete(sig.id)} className="text-red-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"><Trash2 size={18} /></button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {signatures.length === 0 && !isAdding && (
                <div className="p-12 text-center border-t border-gray-100">
                    <div className="inline-flex items-center justify-center p-3 bg-gray-50 rounded-full mb-3 text-gray-400">
                        <AlertCircle size={24} />
                    </div>
                    <p className="text-gray-500 text-sm font-medium">{APP_COPY.admin.signatureTypes.noTypes}</p>
                </div>
            )}
        </div>
    );
}
