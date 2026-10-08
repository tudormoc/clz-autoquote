import { CoverageBadge } from '@/components/presence/CoverageBadge';
import { EditableHoursCell } from '@/components/presence/EditableHoursCell';
import { PresetSelectCell } from '@/components/presence/PresetSelectCell';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { MissingValue } from '@/components/ui/TableCells';
import { getCoveredHours, type PresenceRulesConfig } from '@/lib/presence';
import { formatDate } from '@/lib/format';
import type { RowSortColumns } from '@/lib/sort';
import { APP_COPY, fmt } from '@/locales';
import type { HoursDistributionField, OperatorHoursRow } from '@/types';

const copy = APP_COPY.analytics.monthlySummary;

type SaveHours = (row: OperatorHoursRow, field: HoursDistributionField, value: number | string | null) => Promise<boolean>;

/** Sortable columns of the monthly hours table; the coverage check sorts on the covered hours */
export function monthlyHoursSortColumns(rules: PresenceRulesConfig): RowSortColumns<OperatorHoursRow> {
    const field = (key: keyof OperatorHoursRow) => (row: OperatorHoursRow) => row[key] as string | number | null;
    return {
        ...Object.fromEntries(
            (
                ['operatore', 'matricola', 'nome', 'turno', 'data', 'ora_inizio', 'ora_fine', 'ore_ferie', 'causale_ferie', 'ore_permesso',
                    'causale_permesso', 'ore_malattia', 'ore_ordinarie', 'ore_totali', 'ore_straordinarie', 'banca_ore'] as const
            ).map((key) => [key, field(key)])
        ),
        controllo_8h: (row) => getCoveredHours(row, rules),
    };
}

/** Title of a row's phone card: operator name and code, the day on the right */
export function monthlyHoursCardTitle(row: OperatorHoursRow) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
                <span className="font-medium text-fg-strong">{row.nome || row.operatore}</span>{' '}
                <span className="font-mono text-xs text-fg-muted">{row.operatore}</span>
            </span>
            <span className="shrink-0 font-mono text-fg-secondary">{formatDate(row.data)}</span>
        </div>
    );
}

/** Rows with the same value stay in name order */
export const byOperatorName = (a: OperatorHoursRow, b: OperatorHoursRow) =>
    String(a.nome || a.operatore).localeCompare(String(b.nome || b.operatore), undefined, { sensitivity: 'base' });

/** Columns of the monthly hours table; hours and causali are edited in place through `onSave` */
export function monthlyHoursColumns({
    rules,
    todayStr,
    onSave,
}: {
    rules: PresenceRulesConfig;
    todayStr: string;
    onSave: SaveHours;
}): DataTableColumn<OperatorHoursRow>[] {
    const pauseLabel = rules.pauseMinutes % 60 === 0 ? `${rules.pauseMinutes / 60}h` : `${rules.pauseMinutes}min`;
    const text = 'font-mono text-fg-secondary';

    const hours = (key: HoursDistributionField & keyof OperatorHoursRow, header: string, className?: string): DataTableColumn<OperatorHoursRow> => ({
        key,
        header,
        align: 'right',
        className,
        cellClassName: 'py-2',
        cell: (row) => <EditableHoursCell value={row[key] as number | string | null} onSave={(value) => onSave(row, key, value)} />,
    });

    const causale = (key: 'causale_ferie' | 'causale_permesso', header: string, presets: string[], className: string): DataTableColumn<OperatorHoursRow> => ({
        key,
        header,
        align: 'center',
        className,
        cellClassName: 'py-2',
        cell: (row) => <PresetSelectCell value={row[key]} presets={presets} onSave={(value) => onSave(row, key, value)} />,
    });

    // Not available yet: left out of the phone cards
    const placeholder = (key: string, header: string): DataTableColumn<OperatorHoursRow> => ({
        key,
        header: <span className="font-normal text-fg-subtle">{header}</span>,
        align: 'right',
        sortable: false,
        className: 'w-36',
        mobileHidden: true,
        cell: () => <MissingValue />,
    });

    // Operator and date make up the title of a phone card (monthlyHoursCardTitle), so their columns stay off it
    return [
        { key: 'operatore', header: copy.headers.id, className: 'w-32', cellClassName: text, mobileHidden: true, cell: (row) => row.operatore },
        { key: 'matricola', header: copy.headers.codiceSarpNet, className: 'w-36', cellClassName: text, cell: (row) => row.matricola || <MissingValue /> },
        { key: 'nome', header: copy.headers.operator, className: 'min-w-56', cellClassName: 'text-fg-secondary font-medium', mobileHidden: true, cell: (row) => row.nome || <MissingValue /> },
        {
            key: 'turno',
            header: copy.headers.turno,
            className: 'w-24',
            cell: (row) => <StatusBadge tone={row.turno === 'TURNO2' ? 'info' : 'neutral'}>{row.turno}</StatusBadge>,
        },
        { key: 'data', header: copy.headers.date, className: 'w-28', cellClassName: text, mobileHidden: true, cell: (row) => row.data },
        { key: 'ora_inizio', header: copy.headers.firstEntry, className: 'w-32', cellClassName: text, cell: (row) => row.ora_inizio || <MissingValue /> },
        { key: 'ora_fine', header: copy.headers.lastExit, className: 'w-32', cellClassName: text, cell: (row) => row.ora_fine || <MissingValue /> },
        hours('ore_ferie', copy.headers.oreFerie, 'w-28'),
        causale('causale_ferie', copy.headers.causaleFerie, rules.feriePresets, 'min-w-32 w-36'),
        hours('ore_permesso', copy.headers.orePermesso, 'w-32'),
        causale('causale_permesso', copy.headers.causalePermesso, rules.permessoPresets, 'min-w-36 w-44'),
        hours('ore_malattia', copy.headers.oreMalattia, 'w-32'),
        hours('ore_ordinarie', copy.headers.oreOrdinarie, 'w-32'),
        {
            key: 'ore_totali',
            header: fmt(copy.headers.diffHours, { pause: pauseLabel }),
            variant: 'total',
            className: 'w-36',
            cellClassName: 'text-fg',
            cell: (row) => (row.ore_totali ?? 0).toFixed(1),
        },
        {
            key: 'controllo_8h',
            header: fmt(copy.headers.controllo8h, { h: rules.workdayHours }),
            align: 'right',
            className: 'w-32',
            cell: (row) => <CoverageBadge row={row} todayStr={todayStr} rules={rules} />,
        },
        hours('ore_straordinarie', copy.headers.oreStraordinarie, 'w-36'),
        hours('banca_ore', copy.headers.bancaOre, 'w-28'),
        placeholder('banca_ore_mese_n1', copy.headers.bancaOreMeseN1),
        placeholder('banca_ore_mese_n', copy.headers.bancaOreMeseN),
    ];
}
