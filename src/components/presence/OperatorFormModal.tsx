'use client';

import { useId, useState } from 'react';
import { Pencil, Trash2, UserPlus } from '@/components/ui/icons';
import { createOperatorAction, deleteOperatorAction, saveOperatorAction, type OperatorRow } from '@/app/presence/operators-actions';
import { useCanUse } from '@/components/auth/AccessProvider';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { PRESENCE_FUNCTIONS } from '@/config/navigation';
import { confirmDelete } from '@/lib/confirm';
import { notify } from '@/lib/notify';
import { EMPLOYEE_CATEGORIES, LEFT_CATEGORY, categoryOf, isLeftCategory, nameForCategory } from '@/lib/presence/categories';
import {
    NewOperatorSchema,
    OPERATOR_COLUMN_SIZES,
    OPERATOR_FREE_FIELDS,
    OperatorFieldsSchema,
    changedOperatorFields,
    operatorInputProblem,
    type NewOperatorInput,
    type OperatorFields,
    type OperatorFreeField,
} from '@/lib/presence/operatorInput';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.analytics.operators.form;
const CATEGORY_OPTIONS = EMPLOYEE_CATEGORIES.map((c) => ({ label: c.label, value: c.key }));
/** Modifica also offers the category of the people who left (OFF HR), which Operatori shows only with its chip */
const EDIT_CATEGORY_OPTIONS = [...CATEGORY_OPTIONS, { label: LEFT_CATEGORY.label, value: LEFT_CATEGORY.reparto }];

interface OperatorFormModalProps {
    /** null = a new operator */
    operator: OperatorRow | null;
    onSaved: () => Promise<void>;
    onClose: () => void;
}

interface Draft {
    code: string;
    name: string;
    badge: string;
    category: string;
    matricola: string;
    free: Record<OperatorFreeField, string>;
}

const draftOf = (operator: OperatorRow | null): Draft => ({
    code: operator?.OPERATORE ?? '',
    name: operator?.NOME ?? '',
    badge: operator?.BADGE ?? '',
    category: operator?.ENTITA?.trim() || CATEGORY_OPTIONS[0].value,
    matricola: operator?.MATRICOLA ?? '',
    free: Object.fromEntries(OPERATOR_FREE_FIELDS.map((field) => [field, operator?.[field] ?? ''])) as Record<OperatorFreeField, string>,
});

/**
 * "Nuovo operatore": code, name, badge, category; the matricola is the code. "Modifica operatore": the same, the
 * matricola free, NetPro's five free fields with a hint of what they usually hold, and Elimina (with the function
 * "Crea ed elimina operatori"; the server deletes only a person without history). The name shows how it will be saved
 * when the category adds or removes its mark (" *lb"). Modifica also offers OFF HR, the category of the people who
 * left: a line says the person leaves the lists and gets stato OFF.
 */
