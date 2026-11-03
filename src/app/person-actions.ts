'use server'

/**
 * The person behind a login (Impostazioni → Utenti → Scheda persona), superadmin only: the lists to link a login to
 * its records in NetPro, Business and ARCPROC, the card with every record and fact side by side (src/lib/persons),
 * how many facts differ per user (the "≠" in Utenti), and Allinea, which writes one e-mail into the three places
 * that may be written (NetPro login, Business login, org chart), in one transaction across NetPro and Business.
 * Nothing else is ever written by this file; the e-mail signatures (emailfirme) are not read either.
 */

import { z } from 'zod';
import { requireSuperadmin } from '@/lib/auth/access';
import { findAccountById, listAccounts, updateAccountLinks, type Account } from '@/lib/auth/accounts';
import { queryMSSQL, withTransactions, type SqlParams } from '@/lib/mssql';
import { EMAIL_MAX_LENGTH, buildFacts, driftCount, hasLinks, type Fact, type PersonLinks, type PersonRecords } from '@/lib/persons/places';
import { errorMessage } from '@/lib/utils';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.admin.person;

type Result<T extends object> = ({ success: true } & T) | { success: false; error: string };

export interface PersonChoices {
    operators: { code: string; name: string }[];
    netproUsers: { user: string; name: string }[];
    erpUsers: { user: string; name: string }[];
}

export interface PersonCard {
    links: PersonLinks;
    records: PersonRecords;
    facts: Fact[];
}

const LinkSchema = z
    .string()
    .trim()
    .max(20)
    .nullable()
    .transform((value) => value || null);
const LinksSchema = z.object({ operatorCode: LinkSchema, netproUser: LinkSchema, erpUser: LinkSchema });
const IdSchema = z.number().int().positive();
const EmailSchema = z.string().trim().email().max(EMAIL_MAX_LENGTH);

/** Runs the work after the superadmin check, turning failures into an error text */
async function guarded<T extends object>(work: () => Promise<T>): Promise<Result<T>> {
    try {
        await requireSuperadmin();
        return { success: true, ...(await work()) };
    } catch (error) {
        console.error('Person action failed:', error);
        return { success: false, error: errorMessage(error) };
    }
}

const linksOf = (account: Account): PersonLinks => ({ operatorCode: account.operatorCode, netproUser: account.netproUser, erpUser: account.erpUser });
const named = <T extends { name: string | null }>(rows: T[]) => rows.map((row) => ({ ...row, name: row.name?.trim() || '' }));

/** The records a login can be linked to, for the three selects of the card */
export async function getPersonChoicesAction(): Promise<Result<{ choices: PersonChoices }>> {
    return guarded(async () => {
        const [operators, netproUsers, erpUsers] = await Promise.all([
            queryMSSQL<{ code: string; name: string | null }>(`SELECT OPERATORE AS code, NOME AS name FROM OPERATORI WITH (NOLOCK) ORDER BY NOME`, {}, 'NETPRO'),
            queryMSSQL<{ user: string; name: string | null }>(`SELECT UTENTE AS [user], DESCRIZIONE AS name FROM UTENTI WITH (NOLOCK) ORDER BY UTENTE`, {}, 'NETPRO'),
            queryMSSQL<{ user: string; name: string | null }>(
                `SELECT OpNome AS [user], LTRIM(RTRIM(ISNULL(OpDescont, '') + ' ' + ISNULL(OpDescont2, ''))) AS name FROM ARCPROC.dbo.OPERAT WITH (NOLOCK) ORDER BY OpNome`,
                {},
                'BUSINESS'
            ),
        ]);
        return { choices: { operators: named(operators.recordset), netproUsers: named(netproUsers.recordset), erpUsers: named(erpUsers.recordset) } };
    });
}

const unique = (values: (string | null)[]) => [...new Set(values.filter((value): value is string => Boolean(value)))];

