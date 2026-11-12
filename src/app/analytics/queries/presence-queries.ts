/**
 * PRESENCE QUERIES (Presenze Annuali)
 *
 * Reads the monthly production Excel files of a year (queries/shared/presence-files.ts) and sums the ordinary
 * hours per operator group and ISO week. Columns read: APP_CONFIG.PRESENCE.EXCEL_COLUMNS (week text, hours, group).
 */

'use server'

import { errorMessage } from '@/lib/utils';
import { APP_CONFIG } from '@/config/constants';
import { isoWeekStart, toIsoDate } from '@/lib/dateUtils';
import { APP_COPY, fmt } from '@/locales';
import type { PresenceData, WeekDateRange, WeeklyGroupData } from '@/types';
import { authorize } from '@/lib/auth/access';
import { LINKS } from '@/config/navigation';
import { presenceFileNames, presenceFolder, readSheetByPosition } from './shared/presence-files';

const { EXCEL_FOLDERS, EXCEL_COLUMNS, EXCEL_HEADERS } = APP_CONFIG.PRESENCE;
const copy = APP_COPY.analytics.presence;

interface PresenceRow {
    week: number;
    group: string;
    hours: number;
}

/**
 * Rows of one monthly file with a week number ("Totale settimana 3" → 3), a group and positive hours. A file that
 * cannot be read, or whose columns are not where they are read, throws and the report says which file and why: until
 * 2026-11-12 such a month counted as no hours, without a word.
 */
function readPresenceFile(folder: string, fileName: string): PresenceRow[] {
    const data = readSheetByPosition(folder, fileName, EXCEL_COLUMNS, EXCEL_HEADERS);

    const rows: PresenceRow[] = [];
    for (const row of data.slice(1)) {
        const weekText = row[EXCEL_COLUMNS.WEEK];
        const group = row[EXCEL_COLUMNS.GROUP];
        const hours = Number(row[EXCEL_COLUMNS.HOURS]);
        const week = Number(String(weekText ?? '').match(/(\d+)/)?.[1]);
        if (weekText && group && hours > 0 && !isNaN(week)) {
            rows.push({ week, group: String(group).trim(), hours });
        }
    }
    return rows;
}

/** Monday to Sunday of an ISO week, as "YYYY-MM-DD" */
function weekDateRange(year: number, weekNumber: number): WeekDateRange {
    const start = isoWeekStart(year, weekNumber);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { weekNumber, startDate: toIsoDate(start), endDate: toIsoDate(end) };
}

/** Hours per group and week (keys "week3" …), totals per week, and the dates of each week */
function sumByWeek(rows: PresenceRow[], year: number): PresenceData {
    const groups = new Map<string, WeeklyGroupData>();
    const weekTotals: Record<string, number> = {};

    for (const row of rows) {
        const key = `week${row.week}`;
        const group = groups.get(row.group) ?? { group: row.group };
        group[key] = ((group[key] as number) || 0) + row.hours;
        groups.set(row.group, group);
        weekTotals[key] = (weekTotals[key] || 0) + row.hours;
    }

    const weekNumbers = Array.from(new Set(rows.map((row) => row.week))).sort((a, b) => a - b);
    return {
        groups: Array.from(groups.values()).sort((a, b) => a.group.localeCompare(b.group)),
        weekTotals,
        weekNumbers,
        weekDateRanges: weekNumbers.map((week) => weekDateRange(year, week)),
    };
}

/** Weekly ordinary hours per operator group for a whole year, from that year's monthly files */
export async function getPresenceDataAction(year: number = new Date().getFullYear()) {
    await authorize('view', LINKS.analytics['annual-presence-report']);
    try {
        const folder = presenceFolder();
        if (!folder) {
            return { success: false, error: fmt(copy.folderNotFound, { folders: EXCEL_FOLDERS.join(' / ') }), data: null };
        }

        const files = presenceFileNames(folder, year);
        if (files.length === 0) {
            return { success: false, error: fmt(copy.noFiles, { year }), data: null };
        }

        const rows = files.flatMap((file) => readPresenceFile(folder, file));
        if (rows.length === 0) {
            return { success: false, error: copy.noRows, data: null };
        }

        return { success: true, data: sumByWeek(rows, year), filesProcessed: files.length };
    } catch (err) {
        console.error('Error in getPresenceDataAction:', err);
        return { success: false, error: errorMessage(err), data: null };
    }
}
