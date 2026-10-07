'use client';

import { useState, useEffect } from 'react';
import { getSignatureTypesAction } from '@/app/actions';
import { updateRecordAction, deleteRecordAction, insertRecordAction } from '@/app/admin-actions';
import { SignatureType } from '@/lib/pricing/types';
import { Plus, Trash2, Save, Edit2, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { confirmDelete } from '@/lib/confirm';
import { notify } from '@/lib/notify';
import { APP_COPY } from '@/locales';

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
            notify.failure(res.error);
        }
    };

    const handleDelete = async (id: string) => {
        if (await confirmDelete(APP_COPY.admin.signatureTypes.deleteConfirm)) {
            const res = await deleteRecordAction('QUOTES', 'signature_types', id, 'id');
            if (res.success) loadData();
            else notify.failure(res.error);
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
            notify.failure(res.error);
        }
    };



    if (loading && signatures.length === 0) return <div className="p-8 text-center text-fg-muted font-medium italic">{APP_COPY.admin.signatureTypes.loading}</div>;

    return (
        <div className="bg-card rounded-lg border border-border  overflow-hidden">
            <div className="p-3 border-b border-border flex justify-end">
                <Button
                    variant="primary"
                    size="sm"
                    onClick={() => { setIsAdding(true); setEditingId(null); setEditForm({ name: '', pages: 16, unit_price: 0, sort_order: 100 }); }}
                    className="flex items-center gap-1.5"
                >
                    <Plus size={14} /> {APP_COPY.admin.signatureTypes.addType}
                </Button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-card/50 text-3xs uppercase tracking-wider text-fg-muted font-bold border-b">
                        <tr>
                            <th className="px-6 py-3">{APP_COPY.admin.signatureTypes.nameLabel}</th>
                            <th className="px-6 py-3 text-center">{APP_COPY.admin.signatureTypes.pagesLabel}</th>
                            <th className="px-6 py-3 text-center">{APP_COPY.admin.signatureTypes.unitPriceLabel}</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {isAdding && (
                            <tr className="bg-success-50/30">
                                <td className="px-6 py-3">
                                    <input
                                        type="text"
                                        placeholder="e.g. 16 pages"
                                        className="w-full px-2 py-1 border border-border rounded text-sm bg-card focus:ring-2 focus:ring-success-500 outline-none"
                                        value={editForm.name || ''}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        autoFocus
                                    />
                                </td>
                                <td className="px-6 py-3">
                                    <input
                                        type="number"
                                        className="w-full px-2 py-1 border border-border rounded text-sm bg-card text-center"
                                        value={editForm.pages || ''}
                                        onChange={e => setEditForm({ ...editForm, pages: parseInt(e.target.value) })}
                                    />
                                </td>
                                <td className="px-6 py-3">
                                    <input
                                        type="number"
                                        step="0.0001"
                                        className="w-full px-2 py-1 border border-border rounded text-sm bg-card font-mono text-center"
                                        value={editForm.unit_price ?? ''}
                                        onChange={e => setEditForm({ ...editForm, unit_price: parseFloat(e.target.value) })}
                                    />
                                </td>
                                <td className="px-6 py-3 text-right space-x-2">
                                    <button onClick={handleAdd} className="text-success-600 hover:text-success-800 p-1 rounded-full hover:bg-success-50 transition-colors"><Save size={18} /></button>
                                    <button onClick={() => setIsAdding(false)} className="text-fg-subtle hover:text-fg-secondary p-1 rounded-full hover:bg-card/50 transition-colors"><X size={18} /></button>
                                </td>
                            </tr>
                        )}
                        {signatures.map((sig) => (
                            <tr key={sig.id} className="hover:bg-card/50 transition-colors group">
                                <td className="px-6 py-4">
                                    {editingId === sig.id ? (
                                        <input
                                            type="text"
                                            className="w-full px-2 py-1 border border-border rounded text-sm bg-card focus:ring-2 focus:ring-info-500 outline-none"
                                            value={editForm.name || ''}
                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        />
                                    ) : (
                                        <span className="text-sm font-semibold text-fg">
                                            {sig.name}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {editingId === sig.id ? (
                                        <input
                                            type="number"
                                            className="w-full max-w-[100px] px-2 py-1 border border-border rounded text-sm bg-card text-center focus:ring-2 focus:ring-info-500 outline-none"
                                            value={editForm.pages || ''}
                                            onChange={e => setEditForm({ ...editForm, pages: parseInt(e.target.value) })}
                                        />
                                    ) : (
                                        <span className="text-sm font-mono text-fg-secondary">
                                            {sig.pages} pp
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {editingId === sig.id ? (
                                        <input
                                            type="number"
                                            step="0.0001"
                                            className="w-full max-w-[120px] px-2 py-1 border border-border rounded text-sm bg-card font-mono text-center focus:ring-2 focus:ring-info-500 outline-none"
                                            value={editForm.unit_price ?? 0}
                                            onChange={e => setEditForm({ ...editForm, unit_price: parseFloat(e.target.value) })}
                                        />
                                    ) : (
                                        <span className="text-sm font-mono text-primary font-semibold">
                                            €{sig.unit_price.toFixed(4)}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {editingId === sig.id ? (
                                        <div className="flex justify-end gap-3">
                                            <button onClick={() => handleSave(sig.id)} className="text-success-600 hover:text-success-800 p-1 rounded-full hover:bg-success-50 transition-colors"><Save size={18} /></button>
                                            <button onClick={() => setEditingId(null)} className="text-fg-subtle hover:text-fg-secondary p-1 rounded-full hover:bg-card/50 transition-colors"><X size={18} /></button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleStartEdit(sig)} className="text-primary hover:text-primary/80 p-1 rounded-full hover:bg-muted transition-colors"><Edit2 size={18} /></button>
                                            <button onClick={() => handleDelete(sig.id)} className="text-danger hover:text-danger/80 p-1 rounded-full hover:bg-danger/10 transition-colors"><Trash2 size={18} /></button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {signatures.length === 0 && !isAdding && (
                <div className="p-12 text-center border-t border-border">
                    <div className="inline-flex items-center justify-center p-3 bg-card/50 rounded-full mb-3 text-fg-subtle">
                        <AlertCircle size={24} />
                    </div>
                    <p className="text-fg-muted text-sm font-medium">{APP_COPY.admin.signatureTypes.noTypes}</p>
                </div>
            )}
        </div>
    );
}
