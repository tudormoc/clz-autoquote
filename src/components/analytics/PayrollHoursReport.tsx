'use client'

import { useMemo, useState } from 'react';
import { getPayrollHoursAction } from '@/app/analytics/analytics-actions';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { ExportExcelButton } from '@/components/ui/ExportExcelButton';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { MonthField } from '@/components/ui/MonthField';
import { TabBar } from '@/components/ui/TabBar';
import { YearField } from '@/components/ui/YearField';
import type { ExcelColumn, ExcelSheet } from '@/lib/excel';
import { formatNumber, formatWeekdayDate } from '@/lib/format';
import { PAYROLL_FIELDS, payrollRows, type PayrollData, type PayrollRow, type PayrollValue } from '@/lib/payroll';
import { errorMessage } from '@/lib/utils';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.analytics.payroll;

/** The two tabs on screen, the two sheets of the file */
type SheetId = 'clz' | 'interinali';
const SHEETS: SheetId[] = ['clz', 'interinali'];

interface Period {
    year: number;
    month: number;
}

const thisMonth = (): Period => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
};
const samePeriod = (a: Period, b: Period) => a.year === b.year && a.month === b.month;

const dayOf = (row: PayrollRow) => (row.kind === 'day' ? row : null);

/** On screen: the hours, a typed note, or nothing */
const showValue = (value: PayrollValue) => (typeof value === 'number' ? formatNumber(value, 2) : (value ?? ''));

/** In the file: a code as a number when it is one ("73" → 73), as the production file has it */
const codeValue = (code: string | null | undefined) => (code == null ? null : /^\d+$/.test(code) ? Number(code) : code);

/** Local midnight of "YYYY-MM-DD": an Excel date cell */
const dateOf = (iso: string) => new Date(`${iso}T00:00:00`);

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
    ...PAYROLL_FIELDS.map(
        (field): DataTableColumn<PayrollRow> => ({
            key: field,
            header: copy.columns[field],
            variant: 'number',
            cell: (row) => {
                const day = dayOf(row);
                return day ? showValue(day.day[field]) : '';
            },
        })
    ),
];

const EXCEL_COLUMNS: ExcelColumn<PayrollRow>[] = [
    { header: copy.columns.id, value: (row) => codeValue(dayOf(row)?.person.id), width: 13 },
    { header: copy.columns.sarp, value: (row) => codeValue(dayOf(row)?.person.sarp), width: 16 },
    { header: copy.columns.name, value: (row) => dayOf(row)?.person.name ?? null, width: 30 },
    {
        header: copy.columns.date,
        value: (row) => {
            const day = dayOf(row);
            return day ? dateOf(day.day.date) : null;
        },
        width: 22,
        format: 'weekdayDate',
    },
    ...PAYROLL_FIELDS.map((field): ExcelColumn<PayrollRow> => ({ header: copy.columns[field], value: (row) => dayOf(row)?.day[field] ?? null, width: 16 })),
];

/**
 * Ore Studio Paghe: a month's hours per person from the production file, read on "Applica"; two tabs
 * (Clz e Ufficio, Interinali) that become the two sheets of one Excel named like the file.
 */
export function PayrollHoursReport() {
    const [period, setPeriod] = useState<Period>(thisMonth);
    /** The period the table shows; null before "Applica" (the file takes a while to read, so nothing loads on its own) */
    const [applied, setApplied] = useState<Period | null>(null);
    const [data, setData] = useState<PayrollData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sheet, setSheet] = useState<SheetId>('clz');

    const load = async () => {
        setApplied(period);
        setLoading(true);
        setError(null);
        try {
            const result = await getPayrollHoursAction(period.year, period.month);
            if (result.success) {
                setData(result.data);
            } else {
                setData(null);
                setError(result.error);
            }
        } catch (err) {
            setData(null);
            setError(errorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const clear = () => {
        setPeriod(thisMonth());
        setApplied(null);
        setData(null);
        setError(null);
    };

    const rows = useMemo(() => (data ? payrollRows(data[sheet]) : []), [data, sheet]);

    const excelSheets = async (): Promise<ExcelSheet<PayrollRow>[]> =>
        data ? SHEETS.map((id) => ({ sheetName: copy.sheets[id], columns: EXCEL_COLUMNS, rows: payrollRows(data[id]) })) : [];

    return (
        <div className="flex flex-col gap-4 lg:h-full">
            <FilterPanel
                onApply={load}
                onClear={clear}
                activeCount={applied && !samePeriod(applied, thisMonth()) ? 1 : 0}
                actions={<ExportExcelButton fileName={data?.fileName ?? ''} getSheets={excelSheets} disabled={!data} />}
            >
                <MonthField value={period.month} onChange={(month) => setPeriod({ ...period, month })} />
                <YearField value={period.year} onChange={(year) => setPeriod({ ...period, year })} />
            </FilterPanel>

            {data && (
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <TabBar tabs={SHEETS.map((id) => ({ id, label: copy.sheets[id], count: data[id].length }))} active={sheet} onChange={setSheet} />
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
