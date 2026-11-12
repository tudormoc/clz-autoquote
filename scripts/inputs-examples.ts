/**
 * Regression check for what the forms accept and refuse on made-up data: the Agenda (task, repeat rule, procedure,
 * contact: src/lib/tasks/input.ts, repeat.ts), the Operatori window (src/lib/presence/operatorInput.ts) and the quote
 * (src/lib/pricing/validation.ts). These checks are what stands between the browser and the databases, so an update of
 * the library behind them (Zod) is proven here. The timesheet editor has its own in timesheet:examples, the name of
 * a person in persons:examples.
 *
 *   npm run inputs:examples
 */
import { APP_CONFIG } from '@/config/constants';
import { EMPLOYEE_CATEGORIES, LEFT_CATEGORY, TRACKED_REPARTI } from '@/lib/presence/categories';
import { NewOperatorSchema, OPERATOR_COLUMN_SIZES, OperatorFieldsSchema, changedOperatorFields, operatorInputProblem } from '@/lib/presence/operatorInput';
import { QuoteInputSchema } from '@/lib/pricing/validation';
import { ContactInputSchema, GuideInputSchema, TaskInputSchema, inputProblem } from '@/lib/tasks/input';
import { parseRepeatRule } from '@/lib/tasks/repeat';
import { APP_COPY, fmt } from '@/locales';

const { MAX_TITLE_LENGTH, MAX_TAGS_LENGTH, MAX_LINK_LENGTH, MAX_SHOW_DAYS, MAX_NAME_LENGTH } = APP_CONFIG.TASKS;
const tasks = APP_COPY.tasks;
const operators = APP_COPY.analytics.operators.form;

type Fields = Record<string, unknown>;
type Check = { safeParse: (input: unknown) => { success: true; data: unknown } | { success: false; error: { issues: { path: PropertyKey[] }[] } } };

const FINE = 'fine';
const REFUSED = 'refused';
const chars = (count: number) => 'x'.repeat(count);
const many = <T>(count: number, item: T): T[] => Array.from({ length: count }, () => item);

/** What the schema keeps of an input (trimmed, unknown fields dropped), or 'refused' */
const kept = (schema: Check, input: unknown): unknown => {
    const parsed = schema.safeParse(input);
    return parsed.success ? parsed.data : REFUSED;
};
const refuses = (schema: Check, input: unknown) => kept(schema, input) === REFUSED;
/** 'accepted', or the first field the schema stops at */
const stopsAt = (schema: Check, input: unknown): string => {
    const parsed = schema.safeParse(input);
    return parsed.success ? 'accepted' : parsed.error.issues[0].path.map(String).join('.');
};

// ── Agenda ───────────────────────────────────────────────────────────────────────────────────────────────────────
const taskField = (label: string) => fmt(tasks.messages.invalid, { detail: label });

const MONTHLY = { mode: 'calendar', pattern: { unit: 'months', every: 1, on: { type: 'days', days: [16] } }, missed: 'keep', end: { type: 'never' } };
const TASK: Fields = {
    title: 'F24', notes: 'da pagare', areaId: 3, tags: ['iva', 'banca'], priority: 1, assignee: 'TM', groupId: null, visibility: 'all',
    dueDate: '2026-11-16', dueTime: '09:00', repeat: MONTHLY, showDays: 7,
    checklist: [{ id: 'a1', text: 'controlla il saldo' }], estimateMinutes: 30,
    links: [{ label: 'banca', kind: 'web', value: 'https://example.com' }], guideIds: [1], contactIds: [2],
};
const STEP = { id: 'a1', text: 'passo' };
const LINK = { label: '', kind: 'path', value: 'Z:\\cartella' };

const taskSays = (change: Fields) => inputProblem(TaskInputSchema, { ...TASK, ...change }) ?? FINE;
const taskRefuses = (change: Fields) => refuses(TaskInputSchema, { ...TASK, ...change });
const calendar = (pattern: Fields, end: Fields = { type: 'never' }) => ({ repeat: { mode: 'calendar', pattern, missed: 'keep', end } });
const everySays = (unit: string, every: number, rest: Fields = {}) => taskSays(calendar({ unit, every, ...rest }));

