import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, CalendarClock, LayoutGrid, List, Mail, MessageCircle, Phone, Plus, Search, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, PaginatedResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import { EmptyState, KpiCard, Panel, StatusBadge } from "@/components/erp/primitives";
import { DataTable, DetailGrid, FormGrid } from "@/components/erp/DataTable";
import { ExportButtons, SectionHeader } from "@/components/erp/ModuleLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { inr } from "@/lib/format";
import {
  activities, attachments, customerGroups, customerNotes, customerPayments, customers, followUps, invoices, leadStages, leads, quotations, salesReturns, staff,
  type Customer, type CustomerType, type FollowUp, type Lead,
} from "@/data/sales";
import { AttachmentPanel, Timeline } from "./shared";
import { QuoteBadge } from "./quote-sections";

const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);
const M = ({ children }: { children: React.ReactNode }) => <span className="text-muted-foreground">{children}</span>;
const types = ["School", "College", "Institution", "Business", "Distributor", "Individual"] as const;
const initials = (n: string) => n.replace(/^(Dr\.|Fr\.|Sr\.|Prof\.|Govt\.)\s*/, "").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function CustomerLink({ c }: { c: Pick<Customer, "id" | "name"> }) {
  return <Link to="/crm/customer/$id" params={{ id: c.id }} className="font-medium hover:text-accent">{c.name}</Link>;
}