/** `column IN (@p0, @p1 …)` for the values, adding them to params; "1 = 0" when there are none */
function inList(column: string, values: string[], prefix: string, params: SqlParams): string {
    if (values.length === 0) return '1 = 0';
    values.forEach((value, i) => (params[`${prefix}${i}`] = value));
    return `${column} IN (${values.map((_, i) => `@${prefix}${i}`).join(', ')})`;
}

const sameKey = (value: string) => value.trim().toLowerCase();

/**
 * Every record of the people with these links, read once for all of them (six queries), given back as a lookup
 * by links. Keys compare without case and spaces, like the databases do.
 */
async function readRecords(all: PersonLinks[]): Promise<(links: PersonLinks) => PersonRecords> {
    const codes = unique(all.map((links) => links.operatorCode));
    const netpro = unique(all.map((links) => links.netproUser));
    const erp = unique(all.map((links) => links.erpUser));
    const params = () => ({}) as SqlParams;
    const [pOperators, pErpOperators, pNetproUsers, pErpUsers, pOrgChart, pMailboxes] = [params(), params(), params(), params(), params(), params()];

    const [operators, erpOperators, netproUsers, erpUsers, orgChart, mailboxes] = await Promise.all([
        queryMSSQL<NonNullable<PersonRecords['operator']>>(
            `SELECT OPERATORE AS code, NOME AS name, BADGE AS badge, ENTITA AS category FROM OPERATORI WITH (NOLOCK) WHERE ${inList('OPERATORE', codes, 'c', pOperators)}`,
            pOperators,
            'NETPRO'
        ),
        queryMSSQL<NonNullable<PersonRecords['erpOperator']>>(
            `SELECT CAST(tb_codcope AS VARCHAR(20)) AS code, tb_descope AS name FROM tabcope WITH (NOLOCK) WHERE ${inList('CAST(tb_codcope AS VARCHAR(20))', codes, 'c', pErpOperators)}`,
            pErpOperators,
            'BUSINESS'
        ),
        queryMSSQL<NonNullable<PersonRecords['netproUser']>>(
            `SELECT UTENTE AS [user], DESCRIZIONE AS description, FEMAIL AS email, RUOLO AS role FROM UTENTI WITH (NOLOCK) WHERE ${inList('UTENTE', netpro, 'u', pNetproUsers)}`,
            pNetproUsers,
            'NETPRO'
        ),
        queryMSSQL<NonNullable<PersonRecords['erpUser']>>(
            `SELECT OpNome AS [user], OpDescont AS surname, OpDescont2 AS name, OpSumail AS email, OpRuolo AS role FROM ARCPROC.dbo.OPERAT WITH (NOLOCK) WHERE ${inList('OpNome', erp, 'e', pErpUsers)}`,
            pErpUsers,
            'BUSINESS'
        ),
        queryMSSQL<NonNullable<PersonRecords['orgChart']> & { user: string }>(
            `SELECT og_coperat AS [user], og_descont AS surname, og_descont2 AS name, og_email AS email, og_telef AS phone, og_codcope AS operatorCode FROM organig WITH (NOLOCK) WHERE ${inList('og_coperat', erp, 'e', pOrgChart)}`,
            pOrgChart,
            'BUSINESS'
        ),
        queryMSSQL<NonNullable<PersonRecords['mailbox']> & { user: string }>(
            `SELECT em_user AS [user], em_email AS email FROM emailconf WITH (NOLOCK) WHERE ${inList('em_user', erp, 'e', pMailboxes)}`,
            pMailboxes,
            'BUSINESS'
        ),
    ]);

    const byKey = <T>(rows: T[], key: (row: T) => string) => new Map(rows.map((row) => [sameKey(key(row)), row]));
    const operatorByCode = byKey(operators.recordset, (row) => row.code);
    const erpOperatorByCode = byKey(erpOperators.recordset, (row) => row.code);
    const netproUserByUser = byKey(netproUsers.recordset, (row) => row.user);
    const erpUserByUser = byKey(erpUsers.recordset, (row) => row.user);
    const orgChartByUser = byKey(orgChart.recordset, (row) => row.user);
    const mailboxByUser = byKey(mailboxes.recordset, (row) => row.user);

    const find = <T>(map: Map<string, T>, value: string | null): T | null => (value ? (map.get(sameKey(value)) ?? null) : null);
    return (links) => ({
        operator: find(operatorByCode, links.operatorCode),
        erpOperator: find(erpOperatorByCode, links.operatorCode),
        netproUser: find(netproUserByUser, links.netproUser),
        erpUser: find(erpUserByUser, links.erpUser),
        orgChart: find(orgChartByUser, links.erpUser),
        mailbox: find(mailboxByUser, links.erpUser),
    });
}

