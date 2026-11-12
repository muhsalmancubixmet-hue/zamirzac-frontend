import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Eye, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCan } from "@/lib/access";
import { Lock } from "lucide-react";
import { EmptyState, Panel, TableLoading } from "@/components/erp/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export type Column<T> = {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  className?: string;
  sort?: (r: T) => string | number;
  render: (r: T) => ReactNode;
};

export type Filter<T> = { label: string; get: (r: T) => string; options?: string[] };

export interface ServerSidePagination {
  totalCount: number;
  page: number; // 0-indexed page number from parent state
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newPageSize: number) => void;
  onSearchChange?: (query: string) => void;
  onFilterChange?: (filterValues: Record<string, string>) => void;
  onDateChange?: (range: { from: string; to: string }) => void;
  onSortChange?: (sort: { key: string; dir: 1 | -1 } | null) => void;
  loading?: boolean;
}

export function DataTable<T>({
  rows: initialRows,
  columns,
  getId,
  search = () => "",
  searchPlaceholder = "Search",
  filters = [],
  entity = "record",
  createLabel,
  form,
  detail,
  removeLabel = "Delete",
  pageSize = 8,
  toolbar,
  footer,
  extraActions = [],
  onRowClick,
  date,
  onSave,
  onDelete,
  serverSide,
}: {
  rows: T[];
  columns: Column<T>[];
  getId: (r: T) => string;
  search?: (r: T) => string;
  searchPlaceholder?: string;
  filters?: Filter<T>[];
  entity?: string;
  createLabel?: string | undefined;
  form?: (r: T | null) => ReactNode;
  detail?: (r: T) => ReactNode;
  removeLabel?: "Delete" | "Void" | "Cancel" | null;
  pageSize?: number;
  toolbar?: ReactNode;
  footer?: (rows: T[]) => ReactNode;
  extraActions?: { label: string; icon?: ReactNode; onClick: (r: T) => void; show?: (r: T) => boolean; className?: string | undefined }[];
  onRowClick?: (r: T) => void;
  /** ISO date (yyyy-mm-dd) accessor — enables the from/to date filter. */
  date?: (r: T) => string;
  /** Callback when the dialog form is saved */
  onSave?: (data: Record<string, any>, item: T | null) => Promise<boolean | void> | void;
  /** Callback when a record is deleted or voided */
  onDelete?: (item: T) => Promise<boolean | void> | void;
  /** Optional server-side pagination and query interface */
  serverSide?: ServerSidePagination | undefined;
}) {
  const canCreate = useCan("Create"), canEdit = useCan("Edit"), canDelete = useCan("Delete");
  const isServerSide = !!serverSide;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState(initialRows);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [fv, setFv] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  const [viewing, setViewing] = useState<T | null>(null);
  const [editing, setEditing] = useState<T | null | "new">(null);
  const [removing, setRemoving] = useState<T | null>(null);

  const isFirstMount = useRef(true);
  useEffect(() => {
    if (!isServerSide || !serverSide?.onSearchChange) return;
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    const handler = setTimeout(() => {
      serverSide.onSearchChange!(q);
      serverSide.onPageChange(0);
    }, 300);
    return () => clearTimeout(handler);
  }, [q, isServerSide]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => setRows(initialRows), [initialRows]);

  const isLoading = serverSide?.loading !== undefined ? serverSide.loading : loading;

  const filtered = useMemo(() => {
    if (isServerSide) {
      return rows;
    }
    let out = rows.filter((r) => search(r).toLowerCase().includes(q.toLowerCase()));
    filters.forEach((f) => {
      const v = fv[f.label];
      if (v && v !== "all") out = out.filter((r) => f.get(r) === v);
    });
    if (date && from) out = out.filter((r) => date(r) >= from);
    if (date && to) out = out.filter((r) => date(r) <= to);
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sort) {
        const s = col.sort;
        out = [...out].sort((a, b) => (s(a) > s(b) ? 1 : s(a) < s(b) ? -1 : 0) * sort.dir);
      }
    }
    return out;
  }, [isServerSide, rows, q, fv, sort, columns, filters, search, date, from, to]);

  const activePageSize = isServerSide ? serverSide.pageSize : pageSize;
  const totalCount = isServerSide ? serverSide.totalCount : filtered.length;
  const pages = Math.max(1, Math.ceil(totalCount / activePageSize));
  const current = isServerSide ? Math.max(0, Math.min(serverSide.page, pages - 1)) : Math.min(page, pages - 1);
  const visible = isServerSide ? rows : filtered.slice(current * activePageSize, current * activePageSize + activePageSize);
  const hasActions = !!(detail || form || removeLabel || extraActions.length);
  const actionsFor = (r: T) => (
    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" aria-label="Row actions"><MoreHorizontal className="size-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {detail ? <DropdownMenuItem onClick={() => setViewing(r)}><Eye className="size-4" /> View details</DropdownMenuItem> : null}
                          {form && canEdit ? <DropdownMenuItem onClick={() => setEditing(r)}><Pencil className="size-4" /> Edit</DropdownMenuItem> : null}
                          {extraActions.filter((a) => !a.show || a.show(r)).map((a) => (
                            <DropdownMenuItem key={a.label} onClick={() => a.onClick(r)}>{a.icon}{a.label}</DropdownMenuItem>
                          ))}
                          {removeLabel && canDelete ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setRemoving(r)}>
                                <Trash2 className="size-4" /> {removeLabel}
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
  );
  const align = (a?: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");

  return (
    <Panel bodyClassName="p-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (!isServerSide) {
                setPage(0);
              }
            }}
            placeholder={searchPlaceholder}
            className="h-9 pl-8"
          />
        </div>
        {filters.map((f) => {
          const opts = f.options ?? Array.from(new Set(rows.map(f.get))).sort();
          return (
            <Select
              key={f.label}
              value={fv[f.label] ?? "all"}
              onValueChange={(v) => {
                const nextFv = { ...fv, [f.label]: v };
                setFv(nextFv);
                if (isServerSide) {
                  serverSide.onFilterChange?.(nextFv);
                  serverSide.onPageChange(0);
                } else {
                  setPage(0);
                }
              }}
            >
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {f.label.toLowerCase()}</SelectItem>
                {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          );
        })}
        {date ? (
          <>
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                const newFrom = e.target.value;
                setFrom(newFrom);
                if (isServerSide) {
                  serverSide.onDateChange?.({ from: newFrom, to });
                  serverSide.onPageChange(0);
                } else {
                  setPage(0);
                }
              }}
              className="h-9 w-36"
              aria-label="From date"
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                const newTo = e.target.value;
                setTo(newTo);
                if (isServerSide) {
                  serverSide.onDateChange?.({ from, to: newTo });
                  serverSide.onPageChange(0);
                } else {
                  setPage(0);
                }
              }}
              className="h-9 w-36"
              aria-label="To date"
            />
          </>
        ) : null}
        {toolbar}
        {createLabel && form ? (
          canCreate ? <Button size="sm" onClick={() => setEditing("new")}><Plus className="size-4" /> {createLabel}</Button>
          : <Button size="sm" variant="outline" disabled title="Your role does not have Create permission"><Lock className="size-4" /> {createLabel}</Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="p-4"><TableLoading rows={6} /></div>
      ) : (isServerSide ? totalCount === 0 : filtered.length === 0) ? (
        <div className="p-5">
          <EmptyState
            title={`No ${entity}s found`}
            description={q || Object.values(fv).some((v) => v && v !== "all") ? "Try a different search term or clear the filters." : `There are no ${entity}s yet.`}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQ("");
                  setFv({});
                  setFrom("");
                  setTo("");
                  if (isServerSide) {
                    serverSide.onSearchChange?.("");
                    serverSide.onFilterChange?.({});
                    serverSide.onDateChange?.({ from: "", to: "" });
                    serverSide.onPageChange(0);
                  } else {
                    setPage(0);
                  }
                }}
              >
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <>
        <ul className="divide-y divide-border md:hidden">
          {visible.map((r) => (
            <li key={getId(r)} className={cn("flex gap-3 p-4", onRowClick && "cursor-pointer")} onClick={onRowClick ? (e) => { if (!(e.target as HTMLElement).closest("button,a,[role=menuitem]")) onRowClick(r); } : undefined}>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="text-sm font-medium">{columns[0]?.render(r)}</div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  {columns.slice(1).map((c) => (
                    <div key={c.key} className="min-w-0">
                      <dt className="text-muted-foreground">{c.header}</dt>
                      <dd className="truncate text-foreground">{c.render(r)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              {hasActions ? <div className="shrink-0">{actionsFor(r)}</div> : null}
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => {
                  const isSortable = isServerSide ? Boolean(serverSide.onSortChange) : Boolean(c.sort);
                  return (
                    <TableHead key={c.key} className={cn(align(c.align), "whitespace-nowrap", c.className)}>
                      {isSortable ? (
                        <button
                          className={cn("inline-flex items-center gap-1 hover:text-foreground", c.align === "right" && "flex-row-reverse")}
                          onClick={() => {
                            const nextSort = sort?.key === c.key ? (sort.dir === 1 ? { key: c.key, dir: -1 as const } : null) : { key: c.key, dir: 1 as const };
                            setSort(nextSort);
                            if (isServerSide) {
                              serverSide.onSortChange?.(nextSort);
                              serverSide.onPageChange(0);
                            }
                          }}
                        >
                          {c.header}
                          {sort?.key === c.key ? (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
                        </button>
                      ) : c.header}
                    </TableHead>
                  );
                })}
                {hasActions ? <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={getId(r)} className={onRowClick ? "cursor-pointer" : undefined} onClick={onRowClick ? (e) => { if (!(e.target as HTMLElement).closest("button,a,[role=menuitem]")) onRowClick(r); } : undefined}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className={cn(align(c.align), c.align === "right" && "tabular", "whitespace-nowrap", c.className)}>
                      {c.render(r)}
                    </TableCell>
                  ))}
                  {hasActions ? <TableCell>{actionsFor(r)}</TableCell> : null}
                </TableRow>
              ))}
            </TableBody>
            {footer ? footer(filtered) : null}
          </Table>
        </div>
        </>
      )}

      {!isLoading && (isServerSide ? totalCount > 0 : filtered.length > 0) ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="tabular">
              Showing {totalCount === 0 ? 0 : current * activePageSize + 1}–{Math.min(totalCount, (current + 1) * activePageSize)} of {totalCount}
            </span>
            {isServerSide && serverSide.onPageSizeChange ? (
              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <Select
                  value={String(activePageSize)}
                  onValueChange={(val) => {
                    const size = Number(val);
                    serverSide.onPageSizeChange!(size);
                    serverSide.onPageChange(0);
                  }}
                >
                  <SelectTrigger className="h-7 w-16 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((s) => (
                      <SelectItem key={s} value={String(s)} className="text-xs">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled={current === 0 || isLoading}
              onClick={() => {
                if (isServerSide) {
                  serverSide.onPageChange(current - 1);
                } else {
                  setPage(current - 1);
                }
              }}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-2 tabular">Page {current + 1} / {pages}</span>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled={current >= pages - 1 || isLoading}
              onClick={() => {
                if (isServerSide) {
                  serverSide.onPageChange(current + 1);
                } else {
                  setPage(current + 1);
                }
              }}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[90vh] w-full max-w-lg sm:max-w-xl overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="capitalize">{entity} details</DialogTitle>
            <DialogDescription>{viewing ? getId(viewing) : ""}</DialogDescription>
          </DialogHeader>
          {viewing && detail ? detail(viewing) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] w-full max-w-xl sm:max-w-2xl overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="capitalize">{editing === "new" ? `New ${entity}` : `Edit ${entity}`}</DialogTitle>
            <DialogDescription>Fields marked * are required.</DialogDescription>
          </DialogHeader>
          <form
            noValidate
            className="grid gap-4 min-w-0"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget;
              const invalid = f.querySelector<HTMLInputElement>(":invalid");
              if (invalid) {
                f.querySelectorAll("input,textarea").forEach((el) => el.setAttribute("aria-invalid", String(!(el as HTMLInputElement).checkValidity())));
                invalid.focus();
                toast.error("Please fill in the required fields");
                return;
              }
              const fd = new FormData(f);
              const data: Record<string, any> = {};
              fd.forEach((val, key) => { data[key] = val; });
              if (onSave) {
                try {
                  const res = await onSave(data, editing === "new" ? null : editing);
                  if (res === false) return;
                } catch (err: any) {
                  toast.error(err?.message || "Failed to save record");
                  return;
                }
              } else {
                toast.success(editing === "new" ? `New ${entity} created` : `${entity} updated`);
              }
              setEditing(null);
            }}
          >
            {editing !== null && form ? form(editing === "new" ? null : editing) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit">{editing === "new" ? "Create" : "Save changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{removeLabel} {removing ? getId(removing) : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeLabel === "Void" ? "The entry will be marked void and reversed in all ledgers." : "This permanently removes the record."} This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (removing) {
                  const id = getId(removing);
                  if (onDelete) {
                    try {
                      const res = await onDelete(removing);
                      if (res === false) return;
                    } catch (err: any) {
                      toast.error(err?.message || `Failed to ${removeLabel?.toLowerCase() || "delete"} record`);
                      return;
                    }
                  }
                  setRows((rs) => rs.filter((x) => getId(x) !== id));
                  toast.success(`${id} ${removeLabel === "Void" ? "voided" : "deleted"}`);
                }
                setRemoving(null);
              }}
            >
              {removeLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}

export function DetailGrid({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="font-medium text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Declarative form fields. The first field is required unless `required: false`; set `required` on others as needed. */
export function FormGrid({ fields }: { fields: { label: string; value?: string | number | undefined; type?: string; wide?: boolean; options?: string[]; required?: boolean; readOnly?: boolean; disabled?: boolean }[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map((f, i) => {
        const req = f.required ?? (i === 0 && !f.options && !f.readOnly && !f.disabled);
        return (
          <label key={f.label} className={cn("grid min-w-0 gap-1.5 text-sm", f.wide && "sm:col-span-2")}>
            <span className="text-xs font-medium text-foreground/80">
              {f.label}
              {req ? <span className="ml-0.5 text-destructive" aria-hidden>*</span> : null}
            </span>
            {f.options ? (
              <Select name={f.label} defaultValue={f.value ? String(f.value) : (f.options[0] ?? "")} disabled={f.disabled ?? false}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Input name={f.label} type={f.type ?? "text"} defaultValue={f.value} required={req} aria-required={req} readOnly={f.readOnly} disabled={f.disabled} className="h-9" />
            )}
          </label>
        );
      })}
    </div>
  );
}
