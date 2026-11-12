/**
 * What the Operatori window sends (a new operator, or the fields of one to change), checked the same way in the
 * browser (to show the message) and on the server (the real check). The sizes are those of the OPERATORI columns
 * in NetPro. Texts in it.ts → analytics.operators.form.
 */
import { z } from 'zod';
import { firstInputProblem } from '@/lib/inputProblem';
import { APP_COPY, fmt } from '@/locales';
import { TRACKED_REPARTI, isLeftCategory, nameForCategory } from './categories';

/** varchar lengths of the OPERATORI columns the app writes */
export const OPERATOR_COLUMN_SIZES = { OPERATORE: 20, NOME: 30, BADGE: 20, MATRICOLA: 20, FCODE: 20, STATO_FISICO: 4 } as const;

/** NetPro's free fields of an operator, in order: agency, then whatever was typed (dates, tax codes, addresses) */
export const OPERATOR_FREE_FIELDS = ['FCODE01', 'FCODE02', 'FCODE03', 'FCODE04', 'FCODE05'] as const;
export type OperatorFreeField = (typeof OPERATOR_FREE_FIELDS)[number];

const copy = APP_COPY.analytics.operators.form;
const text = (max: number) => z.string().trim().max(max);
/** Empty → null, the way NetPro leaves a field nobody filled */
const optional = (max: number) => text(max).transform((value) => value || null);
const CategorySchema = z.string().refine((value) => TRACKED_REPARTI.includes(value), { message: copy.categoryRequired });
/** A changed category may also be the one of the people who left (OFF HR); a new operator's never is */
const ChangedCategorySchema = z.string().refine((value) => TRACKED_REPARTI.includes(value) || isLeftCategory(value), { message: copy.categoryRequired });

/** A new operator: code, name, badge and category; the matricola is the code */
export const NewOperatorSchema = z.object({
    code: text(OPERATOR_COLUMN_SIZES.OPERATORE).min(1, copy.codeRequired).regex(/^\S+$/, copy.codeNoSpaces),
    name: text(OPERATOR_COLUMN_SIZES.NOME).min(1, copy.nameRequired),
    badge: optional(OPERATOR_COLUMN_SIZES.BADGE),
    category: CategorySchema,
});
export type NewOperatorInput = z.input<typeof NewOperatorSchema>;

/** The columns of an operator the app may change (the server refuses any other), each with its check */
export const OperatorFieldsSchema = z
    .object({
        NOME: text(OPERATOR_COLUMN_SIZES.NOME).min(1, copy.nameRequired),
        BADGE: optional(OPERATOR_COLUMN_SIZES.BADGE),
        STATO_FISICO: optional(OPERATOR_COLUMN_SIZES.STATO_FISICO),
        ENTITA: ChangedCategorySchema,
        MATRICOLA: optional(OPERATOR_COLUMN_SIZES.MATRICOLA),
        FCODE01: optional(OPERATOR_COLUMN_SIZES.FCODE),
        FCODE02: optional(OPERATOR_COLUMN_SIZES.FCODE),
        FCODE03: optional(OPERATOR_COLUMN_SIZES.FCODE),
        FCODE04: optional(OPERATOR_COLUMN_SIZES.FCODE),
        FCODE05: optional(OPERATOR_COLUMN_SIZES.FCODE),
    })
    .partial();
export type OperatorFields = z.input<typeof OperatorFieldsSchema>;
export type OperatorField = keyof OperatorFields;
export const OPERATOR_FIELDS = Object.keys(OperatorFieldsSchema.shape) as OperatorField[];

/** A value of the window and one of the row are the same when their text is: spaces around and "nothing" do not count */
const sameText = (a: string | null | undefined, b: string | null | undefined) => (a ?? '').trim() === (b ?? '').trim();

/**
 * The fields the "Modifica operatore" window sends: only those where what the window shows differs from the person's
 * row as the list read it (`stored`). Sending every field at each Salva would overwrite a value changed in NetPro
 * while the window was open with the old one, and the Registro would list every field as changed.
 * Name and category go together, since the name carries the category's mark (" *lb"): both are sent when the
 * category differs, or when the name as it will be saved (nameForCategory, what the window announces) differs.
 */
export function changedOperatorFields(stored: Partial<Record<OperatorField, string | null>>, shown: OperatorFields): OperatorFields {
    const changed: OperatorFields = {};
    for (const field of OPERATOR_FIELDS) {
        if (field === 'NOME' || field === 'ENTITA' || shown[field] === undefined) continue;
        if (!sameText(stored[field], shown[field])) changed[field] = shown[field];
    }
    if (shown.NOME !== undefined && shown.ENTITA !== undefined) {
        const nameAsSaved = nameForCategory(shown.NOME, shown.ENTITA);
        if (!sameText(stored.NOME, nameAsSaved) || !sameText(stored.ENTITA, shown.ENTITA)) {
            changed.NOME = shown.NOME;
            changed.ENTITA = shown.ENTITA;
        }
    }
    return changed;
}

const OWN_MESSAGES = new Set<string>([copy.codeRequired, copy.codeNoSpaces, copy.nameRequired, copy.categoryRequired]);
const FIELD_LABELS: readonly (readonly [string, string])[] = [
    ['code', copy.code],
    ['name', copy.name],
    ['badge', copy.badge],
    ['category', copy.category],
    ['NOME', copy.name],
    ['BADGE', copy.badge],
    ['ENTITA', copy.category],
    ['MATRICOLA', copy.matricola],
    ...OPERATOR_FREE_FIELDS.map((field) => [field, field] as const),
];

/** The first problem of the window's data as a text for the user, or null when all is fine */
export const operatorInputProblem = (schema: z.ZodTypeAny, input: unknown): string | null =>
    firstInputProblem(schema, input, { ownMessages: OWN_MESSAGES, labels: FIELD_LABELS, invalid: (label) => fmt(copy.invalid, { field: label }) });
