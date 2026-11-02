'use server'

/** Operators (OPERATORI): list, new operator, edit its fields, printable checklist, TURNO2 group. */

import { errorMessage } from '@/lib/utils';
import { queryMSSQL, withTransactions, type SqlParams, type SqlRunner } from '@/lib/mssql';
import { APP_COPY, fmt } from '@/locales';
import { APP_CONFIG } from '@/config/constants';
import { authorize } from '@/lib/auth/access';
import { buildOperatorSearch } from './presence-db';
import { EMPLOYEE_CATEGORIES, categoryOf, nameForCategory } from '@/lib/presence/categories';
import {
    NewOperatorSchema,
    OPERATOR_COLUMN_SIZES,
    OPERATOR_FIELDS,
    OperatorFieldsSchema,
    operatorInputProblem,
    type NewOperatorInput,
    type OperatorField,
    type OperatorFields,
    type OperatorFreeField,
} from '@/lib/presence/operatorInput';
import { reportFileName } from '@/lib/download';
import { getTodayDate, toLocalDateTime } from '@/lib/dateUtils';
import { operatorChecklistHtml } from '@/lib/pdf/operatorChecklistHtml';
import { renderPdfBase64 } from '@/lib/pdf/renderPdf';
import { LINKS, PRESENCE_FUNCTIONS } from '@/config/navigation';

export interface OperatorRow extends Record<OperatorFreeField, string | null> {
    OPERATORE: string;
    NOME: string | null;
    BADGE: string | null;
    STATO_FISICO: string | null;
    /** Category code (PRESENCE_RULES.CATEGORIES → reparto) */
    ENTITA: string | null;
    MATRICOLA: string | null;
}

/** An operator with its group (TURNO2 or none) */
export interface OperatorGroupRow {
    OPERATORE: string;
    NOME: string | null;
    GRUPPO: string | null;
}

export async function getOperatorsAction(search?: string) {
    await authorize('view', LINKS.presence.operators);
    try {
        const params: SqlParams = {};
        const operatorSearch = buildOperatorSearch(search, ['OPERATORE', 'NOME', 'BADGE'], 'term', params);
        const whereClause = operatorSearch ? `WHERE ${operatorSearch}` : '';

        const query = `
            SELECT
                OPERATORE,
                NOME,
                BADGE,
                STATO_FISICO,
                ENTITA,
                MATRICOLA,
                FCODE01, FCODE02, FCODE03, FCODE04, FCODE05
            FROM OPERATORI WITH (NOLOCK)
            ${whereClause}
            ORDER BY OPERATORE ASC
        `;

        const result = await queryMSSQL<OperatorRow>(query, params, 'NETPRO');

        return {
            success: true,
            data: result.recordset,
            allStati: await readStati()
        };
    } catch (err) {
        return {
            success: false,
            error: errorMessage(err),
            data: [] as OperatorRow[],
            allStati: [] as string[]
        };
    }
}

/** Every stato fisico in use, A → Z */
async function readStati(): Promise<string[]> {
    const result = await queryMSSQL<{ STATO_FISICO: string }>(
        `SELECT DISTINCT STATO_FISICO FROM OPERATORI WITH (NOLOCK) WHERE STATO_FISICO IS NOT NULL AND STATO_FISICO <> '' ORDER BY STATO_FISICO ASC`,
        {},
        'NETPRO'
    );
    return result.recordset.map((r) => r.STATO_FISICO);
}

/** Stati fisici for the checklist window (it opens before the list is loaded) */
export async function getOperatorStatiAction() {
    await authorize('view', LINKS.presence.operators);
    try {
        return { success: true, data: await readStati() };
    } catch (err) {
        return { success: false, error: errorMessage(err), data: [] as string[] };
    }
}

const checklistCopy = APP_COPY.analytics.operators.checklist;

/**
 * Printable checklist: the names of the operators in the chosen categories (OPERATORI.ENTITA) and stati fisici,
 * each with four empty boxes (Entrata, Uscita, Entrata, Uscita) or none; under the title today's date, or a blank line
 * to write it by hand. Returns { success, pdf (base64), filename }.
 */
