/**
 * Report Ordini per Area: the hours of each order, worked and expected, in total and per area. Pure, and the ONE sum
 * of it: the summary on screen ("Mostra Riepilogo") and the PDF both use it, so they show the same hours for the same
 * order. The rule is the PDF's (owner, 2026-11-12):
 * - every area counts in the hours worked, also one without an expected speed (its expected hours are none, and add
 *   nothing to the order's);
 * - the expected hours of an area count once per order, however many rows (periods) the area has.
 */
import { calcExpectedHours } from '@/lib/expectedHours';

/** What the sum needs of a row of the report */
export interface OrderAreaHoursRow {
    commessa_display: string;
    order_description: string | null;
    client_name: string | null;
    area_name: string;
    work_time: number;
    qty_requested: number | null;
    fogli: number | null;
}

/** One area of an order */
export interface AreaHours {
    label: string;
    worked: number;
    /** Hours the area should take; null when the area has no expected speed (or the order lacks the measure) */
    expected: number | null;
}

/** One order: its hours worked and expected over all its areas, and each area */
export interface OrderHours {
    display: string;
    description: string;
    client: string;
    worked: number;
    expected: number;
    areas: AreaHours[];
}

/** The hours of every order of these rows, orders and areas in the order they first appear */
export function sumOrderHours(rows: readonly OrderAreaHoursRow[]): OrderHours[] {
    const orders = new Map<string, OrderHours>();
    for (const row of rows) {
        let order = orders.get(row.commessa_display);
        if (!order) {
            order = { display: row.commessa_display, description: row.order_description ?? '', client: row.client_name ?? '', worked: 0, expected: 0, areas: [] };
            orders.set(row.commessa_display, order);
        }
        let area = order.areas.find((each) => each.label === row.area_name);
        if (!area) {
            // Expected hours count once per order and area, even over several periods
            area = { label: row.area_name, worked: 0, expected: calcExpectedHours(row.area_name, row.qty_requested, row.fogli) };
            order.areas.push(area);
            order.expected += area.expected ?? 0;
        }
        area.worked += row.work_time;
        order.worked += row.work_time;
    }
    return Array.from(orders.values());
}