const GUIDE: Fields = { title: 'Chiusura IVA', areaId: null, body: '# Passi', reviewMonths: 12, links: [LINK], contactIds: [2] };
const guideSays = (change: Fields) => inputProblem(GuideInputSchema, { ...GUIDE, ...change }) ?? FINE;

const CONTACT: Fields = { name: 'Mario Rossi', company: '', role: '', phone: '', email: '', notes: '' };
const contactSays = (change: Fields) => inputProblem(ContactInputSchema, { ...CONTACT, ...change }) ?? FINE;

// ── Operatori ────────────────────────────────────────────────────────────────────────────────────────────────────
const operatorField = (label: string) => fmt(operators.invalid, { field: label });
const CATEGORY = TRACKED_REPARTI[0];
const OPERATOR: Fields = { code: '9876', name: 'ROSSI MARIO', badge: '', category: CATEGORY };
const newOperatorSays = (change: Fields) => operatorInputProblem(NewOperatorSchema, { ...OPERATOR, ...change }) ?? FINE;
const changeSays = (fields: Fields) => operatorInputProblem(OperatorFieldsSchema, fields) ?? FINE;
// What "Modifica operatore" sends: a person's row as the list read it, and the window opened on it with something changed
const PLAIN = EMPLOYEE_CATEGORIES.find((category) => !category.nameMark)!.key;
const MARKED_CATEGORY = EMPLOYEE_CATEGORIES.find((category) => category.nameMark)!;
const MARKED = MARKED_CATEGORY.key;
const NO_FREE = { FCODE01: null, FCODE02: null, FCODE03: null, FCODE04: null, FCODE05: null };
const ROW = { NOME: 'ROSSI MARIO', BADGE: '123', ENTITA: PLAIN, MATRICOLA: '9876', ...NO_FREE };
const windowOn = (row: Record<string, string | null>, change: Record<string, string> = {}) =>
    changedOperatorFields(row, { NOME: row.NOME ?? '', BADGE: row.BADGE ?? '', ENTITA: row.ENTITA?.trim() || PLAIN, MATRICOLA: row.MATRICOLA ?? '', FCODE01: '', FCODE02: '', FCODE03: '', FCODE04: '', FCODE05: '', ...change });

// ── Preventivo ───────────────────────────────────────────────────────────────────────────────────────────────────
const QUOTE = {
    project_title: 'Libro', quantity: 500, format: { width: 210, height: 297 }, pages: 96,
    cover_details: { type: 'hard', spine_type: 'square', board_thickness: 2, headbands_enabled: false },
    internals: { sheet_width: 700, sheet_height: 1000, endpapers_enabled: false },
};
const quoteStopsAt = (change: Fields) => stopsAt(QuoteInputSchema, { ...QUOTE, ...change });
const coverStopsAt = (change: Fields) => quoteStopsAt({ cover_details: { ...QUOTE.cover_details, ...change } });
const internalsStopAt = (change: Fields) => quoteStopsAt({ internals: { ...QUOTE.internals, ...change } });

