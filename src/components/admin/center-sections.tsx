import { AppLink } from "@/components/erp/AppLink";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api, getAccessToken, notificationsApi, PaginatedResponse } from "@/lib/api";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Bell, BellOff, Boxes, CheckCheck, CheckCircle2, FileText, IndianRupee, RefreshCw, Settings2, ShoppingCart, Trash2, UserRound, Workflow } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EmptyState, KpiCard } from "@/components/erp/primitives";
import { DetailGrid, DataTable } from "@/components/erp/DataTable";
import { SectionHeader } from "@/components/erp/ModuleLayout";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAudit, type AuditRow } from "@/data/audit";
import { type NotifCat, type Notif } from "@/data/admin";

export const notifIcon: Record<NotifCat, typeof Bell> = { System: Settings2, "Low stock": Boxes, Payment: IndianRupee, Approval: CheckCircle2, Quotation: FileText, Purchase: ShoppingCart, Employee: UserRound, Automation: Workflow };
const cats: ("All" | "Unread" | NotifCat)[] = ["All", "Unread", "System", "Low stock", "Payment", "Approval", "Quotation", "Purchase", "Employee", "Automation"];

// Shared session store backed by backend API
let store: Notif[] = [];
let hasFetched = false;
let isFetching = false;
const subs = new Set<() => void>();

export const notifStore = {
  get: () => store,
  set: (n: Notif[]) => { store = n; subs.forEach((f) => f()); },
  subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
};

export async function fetchNotifications(force: boolean = false) {
  if (isFetching || (!force && hasFetched) || !getAccessToken()) return;
  isFetching = true;
  try {
    const list = await notificationsApi.list();
    if (Array.isArray(list)) {
      hasFetched = true;
      notifStore.set(
        list.map((n) => ({
          id: n.id,
          cat: (n.cat || n.category || "System") as NotifCat,
          title: n.title,
          body: n.body,
          when: n.when || "Recently",
          read: n.read !== undefined ? n.read : (n.is_read || false),
          link: n.link || "/notifications",
        }))
      );
    }
  } catch (err) {
    console.debug("Notifications fetch deferred:", err);
  } finally {
    isFetching = false;
  }
}

export function useNotifications() {
  useEffect(() => {
    fetchNotifications();
  }, []);
  return useSyncExternalStore(notifStore.subscribe, notifStore.get, notifStore.get);
}

