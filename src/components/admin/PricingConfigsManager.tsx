'use client';

import React, { useState, useEffect } from 'react';
import { getPricingRulesAction } from '@/app/actions';
import { updateRecordAction } from '@/app/admin-actions';
import { PricingRule } from '@/lib/pricing/types';
import { Save, Edit2, X, Settings2 } from 'lucide-react';

import { APP_COPY } from '@/locales/en';

export function PricingConfigsManager() {
    const [rules, setRules] = useState<PricingRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<number | string | null>(null);
    const [editForm, setEditForm] = useState<Partial<PricingRule>>({});

    const loadData = async () => {
        setLoading(true);
        const data = await getPricingRulesAction();
        setRules(data);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSave = async (id: number | string) => {
        const res = await updateRecordAction('QUOTES', 'pricing_configs', id, 'id', {
            setup_base_cost: Number(editForm.setup_base_cost),
            setup_variable_factor: Number(editForm.setup_variable_factor),
            production_base_cost: Number(editForm.production_base_cost),
            production_variable_factor: Number(editForm.production_variable_factor),
        });

        if (res.success) {
            setEditingId(null);
            loadData();
        } else {
            alert('Error updating config: ' + res.error);
        }
    };

    if (loading && rules.length === 0) return <div className="p-8 text-center text-gray-500 italic">{APP_COPY.admin.pricingRules.loading}</div>;

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <div>
                    <h2 className="font-bold text-gray-800 flex items-center gap-2">
                        <Settings2 size={18} className="text-indigo-600" />
                        {APP_COPY.admin.pricingRules.title}
                    </h2>
                    <p className="text-xs text-gray-500">{APP_COPY.admin.pricingRules.subtitle}</p>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 font-bold border-b">
                        <tr>
                            <th className="px-6 py-3">{APP_COPY.admin.pricingRules.operation}</th>
                            <th className="px-6 py-3">{APP_COPY.admin.pricingRules.setupBase}</th>
                            <th className="px-6 py-3">{APP_COPY.admin.pricingRules.variable}</th>
                            <th className="px-6 py-3">{APP_COPY.admin.pricingRules.productionBase}</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {rules.map((rule) => {
                            const isEditing = editingId === rule.id;
                            return (
                                <tr key={rule.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-gray-800">{rule.name || rule.operation_name}</span>
                                            <span className="text-[10px] font-mono text-gray-400">{rule.slug}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                className="w-24 px-2 py-1 border rounded text-sm font-mono"
                                                value={editForm.setup_base_cost ?? ''}
                                                onChange={e => setEditForm({ ...editForm, setup_base_cost: parseFloat(e.target.value) })}
                                            />
                                        ) : (
                                            <span className="text-sm text-gray-600 font-mono">€{rule.setup_base_cost.toFixed(2)}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                className="w-24 px-2 py-1 border rounded text-sm font-mono"
                                                value={editForm.setup_variable_factor ?? ''}
                                                onChange={e => setEditForm({ ...editForm, setup_variable_factor: parseFloat(e.target.value) })}
                                            />
                                        ) : (
                                            <span className="text-sm text-gray-500 font-mono">{rule.setup_variable_factor.toFixed(4)}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                className="w-24 px-2 py-1 border rounded text-sm font-mono"
                                                value={editForm.production_base_cost ?? ''}
                                                onChange={e => setEditForm({ ...editForm, production_base_cost: parseFloat(e.target.value) })}
                                            />
                                        ) : (
                                            <span className="text-sm text-gray-600 font-mono">€{rule.production_base_cost.toFixed(4)}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {isEditing ? (
                                            <div className="flex justify-end gap-3">
                                                <button onClick={() => handleSave(rule.id)} className="text-emerald-600 hover:text-emerald-800 p-1 rounded-full hover:bg-emerald-50 transition-all"><Save size={18} /></button>
                                                <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-50 transition-all"><X size={18} /></button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setEditingId(rule.id); setEditForm(rule); }}
                                                className="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
