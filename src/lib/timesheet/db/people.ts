/**
 * Who enters their hours here: the NetPro operators of the categories marked `timesheet` (PRESENCE_RULES.CATEGORIES),
 * read from NETPRO.OPERATORI; their workday from the presence rules. Server only; NetPro is only read.
 */

import { queryMSSQL } from '@/lib/mssql';
import { rulesForOperator, timesheetRepartiSql, type PresenceRulesConfig } from '@/lib/presence';
import type { TimesheetPerson } from '@/lib/timesheet/types';

interface OperatorRow {
    code: string;
    name: string;
    matricola: string | null;
}

const OPERATOR_SELECT = `SELECT OPE.OPERATORE AS code, ISNULL(OPE.NOME, OPE.OPERATORE) AS name, NULLIF(LTRIM(RTRIM(OPE.MATRICOLA)), '') AS matricola
    FROM OPERATORI OPE WITH (NOLOCK)`;

const toPerson = (row: OperatorRow, rules: PresenceRulesConfig): TimesheetPerson => ({
    operatorCode: row.code.trim(),
    name: row.name.trim(),
    matricola: row.matricola,
    workdayHours: rulesForOperator(row.code, rules).workdayHours,
});

/** Everyone of the timesheet categories, A–Z */
export async function listTimesheetPeople(rules: PresenceRulesConfig): Promise<TimesheetPerson[]> {
    const result = await queryMSSQL<OperatorRow>(`${OPERATOR_SELECT} WHERE ${timesheetRepartiSql('OPE.ENTITA')} ORDER BY OPE.NOME`, {}, 'NETPRO');
    return result.recordset.map((row) => toPerson(row, rules));
}

/** The person with this NetPro code, or null when there is none or they are not of a timesheet category */
export async function findTimesheetPerson(operatorCode: string, rules: PresenceRulesConfig): Promise<TimesheetPerson | null> {
    const result = await queryMSSQL<OperatorRow>(
        `${OPERATOR_SELECT} WHERE OPE.OPERATORE = @code AND ${timesheetRepartiSql('OPE.ENTITA')}`,
        { code: operatorCode },
        'NETPRO'
    );
    const row = result.recordset[0];
    return row ? toPerson(row, rules) : null;
}
