import * as React from "react"

import { cn } from "@/lib/utils"

// Table building blocks: the one place where table spacing, lines and header style are defined.
// For data lists with sorting, paging and loading states use DataTable, which is built on these.

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
    /** Classes of the scrolling box around the table (e.g. a height, so it scrolls inside with its header in view) */
    containerClassName?: string;
}

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
    <thead ref={ref} className={cn("sticky top-0 z-10 bg-card", className)} {...props} />
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
        className={cn("sticky bottom-0 z-10 bg-card font-medium [&_td]:shadow-divider-top", className)}
        {...props}
    />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
    HTMLTableRowElement,
    React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
    <tr
        ref={ref}
        className={cn("transition-colors hover:bg-muted/40", className)}
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