/** The card of one login: its links, the records they open and the facts side by side */
export async function getPersonCardAction(id: number): Promise<Result<{ card: PersonCard }>> {
    if (!IdSchema.safeParse(id).success) return { success: false, error: APP_COPY.common.invalidData };
    return guarded(async () => {
        const account = await findAccountById(id);
        if (!account) throw new Error(copy.notFound);
        const links = linksOf(account);
        const records = (await readRecords([links]))(links);
        return { card: { links, records, facts: buildFacts(records) } };
    });
}

/** Per user id, how many facts differ between the programs (only linked users; 0 is left out) */
export async function getPersonDriftAction(): Promise<Result<{ drift: Record<number, number> }>> {
    return guarded(async () => {
        const linked = (await listAccounts()).filter((account) => hasLinks(linksOf(account)));
        const recordsOf = await readRecords(linked.map(linksOf));
        const drift: Record<number, number> = {};
        for (const account of linked) {
            const count = driftCount(buildFacts(recordsOf(linksOf(account))));
            if (count > 0) drift[account.id] = count;
        }
        return { drift };
    });
}

/** Stores which records of the other programs this login is (our table only) */
export async function setPersonLinksAction(id: number, links: PersonLinks): Promise<Result<object>> {
    const parsed = LinksSchema.safeParse(links);
    if (!IdSchema.safeParse(id).success || !parsed.success) return { success: false, error: APP_COPY.common.invalidData };
    return guarded(async () => {
        await updateAccountLinks(id, parsed.data);
        return {};
    });
}

/**
 * Writes one e-mail for the person into the three places that may be written: NETPRO.UTENTI.FEMAIL (NetPro login),
 * ARCPROC.OPERAT.OpSumail (Business login) and organig.og_email (org chart). One transaction across NetPro and
 * Business; the mailbox (emailconf) is never touched. Answers how many rows changed.
 */
export async function alignEmailAction(id: number, email: string): Promise<Result<{ written: number }>> {
    const parsedEmail = EmailSchema.safeParse(email);
    if (!IdSchema.safeParse(id).success || !parsedEmail.success) return { success: false, error: copy.invalidEmail };
    const value = parsedEmail.data;
    return guarded(async () => {
        const account = await findAccountById(id);
        if (!account) throw new Error(copy.notFound);
        const { netproUser, erpUser } = linksOf(account);
        if (!netproUser && !erpUser) throw new Error(copy.noLinks);
        let written = 0;
        await withTransactions(['NETPRO', 'BUSINESS'], async (run) => {
            const rows = (result: { rowsAffected: number[] }) => result.rowsAffected[0] ?? 0;
            if (netproUser) written += rows(await run(`UPDATE UTENTI SET FEMAIL = @value WHERE UTENTE = @user`, { value, user: netproUser }, 'NETPRO'));
            if (erpUser) {
                written += rows(await run(`UPDATE ARCPROC.dbo.OPERAT SET OpSumail = @value WHERE OpNome = @user`, { value, user: erpUser }, 'BUSINESS'));
                written += rows(await run(`UPDATE organig SET og_email = @value WHERE og_coperat = @user`, { value, user: erpUser }, 'BUSINESS'));
            }
        });
        return { written };
    });
}
