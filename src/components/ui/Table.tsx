import * as React from "react"

import { cn } from "@/lib/utils"

// Table building blocks: the one place where table spacing, lines and header style are defined.
// For data lists with sorting, paging and loading states use DataTable, which is built on these.

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
    /** Classes of the scrolling box around the table (e.g. a height, so it scrolls inside with its header in view) */
    containerClassName?: string;
}

/** The lower header and cells of a table read inside something else (the movements of a bank account under its row) */
export const DENSE_HEAD = 'px-2.5 py-2';
export const DENSE_CELL = 'px-2.5 py-1.5';

/** The tint of a row that needs a look: a fact that differs from its truth, a phase out of line (`getRowClassName` of DataTable) */
export const ROW_WARNING = 'bg-warning-500/5 hover:bg-warning-500/10';
/** The mark of one value that differs, inside a cell */
export const VALUE_WARNING = 'text-warning-300 bg-warning-500/15 rounded px-1 -mx-1';
/** A value one presses, in a cell: to change it in place, to see what it is made of */
export const VALUE_PRESSABLE = 'cursor-pointer rounded transition-colors hover:bg-muted';
/** A row one presses: it opens what it is about, or unfolds the rows under it */
export const ROW_PRESSABLE = 'cursor-pointer';
/** The tint of a row that stands for several: a total, what was added to it, an area over its pages */
export const ROW_SUMMARY = 'bg-muted/40';

const Table = React.forwardRef<HTMLTableElement, TableProps>(({ className, containerClassName, ...props }, ref) => (
    <div className={cn("relative w-full overflow-x-auto", containerClassName)}>
        <table
            ref={ref}
            className={cn("w-full text-sm", className)}
            {...props}
        />
    </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
    HTMLTableSectionElement,
    React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
    // Sticks to the top of a scrolling table box; the line under it is drawn by each cell (shadow-divider)
    <thead ref={ref} className={cn("sticky top-0 z-sticky bg-card", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
    HTMLTableSectionElement,
    React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("divide-y divide-border", className)} {...props} />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
    HTMLTableSectionElement,
    React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
    // Sticks to the bottom of a scrolling table box, so the totals stay in view
    <tfoot
        ref={ref}
        className={cn("sticky bottom-0 z-sticky bg-card font-medium [&_td]:shadow-divider-top", className)}
        {...props}
    />
))
TableFooter.displayName = "TableFooter"

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
    /** A row that does not light up under the mouse: a header row, a total, a row that only holds something else */
    still?: boolean;
}

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(({ className, still = false, ...props }, ref) => (
    <tr
        ref={ref}
        className={cn("transition-colors", !still && "hover:bg-muted/40", className)}
        {...props}
    />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
    HTMLTableCellElement,
    React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
    <th
        ref={ref}
        className={cn("px-4 py-3 text-left align-middle text-xs font-semibold text-fg-muted shadow-divider", className)}
        {...props}
    />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
    HTMLTableCellElement,
    React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
    <td
        ref={ref}
        className={cn("px-4 py-3 align-middle", className)}
        {...props}
    />
))
TableCell.displayName = "TableCell"

export {
    Table,
    TableHeader,
    TableBody,
    TableFooter,
    TableHead,
    TableRow,
    TableCell,
}
