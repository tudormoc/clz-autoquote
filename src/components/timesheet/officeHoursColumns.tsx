import { Pencil } from 'lucide-react';
import type { OfficeDayRow } from '@/app/presence/timesheet-actions';
import { Button } from '@/components/ui/Button';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { formatWeekdayDate } from '@/lib/format';
import { KIND_SPECS } from '@/lib/timesheet/kinds';
import { HOUR_FIELDS, type HourField } from '@/lib/timesheet/types';
import { APP_COPY } from '@/locales';
import { DayStatusBadge } from './DayStatusBadge';
import { entryText, fieldLabel, formatStepHours } from './labels';

const copy = APP_COPY.timesheet.office;

/** A column of hours, by its key */
export const isHourField = (key: string): key is HourField => (HOUR_FIELDS as readonly string[]).includes(key);

interface ColumnOptions {
    today: string;
    /** YYYY-MM-DD, the first day of the timesheet (Regole Presenze): earlier days get no pencil */
    startDay: string;
    canEdit: boolean;
    /** Opens the day's editor */
    onOpen: (row: OfficeDayRow) => void;
}

/** The columns of Ore Ufficio: the person and the day, what was entered, the hours as the studio's file has them, the state */
export function officeHoursColumns({ today, startDay, canEdit, onOpen }: ColumnOptions): DataTableColumn<OfficeDayRow>[] {
    const hours = (field: HourField): DataTableColumn<OfficeDayRow> => ({
        key: field,
        header: fieldLabel(field),
        variant: 'number',
        cell: (row) => (row.summary.hours[field] > 0 ? formatStepHours(row.summary.hours[field]) : ''),
    });
    const text = (key: string, header: string, value: (row: OfficeDayRow) => string): DataTableColumn<OfficeDayRow> => ({
        key,
        header,
        cellClassName: 'text-xs text-fg-secondary',
        cell: value,
    });

    return [
        { key: 'name', header: copy.columns.name, cell: (row) => <span className="font-medium text-fg-strong">{row.person.name}</span> },
        { key: 'date', header: copy.columns.date, cell: (row) => formatWeekdayDate(row.summary.day) },
        {
            key: 'spans',
            header: copy.columns.spans,
            cellClassName: 'font-mono text-xs',
            cell: (row) =>
                row.summary.entries
                    .filter((entry) => KIND_SPECS[entry.kind].input === 'times')
                    .map(entryText)
                    .join(', '),
        },
        hours('ferie'),
        text('causaleFerie', copy.columns.causaleFerie, (row) => row.summary.causaleFerie),
        hours('permesso'),
        text('causalePermesso', copy.columns.causalePermesso, (row) => row.summary.causalePermesso),
        hours('malattia'),
        hours('ordinarie'),
        hours('straordinarie'),
        hours('bancaOre'),
        text('note', copy.columns.note, (row) =>
            row.summary.entries
                .map((entry) => entry.note)
                .filter(Boolean)
                .join(' · ')
        ),
        { key: 'status', header: copy.columns.status, cell: (row) => <DayStatusBadge summary={row.summary} today={today} /> },
        ...(canEdit
            ? [
                  {
                      key: 'actions',
                      header: '',
                      align: 'right' as const,
                      compact: true,
                      // Days before the start of the timesheet are shown but locked (owner, 2026-11-05)
                      cell: (row: OfficeDayRow) =>
                          row.summary.day >= startDay && (
                              <Button variant="ghost" size="sm" title={APP_COPY.timesheet.day.open} aria-label={APP_COPY.timesheet.day.open} onClick={() => onOpen(row)}>
                                  <Pencil size={14} />
                              </Button>
                          ),
                  },
              ]
            : []),
    ];
}
