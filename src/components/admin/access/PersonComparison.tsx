import { AlignmentCell } from '@/components/ui/AlignmentCell';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { EMPTY_VALUE } from '@/lib/format';
import { FACT_PLACES, PLACES, PLACE_SYSTEM, distinctValues, factKeyOf, oddValues, placesWith, type Fact, type PlaceId } from '@/lib/persons/places';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.person;

/** Column colours by program, the same as the order comparison (NetPro, Business) */
const SYSTEM_TONE = { netpro: 'text-info-300', business: 'text-warning-200' } as const;

/** One line per distinct value of a differing fact: the value and where it is */
export const factIssues = (fact: Fact): string[] =>
    fact.differs ? distinctValues(fact).map((value) => fmt(copy.valueIn, { value, places: placesWith(fact, value).map((place) => copy.places[place]).join(', ') })) : [];

/** Header of a place: its name in the colour of its program, "sola lettura" where Allinea never writes */
const placeHeader = (place: PlaceId) => (
    <span className={SYSTEM_TONE[PLACE_SYSTEM[place]]}>
        {copy.places[place]}
        {place === 'mailbox' && <span className="block text-3xs font-normal text-fg-faint">{copy.readOnly}</span>}
    </span>
);

/**
 * The value of a fact in one place: amber when it is the odd one out, faint when the place is empty, "non collegato"
 * when the link is missing, nothing where the place does not carry the fact at all
 */
function placeCell(fact: Fact, place: PlaceId) {
    if (!FACT_PLACES[fact.key].includes(place)) return <span className="text-fg-faint">{EMPTY_VALUE}</span>;
    const item = fact.values.find((value) => value.place === place);
    if (!item) return <span className="text-fg-faint italic">{copy.notLinkedShort}</span>;
    if (!item.value) return <span className="text-fg-faint">{EMPTY_VALUE}</span>;
    const odd = fact.differs && oddValues(fact).has(factKeyOf[fact.key](item.value));
    return <span className={odd ? 'text-warning-300 font-semibold' : 'text-fg-soft'}>{item.value}</span>;
}

const COLUMNS: DataTableColumn<Fact>[] = [
    { key: 'fact', header: copy.factColumn, className: 'w-24', cell: (fact) => <span className="font-semibold text-fg">{copy.facts[fact.key]}</span> },
    ...PLACES.map((place): DataTableColumn<Fact> => ({ key: place, header: placeHeader(place), cellClassName: 'align-top', cell: (fact) => placeCell(fact, place) })),
    { key: 'issues', header: copy.alignedColumn, className: 'w-56', cellClassName: 'align-top whitespace-normal', cell: (fact) => <AlignmentCell issues={factIssues(fact)} /> },
];

/**
 * The facts of a person compared across the programs: one row per fact, one column per place, "Allineato" at the end.
 * Every value stays on one line; a wide table scrolls sideways inside its frame.
 */
export function PersonComparison({ facts }: { facts: Fact[] }) {
    return <DataTable columns={COLUMNS} rows={facts} getRowKey={(fact) => fact.key} getRowClassName={(fact) => (fact.differs ? 'bg-warning-500/5 hover:bg-warning-500/10' : undefined)} nowrap />;
}
