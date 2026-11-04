/**
 * The person behind a login as the other programs know them, without a database: the records the three links of
 * app_users open (operator code, NetPro user, Business user) and the "places" of each fact (e-mail, name), which the
 * Scheda persona compares the way the order comparison does (one row per fact, one column per place). Allinea writes
 * the e-mail and the name, only into the places listed in docs/DATABASE.md → People; the reads and writes are in
 * src/app/person-actions.ts. A name is the same text, in capitals, in every place (owner, 2026-11-04): the rules of
 * how it is written, split and checked are here too. The e-mail signatures of Business (emailfirme) are left out on
 * purpose (owner, 2026-11-02).
 */

import { z } from 'zod';
import { bareName } from '@/lib/presence/categories';

export interface PersonLinks {
    /** NETPRO.OPERATORI.OPERATORE = COOPZANARDI.tabcope.tb_codcope */
    operatorCode: string | null;
    /** NETPRO.UTENTI.UTENTE */
    netproUser: string | null;
    /** ARCPROC.OPERAT.OpNome = COOPZANARDI.organig.og_coperat = emailconf.em_user */
    erpUser: string | null;
}

export const NO_LINKS: PersonLinks = { operatorCode: null, netproUser: null, erpUser: null };
export const hasLinks = (links: PersonLinks) => Boolean(links.operatorCode || links.netproUser || links.erpUser);

/** What the links open, as read by person-actions (null = not linked, or no row there) */
export interface PersonRecords {
    operator: { code: string; name: string | null; badge: string | null; category: string | null } | null;
    erpOperator: { code: string; name: string | null } | null;
    netproUser: { user: string; description: string | null; email: string | null; role: string | null } | null;
    erpUser: { user: string; surname: string | null; name: string | null; email: string | null; role: string | null } | null;
    orgChart: { surname: string | null; name: string | null; email: string | null; phone: string | null; operatorCode: number | null } | null;
    /** The mailbox Business reads and sends with: shown, never written */
    mailbox: { email: string | null } | null;
}

export type PlaceId = 'operator' | 'netproUser' | 'erpOperator' | 'erpUser' | 'orgChart' | 'mailbox';
export type FactKey = 'email' | 'name';

/** The columns of the comparison, NetPro first, then Business */
export const PLACES: readonly PlaceId[] = ['operator', 'netproUser', 'erpOperator', 'erpUser', 'orgChart', 'mailbox'];
/** Which program each place belongs to (the colour of its column, as in the order comparison) */
export const PLACE_SYSTEM: Record<PlaceId, 'netpro' | 'business'> = {
    operator: 'netpro',
    netproUser: 'netpro',
    erpOperator: 'business',
    erpUser: 'business',
    orgChart: 'business',
    mailbox: 'business',
};

/** Which places carry each fact at all (an operator has no e-mail, a mailbox has no name) */
export const FACT_PLACES: Record<FactKey, readonly PlaceId[]> = {
    email: ['netproUser', 'erpUser', 'orgChart', 'mailbox'],
    name: ['operator', 'netproUser', 'erpOperator', 'erpUser', 'orgChart'],
};

export interface FactValue {
    place: PlaceId;
    value: string | null;
    /** Allinea may write here */
    writable: boolean;
}

export interface Fact {
    key: FactKey;
    values: FactValue[];
    /** More than one distinct value among the places that have one */
    differs: boolean;
}

/** The shortest of the e-mail columns Allinea writes (NETPRO.UTENTI.FEMAIL is varchar(50)) */
export const EMAIL_MAX_LENGTH = 50;

const clean = (value: string | null | undefined): string | null => (value ?? '').trim() || null;
const joinName = (surname: string | null, name: string | null) => clean([surname, name].map((part) => (part ?? '').trim()).filter(Boolean).join(' '));

/** The same address however it is typed */
export const emailKey = (value: string) => value.trim().toLowerCase();

const singleSpaced = (value: string) => value.split(/\s+/).filter(Boolean).join(' ');

/** The same name only when the text is the same ("MOCANU TUDOR" ≠ "Mocanu Tudor"): NetPro's category mark and spacing aside */
export const nameKey = (value: string) => singleSpaced(bareName(value));

/** A name as Allinea writes it everywhere: capitals, single spaces, no category mark */
export const writtenName = (value: string) => singleSpaced(bareName(value)).toUpperCase();

/** Cognome and nome, kept apart by the Business login and the org chart */
export interface NameParts {
    surname: string;
    firstName: string;
}

/** The longest text each name column takes: NOME, DESCRIZIONE, tb_descope, OpDescont, og_descont are varchar(30); OpDescont2, og_descont2 varchar(20) */
export const NAME_MAX_LENGTH = { full: 30, surname: 30, firstName: 20 } as const;

/** The whole name from its parts, as written */
export const joinNameParts = ({ surname, firstName }: NameParts) => writtenName(`${surname} ${firstName}`);

