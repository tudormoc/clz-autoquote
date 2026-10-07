/** Helpers that turn the cashflow data into the rows of the monthly matrix (src/components/cashflow). */
import type { MonthlyAmounts, MonthlyFinancialItem } from '@/lib/cashflow/types';

export const MONTHS_IN_YEAR = 12;

/** One value per month (January first); null / undefined = no figure for that month */
export type MonthValues = (number | null | undefined)[];

/** Value of each month taken from the monthly breakdown (`missing` for a month that is not in it) */
export function monthValues(
    items: MonthlyFinancialItem[],
    pick: (item: MonthlyFinancialItem) => number | null | undefined,
    missing?: number | null
): MonthValues {
    return Array.from({ length: MONTHS_IN_YEAR }, (_, index) => {
        const item = items.find((candidate) => candidate.month === index + 1);
        return item ? pick(item) : missing;
    });
}

/** Values of an amounts-by-month record (keys 1–12), 0 for months without an amount */
export function amountValues(amounts: MonthlyAmounts): MonthValues {
    return Array.from({ length: MONTHS_IN_YEAR }, (_, index) => amounts[index + 1] || 0);
}

/** Opening balance of the first month that has bank data */
export const firstOpeningBalance = (items: MonthlyFinancialItem[]) => items.find((item) => item.hasBankData)?.openingBalance;

/** Closing balance of the last month that has one */
export const lastClosingBalance = (items: MonthlyFinancialItem[]) =>
    [...items].reverse().find((item) => item.hasBankData && item.closingBalance !== null)?.closingBalance;