export function NotificationsPage() {
  const list = useNotifications();
  const [cat, setCat] = useState<(typeof cats)[number]>("All");
  const [clear, setClear] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchNotifications(true);
  }, []);

  const shown = list.filter((n) => cat === "All" || (cat === "Unread" ? !n.read : n.cat === cat));
  const unread = list.filter((n) => !n.read).length;

  const mark = async (id: string | number, read: boolean) => {
    notifStore.set(list.map((n) => (n.id === id ? { ...n, read } : n)));
    try {
      await notificationsApi.markRead(id, read);
    } catch {
      toast.error("Failed to update notification");
    }
  };

  const handleMarkAllRead = async () => {
    notifStore.set(list.map((n) => ({ ...n, read: true })));
    toast.success("All marked as read");
    try {
      await notificationsApi.markAllRead();
    } catch {
      toast.error("Failed to mark all as read");
    }
  };

  const handleDismiss = async (id: string | number) => {
    notifStore.set(list.filter((x) => x.id !== id));
    try {
      await notificationsApi.deleteNotification(id);
    } catch {
      toast.error("Failed to remove notification");
    }
  };

  const handleClearAll = async () => {
    notifStore.set([]);
    toast.success("Notifications cleared");
    try {
      await notificationsApi.clearAll();
    } catch {
      toast.error("Failed to clear notifications");
    }
  };

  const handleSyncAlerts = async () => {
    setSyncing(true);
    try {
      const res = await notificationsApi.syncAlerts();
      await fetchNotifications(true);
      toast.success(res.new_notifications > 0 ? `${res.new_notifications} new alert(s) found` : "All notifications are up to date");
    } catch {
      toast.error("Failed to sync system alerts");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="Notifications"
        description="Alerts from stock, payments, approvals, quotations, purchases, employees and automations."
        actions={
          <>
            <Button size="sm" variant="outline" disabled={syncing} onClick={handleSyncAlerts}>
              <RefreshCw className={cn("size-4", syncing && "animate-spin")} /> Check alerts
            </Button>
            <Button size="sm" variant="outline" disabled={!unread} onClick={handleMarkAllRead}>
              <CheckCheck className="size-4" /> Mark all read
            </Button>
            <Button size="sm" variant="outline" disabled={!list.length} onClick={() => setClear(true)}>
              <Trash2 className="size-4" /> Clear all
            </Button>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Unread" value={String(unread)} tone={unread ? "down" : undefined} hint="Need attention" />
        <KpiCard label="Low stock" value={String(list.filter((n) => n.cat === "Low stock").length)} hint="Items at or below minimum" />
        <KpiCard label="Approvals" value={String(list.filter((n) => n.cat === "Approval").length)} hint="Bills, production orders" />
        <KpiCard label="Payments" value={String(list.filter((n) => n.cat === "Payment").length)} hint="Received and overdue" />
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1">
        {cats.map((c) => {
          const n = c === "All" ? list.length : c === "Unread" ? unread : list.filter((x) => x.cat === c).length;
          return (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm",
                c === cat ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {c}
              <span className={cn("rounded px-1 text-[11px] tabular", c === cat ? "bg-primary-foreground/20" : "bg-muted")}>{n}</span>
            </button>
          );
        })}
      </div>
      {shown.length === 0 ? (
        <EmptyState
          title={list.length ? "Nothing here" : "You're all caught up"}
          description={list.length ? "No notifications in this category." : "New alerts will appear here."}
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
          {shown.map((n) => {
            const I = notifIcon[n.cat] || Bell;
            return (
              <li key={n.id} className={cn("flex items-start gap-3 px-4 py-3.5", !n.read && "bg-accent/5")}>
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
                    n.cat === "Low stock" || n.cat === "Payment" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary"
                  )}
                >
                  <I className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</p>
                    {!n.read ? <span className="size-2 rounded-full bg-accent" aria-label="Unread" /> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{n.cat} · {n.when}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="sm" variant="ghost" asChild>
                    <AppLink href={n.link} onClick={() => mark(n.id, true)}>Open</AppLink>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => mark(n.id, !n.read)}>
                    {n.read ? "Mark unread" : "Mark read"}
                  </Button>
                  <Button size="icon" variant="ghost" className="size-8" aria-label="Dismiss" onClick={() => handleDismiss(n.id)}>
                    <BellOff className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <AlertDialog open={clear} onOpenChange={setClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
            <AlertDialogDescription>This removes {list.length} notifications from your list. Underlying records are not affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll}>Clear all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <AlertTriangle className="size-3.5" /> Choose which alerts you receive in{" "}
        <Link to="/settings/$section" params={{ section: "notifications" }} className="text-accent hover:underline">
          notification settings
        </Link>.
      </p>
    </>
  );
}



export function ActivityLogPage() {
  const storeRows = useAudit();
  const [rows, setRows] = useState<AuditRow[]>(storeRows);
  const [totalCount, setTotalCount] = useState<number>(storeRows.length);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState<string | undefined>(undefined);
  const [selectedAction, setSelectedAction] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [isBackend, setIsBackend] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchActivity = (p: number, size: number, search: string, mod?: string, act?: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);

    const params: Record<string, any> = {
      page: p + 1,
      page_size: size,
    };
    if (search.trim()) params["search"] = search.trim();
    if (mod && mod !== "all") params["module"] = mod;
    if (act && act !== "all") params["action"] = act;

    api.get<PaginatedResponse<any>>("/activity/", params, { signal: controller.signal })
      .then((res) => {
        if (res && res.results) {
          setIsBackend(true);
          const apiAudits: AuditRow[] = res.results.map((a: any) => {
            const dt = new Date(a.timestamp);
            return {
              id: `AUD-${a.id}`,
              user: a.user_name || "System",
              action: a.action,
              module: a.module,
              record: a.record || "—",
              description: a.description || "",
              prev: a.previous_value || undefined,
              next: a.new_value || undefined,
              when: dt.toLocaleString(),
              iso: dt.toISOString().slice(0, 10),
              ip: a.ip_address || "—",
              device: a.device || "—",
            };
          });
          setRows(apiAudits);
          setTotalCount(typeof res.count === "number" ? res.count : apiAudits.length);
        }
      })
      .catch((err) => {
        if (err?.name === "AbortError" || controller.signal.aborted) return;
        // On backend error, keep local store rows
      })
      .finally(() => {
        if (abortControllerRef.current === controller) {
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    fetchActivity(page, pageSize, searchQuery, selectedModule, selectedAction);
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const change = (a: AuditRow) => a.prev || a.next ? <span className="flex flex-wrap items-center gap-1 text-xs">{a.prev ? <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive line-through decoration-destructive/40">{a.prev}</span> : null}{a.prev && a.next ? <span className="text-muted-foreground">→</span> : null}{a.next ? <span className="rounded bg-success/10 px-1.5 py-0.5 text-success">{a.next}</span> : null}</span> : <span className="text-xs text-muted-foreground">—</span>;
  return (
    <>
      <SectionHeader title="Audit log" description="Sign-ins, attendance, approvals, transactions, stock, payments, permission and settings changes. IP and device values are placeholders." />
      <DataTable
        rows={rows}
        getId={(a) => a.id}
        entity="audit entry"
        removeLabel={null}
        pageSize={pageSize}
        serverSide={isBackend ? {
          totalCount,
          page,
          pageSize,
          loading,
          onPageChange: (newPage) => {
            setPage(newPage);
            fetchActivity(newPage, pageSize, searchQuery, selectedModule, selectedAction);
          },
          onPageSizeChange: (newSize) => {
            setPageSize(newSize);
            setPage(0);
            fetchActivity(0, newSize, searchQuery, selectedModule, selectedAction);
          },
          onSearchChange: (newSearch) => {
            setSearchQuery(newSearch);
            setPage(0);
            fetchActivity(0, pageSize, newSearch, selectedModule, selectedAction);
          },
          onFilterChange: (filters) => {
            const newMod = filters["Module"] && filters["Module"] !== "all" ? filters["Module"] : undefined;
            const newAct = filters["Action"] && filters["Action"] !== "all" ? filters["Action"] : undefined;
            setSelectedModule(newMod);
            setSelectedAction(newAct);
            setPage(0);
            fetchActivity(0, pageSize, searchQuery, newMod, newAct);
          },
        } : undefined}
        search={(a) => `${a.user} ${a.action} ${a.record} ${a.description} ${a.prev ?? ""} ${a.next ?? ""}`}
        searchPlaceholder="Search user, action, record or value"
        date={(a) => a.iso}
        filters={[{ label: "Module", get: (a) => a.module }, { label: "User", get: (a) => a.user }, { label: "Action", get: (a) => a.action }]}
        columns={[
          { key: "when", header: "Date / time", sort: (a) => a.iso, render: (a) => <span className="whitespace-nowrap">{a.when}</span> },
          { key: "user", header: "User", sort: (a) => a.user, render: (a) => <span className="font-medium">{a.user}</span> },
          { key: "action", header: "Action", render: (a) => a.action },
          { key: "module", header: "Module", render: (a) => <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-xs">{a.module}</span> },
          { key: "record", header: "Record", render: (a) => <span className="font-mono text-xs">{a.record}</span> },
          { key: "change", header: "Previous → new", render: change },
          { key: "desc", header: "Description", render: (a) => <span className="block max-w-72 truncate text-muted-foreground">{a.description}</span> },
          { key: "ip", header: "IP / device", render: (a) => <span className="text-xs text-muted-foreground"><span className="block font-mono">{a.ip}</span>{a.device}</span> },
        ]}
        detail={(a) => <DetailGrid items={[["Date / time", a.when], ["User", a.user], ["Action", a.action], ["Module", a.module], ["Record", a.record], ["Previous value", a.prev ?? "—"], ["New value", a.next ?? "—"], ["Description", a.description], ["IP address", a.ip], ["Device", a.device]]} />}
      />
    </>
  );
}
