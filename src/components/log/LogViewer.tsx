'use client';

import { useState } from 'react';
import { getLogEntriesAction } from '@/app/log-actions';
import { ReportView } from '@/components/analytics/report/ReportView';
import { LogDetailsDialog } from '@/components/log/LogDetailsDialog';
import { Button } from '@/components/ui/Button';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { DateRangeFields } from '@/components/ui/DateRangeFields';
import { SearchField } from '@/components/ui/SearchField';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { NAV_AREAS } from '@/config/navigation';
import { useReportTable } from '@/hooks/useReportTable';
import { menuPages } from '@/lib/auth/permissions';
import { defaultReportPeriod } from '@/lib/dateUtils';
import type { ExcelColumn } from '@/lib/excel';
import { EMPTY_VALUE, formatDbDateTime } from '@/lib/format';
import type { LogEntryRow } from '@/lib/log/entries';
import { APP_COPY } from '@/locales';

interface Filters {
    person: string;
    text: string;
    dateFrom: string;
    dateTo: string;
}

const copy = APP_COPY.log;

const initialFilters = (): Filters => ({ person: '', text: '', ...defaultReportPeriod() });

const toQuery = (f: Filters) => ({
    person: f.person || undefined,
    text: f.text || undefined,
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
});

/** The log names a page by its id: shown with the page's name in the menu */
const PAGE_LABELS = new Map(menuPages(NAV_AREAS).map((page) => [page.id, page.label]));
const OTHER_AREAS: Record<string, string> = copy.areas;
const areaLabel = (area: string) => PAGE_LABELS.get(area) ?? OTHER_AREAS[area] ?? area;

const OUTCOME_TONES: Record<string, StatusTone> = { ok: 'success', error: 'danger', refused: 'warning' };
const OUTCOME_LABELS: Record<string, string> = copy.outcomes;
const outcomeLabel = (outcome: string) => OUTCOME_LABELS[outcome] ?? outcome;

const entityText = (row: LogEntryRow) => [row.entity_kind, row.entity_id].filter(Boolean).join(' ') || EMPTY_VALUE;

const excelColumns: ExcelColumn<LogEntryRow>[] = [
    { header: copy.columns.when, value: (row) => formatDbDateTime(row.logged_at), width: 20 },
    { header: copy.columns.person, value: (row) => row.person_name, width: 22 },
    { header: copy.columns.area, value: (row) => areaLabel(row.area), width: 24 },
    { header: copy.columns.action, value: (row) => row.action, width: 16 },
    { header: copy.columns.entity, value: (row) => entityText(row), width: 22 },
    { header: copy.columns.summary, value: (row) => row.summary, width: 70 },
    { header: copy.columns.outcome, value: (row) => outcomeLabel(row.outcome) + (row.error ? `: ${row.error}` : ''), width: 30 },
];

/**
 * Registro: everything done in the app, newest first — the app's own log together with the Agenda's and the
 * timesheet's. Loads on "Applica"; "Vedi" opens an entry's full record (rows changed, values before and after).
 */
export function LogViewer() {
    const [opened, setOpened] = useState<LogEntryRow | null>(null);
    const report = useReportTable<Filters, LogEntryRow>({
        initialFilters,
        defaultSort: null,
        fetchPage: ({ filters, page, limit }) => getLogEntriesAction(page, limit, toQuery(filters)),
    });
    const { filters, updateFilters } = report;

    // The list is always newest first: no column sorts
    const columns: DataTableColumn<LogEntryRow>[] = [
        { key: 'when', header: copy.columns.when, sortable: false, className: 'w-40', cell: (row) => <span className="font-mono text-fg-soft">{formatDbDateTime(row.logged_at)}</span> },
        { key: 'person', header: copy.columns.person, sortable: false, cell: (row) => <span className="font-semibold text-fg">{row.person_name}</span> },
        { key: 'area', header: copy.columns.area, sortable: false, cell: (row) => areaLabel(row.area) },
        { key: 'action', header: copy.columns.action, sortable: false, cell: (row) => row.action },
        { key: 'entity', header: copy.columns.entity, sortable: false, mobileHidden: true, cell: (row) => entityText(row) },
        {
            key: 'summary',
            header: copy.columns.summary,
            sortable: false,
            cell: (row) => (
                <span className="block leading-tight">
                    {row.summary}
                    {row.error && <span className="block text-2xs text-danger-400">{row.error}</span>}
                </span>
            ),
        },
        {
            key: 'outcome',
            header: copy.columns.outcome,
            sortable: false,
            cell: (row) => <StatusBadge tone={OUTCOME_TONES[row.outcome] ?? 'neutral'}>{outcomeLabel(row.outcome)}</StatusBadge>,
        },
        {
            key: 'details',
            header: copy.columns.details,
            sortable: false,
            compact: true,
            cell: (row) =>
                row.has_details ? (
                    <Button variant="secondary" size="sm" onClick={() => setOpened(row)}>
                        {copy.showDetails}
                    </Button>
                ) : null,
        },
    ];

    return (
        <ReportView
            report={report}
            columns={columns}
            getRowKey={(row) => `${row.source}-${row.id}`}
            filterColumns={4}
            filters={
                <>
                    <DateRangeFields dateFrom={filters.dateFrom} dateTo={filters.dateTo} onChange={updateFilters} />
                    <SearchField label={copy.filters.person} value={filters.person} onChange={(person) => updateFilters({ person })} />
                    <SearchField label={copy.filters.text} value={filters.text} onChange={(text) => updateFilters({ text })} />
                </>
            }
            excel={{ columns: excelColumns, name: APP_COPY.admin.pages.log.label, fileParts: (f) => [f.dateFrom, f.dateTo] }}
        >
            {opened && <LogDetailsDialog entry={opened} onClose={() => setOpened(null)} />}
        </ReportView>
    );
}
