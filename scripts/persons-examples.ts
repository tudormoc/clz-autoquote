/**
 * Regression check for the name rules of the Scheda persona (src/lib/persons/places.ts) on made-up records:
 * when two names count as the same, how a name is written, split into cognome and nome, and what Allinea nome accepts.
 *
 *   npm run persons:examples
 */
import { NamePartsSchema, buildFacts, joinNameParts, nameKey, proposeNameParts, splitName, writtenName, type PersonRecords } from '@/lib/persons/places';

const records = (erpUser: { surname: string; name: string } | null, orgChart: { surname: string; name: string } | null, operatorName = 'MOCANU TUDOR'): PersonRecords => ({
    operator: { code: '98', name: operatorName, badge: null, category: '3' },
    erpOperator: { code: '98', name: operatorName },
    netproUser: { user: 'TM', description: 'Tudor Mocanu', email: null, role: null },
    erpUser: erpUser ? { user: 'TM', ...erpUser, email: null, role: null } : null,
    orgChart: orgChart ? { ...orgChart, email: null, phone: null, operatorCode: 98 } : null,
    mailbox: null,
});
const accepted = (surname: string, firstName: string) => {
    const parsed = NamePartsSchema.safeParse({ surname, firstName });
    return parsed.success ? parsed.data : 'refused';
};

const EXAMPLES: { name: string; expected: unknown; actual: () => unknown }[] = [
    // The same name only when the text is the same (owner, 2026-11-04); NetPro's mark and spacing aside
    { name: 'capitals and small letters are different names', expected: false, actual: () => nameKey('MOCANU TUDOR') === nameKey('Mocanu Tudor') },
    { name: 'the order of the words matters', expected: false, actual: () => nameKey('MOCANU TUDOR') === nameKey('TUDOR MOCANU') },
    { name: 'the interinali mark and double spaces do not', expected: true, actual: () => nameKey('ROSSI  MARIO *lb') === nameKey(' ROSSI MARIO ') },
    { name: 'the name row of the card differs when only the case differs', expected: true, actual: () => buildFacts(records({ surname: 'Mocanu', name: 'Tudor' }, null)).find((fact) => fact.key === 'name')?.differs },
    { name: 'and is aligned when every place has the same capitals', expected: false, actual: () => buildFacts({ ...records({ surname: 'MOCANU', name: 'TUDOR' }, { surname: 'MOCANU', name: 'TUDOR' }), netproUser: { user: 'TM', description: 'MOCANU TUDOR', email: null, role: null } }).find((fact) => fact.key === 'name')?.differs },

    // How a name is written everywhere
    { name: 'written in capitals, single spaces, no mark', expected: 'ROSSI MARIO', actual: () => writtenName('  rossi   mario *lb ') },
    { name: 'split: the last word is the first name', expected: { surname: 'DE VECCHI', firstName: 'MONICA' }, actual: () => splitName('De Vecchi Monica') },
    { name: 'split: one word is all surname', expected: { surname: 'MADONNA', firstName: '' }, actual: () => splitName('Madonna') },
    { name: 'joined back as one text', expected: 'DE VECCHI MONICA', actual: () => joinNameParts({ surname: 'de vecchi', firstName: 'monica' }) },

    // What the window proposes: a Business split with the same words wins over the last-word rule
    { name: 'the Business login split is proposed when its words match', expected: { surname: 'ROSSI', firstName: 'MARIA GRAZIA' }, actual: () => proposeNameParts(records({ surname: 'Rossi', name: 'Maria Grazia' }, null, 'ROSSI MARIA GRAZIA'), 'ROSSI MARIA GRAZIA') },
    { name: 'the org chart split is proposed too', expected: { surname: 'DE VECCHI', firstName: 'MONICA' }, actual: () => proposeNameParts(records(null, { surname: 'De Vecchi', name: 'Monica' }, 'DE VECCHI MONICA'), 'de vecchi monica') },
    { name: 'a Business split with other words is ignored', expected: { surname: 'MOCANU', firstName: 'TUDOR' }, actual: () => proposeNameParts(records({ surname: 'Morando', name: 'Daniele' }, null), 'Mocanu Tudor') },
    { name: 'without a Business split the last word is the first name', expected: { surname: 'MOCANU', firstName: 'TUDOR' }, actual: () => proposeNameParts(records(null, null), 'MOCANU TUDOR') },

    // What Allinea nome accepts (NOME, DESCRIZIONE, tb_descope, OpDescont, og_descont 30; OpDescont2, og_descont2 20)
    { name: 'accepted: written parts', expected: { surname: 'MOCANU', firstName: 'TUDOR' }, actual: () => accepted(' mocanu ', 'tudor') },
    { name: 'accepted: no first name', expected: { surname: 'MADONNA', firstName: '' }, actual: () => accepted('Madonna', '') },
    { name: 'refused: empty surname', expected: 'refused', actual: () => accepted('', 'Tudor') },
    { name: 'refused: first name past 20 characters', expected: 'refused', actual: () => accepted('Rossi', 'Maria Grazia Antonietta') },
    { name: 'accepted: exactly 30 characters in all', expected: { surname: 'SCAGNELLATO ZANELLATO', firstName: 'STEFANIA' }, actual: () => accepted('Scagnellato Zanellato', 'Stefania') },
    { name: 'refused: the whole name past 30 characters', expected: 'refused', actual: () => accepted('Scagnellato Zanellato', 'Stefania Maria') },
];

let failed = 0;
for (const { name, expected, actual } of EXAMPLES) {
    const want = JSON.stringify(expected);
    const got = JSON.stringify(actual());
    const pass = want === got;
    if (!pass) failed++;
    console.log(`${pass ? 'OK  ' : 'FAIL'} ${name}`);
    if (!pass) {
        console.log(`     expected ${want}`);
        console.log(`     actual   ${got}`);
    }
}
console.log(`\n${EXAMPLES.length - failed}/${EXAMPLES.length} examples pass`);
process.exit(failed > 0 ? 1 : 0);
