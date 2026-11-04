'use client';

import { useMemo, useState } from 'react';
import { getOfficeMonthAction, getTimesheetPeopleAction, type CausalePresets, type OfficeDayRow } from '@/app/presence/timesheet-actions';
import { useCanEdit } from '@/components/auth/AccessProvider';
import { DataTable } from '@/components/ui/DataTable';
import { ExportExcelButton } from '@/components/ui/ExportExcelButton';
import { Field } from '@/components/ui/Field';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { MonthField } from '@/components/ui/MonthField';
import { Select } from '@/components/ui/Select';
import { TableCell, TableRow } from '@/components/ui/Table';
import { YearField } from '@/components/ui/YearField';
import { useActionData } from '@/hooks/useActionData';
import { useListQuery } from '@/hooks/useListQuery';
import { thisMonthPeriod } from '@/lib/dateUtils';
import { reportFileName } from '@/lib/download';
import { formatDate } from '@/lib/format';
import { payrollExcelColumns, payrollRows, type PayrollRow } from '@/lib/payroll';
import { totalHours } from '@/lib/timesheet/month';
import { toPayrollPerson } from '@/lib/timesheet/payroll';
import type { DaySummary, TimesheetPerson } from '@/lib/timesheet/types';
import { cn } from '@/lib/utils';
import { APP_COPY } from '@/locales';
import { DayEditor } from './DayEditor';
import { formatStepHours } from './labels';
import { isHourField, officeHoursColumns } from './officeHoursColumns';

const copy = APP_COPY.timesheet.office;
const NO_PRESETS: CausalePresets = { feriePresets: [], permessoPresets: [] };
const EXCEL_COLUMNS = payrollExcelColumns();

interface Filters {
    year: number;
    month: number;
    /** '' = everyone */
    operatorCode: string;
}

/** The rows grouped back into people, in the order they came */
function peopleOf(rows: readonly OfficeDayRow[]): { person: TimesheetPerson; days: DaySummary[] }[] {
    const byCode = new Map<string, { person: TimesheetPerson; days: DaySummary[] }>();
    for (const row of rows) {
        const entry = byCode.get(row.person.operatorCode);
        if (entry) entry.days.push(row.summary);
        else byCode.set(row.person.operatorCode, { person: row.person, days: [row.summary] });
    }
    return [...byCode.values()];
}

/** Ore Ufficio: everyone's month, one row per person and day, loaded on "Applica"; a pencil opens the day; Excel in the studio's layout */
export function OfficeHoursView() {
    const people = useActionData(getTimesheetPeopleAction);
    const canEdit = useCanEdit();
    const list = useListQuery({
        initialFilters: (): Filters => ({ ...thisMonthPeriod(), operatorCode: '' }),
        load: async (filters: Filters) => {
            const result = await getOfficeMonthAction(filters.year, filters.month, filters.operatorCode || null);
            return result.success
                ? { success: true, data: result.rows, today: result.today, presets: result.presets }
                : { success: false, error: result.error, data: [] as OfficeDayRow[], today: '', presets: NO_PRESETS };
        },
    });
    const [open, setOpen] = useState<{ operatorCode: string; day: string } | null>(null);

    const today = list.result?.today ?? '';
    const presets = list.result?.presets ?? NO_PRESETS;
    const editing = open ? list.rows.find((row) => row.person.operatorCode === open.operatorCode && row.summary.day === open.day) : undefined;

    const columns = useMemo(
        () => officeHoursColumns({ today, canEdit, onOpen: (row) => setOpen({ operatorCode: row.person.operatorCode, day: row.summary.day }) }),
        [today, canEdit]
    );

    const totals = totalHours(list.rows.map((row) => row.summary));
    const footer = (
        <TableRow className="text-xs font-semibold hover:bg-transparent">
            {columns.map((column, index) => (
                <TableCell key={column.key} className={cn('py-2', column.variant ? 'text-right font-mono text-fg' : 'text-fg-muted')}>
                    {index === 0 ? copy.totals : isHourField(column.key) && totals[column.key] > 0 ? formatStepHours(totals[column.key]) : null}
                </TableCell>
            ))}
        </TableRow>
    );

    const excelRows = async (): Promise<PayrollRow[]> => payrollRows(peopleOf(list.rows).map(({ person, days }) => toPayrollPerson(person, days)));
    const { applied } = list;
    const fileName = applied ? reportFileName(APP_COPY.timesheet.pages.officeHours.label, [`${applied.year}-${String(applied.month).padStart(2, '0')}`], 'xlsx') : '';
    const personOptions = [{ value: '', label: copy.allPeople }, ...(people.data?.people ?? []).map((person) => ({ value: person.operatorCode, label: person.name }))];

    return (
        <div className="flex flex-col gap-4 lg:h-full">
            <FilterPanel
                columns={3}
                activeCount={list.activeFilterCount}
                onApply={list.apply}
                onClear={list.clear}
                actions={
                    <ExportExcelButton
                        fileName={fileName}
                        sheetName={APP_COPY.timesheet.pages.officeHours.label}
                        columns={EXCEL_COLUMNS}
                        getRows={excelRows}
                        disabled={list.rows.length === 0}
                    />
                }
            >
                <MonthField value={list.filters.month} onChange={(month) => list.updateFilters({ month })} />
                <YearField value={list.filters.year} onChange={(year) => list.updateFilters({ year })} />
                <Field label={copy.person}>
                    <Select value={list.filters.operatorCode} options={personOptions} aria-label={copy.person} onChange={(e) => list.updateFilters({ operatorCode: e.target.value })} />
                </Field>
            </FilterPanel>

            <DataTable
                fill
                nowrap
                columns={columns}
                rows={list.rows}
                getRowKey={(row) => `${row.person.operatorCode}_${row.summary.day}`}
                loading={list.loading}
                error={list.error}
                emptyMessage={applied ? APP_COPY.common.noData : copy.applyHint}
                footer={footer}
                getRowClassName={(row) => (row.summary.status === 'short' ? 'bg-danger-950/20' : row.summary.status === 'free' ? 'text-fg-subtle' : undefined)}
                mobileTitle={(row) => (
                    <span className="font-medium text-fg-strong">
                        {row.person.name} · {formatDate(row.summary.day)}
                    </span>
                )}
            />

            {editing && (
                <DayEditor
                    person={editing.person}
                    summary={editing.summary}
                    today={today}
                    presets={presets}
                    canEdit={canEdit}
                    onChanged={list.reload}
                    onClose={() => setOpen(null)}
                />
            )}
        </div>
    );
}
