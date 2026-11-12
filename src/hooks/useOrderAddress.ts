'use client';

import { useAddress } from '@/hooks/useAddress';
import { choiceParam, flagParam, listParam, textParam } from '@/lib/address';

/** The tabs of an open order */
const WORKSPACE_TABS = ['flow', 'materials', 'management'] as const;
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

/** The tabs of its DiBa comparison */
const MANAGEMENT_TABS = ['comparison', 'materials', 'quantity', 'article', 'diba', 'order'] as const;
export type ManagementTab = (typeof MANAGEMENT_TABS)[number];

const NO_KINDS: readonly string[] = [];

/**
 * What Avanzamento Lavori shows, in the address:
 *  q           the search applied (several matches: the list to choose from)
 *  misaligned  "Ordini da riallineare" in the place of a search
 *  kinds, sort the chips and the order of that list (`sort` belongs to useClientSort: here it is only taken back)
 *  order       the order open (the first characters of its commessa), over the list it was picked from
 *  tab, view   its tab, and the tab of its DiBa comparison
 *  edition     the edition compared (its commessa; none = the first)
 */
const VIEW = {
    q: textParam(),
    misaligned: flagParam(),
    kinds: listParam(NO_KINDS),
    sort: textParam(),
    order: textParam(),
    tab: choiceParam(WORKSPACE_TABS, 'flow'),
    view: choiceParam(MANAGEMENT_TABS, 'comparison'),
    edition: textParam(),
};

/** An order opens on its first tab and its first edition */
const ORDER_START = { tab: 'flow', view: 'comparison', edition: '' } as const;
/** The page with nothing searched, listed or open */
const BARE = { q: '', misaligned: false, kinds: NO_KINDS, sort: '', order: '', ...ORDER_START };

/** The address of Avanzamento Lavori: its values, and the links and steps between its views */
export function useOrderAddress() {
    const { values, set, link } = useAddress(VIEW);
    return {
        values,
        set,
        link,
        /**
         * The link that opens an order: its own address (what a new tab opens and "copy link" gives), while a plain click
         * opens it over the list on screen, so Back returns to the list
         */
        orderLink: (rootCommessaKey: string) => ({
            href: link({ ...BARE, order: rootCommessaKey }).href,
            onOpen: () => set({ order: rootCommessaKey, ...ORDER_START }),
        }),
        /** The link back to the list the open order was picked from */
        listLink: () => link({ order: '', ...ORDER_START }),
        /** The link to "Ordini da riallineare" */
        misalignedLink: () => link({ ...BARE, misaligned: true }),
        /** Shows the results of a search: a new history step ('' = the bare page) */
        search: (text: string) => set({ ...BARE, q: text }),
        /** An order a search found alone gets its own address, in the place of the search's step */
        showOnly: (rootCommessaKey: string) => set({ ...BARE, order: rootCommessaKey }, 'replace'),
    };
}