export function CrmDashboard() {
  const [liveLeads, setLiveLeads] = useState<Lead[]>(leads);
  const [liveFollowUps, setLiveFollowUps] = useState<FollowUp[]>(followUps);
  const [liveCustCount, setLiveCustCount] = useState<number>(customers.length);
  const [liveActiveCount, setLiveActiveCount] = useState<number>(customers.filter((c) => c.status === "Active").length);

  useEffect(() => {
    Promise.all([
      api.get<any>("/sales/leads/").catch(() => null),
      api.get<any>("/sales/follow-ups/").catch(() => null),
      api.get<any>("/parties/customers/").catch(() => null),
    ]).then(([leadsRes, fuRes, custRes]) => {
      if (leadsRes) {
        const list = Array.isArray(leadsRes) ? leadsRes : (leadsRes?.results ?? []);
        setLiveLeads(list.map((l: any) => ({
          id: l.code || l.id,
          name: l.name,
          org: l.org,
          type: (l.type || l.lead_type || "School") as CustomerType,
          phone: l.phone || "",
          city: l.city || "Kerala",
          value: Number(l.value) || 0,
          stage: l.stage,
          owner: l.owner || "Sales Team",
          source: l.source || "Phone enquiry",
          created: l.created || "—",
        })));
      }
      if (fuRes) {
        const list = Array.isArray(fuRes) ? fuRes : (fuRes?.results ?? []);
        setLiveFollowUps(list.map((f: any) => ({
          id: f.code || f.id,
          customer: f.customer,
          contact: f.contact || "—",
          date: f.date || f.scheduled_date,
          iso: f.iso || f.scheduled_date,
          type: (f.type || f.follow_up_type || "Call") as FollowUp["type"],
          assigned: f.assigned || "Sales Team",
          notes: f.notes || "",
          status: (f.status || "Scheduled") as FollowUp["status"],
        })));
      }
      if (custRes) {
        const list = Array.isArray(custRes) ? custRes : (custRes?.results ?? []);
        setLiveCustCount(list.length);
        setLiveActiveCount(list.filter((c: any) => (c.status || "Active") === "Active").length);
      }
    });
  }, []);

  const due = liveFollowUps.filter((f) => f.status === "Scheduled" || f.status === "Overdue");
  return (
    <>
      <SectionHeader title="CRM dashboard" description="Customers, leads and follow-ups across Kerala." actions={<ExportButtons />} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiCard label="Total customers" value={String(liveCustCount)} />
        <KpiCard label="New customers" value="3" hint="Joined this quarter" tone="up" />
        <KpiCard label="Active customers" value={String(liveActiveCount)} />
        <KpiCard label="Open leads" value={String(liveLeads.filter((l) => l.stage !== "Converted" && l.stage !== "Lost").length)} hint={inr(sum(liveLeads.filter((l) => l.stage !== "Lost" && l.stage !== "Converted"), (l) => l.value)) + " pipeline"} />
        <KpiCard label="Follow-ups due" value={String(due.length)} hint={`${liveFollowUps.filter((f) => f.status === "Overdue").length} overdue`} tone="down" />
        <KpiCard label="With outstanding" value={String(customers.filter((c) => c.outstanding > 0).length)} hint={inr(sum(customers, (c) => c.outstanding))} tone="down" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Recent customer activity" className="xl:col-span-2" actions={<Button variant="ghost" size="sm" asChild><Link to="/crm/$section" params={{ section: "activities" }}>View all</Link></Button>}>
          <Timeline items={activities.slice(0, 8)} />
        </Panel>
        <div className="space-y-4">
          <Panel title="Pipeline">
            <ul className="space-y-2.5">
              {leadStages.map((s) => {
                const ls = liveLeads.filter((l) => l.stage === s); return (
                  <li key={s} className="text-sm"><div className="flex justify-between"><span>{s}</span><span className="tabular text-muted-foreground">{ls.length} · {inr(sum(ls, (l) => l.value))}</span></div><Progress value={liveLeads.length ? (ls.length / liveLeads.length) * 100 * 3 : 0} className="mt-1 h-1.5" /></li>
                );
              })}
            </ul>
          </Panel>
          <Panel title="Top outstanding" bodyClassName="p-0">
            <ul className="divide-y divide-border">
              {[...customers].sort((a, b) => b.outstanding - a.outstanding).slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm"><span className="truncate"><CustomerLink c={c} /></span><span className="tabular font-medium">{inr(c.outstanding)}</span></li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

function customerForm(c: Customer | null) {
  return <FormGrid fields={[
    { label: "Customer name", value: c?.name, wide: true }, { label: "Type", value: c?.type, options: [...types] }, { label: "Group", value: c?.group, options: customerGroups.map((g) => g.name) },
    { label: "Contact person", value: c?.contact }, { label: "Phone", value: c?.phone }, { label: "Email", value: c?.email, type: "email", wide: true },
    { label: "Address", value: c?.address, wide: true }, { label: "GSTIN", value: c?.gstin ?? "" }, { label: "Credit limit (₹)", value: c?.creditLimit, type: "number" },
  ]} />;
}

export function Customers() {
  const [view, setView] = useState<"table" | "cards">("table");
  const [customerRows, setCustomerRows] = useState<(Customer & { backendId?: number })[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchCustomers = (p: number, size: number, search: string, filterType?: string, filterStatus?: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    setError(null);

    const params: Record<string, any> = {
      page: p + 1,
      page_size: size,
    };
    if (search.trim()) params["q"] = search.trim();
    if (filterType && filterType !== "all") params["type"] = filterType;
    if (filterStatus && filterStatus !== "all") params["status"] = filterStatus;

    api.get<PaginatedResponse<any>>("/parties/customers/", params, { signal: controller.signal })
      .then((custRes) => {
        const custList = Array.isArray(custRes) ? custRes : (custRes?.results ?? []);
        const total = typeof custRes?.count === "number" ? custRes.count : custList.length;
        setTotalCount(total);

        const apiCusts: (Customer & { backendId?: number })[] = custList.map((c: any) => ({
          id: c.code || `CUS-${c.id}`,
          backendId: c.id,
          name: c.name,
          type: (c.customer_type || "Business") as Customer["type"],
          contact: c.contact_person || c.name,
          phone: c.phone || "—",
          email: c.email || "—",
          city: c.city || "Kerala",
          district: c.state || "Kerala",
          address: c.address || `${c.city || ""}, ${c.state || "Kerala"}`.trim(),
          gstin: c.gstin || null,
          group: c.customer_group || "General",
          creditLimit: Number(c.credit_limit) || 0,
          totalSales: 0,
          paid: 0,
          outstanding: 0,
          lastTxn: "—",
          since: c.created_at ? new Date(c.created_at).toLocaleDateString() : "2026",
          status: (c.status || "Active") as Customer["status"],
          owner: c.owner_name || "Sales",
        }));
        setCustomerRows(apiCusts);
      })
      .catch((err: any) => {
        if (err?.name === "AbortError" || controller.signal.aborted) return;
        console.error("Backend customer fetch error:", err);
        setError(err?.message || "Failed to load customers from backend");
      })
      .finally(() => {
        if (abortControllerRef.current === controller) {
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    fetchCustomers(page, pageSize, searchQuery, selectedType, selectedStatus);
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleSaveCustomer = async (data: Record<string, any>, row?: any) => {
    try {
      const gstinVal = data["GSTIN"] ? String(data["GSTIN"]).trim().toUpperCase() : "";
      if (gstinVal && gstinVal.length !== 15) {
        toast.error("GSTIN must be exactly 15 characters long (or leave it blank for unregistered customers).");
        return false;
      }
      interface CustomerPayload {
        name: string;
        customer_type: string;
        customer_group: string;
        contact_person: string;
        phone: string;
        email: string;
        address: string;
        credit_limit: string;
        gstin?: string;
      }
      const payload: CustomerPayload = {
        name: String(data["Customer name"] || "").trim(),
        customer_type: data["Type"] || "Business",
        customer_group: data["Group"] || "General",
        contact_person: String(data["Contact person"] || "").trim(),
        phone: String(data["Phone"] || "").trim(),
        email: String(data["Email"] || "").trim(),
        address: String(data["Address"] || "").trim(),
        credit_limit: String(Number(data["Credit limit (₹)"]) || 0),
      };
      if (gstinVal) {
        payload.gstin = gstinVal;
      }

      if (row?.backendId) {
        await api.patch(`/parties/customers/${row.backendId}/`, payload);
        toast.success(`Customer ${payload.name} updated successfully`);
      } else {
        await api.post("/parties/customers/", payload);
        toast.success(`Customer ${payload.name} created successfully`);
      }
      fetchCustomers(page, pageSize, searchQuery, selectedType, selectedStatus);
      return true;
    } catch (err: any) {
      const errorMsg = err?.fieldErrors
        ? Object.entries(err.fieldErrors)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
          .join("; ")
        : err?.message || "Failed to save customer";
      toast.error(errorMsg);
      return false;
    }
  };

  const handleDeleteCustomer = async (c: Customer & { backendId?: number }) => {
    try {
      if (c.backendId) {
        await api.delete(`/parties/customers/${c.backendId}/`);
      }
      toast.success(`Customer ${c.name} deleted successfully`);
      fetchCustomers(page, pageSize, searchQuery, selectedType, selectedStatus);
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete customer");
      return false;
    }
  };

  const cards = customerRows;
  return (
    <>
      <SectionHeader title="Customers" description="Schools, colleges, institutions, businesses, distributors and individual customers."
        actions={<div className="flex rounded-md border border-border p-0.5">
          <Button size="sm" variant={view === "table" ? "default" : "ghost"} className="h-7" onClick={() => setView("table")} aria-label="Table view"><List className="size-4" /></Button>
          <Button size="sm" variant={view === "cards" ? "default" : "ghost"} className="h-7" onClick={() => setView("cards")} aria-label="Card view"><LayoutGrid className="size-4" /></Button>
        </div>} />
      <div className="flex flex-wrap gap-2">
        <span className="rounded-md border border-border bg-card px-2.5 py-1 text-xs">
          <span className="font-medium">{totalCount}</span> <M>Total registered</M>
        </span>
        {types.map((t) => (
          <span key={t} className="rounded-md border border-border bg-card px-2.5 py-1 text-xs">
            <span className="font-medium">{customerRows.filter((c) => c.type === t).length}</span> <M>{t}{t === "Business" ? "es" : t === "Individual" ? "s" : t.endsWith("y") ? "" : "s"} on page</M>
          </span>
        ))}
      </div>
      {view === "table" ? (
        <DataTable<Customer & { backendId?: number }> rows={customerRows} getId={(c) => c.id} entity="customer" removeLabel="Delete" pageSize={pageSize}
          serverSide={{
            totalCount,
            page,
            pageSize,
            loading,
            onPageChange: (newPage) => {
              setPage(newPage);
              fetchCustomers(newPage, pageSize, searchQuery, selectedType, selectedStatus);
            },
            onPageSizeChange: (newSize) => {
              setPageSize(newSize);
              setPage(0);
              fetchCustomers(0, newSize, searchQuery, selectedType, selectedStatus);
            },
            onSearchChange: (newSearch) => {
              setSearchQuery(newSearch);
              setPage(0);
              fetchCustomers(0, pageSize, newSearch, selectedType, selectedStatus);
            },
            onFilterChange: (filters) => {
              const newType = filters["Types"] && filters["Types"] !== "all" ? filters["Types"] : undefined;
              const newStatus = filters["Status"] && filters["Status"] !== "all" ? filters["Status"] : undefined;
              setSelectedType(newType);
              setSelectedStatus(newStatus);
              setPage(0);
              fetchCustomers(0, pageSize, searchQuery, newType, newStatus);
            },
          }}
          search={(c) => `${c.name} ${c.contact} ${c.phone} ${c.email} ${c.city} ${c.gstin ?? ""}`} searchPlaceholder="Search name, contact, phone, city or GSTIN"
          filters={[{ label: "Types", get: (c) => c.type }, { label: "Status", get: (c) => c.status }]}
          createLabel="New customer" form={customerForm}
          onRowClick={(c) => nav({ to: "/crm/customer/$id", params: { id: c.id } })}
          onSave={handleSaveCustomer}
          onDelete={handleDeleteCustomer}
          detail={(c) => <DetailGrid items={[["Type", c.type], ["Group", c.group], ["Contact", c.contact], ["Phone", c.phone], ["Email", c.email], ["GSTIN", c.gstin ?? "Unregistered"], ["Outstanding", inr(c.outstanding)], ["Credit limit", inr(c.creditLimit)]]} />}
          columns={[
            { key: "name", header: "Customer", sort: (c) => c.name, render: (c) => <div className="flex items-center gap-2.5"><span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">{initials(c.name)}</span><div className="min-w-0"><div className="max-w-56 truncate"><CustomerLink c={c} /></div><div className="text-xs text-muted-foreground">{c.id}</div></div></div> },
            { key: "type", header: "Type", sort: (c) => c.type, render: (c) => <M>{c.type}</M> },
            { key: "contact", header: "Contact", className: "hidden lg:table-cell", render: (c) => <div><div>{c.contact}</div><div className="text-xs text-muted-foreground">{c.phone}</div></div> },
            { key: "email", header: "Email", className: "hidden 2xl:table-cell", render: (c) => <M>{c.email}</M> },
            { key: "loc", header: "Location", className: "hidden md:table-cell", sort: (c) => c.city, render: (c) => <M>{c.city}</M> },
            { key: "gst", header: "GST", className: "hidden xl:table-cell", render: (c) => (c.gstin ? <StatusBadge status="Active" label="Registered" /> : <StatusBadge status="Draft" label="Unregistered" />) },
            { key: "out", header: "Outstanding", align: "right", sort: (c) => c.outstanding, render: (c) => (c.outstanding ? <span className="font-medium">{inr(c.outstanding)}</span> : <M>—</M>) },
            { key: "last", header: "Last txn", className: "hidden xl:table-cell", render: (c) => <M>{c.lastTxn}</M> },
            { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
          ]} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-3">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  setPage(0);
                  fetchCustomers(0, pageSize, val, selectedType, selectedStatus);
                }}
                placeholder="Search customers"
                className="h-9 pl-8"
              />
            </div>
            <Select
              value={selectedType || "all"}
              onValueChange={(val) => {
                const newT = val === "all" ? undefined : val;
                setSelectedType(newT);
                setPage(0);
                fetchCustomers(0, pageSize, searchQuery, newT, selectedStatus);
              }}
            >
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All types</SelectItem>{types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {cards.length === 0 ? <EmptyState title="No customers found" description="Try a different search." /> : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {cards.map((c) => (
                <Link key={c.id} to="/crm/customer/$id" params={{ id: c.id }} className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:border-accent">
                  <div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">{initials(c.name)}</span><div className="min-w-0"><p className="truncate font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.type} · {c.city}</p></div></div>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground"><p>{c.contact}</p><p>{c.phone}</p></div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm"><span className="text-xs text-muted-foreground">Outstanding</span><span className="font-semibold tabular">{inr(c.outstanding)}</span></div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

export function Leads() {
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [q, setQ] = useState("");
  const nav = useNavigate();

  const fetchLeads = () => {
    setLoading(true);
    api.get<any>("/sales/leads/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const mapped: Lead[] = list.map((l: any) => ({
          id: l.code || l.id,
          name: l.name,
          org: l.org,
          type: (l.type || l.lead_type || "School") as CustomerType,
          phone: l.phone || "",
          city: l.city || "Kerala",
          value: Number(l.value) || 0,
          stage: l.stage,
          owner: l.owner || "Sales Team",
          source: l.source || "Phone enquiry",
          created: l.created || "—",
        }));
        setItems(mapped);
      })
      .catch((err) => {
        console.error("Backend leads fetch error:", err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const move = async (l: Lead, stage: Lead["stage"]) => {
    try {
      await api.patch(`/sales/leads/${l.id}/move-stage/`, { stage });
      toast.success(`${l.org} moved to ${stage}`);
      fetchLeads();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update lead stage");
    }
  };

  const handleSaveLead = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!open) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const org = String(fd.get("Organisation") || "").trim();
    const name = String(fd.get("Contact person") || "").trim();
    const phone = String(fd.get("Phone") || "").trim();
    const city = String(fd.get("City") || "").trim();
    const type = String(fd.get("Type") || "School").trim();
    const value = Number(fd.get("Expected value (₹)")) || 0;
    const stage = String(fd.get("Stage") || "New").trim();
    const owner = String(fd.get("Owner") || staff[0]).trim();
    const source = String(fd.get("Source") || "Phone enquiry").trim();

    if (!org) {
      toast.error("Organisation name is required");
      setSaving(false);
      return;
    }

    try {
      if (open.id === "new") {
        await api.post("/sales/leads/", {
          org,
          name: name || org,
          lead_type: type,
          phone,
          city: city || "Kerala",
          value,
          stage,
          owner,
          source,
        });
        toast.success(`Lead ${org} created successfully`);
      } else {
        await api.patch(`/sales/leads/${open.id}/`, {
          org,
          name: name || org,
          lead_type: type,
          phone,
          city: city || "Kerala",
          value,
          stage,
          owner,
          source,
        });
        toast.success(`Lead ${org} updated successfully`);
      }
      setOpen(null);
      fetchLeads();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save lead");
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToCustomer = async (lead: Lead) => {
    setConverting(true);
    try {
      const res = await api.post<any>(`/sales/leads/${lead.id}/convert-to-customer/`, {});
      toast.success(res?.message || `${lead.org} converted to customer!`);
      setOpen(null);
      fetchLeads();
    } catch (err: any) {
      toast.error(err?.message || "Failed to convert lead to customer");
    } finally {
      setConverting(false);
    }
  };

  const shown = items.filter((l) => `${l.org} ${l.name} ${l.city}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <SectionHeader title="Leads" description="Sales pipeline from first enquiry to conversion. Use the menu on a card to move it between stages."
        actions={<Button size="sm" onClick={() => setOpen({ id: "new", name: "", org: "", type: "School", phone: "", city: "", value: 0, stage: "New", owner: staff[0] ?? "Sales Team", source: "Phone enquiry", created: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) })}><Plus className="size-4" /> New lead</Button>} />
      <div className="relative max-w-sm"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search leads" className="h-9 pl-8" /></div>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {leadStages.map((s) => {
          const col = shown.filter((l) => l.stage === s);
          return (
            <div key={s} className="flex w-64 shrink-0 flex-col rounded-lg border border-border bg-muted/40">
              <div className={cn("flex items-center justify-between border-b border-border px-3 py-2.5", s === "Converted" && "border-b-success/40", s === "Lost" && "border-b-destructive/40")}>
                <span className="text-sm font-semibold">{s}</span><span className="rounded bg-card px-1.5 text-xs tabular text-muted-foreground">{col.length}</span>
              </div>
              <p className="px-3 pt-2 text-xs text-muted-foreground tabular">{inr(sum(col, (l) => l.value))}</p>
              <div className="flex flex-col gap-2 p-2">
                {col.length === 0 ? <p className="rounded-md border border-dashed border-border-strong py-6 text-center text-xs text-muted-foreground">No leads</p> : col.map((l) => (
                  <div key={l.id} className="rounded-md border border-border bg-card p-3 shadow-[var(--shadow-card)]">
                    <div className="flex items-start justify-between gap-2">
                      <button className="min-w-0 text-left" onClick={() => setOpen(l)}><p className="truncate text-sm font-medium hover:text-accent">{l.org}</p><p className="truncate text-xs text-muted-foreground">{l.name} · {l.city}</p></button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="-mr-1 -mt-1 size-7" aria-label="Move lead">⋯</Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end"><DropdownMenuLabel>Move to</DropdownMenuLabel>{leadStages.filter((x) => x !== l.stage).map((x) => <DropdownMenuItem key={x} onClick={() => move(l, x)}>{x}</DropdownMenuItem>)}</DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs"><span className="font-semibold tabular">{inr(l.value)}</span><span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{l.type}</span></div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">{l.owner} · {l.source}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle>{open?.id === "new" ? "New lead" : open?.org}</SheetTitle><SheetDescription>{open?.id === "new" ? "Add an enquiry to the pipeline" : `${open?.id} · created ${open?.created}`}</SheetDescription></SheetHeader>
          {open ? (
            <form onSubmit={handleSaveLead} className="mt-4 space-y-4 px-4">
              <FormGrid fields={[
                { label: "Organisation", value: open.org, wide: true },
                { label: "Contact person", value: open.name },
                { label: "Phone", value: open.phone },
                { label: "City", value: open.city },
                { label: "Type", value: open.type, options: [...types] },
                { label: "Expected value (₹)", value: open.value, type: "number" },
                { label: "Stage", value: open.stage, options: [...leadStages] },
                { label: "Owner", value: open.owner, options: staff },
                { label: "Source", value: open.source },
              ]} />
              <div className="flex flex-col gap-2 pt-2">
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Saving..." : open.id === "new" ? "Create lead" : "Save changes"}
                </Button>
                {open.id !== "new" ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      disabled={converting}
                      onClick={() => handleConvertToCustomer(open)}
                    >
                      {converting ? "Converting..." : "Convert to customer"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="flex-1"
                      onClick={() => {
                        toast.info("Opening Quotations module");
                        nav({ to: "/quotations" });
                        setOpen(null);
                      }}
                    >
                      Create quotation
                    </Button>
                  </div>
                ) : null}
              </div>
            </form>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

export function FollowUps() {
  const [rows, setRows] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFollowUps = () => {
    setLoading(true);
    api.get<any>("/sales/follow-ups/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const mapped: FollowUp[] = list.map((f: any) => ({
          id: f.code || f.id,
          customer: f.customer,
          contact: f.contact || "—",
          date: f.date || f.scheduled_date,
          iso: f.iso || f.scheduled_date,
          type: (f.type || f.follow_up_type || "Call") as FollowUp["type"],
          assigned: f.assigned || "Sales Team",
          notes: f.notes || "",
          status: (f.status || "Scheduled") as FollowUp["status"],
        }));
        setRows(mapped);
      })
      .catch((err) => {
        console.error("Backend follow-ups fetch error:", err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFollowUps();
  }, []);

  const overdue = rows.filter((f) => f.status === "Overdue");
  const upcoming = rows.filter((f) => f.status === "Scheduled").sort((a, b) => a.iso.localeCompare(b.iso));
  const done = async (f: FollowUp) => {
    try {
      await api.patch(`/sales/follow-ups/${f.id}/mark-complete/`, {});
      toast.success(`Follow-up with ${f.customer} marked complete`);
      fetchFollowUps();
    } catch (err: any) {
      toast.error(err?.message || "Failed to mark follow-up complete");
    }
  };

  const handleSaveFollowUp = async (data: Record<string, any>, item: FollowUp | null) => {
    const cust = String(data["Customer / lead"] || "").trim();
    if (!cust) {
      toast.error("Customer or lead name is required");
      return false;
    }
    const payload = {
      customer: cust,
      contact: String(data["Contact person"] || "").trim(),
      scheduled_date: data["Date"] || new Date().toISOString().split("T")[0],
      follow_up_type: data["Type"] || "Call",
      assigned: data["Assigned to"] || staff[0],
      notes: String(data["Notes"] || "").trim(),
      status: data["Status"] || "Scheduled",
    };

    try {
      if (item && item.id) {
        await api.patch(`/sales/follow-ups/${item.id}/`, payload);
        toast.success("Follow-up updated successfully");
      } else {
        await api.post("/sales/follow-ups/", payload);
        toast.success("Follow-up scheduled successfully");
      }
      fetchFollowUps();
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to save follow-up");
      return false;
    }
  };

  const handleDeleteFollowUp = async (item: FollowUp) => {
    try {
      await api.delete(`/sales/follow-ups/${item.id}/`);
      toast.success(`Follow-up for ${item.customer} deleted`);
      fetchFollowUps();
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete follow-up");
      return false;
    }
  };

  const Card = ({ f }: { f: FollowUp }) => (
    <li className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0"><p className="truncate text-sm font-medium">{f.customer}</p><p className="text-xs text-muted-foreground">{f.type} · {f.contact} · {f.assigned}</p><p className="mt-1 text-xs">{f.notes}</p></div>
      <div className="shrink-0 text-right"><p className={cn("text-xs font-medium", f.status === "Overdue" ? "text-destructive" : "text-muted-foreground")}>{f.date}</p><Button size="sm" variant="ghost" className="mt-1 h-7" onClick={() => done(f)}>Done</Button></div>
    </li>
  );
  return (
    <>
      <SectionHeader title="Follow-ups" description="Calls, visits and messages scheduled with customers and leads." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Overdue" actions={<span className="inline-flex items-center gap-1 text-xs font-medium text-destructive"><AlertTriangle className="size-3.5" />{overdue.length}</span>} bodyClassName="p-0">
          {overdue.length ? <ul className="divide-y divide-border">{overdue.map((f) => <Card key={f.id} f={f} />)}</ul> : <div className="p-5"><EmptyState title="Nothing overdue" /></div>}
        </Panel>
        <Panel title="Upcoming" actions={<span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="size-3.5" />{upcoming.length}</span>} bodyClassName="p-0">
          {upcoming.length ? <ul className="divide-y divide-border">{upcoming.slice(0, 6).map((f) => <Card key={f.id} f={f} />)}</ul> : <div className="p-5"><EmptyState title="No upcoming follow-ups" /></div>}
        </Panel>
      </div>
      <DataTable<FollowUp> rows={rows} getId={(f) => f.id} entity="follow-up" removeLabel="Delete" search={(f) => `${f.customer} ${f.contact} ${f.notes}`}
        filters={[{ label: "Types", get: (f) => f.type }, { label: "Assignees", get: (f) => f.assigned }, { label: "Status", get: (f) => f.status }]} createLabel="Schedule follow-up"
        onSave={handleSaveFollowUp}
        onDelete={handleDeleteFollowUp}
        form={(f) => <FormGrid fields={[{ label: "Customer / lead", value: f?.customer, wide: true }, { label: "Contact person", value: f?.contact }, { label: "Date", value: f?.iso ?? new Date().toISOString().split("T")[0], type: "date" }, { label: "Type", value: f?.type, options: ["Call", "Visit", "WhatsApp", "Email", "Meeting"] }, { label: "Assigned to", value: f?.assigned, options: staff }, { label: "Notes", value: f?.notes, wide: true }, { label: "Status", value: f?.status, options: ["Scheduled", "Completed", "Cancelled"] }]} />}
        detail={(f) => <DetailGrid items={[["Customer", f.customer], ["Contact", f.contact], ["Date", f.date], ["Type", f.type], ["Assigned", f.assigned], ["Status", f.status], ["Notes", f.notes]]} />}
        columns={[
          { key: "date", header: "Date", sort: (f) => f.iso, render: (f) => <span className={f.status === "Overdue" ? "font-medium text-destructive" : "text-muted-foreground"}>{f.date}</span> },
          { key: "cust", header: "Customer / lead", sort: (f) => f.customer, render: (f) => <span className="block max-w-52 truncate font-medium">{f.customer}</span> },
          { key: "contact", header: "Contact", className: "hidden lg:table-cell", render: (f) => <M>{f.contact}</M> },
          { key: "type", header: "Type", render: (f) => f.type },
          { key: "ass", header: "Assigned", className: "hidden md:table-cell", render: (f) => <M>{f.assigned}</M> },
          { key: "notes", header: "Notes", className: "hidden xl:table-cell", render: (f) => <span className="block max-w-56 truncate text-muted-foreground">{f.notes}</span> },
          { key: "status", header: "Status", render: (f) => <StatusBadge status={f.status === "Scheduled" ? "info" : f.status === "Cancelled" ? "Void" : f.status} label={f.status} /> },
        ]} />
    </>
  );
}

export function Activities() {
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const shown = activities.filter((a) => (kind === "all" || a.kind === kind) && `${a.text} ${a.customer}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <SectionHeader title="Activities" description="Every call, message, quotation, sale and payment in one feed." actions={<ExportButtons />} />
      <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-3">
        <div className="relative min-w-52 flex-1"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search activity or customer" className="h-9 pl-8" /></div>
        <Select value={kind} onValueChange={setKind}><SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All activity types</SelectItem>{["Call", "Message", "Email", "Quotation", "Sale", "Payment", "Follow-up", "Note"].map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select>
      </div>
      <Panel>{shown.length ? <Timeline items={shown} /> : <EmptyState title="No activity matches" description="Clear the filters to see everything." />}</Panel>
    </>
  );
}

type Group = (typeof customerGroups)[number];
export function CustomerGroups() {
  return (
    <>
      <SectionHeader title="Customer groups" description="Group customers for price lists, payment terms and reporting." />
      <DataTable<Group> rows={customerGroups} getId={(g) => g.id} entity="group" removeLabel="Delete" search={(g) => g.name} createLabel="New group"
        form={(g) => <FormGrid fields={[{ label: "Group name", value: g?.name, wide: true }, { label: "Price list", value: g?.priceList }, { label: "Payment terms", value: g?.terms, options: ["Advance", "15 days", "30 days", "45 days"] }]} />}
        detail={(g) => (
          <div className="space-y-3"><DetailGrid items={[["Customers", String(g.customers)], ["Price list", g.priceList], ["Terms", g.terms], ["Sales", inr(g.sales)]]} />
            <ul className="divide-y divide-border rounded-md border border-border text-sm">{customers.filter((c) => c.group === g.name).map((c) => <li key={c.id} className="px-3 py-2"><CustomerLink c={c} /></li>)}</ul></div>
        )}
        columns={[
          { key: "name", header: "Group", sort: (g) => g.name, render: (g) => <span className="font-medium">{g.name}</span> },
          { key: "n", header: "Customers", align: "right", sort: (g) => g.customers, render: (g) => g.customers },
          { key: "pl", header: "Price list", className: "hidden md:table-cell", render: (g) => <M>{g.priceList}</M> },
          { key: "terms", header: "Terms", className: "hidden md:table-cell", render: (g) => <M>{g.terms}</M> },
          { key: "sales", header: "Sales", align: "right", sort: (g) => g.sales, render: (g) => inr(g.sales) },
          { key: "out", header: "Outstanding", align: "right", sort: (g) => g.outstanding, render: (g) => inr(g.outstanding) },
        ]} />
    </>
  );
}

export function CustomerDetail({ id }: { id: string }) {
  const [c, setC] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState(customerNotes);
  const [draft, setDraft] = useState("");
  const [customMsg, setCustomMsg] = useState("");
  const [custInvoices, setCustInvoices] = useState<any[]>([]);
  const [custPayments, setCustPayments] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);
    api.get<any>(`/parties/customers/${id}/`)
      .then((raw) => {
        if (raw) {
          const mapped: Customer = {
            id: raw.code || `CUS-${raw.id}`,
            name: raw.name,
            type: (raw.customer_type || "Business") as Customer["type"],
            contact: raw.contact_person || raw.name,
            phone: raw.phone || "—",
            email: raw.email || "—",
            city: raw.city || "Kerala",
            district: raw.state || "Kerala",
            address: raw.address || `${raw.city || ""}, ${raw.state || "Kerala"}`.trim(),
            gstin: raw.gstin || null,
            group: raw.customer_group || "General",
            creditLimit: Number(raw.credit_limit) || 0,
            totalSales: 0,
            paid: 0,
            outstanding: 0,
            lastTxn: "—",
            since: raw.created_at ? new Date(raw.created_at).toLocaleDateString() : "2026",
            status: (raw.status || "Active") as Customer["status"],
            owner: raw.owner_name || "Sales",
          };
          setC(mapped);

          // Fetch customer's real sales invoices and payments
          Promise.all([
            api.get<any>(`/sales/invoices/?customer=${raw.id}`),
            api.get<any>(`/sales/payments/?customer=${raw.id}`),
          ])
            .then(([invRes, payRes]) => {
              const liveInvs = Array.isArray(invRes) ? invRes : (invRes?.results ?? []);
              const livePays = Array.isArray(payRes) ? payRes : (payRes?.results ?? []);
              const totSales = sum(liveInvs, (i: any) => Number(i.total_amount) || 0);
              const totPaid = sum(liveInvs, (i: any) => Number(i.received_amount) || 0);
              const totBal = sum(liveInvs, (i: any) => Number(i.balance_amount) || 0);
              setC((prev) => (prev ? { ...prev, totalSales: totSales, paid: totPaid, outstanding: totBal } : prev));
              setCustInvoices(liveInvs);
              setCustPayments(livePays);
            })
            .catch(() => { });
        }
      })
      .catch(() => {
        const found = customers.find((x) => x.id === id);
        if (found) setC(found);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const data = useMemo(() => {
    if (!c) return null;
    const invMapped = custInvoices.map((inv: any) => ({
      id: inv.code || `INV-${inv.id}`,
      date: inv.invoice_date,
      iso: inv.invoice_date || new Date().toISOString().slice(0, 10),
      grand: Number(inv.total_amount) || 0,
      balance: Number(inv.balance_amount) || 0,
      status: inv.status,
      salesperson: inv.salesperson_name || "Sales Team",
    }));
    const paysMapped = custPayments.map((p: any) => ({
      id: p.code || `RCPT-${p.id}`,
      date: p.payment_date,
      iso: p.payment_date || new Date().toISOString().slice(0, 10),
      mode: p.payment_mode || "NEFT",
      invoice: p.invoice_code || (p.invoice ? `INV-${p.invoice}` : "—"),
      amount: Number(p.amount) || 0,
      status: p.status,
    }));
    return {
      inv: invMapped,
      pays: paysMapped,
      qts: quotations.filter((q) => q.customerId === c.id),
      rets: salesReturns.filter((r) => r.customer === c.name),
      acts: activities.filter((a) => a.customerId === c.id),
      fus: followUps.filter((f) => f.customer === c.name),
      files: attachments.filter((a) => a.customer === c.name),
    };
  }, [c, custInvoices, custPayments]);

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading customer details...</div>;
  }

  if (!c || !data) return <EmptyState title="Customer not found" description={`No customer with ID ${id}.`} action={<Button asChild variant="outline"><Link to="/crm/$section" params={{ section: "customers" }}>Back to customers</Link></Button>} />;
  const used = c.creditLimit ? Math.min(100, (c.outstanding / c.creditLimit) * 100) : 0;

  const timeline = [
    ...data.acts,
    ...data.inv.map((i) => ({ id: i.id, kind: "Sale", when: `${i.date}, 10:00`, iso: i.iso, text: `Invoice ${i.id} · ${inr(i.grand)}`, by: i.salesperson })),
    ...data.pays.map((p) => ({ id: p.id, kind: "Payment", when: `${p.date}, 15:00`, iso: p.iso, text: `${p.mode} payment ${inr(p.amount)} against ${p.invoice}`, by: "Anoop Krishnan" })),
    ...data.qts.map((q) => ({ id: q.id, kind: "Quotation", when: `${q.date}, 11:00`, iso: q.iso, text: `Quotation ${q.id} · ${q.status}`, by: q.owner })),
    ...data.fus.map((f) => ({ id: f.id, kind: "Follow-up", when: `${f.date}`, iso: f.iso, text: `${f.type}: ${f.notes}`, by: f.assigned })),
    ...notes.map((n) => ({ id: n.id, kind: "Note", when: n.when, iso: "2026-09-2" + (n.id === "N1" ? "2" : "0"), text: n.text, by: n.by })),
  ].sort((a, b) => b.iso.localeCompare(a.iso));
  const comms = [
    { id: "m1", ch: "WhatsApp", icon: MessageCircle, text: "Card proof shared — please confirm spelling of student names.", when: "25 Sep 2026, 11:42", dir: "out" },
    { id: "m2", ch: "WhatsApp", icon: MessageCircle, text: "Approved. Please proceed with printing 👍", when: "25 Sep 2026, 14:05", dir: "in" },
    { id: "m3", ch: "Email", icon: Mail, text: `Invoice ${data.inv[0]?.id ?? "INV-2630"} and delivery challan attached.`, when: "22 Sep 2026, 17:20", dir: "out" },
    { id: "m4", ch: "Call", icon: Phone, text: "Asked for revised delivery date before Onam holidays.", when: "19 Sep 2026, 10:15", dir: "in" },
  ];
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground">{initials(c.name)}</span>
          <div>
            <Link to="/crm/$section" params={{ section: "customers" }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3" /> Customers</Link>
            <h1 className="flex flex-wrap items-center gap-3 text-xl font-semibold sm:text-2xl">{c.name} <StatusBadge status={c.status} /></h1>
            <p className="text-sm text-muted-foreground">{c.type} · {c.group} · customer since {c.since}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`tel:${c.phone}`}><Phone className="size-4" /> Call</a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`https://wa.me/${c.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild><Link to="/quotations/$section" params={{ section: "create" }}>New quotation</Link></Button>
          <Button size="sm" asChild><Link to="/sales/$section" params={{ section: "new-invoice" }}>New invoice</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Total sales" value={inr(c.totalSales)} />
        <KpiCard label="Total paid" value={inr(c.paid)} tone="up" />
        <KpiCard label="Outstanding" value={inr(c.outstanding)} tone={c.outstanding ? "down" : "up"} />
        <div className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Credit limit</p>
          <p className="mt-1.5 text-xl font-semibold tabular">{c.creditLimit ? inr(c.creditLimit) : "Cash only"}</p>
          {c.creditLimit ? <><Progress value={used} className="mt-2 h-1.5" /><p className="mt-1 text-xs text-muted-foreground">{used.toFixed(0)}% used</p></> : null}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          {["overview", "transactions", "communication", "attachments", "timeline"].map((t) => <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="overview" className="mt-4 grid gap-4 xl:grid-cols-3">
          <Panel title="Customer information"><DetailGrid items={[["Customer ID", c.id], ["Type", c.type], ["Group", c.group], ["Account owner", c.owner], ["Since", c.since], ["Last transaction", c.lastTxn]]} /></Panel>
          <Panel title="Contact & address"><DetailGrid items={[["Contact person", c.contact], ["Phone", c.phone], ["Email", c.email], ["City", c.city], ["Address", c.address], ["District", c.district]]} /></Panel>
          <Panel title="GST details"><DetailGrid items={[["GSTIN", c.gstin ?? "Unregistered"], ["Registration", c.gstin ? "Regular" : "B2C"], ["State", c.gstin?.startsWith("33") ? "Tamil Nadu (33)" : "Kerala (32)"], ["Supply type", c.gstin?.startsWith("33") ? "Interstate (IGST)" : "Intra-state (CGST+SGST)"]]} /></Panel>
        </TabsContent>
        <TabsContent value="transactions" className="mt-4">
          <Tabs defaultValue="sales">
            <TabsList><TabsTrigger value="sales">Sales ({data.inv.length})</TabsTrigger><TabsTrigger value="payments">Payments ({data.pays.length})</TabsTrigger><TabsTrigger value="quotes">Quotations ({data.qts.length})</TabsTrigger><TabsTrigger value="returns">Returns ({data.rets.length})</TabsTrigger></TabsList>
            <TabsContent value="sales" className="mt-3"><MiniList empty="No invoices" head={["Invoice", "Date", "Total", "Balance", "Status"]} rows={data.inv.map((i) => [<Link key="l" to="/sales/invoice/$id" params={{ id: i.id }} className="font-medium text-accent hover:underline">{i.id}</Link>, i.date, inr(i.grand), inr(i.balance), <StatusBadge key="s" status={i.status} />])} /></TabsContent>
            <TabsContent value="payments" className="mt-3"><MiniList empty="No payments" head={["Receipt", "Date", "Invoice", "Amount", "Status"]} rows={data.pays.map((p) => [p.id, p.date, p.invoice, inr(p.amount), <StatusBadge key="s" status={p.status} />])} /></TabsContent>
            <TabsContent value="quotes" className="mt-3"><MiniList empty="No quotations" head={["Quotation", "Date", "Valid till", "Total", "Status"]} rows={data.qts.map((q) => [<Link key="l" to="/quotations/view/$id" params={{ id: q.id }} className="font-medium text-accent hover:underline">{q.id}</Link>, q.date, q.validTill, inr(q.total), <QuoteBadge key="s" s={q.status} />])} /></TabsContent>
            <TabsContent value="returns" className="mt-3"><MiniList empty="No returns" head={["Return", "Date", "Invoice", "Value", "Status"]} rows={data.rets.map((r) => [r.id, r.date, r.invoice, inr(r.amount), <StatusBadge key="s" status={r.status} />])} /></TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="communication" className="mt-4 grid gap-4 xl:grid-cols-3">
          <Panel title="Messages & emails" className="xl:col-span-2" description="WhatsApp and email sending will work once those services are connected.">
            <ul className="space-y-3">
              {comms.map((m) => (
                <li key={m.id} className={cn("flex", m.dir === "out" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-md rounded-lg px-3 py-2 text-sm", m.dir === "out" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                    <p className="mb-0.5 flex items-center gap-1 text-[11px] opacity-75"><m.icon className="size-3" />{m.ch} · {m.when}</p>{m.text}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <Input
                placeholder="Type a WhatsApp message…"
                className="h-9"
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customMsg.trim()) {
                    window.open(`https://wa.me/${c.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(customMsg)}`, "_blank");
                    setCustomMsg("");
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() => {
                  if (!customMsg.trim()) {
                    toast.error("Please type a message first");
                    return;
                  }
                  window.open(`https://wa.me/${c.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(customMsg)}`, "_blank");
                  setCustomMsg("");
                }}
              >
                Send
              </Button>
            </div>
          </Panel>
          <div className="space-y-4">
            <Panel title="Notes">
              <div className="space-y-2"><Textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a note" /><Button size="sm" disabled={!draft.trim()} onClick={() => { setNotes([{ id: `N${Date.now()}`, by: "Anoop Krishnan", when: "27 Sep 2026", text: draft }, ...notes]); setDraft(""); toast.success("Note added"); }}><StickyNote className="size-4" /> Add note</Button></div>
              <ul className="mt-4 space-y-3">{notes.map((n) => <li key={n.id} className="rounded-md bg-muted/50 p-2.5 text-sm"><p>{n.text}</p><p className="mt-1 text-xs text-muted-foreground">{n.by} · {n.when}</p></li>)}</ul>
            </Panel>
            <Panel title="Follow-ups">{data.fus.length ? <ul className="space-y-2 text-sm">{data.fus.map((f) => <li key={f.id} className="flex justify-between gap-2"><span>{f.type} — {f.notes}</span><span className="shrink-0 text-xs text-muted-foreground">{f.date}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">No follow-ups scheduled.</p>}</Panel>
          </div>
        </TabsContent>
        <TabsContent value="attachments" className="mt-4"><AttachmentPanel items={data.files} /></TabsContent>
        <TabsContent value="timeline" className="mt-4"><Panel title="Activity timeline"><Timeline items={timeline} /></Panel></TabsContent>
      </Tabs>
    </>
  );
}

function MiniList({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length) return <EmptyState title={empty} />;
  return (
    <Panel bodyClassName="p-0">
      <Table><TableHeader><TableRow>{head.map((h, i) => <TableHead key={h} className={i === 2 || i === 3 ? "text-right" : ""}>{h}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className={j === 2 || j === 3 ? "text-right tabular" : j === 1 ? "text-muted-foreground" : ""}>{c}</TableCell>)}</TableRow>)}</TableBody></Table>
    </Panel>
  );
}