const EXAMPLES: { name: string; expected: unknown; actual: () => unknown }[] = [
    // A task: what the form says
    { name: 'task: a monthly deadline with steps, links, a procedure and a contact', expected: FINE, actual: () => taskSays({}) },
    { name: 'task: one date, nothing else filled', expected: FINE, actual: () => taskSays({ notes: '', areaId: null, tags: [], assignee: null, dueTime: null, repeat: null, checklist: [], estimateMinutes: null, links: [], guideIds: [], contactIds: [] }) },
    { name: 'task: no date at all', expected: FINE, actual: () => taskSays({ dueDate: null, dueTime: null, repeat: null }) },
    { name: 'task: no title', expected: tasks.messages.titleRequired, actual: () => taskSays({ title: '' }) },
    { name: 'task: a title of spaces is no title', expected: tasks.messages.titleRequired, actual: () => taskSays({ title: '   ' }) },
    { name: 'task: a title as long as its column', expected: FINE, actual: () => taskSays({ title: chars(MAX_TITLE_LENGTH) }) },
    { name: 'task: a title one character longer', expected: taskField(tasks.form.title), actual: () => taskSays({ title: chars(MAX_TITLE_LENGTH + 1) }) },
    { name: 'task: a repeat without its first date', expected: tasks.messages.firstDateRequired, actual: () => taskSays({ dueDate: null }) },
    { name: 'task: no title and no first date, the title is named first', expected: tasks.messages.titleRequired, actual: () => taskSays({ title: '', dueDate: null }) },
    { name: 'task: a date that does not exist', expected: taskField(tasks.form.dueDate), actual: () => taskSays({ dueDate: '2026-02-30' }) },
    { name: 'task: a date written the Italian way', expected: taskField(tasks.form.dueDate), actual: () => taskSays({ dueDate: '16/11/2026' }) },
    { name: 'task: times that are not HH:MM', expected: [taskField(tasks.form.dueTime), taskField(tasks.form.dueTime), taskField(tasks.form.dueTime)], actual: () => ['24:00', '8:30', '08:60'].map((dueTime) => taskSays({ dueTime })) },
    { name: 'task: shown from 0 days up to a year before', expected: [FINE, FINE], actual: () => [0, MAX_SHOW_DAYS].map((showDays) => taskSays({ showDays })) },
    { name: 'task: shown from more than a year, a negative or a half day before', expected: [taskField(tasks.form.showDays), taskField(tasks.form.showDays), taskField(tasks.form.showDays)], actual: () => [MAX_SHOW_DAYS + 1, -1, 1.5].map((showDays) => taskSays({ showDays })) },
    { name: 'task: an estimate of 0 minutes', expected: taskField(tasks.form.estimate), actual: () => taskSays({ estimateMinutes: 0 }) },
    { name: 'task: the longest estimate, and one minute more', expected: [false, true], actual: () => [100_000, 100_001].map((estimateMinutes) => taskRefuses({ estimateMinutes })) },
    { name: 'task: notes up to 200 000 characters', expected: [false, true], actual: () => [200_000, 200_001].map((length) => taskRefuses({ notes: chars(length) })) },

    // A task: its lists
    { name: 'task: 30 tags, and one more', expected: [FINE, taskField(tasks.form.tags)], actual: () => [30, 31].map((count) => taskSays({ tags: many(count, 't') })) },
    { name: 'task: a tag of 50 characters, of 51, an empty one', expected: [FINE, taskField(tasks.form.tags), taskField(tasks.form.tags)], actual: () => [chars(50), chars(51), ''].map((tag) => taskSays({ tags: [tag] })) },
    { name: `task: tags that fit their column together (${MAX_TAGS_LENGTH}), and that do not`, expected: [FINE, taskField(tasks.form.tags)], actual: () => [7, 8].map((count) => taskSays({ tags: many(count, chars(50)) })) },
    { name: 'task: 100 steps, and one more', expected: [FINE, taskField(tasks.form.checklist)], actual: () => [100, 101].map((count) => taskSays({ checklist: many(count, STEP) })) },
    { name: 'task: a step without text, a step of 301 characters', expected: [taskField(tasks.form.checklist), taskField(tasks.form.checklist)], actual: () => ['', chars(301)].map((text) => taskSays({ checklist: [{ id: 'a1', text }] })) },
    { name: 'task: 50 links, and one more', expected: [FINE, taskField(tasks.form.links)], actual: () => [50, 51].map((count) => taskSays({ links: many(count, LINK) })) },
    { name: 'task: a link without its address, one past its column, of an unknown kind', expected: [taskField(tasks.form.links), taskField(tasks.form.links), taskField(tasks.form.links)], actual: () => [{ ...LINK, value: '' }, { ...LINK, value: chars(MAX_LINK_LENGTH + 1) }, { ...LINK, kind: 'ftp' }].map((link) => taskSays({ links: [link] })) },
    { name: 'task: 50 procedures and 50 contacts, and one more of each', expected: [false, true, false, true], actual: () => [taskRefuses({ guideIds: many(50, 1) }), taskRefuses({ guideIds: many(51, 1) }), taskRefuses({ contactIds: many(50, 1) }), taskRefuses({ contactIds: many(51, 1) })] },

    // A task: values no form sends
    { name: 'task: an area that is not a whole number from 1', expected: [true, true, true, true], actual: () => [0, -1, 1.5, '3'].map((areaId) => taskRefuses({ areaId })) },
    { name: 'task: an area that is infinite, or too large to be exact (refused since Zod 4)', expected: [true, true, true], actual: () => [Infinity, 2 ** 53, 1e308].map((areaId) => taskRefuses({ areaId })) },
    { name: 'task: an unknown priority or visibility', expected: [true, true, true], actual: () => [taskRefuses({ priority: 3 }), taskRefuses({ priority: '1' }), taskRefuses({ visibility: 'everyone' })] },
    { name: 'task: a responsabile past 20 characters', expected: [false, true], actual: () => [20, 21].map((length) => taskRefuses({ assignee: chars(length) })) },
    { name: 'task: a field left out', expected: [true, true, true], actual: () => ['title', 'tags', 'repeat'].map((field) => refuses(TaskInputSchema, Object.fromEntries(Object.entries(TASK).filter(([key]) => key !== field)))) },
    { name: 'task: not a form at all', expected: [true, true, true, true], actual: () => [null, undefined, 'F24', [TASK]].map((input) => refuses(TaskInputSchema, input)) },
    { name: 'task: texts are kept trimmed, a field the form does not have is dropped', expected: { title: 'F24', tags: ['iva'], link: 'https://example.com', extra: false }, actual: () => { const data = kept(TaskInputSchema, { ...TASK, title: '  F24  ', tags: [' iva '], links: [{ label: '', kind: 'web', value: ' https://example.com ' }], extra: 1 }) as { title: string; tags: string[]; links: { value: string }[] }; return { title: data.title, tags: data.tags, link: data.links[0].value, extra: 'extra' in data }; } },

    // The repeat rule of a task
    { name: 'repeat: every 2 days, 5 times', expected: FINE, actual: () => taskSays(calendar({ unit: 'days', every: 2 }, { type: 'count', count: 5 })) },
    { name: 'repeat: every week on Monday and Wednesday, until a date', expected: FINE, actual: () => taskSays(calendar({ unit: 'weeks', every: 1, weekdays: [1, 3] }, { type: 'until', date: '2027-06-30' })) },
    { name: 'repeat: every 3 months on the last day, on the last Friday', expected: [FINE, FINE], actual: () => [{ type: 'last' }, { type: 'weekday', nth: -1, weekday: 5 }].map((on) => taskSays(calendar({ unit: 'months', every: 3, on }))) },
    { name: 'repeat: every year on 16/06 and 16/12', expected: FINE, actual: () => taskSays(calendar({ unit: 'years', every: 1, dates: [{ month: 6, day: 16 }, { month: 12, day: 16 }] })) },
    { name: 'repeat: 3 months after the last time it was done', expected: FINE, actual: () => taskSays({ repeat: { mode: 'after', every: 3, unit: 'months', end: { type: 'never' } } }) },
    { name: 'repeat: a week without a weekday', expected: tasks.messages.weekdaysRequired, actual: () => everySays('weeks', 1, { weekdays: [] }) },
    { name: 'repeat: a month without a day', expected: tasks.messages.monthDaysRequired, actual: () => everySays('months', 1, { on: { type: 'days', days: [] } }) },
    { name: 'repeat: a year without a date', expected: tasks.messages.yearDatesRequired, actual: () => everySays('years', 1, { dates: [] }) },
    { name: 'repeat: the longest "every" of each unit', expected: [FINE, FINE, FINE, FINE], actual: () => [everySays('days', 366), everySays('weeks', 52, { weekdays: [1] }), everySays('months', 24, { on: { type: 'last' } }), everySays('years', 10, { dates: [{ month: 1, day: 1 }] })] },
    { name: 'repeat: one more than that, and every 0', expected: many(5, taskField(tasks.form.every)), actual: () => [everySays('days', 367), everySays('weeks', 53, { weekdays: [1] }), everySays('months', 25, { on: { type: 'last' } }), everySays('years', 11, { dates: [{ month: 1, day: 1 }] }), everySays('days', 0)] },
    { name: 'repeat: day 31 of the month, day 32, day 0', expected: [FINE, taskField(tasks.form.monthDays), taskField(tasks.form.monthDays)], actual: () => [31, 32, 0].map((day) => everySays('months', 1, { on: { type: 'days', days: [day] } })) },
    { name: 'repeat: 31 days of the month listed, and one more', expected: [FINE, taskField(tasks.form.monthDays)], actual: () => [31, 32].map((count) => everySays('months', 1, { on: { type: 'days', days: many(count, 1) } })) },
    { name: 'repeat: 7 weekdays listed, and one more; a weekday 8', expected: [false, true, true], actual: () => [many(7, 1), many(8, 1), [8]].map((weekdays) => taskRefuses(calendar({ unit: 'weeks', every: 1, weekdays }))) },
    { name: 'repeat: 24 dates of the year, and one more', expected: [FINE, taskField(tasks.form.yearDates)], actual: () => [24, 25].map((count) => everySays('years', 1, { dates: many(count, { month: 6, day: 16 }) })) },
    { name: 'repeat: month 13, day 32 of a date of the year', expected: [true, true], actual: () => [{ month: 13, day: 1 }, { month: 1, day: 32 }].map((date) => taskRefuses(calendar({ unit: 'years', every: 1, dates: [date] }))) },
    { name: 'repeat: 1 000 times, and 0 or 1 001', expected: [FINE, taskField(tasks.form.endCount), taskField(tasks.form.endCount)], actual: () => [1000, 0, 1001].map((count) => taskSays(calendar({ unit: 'days', every: 1 }, { type: 'count', count }))) },
    { name: 'repeat: an end date that does not exist, a kind of rule nobody knows', expected: [true, true, true, true, true], actual: () => [taskRefuses(calendar({ unit: 'days', every: 1 }, { type: 'until', date: '2026-02-30' })), taskRefuses(calendar({ unit: 'hours', every: 1 })), taskRefuses(calendar({ unit: 'months', every: 1, on: { type: 'weekday', nth: 5, weekday: 1 } })), taskRefuses({ repeat: { ...MONTHLY, mode: 'sometimes' } }), taskRefuses({ repeat: { ...MONTHLY, missed: 'drop' } })] },
    { name: 'repeat: a stored rule is read back, a broken or outdated one counts as none', expected: [MONTHLY, null, null, null], actual: () => [parseRepeatRule(JSON.stringify(MONTHLY)), parseRepeatRule('{"mode":'), parseRepeatRule(JSON.stringify({ mode: 'weekly' })), parseRepeatRule(null)] },

    // A procedure and a contact of the Agenda
    { name: 'procedure: a title, a text, a review every year', expected: FINE, actual: () => guideSays({}) },
    { name: 'procedure: no title', expected: tasks.messages.titleRequired, actual: () => guideSays({ title: ' ' }) },
    { name: 'procedure: never reviewed, every 120 months', expected: [FINE, FINE], actual: () => [null, 120].map((reviewMonths) => guideSays({ reviewMonths })) },
    { name: 'procedure: reviewed every 0 or 121 months', expected: [taskField(tasks.guides.reviewMonths), taskField(tasks.guides.reviewMonths)], actual: () => [0, 121].map((reviewMonths) => guideSays({ reviewMonths })) },
    { name: 'procedure: a text up to 500 000 characters', expected: [false, true], actual: () => [500_000, 500_001].map((length) => refuses(GuideInputSchema, { ...GUIDE, body: chars(length) })) },
    { name: 'procedure: 50 links and 50 contacts, and one more of each', expected: [FINE, taskField(tasks.form.links), false, true], actual: () => [guideSays({ links: many(50, LINK) }), guideSays({ links: many(51, LINK) }), refuses(GuideInputSchema, { ...GUIDE, contactIds: many(50, 1) }), refuses(GuideInputSchema, { ...GUIDE, contactIds: many(51, 1) })] },
    { name: 'contact: a name is enough', expected: FINE, actual: () => contactSays({}) },
    { name: 'contact: no name', expected: tasks.contacts.nameRequired, actual: () => contactSays({ name: '  ' }) },
    { name: 'contact: a name as long as its column, and one character longer', expected: [false, true], actual: () => [MAX_NAME_LENGTH, MAX_NAME_LENGTH + 1].map((length) => refuses(ContactInputSchema, { ...CONTACT, name: chars(length) })) },
    { name: 'contact: a phone of 51 characters, an e-mail of 201', expected: [taskField(tasks.contacts.phone), taskField(tasks.contacts.email)], actual: () => [contactSays({ phone: chars(51) }), contactSays({ email: chars(201) })] },
    { name: 'contact: the e-mail is free text (not checked as an address)', expected: FINE, actual: () => contactSays({ email: 'chiedere a Mario' }) },
    { name: 'contact: texts are kept trimmed', expected: { name: 'Mario Rossi', company: 'Studio', role: '', phone: '049 123', email: 'm@example.com', notes: ' due righe ' }, actual: () => kept(ContactInputSchema, { name: ' Mario Rossi ', company: ' Studio', role: ' ', phone: '049 123 ', email: ' m@example.com', notes: ' due righe ' }) },

    // Operatori: a new operator
    { name: 'new operator: code, name, category', expected: FINE, actual: () => newOperatorSays({}) },
    { name: 'new operator: no code, a code with a space inside', expected: [operators.codeRequired, operators.codeNoSpaces], actual: () => ['', '98 76'].map((code) => newOperatorSays({ code })) },
    { name: 'new operator: a code as long as its column, and one character longer', expected: [FINE, operatorField(operators.code)], actual: () => [OPERATOR_COLUMN_SIZES.OPERATORE, OPERATOR_COLUMN_SIZES.OPERATORE + 1].map((length) => newOperatorSays({ code: chars(length) })) },
    { name: 'new operator: no name, a name one character past its column', expected: [operators.nameRequired, operatorField(operators.name)], actual: () => ['', chars(OPERATOR_COLUMN_SIZES.NOME + 1)].map((name) => newOperatorSays({ name })) },
    { name: 'new operator: no category, an unknown one, the one of the people who left', expected: [operators.categoryRequired, operators.categoryRequired, operators.categoryRequired], actual: () => ['', 'altro', LEFT_CATEGORY.reparto].map((category) => newOperatorSays({ category })) },
    { name: 'new operator: a badge one character past its column', expected: operatorField(operators.badge), actual: () => newOperatorSays({ badge: chars(OPERATOR_COLUMN_SIZES.BADGE + 1) }) },
    { name: 'new operator: code and name are kept trimmed, an empty badge as none', expected: { code: '9876', name: 'ROSSI MARIO', badge: null, category: CATEGORY }, actual: () => kept(NewOperatorSchema, { code: ' 9876 ', name: ' ROSSI MARIO ', badge: '  ', category: CATEGORY }) },

    // Operatori: what the Modifica window sends (only what differs from the person's row)
    { name: 'modifica: nothing touched, nothing sent', expected: {}, actual: () => windowOn(ROW) },
    { name: 'modifica: a new badge, only the badge', expected: { BADGE: '456' }, actual: () => windowOn(ROW, { BADGE: '456' }) },
    { name: 'modifica: the badge emptied, sent as empty', expected: { BADGE: '' }, actual: () => windowOn(ROW, { BADGE: '' }) },
    { name: 'modifica: spaces around a value are no change', expected: {}, actual: () => windowOn({ ...ROW, BADGE: ' 123 ' }, { MATRICOLA: '9876 ' }) },
    { name: 'modifica: a free field filled, only that one', expected: { FCODE02: 'ADECCO' }, actual: () => windowOn(ROW, { FCODE02: 'ADECCO' }) },
    { name: 'modifica: another name goes with its category', expected: { NOME: 'ROSSI MARIA', ENTITA: PLAIN }, actual: () => windowOn(ROW, { NOME: 'ROSSI MARIA' }) },
    { name: 'modifica: another category goes with the name (the server adds the mark)', expected: { NOME: 'ROSSI MARIO', ENTITA: MARKED }, actual: () => windowOn(ROW, { ENTITA: MARKED }) },
    { name: 'modifica: a name that lacks the mark of its category is sent, as the window announces', expected: { NOME: 'ROSSI MARIO', ENTITA: MARKED }, actual: () => windowOn({ ...ROW, ENTITA: MARKED }) },
    { name: 'modifica: a name that has the mark of its category, untouched: nothing', expected: {}, actual: () => windowOn({ ...ROW, NOME: `ROSSI MARIO${MARKED_CATEGORY.nameMark}`, ENTITA: MARKED }) },
    { name: 'modifica: a person without a category gets the one the window shows', expected: { NOME: 'ROSSI MARIO', ENTITA: PLAIN }, actual: () => windowOn({ ...ROW, ENTITA: null }) },
    { name: 'modifica: two things changed, both sent, nothing else', expected: { BADGE: '456', FCODE01: 'X' }, actual: () => windowOn(ROW, { BADGE: '456', FCODE01: 'X' }) },

    // Operatori: the fields of an operator
    { name: 'operator: one field alone', expected: { NOME: 'ROSSI MARIO' }, actual: () => kept(OperatorFieldsSchema, { NOME: ' ROSSI MARIO ' }) },
    { name: 'operator: nothing to change', expected: {}, actual: () => kept(OperatorFieldsSchema, {}) },
    { name: 'operator: an emptied name', expected: operators.nameRequired, actual: () => changeSays({ NOME: '' }) },
    { name: 'operator: moved to the people who left, to an unknown category', expected: [FINE, operators.categoryRequired], actual: () => [LEFT_CATEGORY.reparto, 'altro'].map((ENTITA) => changeSays({ ENTITA })) },
    { name: 'operator: emptied fields are kept as none', expected: { BADGE: null, STATO_FISICO: null, MATRICOLA: null, FCODE01: null }, actual: () => kept(OperatorFieldsSchema, { BADGE: '', STATO_FISICO: ' ', MATRICOLA: '', FCODE01: '' }) },
    { name: 'operator: a free field one character past its column, a stato of 5 letters', expected: [operatorField('FCODE01'), true], actual: () => [changeSays({ FCODE01: chars(OPERATOR_COLUMN_SIZES.FCODE + 1) }), refuses(OperatorFieldsSchema, { STATO_FISICO: 'FUORI' })] },
    { name: 'operator: a column the window does not have is dropped', expected: { NOME: 'ROSSI MARIO' }, actual: () => kept(OperatorFieldsSchema, { NOME: 'ROSSI MARIO', PASSWORD: 'x', OPERATORE: '1' }) },
    { name: 'operator: not a set of fields at all', expected: [true, true, true], actual: () => [null, 'NOME', ['NOME']].map((input) => refuses(OperatorFieldsSchema, input)) },
    { name: 'operator: a date in place of the fields is nothing to change (accepted since Zod 4, as {} always was)', expected: {}, actual: () => kept(OperatorFieldsSchema, new Date('2026-11-11T08:00:00')) },

    // The quote form: 'accepted', or the first field it stops at
    { name: 'quote: title, quantity, format, pages, cover and sheets', expected: 'accepted', actual: () => quoteStopsAt({}) },
    { name: 'quote: with client, e-mail, finishings, signatures and packaging', expected: 'accepted', actual: () => stopsAt(QuoteInputSchema, { ...QUOTE, display_id: 'Q1', client_name: 'Cliente', client_id: '12', email: 'a@example.com', cover_details: { ...QUOTE.cover_details, headbands_enabled: true, headbands_type: 'politi', finishings: ['uv'], cover_production_type: 'fast' }, internals: { ...QUOTE.internals, sheet_type: 'coated_matte', custom_signatures: [{ amount: 6, signature_type_id: 's16', size: 16 }] }, packaging: { type: 'box' } }) },
    { name: 'quote: no title', expected: 'project_title', actual: () => quoteStopsAt({ project_title: '' }) },
    { name: 'quote: a quantity of 0, of a half, as text', expected: ['quantity', 'quantity', 'quantity'], actual: () => [0, 1.5, '500'].map((quantity) => quoteStopsAt({ quantity })) },
    { name: 'quote: no pages', expected: 'pages', actual: () => quoteStopsAt({ pages: 0 }) },
    { name: 'quote: a width from 10 to 1000 mm', expected: ['accepted', 'accepted', 'format.width', 'format.width'], actual: () => [10, 1000, 9, 1001].map((width) => quoteStopsAt({ format: { width, height: 297 } })) },
    { name: 'quote: a height from 10 to 1000 mm', expected: ['accepted', 'accepted', 'format.height', 'format.height'], actual: () => [10, 1000, 9, 1001].map((height) => quoteStopsAt({ format: { width: 210, height } })) },
    { name: 'quote: an empty e-mail is no e-mail, a wrong one is refused', expected: ['accepted', 'accepted', 'email', 'email'], actual: () => ['', 'a.b@example.com', 'a@b', 'Mario Rossi'].map((email) => quoteStopsAt({ email })) },
    { name: 'quote: a cover without its type, an unknown spine, a board thinner than 0,1', expected: ['cover_details.type', 'cover_details.spine_type', 'cover_details.board_thickness'], actual: () => [coverStopsAt({ type: '' }), coverStopsAt({ spine_type: 'flat' }), coverStopsAt({ board_thickness: 0.05 })] },
    { name: 'quote: unknown headbands, an unknown cover production', expected: ['cover_details.headbands_type', 'cover_details.cover_production_type'], actual: () => [coverStopsAt({ headbands_type: 'altro' }), coverStopsAt({ cover_production_type: 'slow' })] },
    { name: 'quote: a sheet without a side, an unknown paper', expected: ['internals.sheet_width', 'internals.sheet_height', 'internals.sheet_type'], actual: () => [internalsStopAt({ sheet_width: 0 }), internalsStopAt({ sheet_height: 0 }), internalsStopAt({ sheet_type: 'uncoated' })] },
    { name: 'quote: a signature of 0 sheets', expected: 'internals.custom_signatures.0.amount', actual: () => internalsStopAt({ custom_signatures: [{ amount: 0 }] }) },
    { name: 'quote: an infinite thickness or sheet side, a quantity too large to be exact (refused since Zod 4)', expected: ['cover_details.board_thickness', 'internals.sheet_width', 'quantity'], actual: () => [coverStopsAt({ board_thickness: Infinity }), internalsStopAt({ sheet_width: Infinity }), quoteStopsAt({ quantity: 2 ** 53 })] },
    { name: 'quote: a date in place of the packaging is no packaging (accepted since Zod 4, as {} always was)', expected: {}, actual: () => (kept(QuoteInputSchema, { ...QUOTE, packaging: new Date('2026-11-11T08:00:00') }) as { packaging?: unknown }).packaging },
    { name: 'quote: 50 finishings and 100 signatures, and one more of each', expected: ['accepted', 'cover_details.finishings', 'accepted', 'internals.custom_signatures'], actual: () => [coverStopsAt({ finishings: many(50, 'uv') }), coverStopsAt({ finishings: many(51, 'uv') }), internalsStopAt({ custom_signatures: many(100, { amount: 1 }) }), internalsStopAt({ custom_signatures: many(101, { amount: 1 }) })] },
    { name: 'quote: no cover, no sheets', expected: ['cover_details', 'internals'], actual: () => [quoteStopsAt({ cover_details: undefined }), quoteStopsAt({ internals: undefined })] },
    { name: 'quote: a field the form does not have is dropped', expected: false, actual: () => 'extra' in (kept(QuoteInputSchema, { ...QUOTE, extra: 1 }) as object) },
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
