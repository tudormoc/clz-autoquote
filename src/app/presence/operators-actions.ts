'use server'

/** Operators (OPERATORI): list, edit badge / name / stato, TURNO2 group. */

import { errorMessage } from '@/lib/utils';
import { queryMSSQL, type SqlParams } from '@/lib/mssql';
import { APP_COPY } from '@/locales';
import { authorize } from '@/lib/auth/access';
import { buildOperatorSearch } from './presence-db';
import { EMPLOYEE_CATEGORIES } from '@/lib/presence/categories';
import { reportFileName } from '@/lib/download';
import { getTodayDate } from '@/lib/dateUtils';
import { operatorChecklistHtml } from '@/lib/pdf/operatorChecklistHtml';
import { renderPdfBase64 } from '@/lib/pdf/renderPdf';
import { LINKS } from '@/config/navigation';

export interface OperatorRow {
    OPERATORE: string;
    NOME: string | null;
    BADGE: string | null;
    STATO_FISICO: string | null;
    /** Category code (PRESENCE_RULES.CATEGORIES → reparto) */
    ENTITA: string | null;
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
                ENTITA
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

/** Columns of an operator the list may change (the server refuses any other) */
const OPERATOR_COLUMNS = ['BADGE', 'NOME', 'STATO_FISICO'] as const;

export async function updateOperatorAction(
    operatore: string,
    columnName: (typeof OPERATOR_COLUMNS)[number],
    newValue: string | null
) {
    await authorize('edit', LINKS.presence.operators);
    if (!OPERATOR_COLUMNS.includes(columnName)) return { success: false, error: APP_COPY.common.notAllowed };
    try {
        const query = `
            UPDATE OPERATORI
            SET ${columnName} = @newValue
            WHERE OPERATORE = @operatore
        `;

        await queryMSSQL(query, {
            newValue: newValue ?? null,
            operatore
        }, 'NETPRO');

        return { success: true };
    } catch (err) {
        return {
            success: false,
            error: errorMessage(err)
        };
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