/** The parts of a name written as one text, by NetPro's habit "COGNOME NOME": the last word is the first name, the rest the surname ("DE VECCHI MONICA") */
export function splitName(full: string): NameParts {
    const words = writtenName(full).split(' ').filter(Boolean);
    return words.length > 1 ? { surname: words.slice(0, -1).join(' '), firstName: words[words.length - 1] } : { surname: words[0] ?? '', firstName: '' };
}

/**
 * The parts to propose for a name: the split a Business place already has when its words are the same ("Rossi" +
 * "Maria Grazia" for "ROSSI MARIA GRAZIA"), else splitName
 */
export function proposeNameParts(records: PersonRecords, full: string): NameParts {
    const target = writtenName(full);
    for (const place of [records.erpUser, records.orgChart]) {
        if (!place?.surname) continue;
        const parts = { surname: writtenName(place.surname), firstName: writtenName(place.name ?? '') };
        if (joinNameParts(parts) === target) return parts;
    }
    return splitName(full);
}

/** What Allinea nome accepts: both parts as written, the surname never empty, each within its columns */
export const NamePartsSchema = z
    .object({
        surname: z.string().transform(writtenName).pipe(z.string().min(1).max(NAME_MAX_LENGTH.surname)),
        firstName: z.string().transform(writtenName).pipe(z.string().max(NAME_MAX_LENGTH.firstName)),
    })
    .refine((parts) => joinNameParts(parts).length <= NAME_MAX_LENGTH.full);

/** How two values of a fact are told apart */
export const factKeyOf: Record<FactKey, (value: string) => string> = { email: emailKey, name: nameKey };

/** The distinct values among the filled places, first spelling kept, in the order they appear */
export function distinctValues(fact: Fact): string[] {
    const keyOf = factKeyOf[fact.key];
    const seen = new Set<string>();
    const distinct: string[] = [];
    for (const { value } of fact.values) {
        if (!value || seen.has(keyOf(value))) continue;
        seen.add(keyOf(value));
        distinct.push(value);
    }
    return distinct;
}

/** The places holding this value of the fact */
export const placesWith = (fact: Fact, value: string): PlaceId[] =>
    fact.values.filter((item) => item.value && factKeyOf[fact.key](item.value) === factKeyOf[fact.key](value)).map((item) => item.place);

/**
 * The odd values out: those held by fewer places than the most common one (the amber cells, as the order comparison
 * marks what strays from the DiBa). When no value prevails, every value is odd.
 */
export function oddValues(fact: Fact): Set<string> {
    const keyOf = factKeyOf[fact.key];
    const counts = new Map<string, number>();
    for (const { value } of fact.values) if (value) counts.set(keyOf(value), (counts.get(keyOf(value)) ?? 0) + 1);
    const most = Math.max(0, ...counts.values());
    const leaders = [...counts.entries()].filter(([, count]) => count === most);
    const odd = new Set<string>();
    for (const [key, count] of counts) if (count < most || leaders.length > 1) odd.add(key);
    return odd;
}

/** The facts of a person, each with its value place by place */
export function buildFacts(records: PersonRecords): Fact[] {
    const email: FactValue[] = [
        ...(records.netproUser ? [{ place: 'netproUser' as const, value: clean(records.netproUser.email), writable: true }] : []),
        ...(records.erpUser ? [{ place: 'erpUser' as const, value: clean(records.erpUser.email), writable: true }] : []),
        ...(records.orgChart ? [{ place: 'orgChart' as const, value: clean(records.orgChart.email), writable: true }] : []),
        ...(records.mailbox ? [{ place: 'mailbox' as const, value: clean(records.mailbox.email), writable: false }] : []),
    ];
    const name: FactValue[] = [
        ...(records.operator ? [{ place: 'operator' as const, value: clean(records.operator.name), writable: true }] : []),
        ...(records.netproUser ? [{ place: 'netproUser' as const, value: clean(records.netproUser.description), writable: true }] : []),
        ...(records.erpOperator ? [{ place: 'erpOperator' as const, value: clean(records.erpOperator.name), writable: true }] : []),
        ...(records.erpUser ? [{ place: 'erpUser' as const, value: joinName(records.erpUser.surname, records.erpUser.name), writable: true }] : []),
        ...(records.orgChart ? [{ place: 'orgChart' as const, value: joinName(records.orgChart.surname, records.orgChart.name), writable: true }] : []),
    ];
    const fact = (key: FactKey, values: FactValue[]): Fact => {
        const draft: Fact = { key, values, differs: false };
        return { ...draft, differs: distinctValues(draft).length > 1 };
    };
    return [fact('email', email), fact('name', name)];
}

/** How many facts of the person differ between the programs (the "≠" in Utenti) */
export const driftCount = (facts: Fact[]) => facts.filter((fact) => fact.differs).length;