export function OperatorFormModal({ operator, onSaved, onClose }: OperatorFormModalProps) {
    const formId = useId();
    const [draft, setDraft] = useState<Draft>(() => draftOf(operator));
    const [saving, setSaving] = useState(false);
    const canDelete = useCanUse(PRESENCE_FUNCTIONS.manageOperators);
    const set = (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change }));
    const setFree = (field: OperatorFreeField, value: string) => setDraft((current) => ({ ...current, free: { ...current.free, [field]: value } }));

    const code = draft.code.trim();
    const savedName = nameForCategory(draft.name, draft.category);
    const nameChanges = savedName !== draft.name.trim();

    const newInput = (): NewOperatorInput => ({ code, name: draft.name, badge: draft.badge, category: draft.category });
    /** Modifica: only what the window shows differently from the person's row is sent, not every field (see changedOperatorFields) */
    const changedFields = (): OperatorFields =>
        operator ? changedOperatorFields(operator, { NOME: draft.name, BADGE: draft.badge, ENTITA: draft.category, MATRICOLA: draft.matricola, ...draft.free }) : {};

    const save = async () => {
        const problem = operator ? operatorInputProblem(OperatorFieldsSchema, changedFields()) : operatorInputProblem(NewOperatorSchema, newInput());
        if (problem) {
            notify.error(problem);
            return;
        }
        setSaving(true);
        try {
            const result = operator ? await saveOperatorAction(operator.OPERATORE, changedFields()) : await createOperatorAction(newInput());
            if (!result.success) {
                notify.error(result.error);
                return;
            }
            notify.success(operator ? copy.saved : fmt(copy.created, { code }));
            // Who is moved out while inside (to OFF HR) also gets the exit: the message says so
            if ('message' in result && result.message) notify.success(result.message);
            await onSaved();
            onClose();
        } catch (err) {
            notify.failure(err);
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!operator) return;
        if (!(await confirmDelete(fmt(copy.deleteConfirm, { code: operator.OPERATORE, name: operator.NOME ?? '' })))) return;
        setSaving(true);
        try {
            const result = await deleteOperatorAction(operator.OPERATORE);
            if (!result.success) {
                notify.error(result.error);
                return;
            }
            notify.success(fmt(copy.deleted, { code: operator.OPERATORE }));
            await onSaved();
            onClose();
        } catch (err) {
            notify.failure(err);
        } finally {
            setSaving(false);
        }
    };

    const id = (name: string) => `${formId}-${name}`;

    return (
        <Modal
            title={operator ? copy.editTitle : copy.newTitle}
            subtitle={operator ? operator.OPERATORE : fmt(copy.newSubtitle, { stato: categoryOf(draft.category).newStato })}
            icon={operator ? Pencil : UserPlus}
            size="lg"
            onClose={onClose}
            busy={saving}
            footer={
                <>
                    {operator && canDelete && (
                        <Button variant="danger" onClick={remove} disabled={saving} className="mr-auto">
                            <Trash2 size={16} />
                            {copy.delete}
                        </Button>
                    )}
                    <Button variant="secondary" onClick={onClose} disabled={saving}>
                        {APP_COPY.common.cancel}
                    </Button>
                    <Button type="submit" form={formId} disabled={saving}>
                        {APP_COPY.common.save}
                    </Button>
                </>
            }
        >
            <form
                id={formId}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    save();
                }}
            >
                <Field label={copy.code} htmlFor={id('code')}>
                    <Input
                        id={id('code')}
                        value={draft.code}
                        onChange={(e) => set({ code: e.target.value })}
                        placeholder={copy.codePlaceholder}
                        maxLength={OPERATOR_COLUMN_SIZES.OPERATORE}
                        disabled={!!operator}
                        autoFocus={!operator}
                        className="font-mono"
                    />
                </Field>
                <div>
                    <Field label={copy.category} htmlFor={id('category')}>
                        <Select
                            id={id('category')}
                            value={draft.category}
                            onChange={(e) => set({ category: e.target.value })}
                            options={operator ? EDIT_CATEGORY_OPTIONS : CATEGORY_OPTIONS}
                        />
                    </Field>
                    {isLeftCategory(draft.category) && (
                        <p className="text-xs text-fg-muted mt-1">{fmt(copy.leaving, { category: LEFT_CATEGORY.label, stato: LEFT_CATEGORY.stato })}</p>
                    )}
                </div>
                <div className="sm:col-span-2">
                    <Field label={copy.name} htmlFor={id('name')}>
                        <Input
                            id={id('name')}
                            value={draft.name}
                            onChange={(e) => set({ name: e.target.value })}
                            placeholder={copy.namePlaceholder}
                            maxLength={OPERATOR_COLUMN_SIZES.NOME}
                            autoFocus={!!operator}
                        />
                    </Field>
                    {nameChanges && savedName && <p className="text-xs text-fg-muted mt-1">{fmt(copy.nameSaved, { name: savedName })}</p>}
                </div>
                <Field label={copy.badge} htmlFor={id('badge')}>
                    <Input
                        id={id('badge')}
                        value={draft.badge}
                        onChange={(e) => set({ badge: e.target.value })}
                        placeholder={copy.badgePlaceholder}
                        maxLength={OPERATOR_COLUMN_SIZES.BADGE}
                        className="font-mono"
                    />
                </Field>
                <div>
                    <Field label={copy.matricola} htmlFor={id('matricola')}>
                        <Input
                            id={id('matricola')}
                            value={operator ? draft.matricola : code}
                            onChange={(e) => set({ matricola: e.target.value })}
                            maxLength={OPERATOR_COLUMN_SIZES.MATRICOLA}
                            disabled={!operator}
                            className="font-mono"
                        />
                    </Field>
                </div>
                {operator && (
                    <fieldset className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border pt-3">
                        <legend className="text-xs font-medium text-fg-muted pr-2">{copy.freeFields}</legend>
                        {OPERATOR_FREE_FIELDS.map((field) => (
                            <Field key={field} label={field} htmlFor={id(field)}>
                                <Input
                                    id={id(field)}
                                    value={draft.free[field]}
                                    onChange={(e) => setFree(field, e.target.value)}
                                    placeholder={copy.freeFieldHints[field]}
                                    maxLength={OPERATOR_COLUMN_SIZES.FCODE}
                                />
                            </Field>
                        ))}
                    </fieldset>
                )}
            </form>
        </Modal>
    );
}