export async function generateOperatorChecklistPDFAction(categoryKeys: string[], stati: string[], showDate: boolean, showChecks: boolean) {
    await authorize('view', LINKS.presence.operators);
    try {
        const categories = EMPLOYEE_CATEGORIES.filter((c) => categoryKeys.includes(c.key));
        if (categories.length === 0 || stati.length === 0) return { success: false as const, error: checklistCopy.empty };

        const params: Record<string, string> = {};
        categories.forEach((c, i) => (params[`cat${i}`] = c.key));
        stati.forEach((stato, i) => (params[`stato${i}`] = stato));
        const result = await queryMSSQL<{ NAME: string }>(
            `SELECT ISNULL(NULLIF(LTRIM(RTRIM(NOME)), ''), OPERATORE) AS NAME
             FROM OPERATORI WITH (NOLOCK)
             WHERE LTRIM(RTRIM(ENTITA)) IN (${categories.map((_, i) => `@cat${i}`).join(', ')})
               AND STATO_FISICO IN (${stati.map((_, i) => `@stato${i}`).join(', ')})
             ORDER BY NAME ASC`,
            params,
            'NETPRO'
        );
        const names = result.recordset.map((r) => r.NAME);
        if (names.length === 0) return { success: false as const, error: checklistCopy.empty };

        // Every category chosen → just "Lista operatori"
        const title = categories.length === EMPLOYEE_CATEGORIES.length
            ? checklistCopy.title
            : `${checklistCopy.title} ${categories.map((c) => c.label).join(', ')}`;
        const pdf = await renderPdfBase64(operatorChecklistHtml(title, names, showDate, showChecks), {
            format: 'A4',
            footerTitle: title,
            margin: { top: '15mm', right: '15mm', bottom: '20mm', left: '15mm' },
        });
        return { success: true as const, pdf, filename: reportFileName(title, [getTodayDate()], 'pdf') };
    } catch (err) {
        return { success: false as const, error: errorMessage(err) };
    }
}

const formCopy = APP_COPY.analytics.operators.form;
const NEW_VALUES = APP_CONFIG.PRESENCE.NEW_OPERATOR_VALUES;

/** The message when another operator has this badge, null when it is free (NetPro does not keep badges unique: the app does) */
async function badgeProblem(run: SqlRunner, badge: string, exceptOperator?: string): Promise<string | null> {
    const params: SqlParams = { badge };
    if (exceptOperator) params.exceptOperator = exceptOperator;
    const result = await run<{ OPERATORE: string; NOME: string | null }>(
        `SELECT TOP 1 OPERATORE, NOME FROM OPERATORI WITH (NOLOCK)
         WHERE BADGE = @badge${exceptOperator ? ' AND OPERATORE <> @exceptOperator' : ''}`,
        params,
        'NETPRO'
    );
    const owner = result.recordset[0];
    return owner ? fmt(formCopy.badgeTaken, { badge, name: owner.NOME ?? '', code: owner.OPERATORE }) : null;
}

/**
 * Creates an operator in NetPro the way its own screen does: one row of OPERATORI with the typed code, the name with
 * the category's mark (" *lb" for the interinali), badge and category, the matricola equal to the code, the stato
 * fisico of the category (OUT, OFF for the office) and IDLE as of now, and the fixed values NetPro writes (NEW_OPERATOR_VALUES). The code must be free, and so must the
 * badge; the checks and the insert are one transaction. Needs modifica on Operatori and the function "Nuovo operatore".
 */
export async function createOperatorAction(input: NewOperatorInput) {
    await authorize('edit', LINKS.presence.operators);
    await authorize('edit', PRESENCE_FUNCTIONS.newOperator);
    const parsed = NewOperatorSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, error: operatorInputProblem(NewOperatorSchema, input) ?? APP_COPY.common.invalidData };
    const { code, badge, category } = parsed.data;
    const name = nameForCategory(parsed.data.name, category);
    if (name.length > OPERATOR_COLUMN_SIZES.NOME) return { success: false as const, error: fmt(formCopy.invalid, { field: formCopy.name }) };
    try {
        const problem = await withTransactions(['NETPRO'], async (run) => {
            const existing = await run<{ NOME: string | null }>(`SELECT NOME FROM OPERATORI WITH (NOLOCK) WHERE OPERATORE = @code`, { code }, 'NETPRO');
            if (existing.recordset[0]) return fmt(formCopy.codeTaken, { code, name: existing.recordset[0].NOME ?? '' });
            const taken = badge ? await badgeProblem(run, badge) : null;
            if (taken) return taken;

            const now = toLocalDateTime(new Date());
            await run(
                `INSERT INTO OPERATORI (OPERATORE, NOME, BADGE, ENTITA, MATRICOLA, CENTRO_COSTO, LIVELLO, STATO_FISICO, STATO_LOGICO, ORA_ST_FISICO, ORA_ST_LOGICO,
                                        COSTO, FVALUE01, FVALUE02, FVALUE03, FVALUE04, FVALUE05, FMULTIASSMAC, FNDESCS, FPLANNING)
                 VALUES (@code, @name, @badge, @category, @code, @centroCosto, @livello, @statoFisico, @statoLogico, @now, @now,
                         @costo, @fvalue, @fvalue, @fvalue, @fvalue, @fvalue, @multiAssMac, @nDescs, @planning)`,
                {
                    code, name, badge, category, now,
                    centroCosto: NEW_VALUES.CENTRO_COSTO, livello: NEW_VALUES.LIVELLO,
                    statoFisico: categoryOf(category).newStato, statoLogico: NEW_VALUES.STATO_LOGICO,
                    costo: NEW_VALUES.COSTO, fvalue: NEW_VALUES.FVALUE,
                    multiAssMac: NEW_VALUES.FMULTIASSMAC, nDescs: NEW_VALUES.FNDESCS, planning: NEW_VALUES.FPLANNING,
                },
                'NETPRO'
            );
            return null;
        });
        return problem ? { success: false as const, error: problem } : { success: true as const, name };
    } catch (err) {
        return { success: false as const, error: errorMessage(err) };
    }
}

