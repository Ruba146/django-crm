import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/utils/cn";
import { Loading } from "./loading";
import { EmptyState } from "./empty-state";

/* ------------------------------------------------------------------ */
/* Low-level primitives (keep for max flexibility)                     */
/* ------------------------------------------------------------------ */

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
);
Table.displayName = "Table";

export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

export const TableFooter = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("border-t bg-muted/50 font-medium", className)}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

export const TableRow = forwardRef<
  HTMLTableRowElement,
  HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-border transition-colors hover:bg-muted/40 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

export const TableHead = forwardRef<
  HTMLTableCellElement,
  ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-3 text-start align-middle text-xs font-medium uppercase tracking-wide text-muted-foreground",
      className
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

export const TableCell = forwardRef<
  HTMLTableCellElement,
  TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("px-3 py-3 align-middle", className)}
    {...props}
  />
));
TableCell.displayName = "TableCell";

export const TableCaption = forwardRef<
  HTMLTableCaptionElement,
  HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

/* ------------------------------------------------------------------ */
/* Sortable head (used by DataTable)                                   */
/* ------------------------------------------------------------------ */

export interface SortConfig {
  columnId: string;
  direction: "asc" | "desc";
}

export interface SortableTableHeadProps {
  columnId: string;
  sortable?: boolean;
  sort?: SortConfig | null;
  onSortChange?: (columnId: string) => void;
  className?: string;
  children: ReactNode;
}

export function SortableTableHead({
  columnId,
  sortable,
  sort,
  onSortChange,
  className,
  children,
}: SortableTableHeadProps) {
  const isActive = sort?.columnId === columnId;
  const sortDirection = isActive ? (sort?.direction === "asc" ? "ascending" : "descending") : "none";

  return (
    <TableHead className={className} aria-sort={sortable ? sortDirection : undefined}>
      {sortable ? (
        <button
          type="button"
          onClick={() => onSortChange?.(columnId)}
          className="inline-flex items-center gap-1 font-medium uppercase tracking-wide hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          {children}
          <span className="inline-flex">
            {isActive && sort?.direction === "asc" ? (
              <ArrowUp className="size-3.5" />
            ) : isActive && sort?.direction === "desc" ? (
              <ArrowDown className="size-3.5" />
            ) : (
              <ArrowUpDown className="size-3.5 opacity-50" />
            )}
          </span>
        </button>
      ) : (
        children
      )}
    </TableHead>
  );
}

/* ------------------------------------------------------------------ */
/* High-level presentational DataTable                                 */
/* ------------------------------------------------------------------ */

export interface Column<T> {
  /** Unique id and default sort key. */
  id: string;
  /** Header label. */
  header: ReactNode;
  /** Render the cell for a row. */
  cell: (row: T) => ReactNode;
  /** Whether the column is sortable. */
  sortable?: boolean;
  /** Optional class for header cells. */
  headerClassName?: string;
  /** Optional class for body cells. */
  cellClassName?: string;
  /** Hide the column on small screens. */
  hideOnMobile?: boolean;
}

export interface TableEmptyState {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  /** Unique key accessor for rows. */
  rowKey: (row: T) => string | number;
  /** Loading overlay. */
  loading?: boolean;
  /** Empty-state config shown when `data` is empty. */
  emptyState?: TableEmptyState | null;
  /** Optional toolbar rendered above the table (e.g. search + actions). */
  toolbar?: ReactNode;
  /** Optional pagination footer rendered under the table. */
  footer?: ReactNode;
  /** Optional sort state (controlled externally via useTableSorting). */
  sort?: SortConfig | null;
  /** Called when a sortable column header is clicked. */
  onSortChange?: (columnId: string) => void;
  /** Optional row actions column. */
  actions?: (row: T) => ReactNode;
  /** Optional row click handler. */
  onRowClick?: (row: T) => void;
  className?: string;
}

/**
 * Generic, presentational data table.
 *
 * The component is intentionally dumb: it receives already-processed `data`
 * (sorting, filtering and pagination are owned by the calling module through
 * the provided hooks). It renders the columns, a loading overlay, an empty
 * state and an optional toolbar/footer. No business logic, no DB access, no
 * CRM-specific naming.
 */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading,
  emptyState,
  toolbar,
  footer,
  sort,
  onSortChange,
  actions,
  onRowClick,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn("space-y-3", className)}>
      {toolbar}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="relative w-full overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <SortableTableHead
                    key={column.id}
                    columnId={column.id}
                    sortable={column.sortable}
                    sort={sort}
                    onSortChange={onSortChange}
                    className={cn(
                      column.hideOnMobile && "hidden lg:table-cell",
                      column.headerClassName
                    )}
                  >
                    {column.header}
                  </SortableTableHead>
                ))}
                {actions && (
                  <TableHead className="w-[3.5rem] text-end">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? null : (
                data.map((row) => (
                  <TableRow
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={onRowClick ? "cursor-pointer" : undefined}
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column.id}
                        className={cn(
                          column.hideOnMobile && "hidden lg:table-cell",
                          column.cellClassName
                        )}
                      >
                        {column.cell(row)}
                      </TableCell>
                    ))}
                    {actions && (
                      <TableCell className="text-end">{actions(row)}</TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
              <Loading />
            </div>
          )}

          {/* Empty state */}
          {!loading && emptyState && data.length === 0 && (
            <div className="p-4">
              <EmptyState
                title={emptyState.title}
                description={emptyState.description}
                icon={emptyState.icon}
                action={emptyState.action}
              />
            </div>
          )}
        </div>
      </div>
      {footer}
    </div>
  );
}
