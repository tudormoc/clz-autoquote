'use client'

import { useMemo } from 'react';
import { getPayrollHoursAction } from '@/app/analytics/analytics-actions';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { ExportExcelButton } from '@/components/ui/ExportExcelButton';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { MonthField } from '@/components/ui/MonthField';
import { TabBar } from '@/components/ui/TabBar';
import { YearField } from '@/components/ui/YearField';
import { useAddress } from '@/hooks/useAddress';
import { useAppliedQuery } from '@/hooks/useAppliedQuery';
import { choiceParam } from '@/lib/address';
import { thisMonthPeriod, type MonthPeriod } from '@/lib/dateUtils';
import type { ExcelSheet } from '@/lib/excel';
import { formatNumber, formatWeekdayDate } from '@/lib/format';
import { PAYROLL_COLUMNS, dayOf, isPayrollNote, payrollExcelColumns, payrollRows, type PayrollRow, type PayrollValue } from '@/lib/payroll';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.analytics.payroll;

/** The two tabs on screen, the two sheets of the file */
type SheetId = 'clz' | 'interinali';
const SHEETS: SheetId[] = ['clz', 'interinali'];
/** The open tab, in the address */
const VIEW = { sheet: choiceParam(SHEETS, 'clz') };

/** On screen: the hours, a typed note, or nothing */
const showValue = (value: PayrollValue) => (typeof value === 'number' ? formatNumber(value, 2) : (value ?? ''));

const COLUMNS: DataTableColumn<PayrollRow>[] = [
    { key: 'id', header: copy.columns.id, variant: 'number', cell: (row) => dayOf(row)?.person.id ?? '' },
    { key: 'sarp', header: copy.columns.sarp, variant: 'number', cell: (row) => dayOf(row)?.person.sarp ?? '' },
    { key: 'name', header: copy.columns.name, cell: (row) => dayOf(row)?.person.name ?? '' },
    {
        key: 'date',
        header: copy.columns.date,
        cell: (row) => {
            const day = dayOf(row);
            return day ? formatWeekdayDate(day.day.date) : '';
        },
    },
    ...PAYROLL_COLUMNS.map(
        (column): DataTableColumn<PayrollRow> => ({
            key: column,
            header: copy.columns[column],
            variant: isPayrollNote(column) ? undefined : 'number',
            cell: (row) => {
                const day = dayOf(row);
                return day ? showValue(day.day[column]) : '';
            },
        })
    ),
];

const EXCEL_COLUMNS = payrollExcelColumns();

/**
 * Ore Studio Paghe: a month's hours per person, read on "Applica" or from a link that names the month (production
 * from the file, office from the timesheet; the file takes a while to read, so a page opened bare loads nothing);
 * two tabs (Clz e Ufficio, Interinali) that become the two sheets of one Excel named like the file.
 */
export function PayrollHoursReport() {
    const query = useAppliedQuery({
        initialFilters: (): MonthPeriod => thisMonthPeriod(),
        load: (period: MonthPeriod) => getPayrollHoursAction(period.year, period.month),
    });
    const { filters: period, updateFilters, applied, loading, error } = query;
    const view = useAddress(VIEW);
    const { sheet } = view.values;
    // A month that could not be read shows its error, not the month read before it
    const data = !error && query.result?.success ? query.result.data : null;

    const rows = useMemo(() => (data ? payrollRows(data[sheet]) : []), [data, sheet]);

    const excelSheets = async (): Promise<ExcelSheet<PayrollRow>[]> =>
        data ? SHEETS.map((id) => ({ sheetName: copy.sheets[id], columns: EXCEL_COLUMNS, rows: payrollRows(data[id]) })) : [];

    return (
        <div className="flex flex-col gap-4 lg:h-full">
            <FilterPanel
                onApply={query.apply}
                onClear={query.clear}
                activeCount={query.activeFilterCount}
                actions={<ExportExcelButton fileName={data?.fileName ?? ''} getSheets={excelSheets} disabled={!data} />}
            >
                <MonthField value={period.month} onChange={(month) => updateFilters({ month })} />
                <YearField value={period.year} onChange={(year) => updateFilters({ year })} />
            </FilterPanel>

            {data && (
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <TabBar tabs={SHEETS.map((id) => ({ id, label: copy.sheets[id], count: data[id].length }))} active={sheet} linkOf={(id) => view.link({ sheet: id })} />
                    <p className="text-sm text-fg-muted">
                        {copy.file}: <span className="font-mono text-fg-strong">{data.fileName}</span>
                    </p>
                </div>
            )}

            <DataTable
                columns={COLUMNS}
                rows={rows}
                getRowKey={(row) => (row.kind === 'day' ? `${row.person.name}_${row.day.date}` : row.key)}
                loading={loading}
                error={error}
                emptyMessage={applied ? APP_COPY.analytics.common.noData : APP_COPY.analytics.applyFiltersHint}
                fill
                nowrap
                mobile="table"
            />
        </div>
    );
}
