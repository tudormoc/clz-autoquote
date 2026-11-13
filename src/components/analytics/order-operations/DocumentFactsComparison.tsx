import { useMemo } from 'react';
import { AlignmentCell } from '@/components/ui/AlignmentCell';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { compareFacts, placeDiffers, placeName, type FactComparisonRow, type FactRules } from '@/lib/orders/documentFacts';
import { cn } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';
import type { DocumentFactRow, DocumentFacts, DocumentPlace, DocumentSide } from '@/types';
import { ROW_WARNING } from '@/components/ui/Table';

const t = APP_COPY.analytics.orderOperations;

interface FactCellProps<V> {
    /** The fact in one document; none = the document was not found */
    side?: DocumentSide<V>;
    /** The impegno's value, the truth */
    reference?: V;
    rules: FactRules<V>;
    format: (value: V) => string;
    mono: boolean;
    missingText: string;
}

/** What follows a place's name: its values when they differ from the impegno, "×n" when several records hold one */
function placeDetail<V>(place: DocumentPlace<V>, differs: boolean, format: (value: V) => string) {
    return place.values
        .map((item) => [differs ? format(item.value) : '', item.rows > 1 ? fmt(t.factRows, { n: item.rows }) : ''].filter(Boolean).join(' '))
        .filter(Boolean)
        .join(' · ');
}

/** The document row's value, then every place of the document that holds the fact, amber where it differs from the impegno */
function FactCell<V>({ side, reference, rules, format, mono, missingText }: FactCellProps<V>) {
    if (!side) return <span className="text-warning-300 font-semibold">{missingText}</span>;
    if (side.value === undefined && side.places.length === 0) return <span className="text-fg-faint">{t.factNotPresent}</span>;
    const differs = (place: DocumentPlace<V>) => reference !== undefined && placeDiffers(place, reference, rules);
    // The first place is the document row's own column: the value shown big is amber when that place differs
    const mainDiffers = side.places.length > 0 && differs(side.places[0]);
    return (
        <div className="leading-tight min-w-0">
            <p className={cn('font-semibold truncate', mono && 'font-mono', mainDiffers ? 'text-warning-300' : 'text-fg')} title={side.value === undefined ? undefined : format(side.value)}>
                {side.value === undefined ? '' : format(side.value)}
            </p>
            {side.places.map((place) => {
                const odd = differs(place);
                const detail = placeDetail(place, odd, format);
                return (
                    <p key={placeName(place)} className={cn('text-2xs font-mono truncate', odd ? 'text-warning-300' : 'text-fg-muted')} title={detail || undefined}>
                        {placeName(place)}
                        {detail && <span className="ml-1">{detail}</span>}
                    </p>
                );
            })}
        </div>
    );
}

interface DocumentFactsComparisonProps<K extends string, V> {
    facts?: DocumentFacts<DocumentFactRow<K, V>>;
    rules: FactRules<V>;
    /** Name of each fact, shown in the first column */
    names: Record<K, string>;
    /** Header of the first column */
    factColumn: string;
    format: (value: V) => string;
    /** Numbers are monospaced */
    mono?: boolean;
    businessOrderNumber?: number;
}

/**
 * Table comparing each fact of the impegno cliente (the truth) with the Business order and the NetPro order, laid out like
 * the phases and the materials: the Quantità tab (numbers) and the Articolo tab (text) are this one table with their own rules.
 */
export function DocumentFactsComparison<K extends string, V>({ facts, rules, names, factColumn, format, mono = false, businessOrderNumber }: DocumentFactsComparisonProps<K, V>) {
    const rows = useMemo(() => compareFacts(facts?.rows ?? [], rules), [facts, rules]);
    const impegnoHeader = facts?.impegnoRef ? fmt(t.impegnoRef, { num: facts.impegnoRef }) : t.impegnoColumn;
    /** The cell of one document column */
    function cell(side: (row: FactComparisonRow<K, V>) => DocumentSide<V> | undefined, missingText: string) {
        return function SideCell(row: FactComparisonRow<K, V>) {
            return <FactCell side={side(row)} reference={row.impegno?.value} rules={rules} format={format} mono={mono} missingText={missingText} />;
        };
    }

    const columns: DataTableColumn<FactComparisonRow<K, V>>[] = [
        { key: 'name', header: factColumn, className: 'w-44', cellClassName: 'align-top', cell: (row) => <span className="font-semibold text-fg">{names[row.key]}</span> },
        { key: 'impegno', header: <span className="text-highlight-300">{impegnoHeader}</span>, cellClassName: 'align-top', cell: cell((row) => row.impegno, t.factNoImpegno) },
        {
            key: 'business',
            header: <span className="text-warning-200">{fmt(t.businessOrderNum, { num: businessOrderNumber || '-' })}</span>,
            cellClassName: 'align-top',
            cell: cell((row) => row.bus, t.factBusMissing),
        },
        { key: 'netpro', header: <span className="text-info-300">{t.netproOrder}</span>, cellClassName: 'align-top', cell: cell((row) => row.net, t.factNetMissing) },
        { key: 'issues', header: t.alignedStatus, className: 'w-56', cellClassName: 'align-top', cell: (row) => <AlignmentCell issues={row.issues} /> },
    ];

    return (
        <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.key}
            getRowClassName={(row) => (row.issues.length ? ROW_WARNING : undefined)}
            emptyMessage={t.factEmpty}
        />
    );
}
