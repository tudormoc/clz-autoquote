/**
 * What the Agenda forms send, checked the same way in the browser (to show the message) and on the server
 * (the real check). Texts of the messages in it.ts → tasks.messages.
 */

import { z } from 'zod';
import { APP_CONFIG } from '@/config/constants';
import { isIsoDate } from '@/lib/tasks/dates';
import { RepeatRuleSchema } from '@/lib/tasks/repeat';
import { LINK_KINDS, PRIORITIES, VISIBILITIES } from '@/lib/tasks/types';
import { APP_COPY, fmt } from '@/locales';

const { MAX_TITLE_LENGTH, MAX_TAGS_LENGTH, MAX_LINK_LENGTH, MAX_SHOW_DAYS, MAX_NAME_LENGTH } = APP_CONFIG.TASKS;
const messages = APP_COPY.tasks.messages;

const IdSchema = z.number().int().positive();
const IsoDateSchema = z.string().refine(isIsoDate);
export const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const text = (max: number) => z.string().trim().max(max);

export const PrioritySchema = z.union([z.literal(PRIORITIES[0]), z.literal(PRIORITIES[1]), z.literal(PRIORITIES[2])]);

export const LinkSchema = z.object({
    label: text(200),
    kind: z.enum(LINK_KINDS),
    value: text(MAX_LINK_LENGTH).min(1),
});

export const TaskInputSchema = z
    .object({
        title: text(MAX_TITLE_LENGTH).min(1, messages.titleRequired),
        notes: z.string().max(200_000),
        areaId: IdSchema.nullable(),
        tags: z.array(text(50).min(1)).max(30),
        priority: PrioritySchema,
        assignee: z.string().max(20).nullable(),
        groupId: IdSchema.nullable(),
        visibility: z.enum(VISIBILITIES),
        dueDate: IsoDateSchema.nullable(),
        dueTime: TimeSchema.nullable(),
        repeat: RepeatRuleSchema.nullable(),
        showDays: z.number().int().min(0).max(MAX_SHOW_DAYS),
        checklist: z.array(z.object({ id: z.string().min(1).max(40), text: text(300).min(1) })).max(100),
        estimateMinutes: z.number().int().min(1).max(100_000).nullable(),
        links: z.array(LinkSchema).max(50),
        guideIds: z.array(IdSchema).max(50),
        contactIds: z.array(IdSchema).max(50),
    })
    .refine((task) => !task.repeat || task.dueDate !== null, { message: messages.firstDateRequired, path: ['dueDate'] })
    .refine((task) => task.tags.join(',').length <= MAX_TAGS_LENGTH, { path: ['tags'] });

/** Messages written for the user (the others are Zod's own, in English) */
const OWN_MESSAGES = new Set<string>([...Object.values(messages), APP_COPY.tasks.contacts.nameRequired]);

const form = APP_COPY.tasks.form;

/** The form field a problem is about, by the name in the data (the most specific match first) */
const FIELD_LABELS: [string, string][] = [
    ['until', form.endOptions.until],
    ['count', form.endCount],
    ['every', form.every],
    ['days', form.monthDays],
    ['dates', form.yearDates],
    ['repeat', form.mode],
    ['title', form.title],
    ['dueDate', form.dueDate],
    ['dueTime', form.dueTime],
    ['showDays', form.showDays],
    ['estimateMinutes', form.estimate],
    ['tags', form.tags],
    ['checklist', form.checklist],
    ['links', form.links],
    ['reviewMonths', APP_COPY.tasks.guides.reviewMonths],
    ['email', APP_COPY.tasks.contacts.email],
    ['phone', APP_COPY.tasks.contacts.phone],
];

/** The first problem of a form as a text for the user, or null when all is fine */
export function inputProblem<T>(schema: z.ZodType<T>, input: unknown): string | null {
    const parsed = schema.safeParse(input);
    if (parsed.success) return null;
    const issue = parsed.error.issues[0];
    if (OWN_MESSAGES.has(issue.message)) return issue.message;
    const path = issue.path.map(String);
    const label = FIELD_LABELS.find(([name]) => path.includes(name))?.[1] ?? path.join('.');
    return fmt(messages.invalid, { detail: label });
}

export const GuideInputSchema = z.object({
    title: text(MAX_TITLE_LENGTH).min(1, messages.titleRequired),
    areaId: IdSchema.nullable(),
    body: z.string().max(500_000),
    reviewMonths: z.number().int().min(1).max(120).nullable(),
    links: z.array(LinkSchema).max(50),
    contactIds: z.array(IdSchema).max(50),
});
export type GuideInput = z.infer<typeof GuideInputSchema>;

export const ContactInputSchema = z.object({
    name: text(MAX_NAME_LENGTH).min(1, APP_COPY.tasks.contacts.nameRequired),
    company: text(MAX_NAME_LENGTH),
    role: text(MAX_NAME_LENGTH),
    phone: text(50),
    email: text(200),
    notes: z.string().max(20_000),
});
export type ContactInput = z.infer<typeof ContactInputSchema>;

/** "iva, banca , ,F24" → ["iva", "banca", "F24"] */
export const parseTags = (text: string) => Array.from(new Set(text.split(',').map((tag) => tag.trim()).filter(Boolean)));