/**
 * Changes the given fields of an operator (one cell of the list, or the whole window): only the columns of
 * OperatorFieldsSchema, trimmed, empty → NULL. When the name and the category come together the name takes the
 * category's mark. A badge must not be another operator's; the check and the update are one transaction.
 */
export async function saveOperatorAction(operatore: string, fields: OperatorFields) {
    await authorize('edit', LINKS.presence.operators);
    const parsed = OperatorFieldsSchema.safeParse(fields);
    if (!parsed.success) return { success: false as const, error: operatorInputProblem(OperatorFieldsSchema, fields) ?? APP_COPY.common.invalidData };
    const changes: Partial<Record<OperatorField, string | null>> = { ...parsed.data };
    if (changes.NOME !== undefined && changes.ENTITA !== undefined) changes.NOME = nameForCategory(changes.NOME ?? '', changes.ENTITA);
    if ((changes.NOME?.length ?? 0) > OPERATOR_COLUMN_SIZES.NOME) return { success: false as const, error: fmt(formCopy.invalid, { field: formCopy.name }) };
    const columns = OPERATOR_FIELDS.filter((column) => changes[column] !== undefined);
    if (columns.length === 0) return { success: true as const };
    try {
        const problem = await withTransactions(['NETPRO'], async (run) => {
            const taken = changes.BADGE ? await badgeProblem(run, changes.BADGE, operatore) : null;
            if (taken) return taken;
            const params: SqlParams = { operatore };
            for (const column of columns) params[column] = changes[column] ?? null;
            await run(`UPDATE OPERATORI SET ${columns.map((column) => `${column} = @${column}`).join(', ')} WHERE OPERATORE = @operatore`, params, 'NETPRO');
            return null;
        });
        return problem ? { success: false as const, error: problem } : { success: true as const };
    } catch (err) {
        return { success: false as const, error: errorMessage(err) };
    }
}

/**
 * Get all operators currently assigned to TURNO2 (GRUPPO = 'TURNO2')
 */
export async function getTurno2OperatorsAction() {
    await authorize('view', LINKS.settings['presence']);
    try {
        const result = await queryMSSQL<OperatorGroupRow>(
            `SELECT OPERATORE, NOME, GRUPPO
             FROM OPERATORI WITH (NOLOCK)
             WHERE UPPER(LTRIM(RTRIM(GRUPPO))) = 'TURNO2'
             ORDER BY NOME ASC`,
            {},
            'NETPRO'
        );
        return {
            success: true,
            data: result.recordset,
        };
    } catch (err) {
        return { success: false, error: errorMessage(err), data: [] as OperatorGroupRow[] };
    }
}

/**
 * Search operators by name or code (for the add-to-TURNO2 picker)
 */
export async function searchOperatorsAction(term: string) {
    await authorize('view', LINKS.settings['presence']);
    try {
        const result = await queryMSSQL<OperatorGroupRow>(
            `SELECT TOP 20 OPERATORE, NOME, ISNULL(NULLIF(LTRIM(RTRIM(GRUPPO)), ''), NULL) AS GRUPPO
             FROM OPERATORI WITH (NOLOCK)
             WHERE (OPERATORE LIKE @term OR NOME LIKE @term)
             ORDER BY NOME ASC`,
            { term: `%${term}%` },
            'NETPRO'
        );
        return {
            success: true,
            data: result.recordset,
        };
    } catch (err) {
        return { success: false, error: errorMessage(err), data: [] as OperatorGroupRow[] };
    }
}

/**
 * Set or clear the GRUPPO field on an operator (live production — parameterized only)
 * Pass gruppo = 'TURNO2' to assign, or gruppo = '' to reset to standard
 */
export async function setOperatorGruppoAction(operatore: string, gruppo: string) {
    await authorize('edit', LINKS.settings['presence']);
    try {
        await queryMSSQL(
            `UPDATE OPERATORI SET GRUPPO = @gruppo WHERE OPERATORE = @operatore`,
            { operatore, gruppo: gruppo || '' },
            'NETPRO'
        );
        return { success: true };
    } catch (err) {
        return { success: false, error: errorMessage(err) };
    }
}
