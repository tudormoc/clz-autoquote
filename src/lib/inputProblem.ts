/**
 * The first problem of a form, as a text for the user. Shared by the Zod schemas of the forms (Agenda, Operatori):
 * a message written in it.ts is shown as it is; any other issue names the field it is about.
 */
import type { z } from 'zod';

interface ProblemTexts {
    /** Messages written for the user, shown as they are (the others are Zod's own, in English) */
    ownMessages: ReadonlySet<string>;
    /** The form field a problem is about, by the name in the data (the most specific match first) */
    labels: readonly (readonly [string, string])[];
    /** The sentence naming a field whose value is wrong ("Controlla il campo {label}") */
    invalid: (label: string) => string;
}

/** The first problem of `input` against `schema` as a text for the user, or null when all is fine */
export function firstInputProblem(schema: z.ZodTypeAny, input: unknown, texts: ProblemTexts): string | null {
    const parsed = schema.safeParse(input);
    if (parsed.success) return null;
    const issue = parsed.error.issues[0];
    if (texts.ownMessages.has(issue.message)) return issue.message;
    const path = issue.path.map(String);
    const label = texts.labels.find(([name]) => path.includes(name))?.[1] ?? path.join('.');
    return texts.invalid(label);
}
