'use client';

import { useState, useEffect } from 'react';
import { getPricingRulesAction } from '@/app/actions';
import { updateRecordAction, deleteRecordAction, insertRecordAction } from '@/app/admin-actions';
import { PricingRule } from '@/lib/pricing/types';
import { Plus, Trash2, Save, Edit2, X, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { OPERATION_CATEGORIES, getCategoryLabel } from '@/config/constants';
import { APP_COPY } from '@/locales/en';

export function PricingConfigsManager() {
    const [rules, setRules] = useState<PricingRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<number | string | null>(null);
    const [editForm, setEditForm] = useState<Partial<PricingRule>>({});
    const [isAdding, setIsAdding] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
        new Set() // Start with all categories collapsed
    );

    const loadData = async () => {
        setLoading(true);
        const data = await getPricingRulesAction();
        setRules(data);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    };

    const handleSave = async (id: number | string) => {
        const res = await updateRecordAction('QUOTES', 'pricing_configs', id, 'id', {
            setup_base_cost: Number(editForm.setup_base_cost),
            setup_variable_factor: Number(editForm.setup_variable_factor),
            production_base_cost: Number(editForm.production_base_cost),
            production_variable_factor: Number(editForm.production_variable_factor),
        });

        if (res.success) {
            const rule = rules.find(r => r.id === id);
            if (rule && rule.operation_id) {
                const updates: any = {};
                if (editForm.name && editForm.name !== rule.name) {
                    updates.name = editForm.name;
                }
                if (editForm.category && editForm.category !== rule.category) {
                    updates.category = editForm.category;
                }
                if (editForm.discount_multiplier_setup !== undefined && !isNaN(editForm.discount_multiplier_setup) && editForm.discount_multiplier_setup !== rule.discount_multiplier_setup) {
                    updates.discount_multiplier_setup = Number(editForm.discount_multiplier_setup);
                }
                if (editForm.discount_multiplier_production !== undefined && !isNaN(editForm.discount_multiplier_production) && editForm.discount_multiplier_production !== rule.discount_multiplier_production) {
                    updates.discount_multiplier_production = Number(editForm.discount_multiplier_production);
                }
                if (editForm.surcharge_multiplier_setup !== undefined && !isNaN(editForm.surcharge_multiplier_setup) && editForm.surcharge_multiplier_setup !== rule.surcharge_multiplier_setup) {
                    updates.surcharge_multiplier_setup = Number(editForm.surcharge_multiplier_setup);
                }
                if (editForm.surcharge_multiplier_production !== undefined && !isNaN(editForm.surcharge_multiplier_production) && editForm.surcharge_multiplier_production !== rule.surcharge_multiplier_production) {
                    updates.surcharge_multiplier_production = Number(editForm.surcharge_multiplier_production);
                }
                
                if (Object.keys(updates).length > 0) {
                    await updateRecordAction('QUOTES', 'operations', rule.operation_id, 'id', updates);
                }
            }
            setEditingId(null);
            loadData();
        } else {
            alert('Error updating config: ' + res.error);
        }
    };

    const handleDelete = async (id: number | string) => {
        if (confirm(APP_COPY.admin.pricingRules.deleteConfirm)) {
            const res = await deleteRecordAction('QUOTES', 'pricing_configs', id, 'id');
            if (res.success) loadData();
            else alert('Error deleting: ' + res.error);
        }
    };

    const handleAdd = async () => {
        const operationId = crypto.randomUUID();
        const operationRes = await insertRecordAction('QUOTES', 'operations', {
            id: operationId,
            slug: editForm.slug,
            name: editForm.name || editForm.operation_name,
            description: editForm.description || '',
            category: editForm.category || 'other',
            discount_multiplier_setup: editForm.discount_multiplier_setup ?? 1.0,
            discount_multiplier_production: editForm.discount_multiplier_production ?? 1.0,
            surcharge_multiplier_setup: editForm.surcharge_multiplier_setup ?? 1.0,
            surcharge_multiplier_production: editForm.surcharge_multiplier_production ?? 1.0
        });

        if (!operationRes.success) {
            alert('Error adding operation: ' + operationRes.error);
            return;
        }

        const configRes = await insertRecordAction('QUOTES', 'pricing_configs', {
            operation_id: operationId,
            setup_base_cost: Number(editForm.setup_base_cost || 0),
            setup_variable_factor: Number(editForm.setup_variable_factor || 0),
            production_base_cost: Number(editForm.production_base_cost || 0),
            production_variable_factor: Number(editForm.production_variable_factor || 0),
            active: 1
        });

        if (configRes.success) {
            setIsAdding(false);
            setEditForm({});
            loadData();
        } else {
            alert('Error adding pricing config: ' + configRes.error);
        }
    };

    // Group rules by category
    const rulesByCategory = OPERATION_CATEGORIES.map(cat => ({
        ...cat,
        rules: rules.filter(r => r.category === cat.value)
    })).filter(cat => cat.rules.length > 0);

    if (loading && rules.length === 0) {
        return <div className="p-8 text-center text-gray-500 italic">{APP_COPY.admin.pricingRules.loading}</div>;
    }

    const renderOperationRow = (rule: PricingRule) => {
        const isEditing = editingId === rule.id;
        
        return (
            <tr key={rule.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-6 py-4">
                    {isEditing ? (
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-mono text-gray-400">{rule.slug}</span>
                            <input
                                type="text"
                                className="w-full px-2 py-1 border rounded text-sm"
                                value={editForm.name || editForm.operation_name || ''}
                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                            />
                            <select
                                className="w-full px-2 py-1 border rounded text-sm"
                                value={editForm.category || rule.category}
                                onChange={e => setEditForm({ ...editForm, category: e.target.value as any })}
                            >
                                {OPERATION_CATEGORIES.map(cat => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-800">{rule.name || rule.operation_name}</span>
                            <span className="text-[10px] font-mono text-gray-400">{rule.slug}</span>
                        </div>
                    )}
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
                <td className="px-6 py-4">
                    {isEditing ? (
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            className="w-20 px-2 py-1 border rounded text-sm font-mono"
                            value={editForm.discount_multiplier_setup !== undefined ? editForm.discount_multiplier_setup : ''}
                            onChange={e => {
                                const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                setEditForm({ ...editForm, discount_multiplier_setup: val });
                            }}
                        />
                    ) : (
                        <span className="text-sm text-gray-600 font-mono">{((rule.discount_multiplier_setup ?? 1) * 100).toFixed(0)}%</span>
                    )}
                </td>
                <td className="px-6 py-4">
                    {isEditing ? (
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            className="w-20 px-2 py-1 border rounded text-sm font-mono"
                            value={editForm.discount_multiplier_production !== undefined ? editForm.discount_multiplier_production : ''}
                            onChange={e => {
                                const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                setEditForm({ ...editForm, discount_multiplier_production: val });
                            }}
                        />
                    ) : (
                        <span className="text-sm text-gray-600 font-mono">{((rule.discount_multiplier_production ?? 1) * 100).toFixed(0)}%</span>
                    )}
                </td>
                <td className="px-6 py-4">
                    {isEditing ? (
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            className="w-20 px-2 py-1 border rounded text-sm font-mono"
                            value={editForm.surcharge_multiplier_setup !== undefined ? editForm.surcharge_multiplier_setup : ''}
                            onChange={e => {
                                const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                setEditForm({ ...editForm, surcharge_multiplier_setup: val });
                            }}
                        />
                    ) : (
                        <span className="text-sm text-gray-600 font-mono">{((rule.surcharge_multiplier_setup ?? 1) * 100).toFixed(0)}%</span>
                    )}
                </td>
                <td className="px-6 py-4">
                    {isEditing ? (
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            className="w-20 px-2 py-1 border rounded text-sm font-mono"
                            value={editForm.surcharge_multiplier_production !== undefined ? editForm.surcharge_multiplier_production : ''}
                            onChange={e => {
                                const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                setEditForm({ ...editForm, surcharge_multiplier_production: val });
                            }}
                        />
                    ) : (
                        <span className="text-sm text-gray-600 font-mono">{((rule.surcharge_multiplier_production ?? 1) * 100).toFixed(0)}%</span>
                    )}
                </td>
                <td className="px-6 py-4 text-right">
                    {isEditing ? (
                        <div className="flex justify-end gap-3">
                            <button onClick={() => handleSave(rule.id)} className="text-emerald-600 hover:text-emerald-800 p-1 rounded-full hover:bg-emerald-50 transition-all"><Save size={18} /></button>
                            <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-50 transition-all"><X size={18} /></button>
                        </div>
                    ) : (
                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                                onClick={() => { setEditingId(rule.id); setEditForm(rule); }}
                                className="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50 transition-all"
                            >
                                <Edit2 size={18} />
                            </button>
                            <button 
                                onClick={() => handleDelete(rule.id)} 
                                className="text-red-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-all"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    )}
                </td>
            </tr>
        );
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-gray-200 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                    {rules.length} operation{rules.length !== 1 ? 's' : ''} across {rulesByCategory.length} categor{rulesByCategory.length !== 1 ? 'ies' : 'y'}
                </div>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={() => { 
                        setIsAdding(true); 
                        setEditingId(null); 
                        setEditForm({ 
                            slug: '', 
                            name: '', 
                            description: '', 
                            category: 'other',
                            setup_base_cost: 0, 
                            setup_variable_factor: 0, 
                            production_base_cost: 0,
                            production_variable_factor: 0,
                            discount_multiplier_setup: 1.0,
                            discount_multiplier_production: 1.0,
                            surcharge_multiplier_setup: 1.0,
                            surcharge_multiplier_production: 1.0
                        }); 
                    }}
                    className="flex items-center gap-1.5"
                >
                    <Plus size={14} /> {APP_COPY.admin.pricingRules.addOperation}
                </Button>
            </div>

            {isAdding && (
                <div className="border-b border-gray-200 bg-blue-50/30 p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Add New Operation</h3>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                            <label className="text-xs text-gray-600 block mb-1">Slug (unique identifier)</label>
                            <input
                                type="text"
                                placeholder="e.g. gluing_square_spine"
                                className="w-full px-3 py-2 border rounded text-sm font-mono"
                                value={editForm.slug || ''}
                                onChange={e => setEditForm({ ...editForm, slug: e.target.value })}
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-600 block mb-1">Display Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Gluing Square Spine"
                                className="w-full px-3 py-2 border rounded text-sm"
                                value={editForm.name || ''}
                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-600 block mb-1">Category</label>
                            <select
                                className="w-full px-3 py-2 border rounded text-sm"
                                value={editForm.category || 'other'}
                                onChange={e => setEditForm({ ...editForm, category: e.target.value as any })}
                            >
                                {OPERATION_CATEGORIES.map(cat => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                        <div>
                            <label className="text-xs text-gray-600 block mb-1">Setup Base €</label>
                            <input
                                type="number"
                                step="0.01"
                                className="w-full px-3 py-2 border rounded text-sm font-mono"
                                value={editForm.setup_base_cost ?? ''}
                                onChange={e => setEditForm({ ...editForm, setup_base_cost: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-600 block mb-1">Setup Variable</label>
                            <input
                                type="number"
                                step="0.0001"
                                className="w-full px-3 py-2 border rounded text-sm font-mono"
                                value={editForm.setup_variable_factor ?? ''}
                                onChange={e => setEditForm({ ...editForm, setup_variable_factor: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-600 block mb-1">Production Base €</label>
                            <input
                                type="number"
                                step="0.0001"
                                className="w-full px-3 py-2 border rounded text-sm font-mono"
                                value={editForm.production_base_cost ?? ''}
                                onChange={e => setEditForm({ ...editForm, production_base_cost: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-600 block mb-1">Production Variable</label>
                            <input
                                type="number"
                                step="0.0001"
                                className="w-full px-3 py-2 border rounded text-sm font-mono"
                                value={editForm.production_variable_factor ?? ''}
                                onChange={e => setEditForm({ ...editForm, production_variable_factor: parseFloat(e.target.value) })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setIsAdding(false)}>
                            <X size={14} /> Cancel
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleAdd}>
                            <Save size={14} /> Save Operation
                        </Button>
                    </div>
                </div>
            )}

            <div className="divide-y divide-gray-200">
                {rulesByCategory.map(category => {
                    const isExpanded = expandedCategories.has(category.value);
                    
                    return (
                        <div key={category.value}>
                            <button
                                onClick={() => toggleCategory(category.value)}
                                className="w-full px-6 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                    <span className="font-semibold text-gray-800">{category.label}</span>
                                    <span className="text-xs text-gray-500">({category.rules.length})</span>
                                </div>
                            </button>
                            
                            {isExpanded && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 font-bold border-b">
                                            <tr>
                                                <th className="px-6 py-3">Operation</th>
                                                <th className="px-6 py-3">Setup Base</th>
                                                <th className="px-6 py-3">Variable</th>
                                                <th className="px-6 py-3">Prod Base</th>
                                                <th className="px-6 py-3">Disc S%</th>
                                                <th className="px-6 py-3">Disc P%</th>
                                                <th className="px-6 py-3">Surch S%</th>
                                                <th className="px-6 py-3">Surch P%</th>
                                                <th className="px-6 py-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {category.rules.map(renderOperationRow)}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {rules.length === 0 && !isAdding && (
                <div className="p-12 text-center">
                    <div className="inline-flex items-center justify-center p-3 bg-gray-50 rounded-full mb-3 text-gray-400">
                        <AlertCircle size={24} />
                    </div>
                    <p className="text-gray-500 text-sm">{APP_COPY.admin.pricingRules.noRules}</p>
                </div>
            )}
        </div>
    );
}
