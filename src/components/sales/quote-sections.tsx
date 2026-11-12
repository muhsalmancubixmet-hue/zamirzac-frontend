import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRightLeft, Copy, Download, Eye, FileStack, Plus, Printer, Send } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { KpiCard, Panel, StatusBadge, EmptyState } from "@/components/erp/primitives";
import { DataTable, DetailGrid } from "@/components/erp/DataTable";
import { ExportButtons, SectionHeader } from "@/components/erp/ModuleLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { inr } from "@/lib/format";
import { attachments, customers, defaultTerms, products, quoteTemplates, quotations, type Line, type Quotation, type QuoteStatus } from "@/data/sales";
import { api } from "@/lib/api";
import { AttachmentPanel, DocumentEditor, DocumentSheet, Timeline } from "./shared";

const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);
const M = ({ children }: { children: React.ReactNode }) => <span className="text-muted-foreground">{children}</span>;
const statusTone: Record<QuoteStatus, string> = { Draft: "Draft", Sent: "info", Accepted: "Active", Rejected: "Failed", Expired: "Void", Converted: "Completed" };
export function QuoteBadge({ s }: { s: QuoteStatus }) {
  return <StatusBadge status={statusTone[s]} label={s} />;
}

function useQuoteActions() {
  const nav = useNavigate();
  const [overrides, setOverrides] = useState<Record<string, Partial<Quotation>>>({});
  const [extra, setExtra] = useState<Quotation[]>([]);
  const [converting, setConverting] = useState<Quotation | null>(null);
  const [preview, setPreview] = useState<Quotation | null>(null);
  const [apiQuotes, setApiQuotes] = useState<Quotation[]>([]);

  useEffect(() => {
    api.get<any>("/sales/quotations/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        if (list.length > 0) {
          const mapped: Quotation[] = list.map((q: any) => ({
            id: q.code || `QT-${q.id}`,
            date: q.quotation_date,
            iso: q.quotation_date,
            validTill: q.valid_till || q.quotation_date,
            customerId: `CUST-${q.customer}`,
            customer: q.customer_name || `Customer #${q.customer}`,
            lines: (q.lines || []).map((l: any) => ({
              code: l.item_code || "",
              name: l.item_name || l.description || "Item",
              description: l.description || "",
              qty: Number(l.quantity) || 1,
              unit: "Nos",
              rate: Number(l.unit_price) || 0,
              defaultRate: Number(l.unit_price) || 0,
              discount: Number(l.discount_percentage) || 0,
              tax: Number(l.tax_rate) || 18,
            })),
            total: Number(q.total_amount) || 0,
            status: q.status as QuoteStatus,
            owner: "Admin",
            notes: q.notes || "",
            terms: q.terms || defaultTerms,
            attachments: 0,
            convertedTo: q.converted_to,
          }));
          setApiQuotes(mapped);
        }
      })
      .catch(() => {});
  }, []);

  const baseQuotes = apiQuotes;
  const rows = useMemo(() => [...extra, ...baseQuotes].map((q) => ({ ...q, ...overrides[q.id] })), [overrides, extra, baseQuotes]);
  const duplicate = (q: Quotation) => { const id = `QT-${341 + extra.length}`; setExtra((x) => [{ ...q, id, status: "Draft", date: new Date().toISOString().slice(0, 10), iso: new Date().toISOString().slice(0, 10) }, ...x]); toast.success(`Duplicated as ${id} (draft)`); };
  const convert = (q: Quotation) => setConverting(q);
  const dialogs = (
    <>
      <AlertDialog open={!!converting} onOpenChange={(o) => !o && setConverting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert {converting?.id} to a sale?</AlertDialogTitle>
            <AlertDialogDescription>A sales invoice for {converting ? inr(converting.total) : ""} will be created for {converting?.customer}. Stock and accounts are updated only by the invoice, not by the quotation.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (converting) {
                try {
                  const res = await api.post<any>(`/sales/quotations/${converting.id}/convert/`, {});
                  toast.success(`Quotation ${converting.id} converted — invoice ${res.code} created!`);
                  setOverrides((o) => ({ ...o, [converting.id]: { status: "Converted", convertedTo: res.code } }));
                } catch (err: any) {
                  toast.error(err?.message || "Failed to convert quotation");
                }
              }
              setConverting(null);
            }}>Convert to sale</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Preview {preview?.id}</DialogTitle><DialogDescription>Valid till {preview?.validTill}</DialogDescription></DialogHeader>
          {preview ? <DocumentSheet title="QUOTATION" number={preview.id} date={preview.date} customerId={preview.customerId} lines={preview.lines} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
  return { rows, duplicate, convert, setPreview, dialogs, nav, setOverrides };
}

export function QuoteDashboard() {
  const { rows } = useQuoteActions();
  const statuses: QuoteStatus[] = ["Draft", "Sent", "Accepted", "Rejected", "Expired", "Converted"];
  const data = statuses.map((s) => ({ s, count: rows.filter((q) => q.status === s).length, value: sum(rows.filter((q) => q.status === s), (q) => q.total) }));
  const decided = rows.filter((q) => ["Accepted", "Converted", "Rejected"].includes(q.status));
  const won = decided.filter((q) => q.status !== "Rejected");
  const winRate = decided.length > 0 ? Math.round((won.length / decided.length) * 100) : 0;
  const colors = ["var(--color-muted-foreground)", "var(--color-chart-2)", "var(--color-success)", "var(--color-destructive)", "var(--color-border-strong)", "var(--color-chart-1)"];
  return (
    <>
      <SectionHeader title="Quotation dashboard" description="Quotations are estimates only — they never change stock or accounts." actions={<Button size="sm" asChild><Link to="/quotations/$section" params={{ section: "create" }}><Plus className="size-4" /> New quotation</Link></Button>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Open quotations" value={String(rows.filter((q) => q.status === "Sent" || q.status === "Draft").length)} hint={inr(sum(rows.filter((q) => q.status === "Sent"), (q) => q.total)) + " awaiting reply"} />
        <KpiCard label="Accepted" value={String(rows.filter((q) => q.status === "Accepted").length)} hint="Ready to convert" tone="up" />
        <KpiCard label="Converted" value={String(rows.filter((q) => q.status === "Converted").length)} />
        <KpiCard label="Win rate" value={`${winRate}%`} hint="Accepted + converted" tone="up" />
        <KpiCard label="Expired" value={String(rows.filter((q) => q.status === "Expired").length)} tone="down" hint="Follow up or re-issue" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Value by status" className="xl:col-span-2">
          <div className="h-60"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: -8, right: 8, top: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} /><XAxis dataKey="s" tickLine={false} axisLine={false} fontSize={12} /><YAxis tickFormatter={(n: number) => `₹${(n / 100000).toFixed(1)}L`} tickLine={false} axisLine={false} fontSize={12} /><RTooltip formatter={(v: number) => inr(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} /><Bar dataKey="value" radius={[4, 4, 0, 0]}>{data.map((_, i) => <Cell key={i} fill={colors[i]} />)}</Bar></BarChart>
          </ResponsiveContainer></div>
        </Panel>
        <Panel title="Accepted — awaiting conversion" bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {rows.filter((q) => q.status === "Accepted").map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0"><Link to="/quotations/view/$id" params={{ id: q.id }} className="font-medium text-accent hover:underline">{q.id}</Link><p className="truncate text-xs text-muted-foreground">{q.customer}</p></div>
                <span className="text-sm font-medium tabular">{inr(q.total)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

export function QuoteList() {
  const a = useQuoteActions();
  return (
    <>
      <SectionHeader title="Quotations" description="All quotations with status, validity and conversion." actions={<><ExportButtons /><Button size="sm" asChild><Link to="/quotations/$section" params={{ section: "create" }}><Plus className="size-4" /> New quotation</Link></Button></>} />
      <DataTable<Quotation> rows={a.rows} getId={(q) => q.id} entity="quotation" removeLabel="Delete"
        search={(q) => `${q.id} ${q.customer}`} searchPlaceholder="Search quotation or customer"
        filters={[{ label: "Status", get: (q) => q.status }, { label: "Owners", get: (q) => q.owner }]}
        onRowClick={(q) => a.nav({ to: "/quotations/view/$id", params: { id: q.id } })}
        extraActions={[
          { label: "Preview", icon: <Eye className="size-4" />, onClick: a.setPreview },
          { label: "Duplicate", icon: <Copy className="size-4" />, onClick: a.duplicate },
          { label: "Send", icon: <Send className="size-4" />, onClick: (q) => { a.setOverrides((o) => ({ ...o, [q.id]: { status: "Sent" } })); toast.success(`${q.id} sent to customer`); }, show: (q) => q.status === "Draft" },
          { label: "Convert to sale", icon: <ArrowRightLeft className="size-4" />, onClick: a.convert, show: (q) => q.status === "Accepted" },
        ]}
        detail={(q) => <DetailGrid items={[["Customer", q.customer], ["Date", q.date], ["Valid till", q.validTill], ["Items", String(q.lines.length)], ["Total", inr(q.total)], ["Status", <QuoteBadge key="s" s={q.status} />]]} />}
        columns={[
          { key: "id", header: "Quotation", sort: (q) => q.id, render: (q) => <Link to="/quotations/view/$id" params={{ id: q.id }} className="font-medium text-accent hover:underline">{q.id}</Link> },
          { key: "date", header: "Date", sort: (q) => q.iso, render: (q) => <M>{q.date}</M> },
          { key: "cust", header: "Customer", sort: (q) => q.customer, render: (q) => <span className="block max-w-56 truncate">{q.customer}</span> },
          { key: "valid", header: "Valid till", className: "hidden md:table-cell", render: (q) => <M>{q.validTill}</M> },
          { key: "owner", header: "Owner", className: "hidden xl:table-cell", render: (q) => <M>{q.owner}</M> },
          { key: "total", header: "Total", align: "right", sort: (q) => q.total, render: (q) => <span className="font-medium">{inr(q.total)}</span> },
          { key: "status", header: "Status", render: (q) => <QuoteBadge s={q.status} /> },
        ]} />
      {a.dialogs}
    </>
  );
}

export function QuoteCreate() {
  const [tpl, setTpl] = useState<string>("");
  const nav = useNavigate();
  const lines = tpl ? templateLines(tpl) : undefined;
  return (
    <>
      <SectionHeader title="Create quotation" description="Prepare an estimate for a customer. Nothing is reserved in stock and no accounting entry is made." />
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm">
        <FileStack className="size-4 text-accent" /> Start from template:
        {quoteTemplates.map((t) => <Button key={t.id} size="sm" variant={tpl === t.id ? "default" : "outline"} onClick={() => setTpl(tpl === t.id ? "" : t.id)}>{t.name}</Button>)}
      </div>
      <DocumentEditor key={tpl} mode="quotation" initial={lines ? { lines } : undefined} onSaved={() => nav({ to: "/quotations/$section", params: { section: "list" } })} />
    </>
  );
}

function templateLines(id: string): Line[] {
  const t = quoteTemplates.find((x) => x.id === id)!;
  return t.items.map((code) => { const p = products.find((x) => x.code === code)!; return { code, name: p.name, description: "", qty: p.unit === "Job" || p.unit === "Trip" ? 1 : 500, unit: p.unit, rate: p.price, defaultRate: p.price, discount: 0, tax: p.tax }; });
}

export function QuoteTemplates() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <SectionHeader title="Quotation templates" description="Reusable product bundles for common school and business orders." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quoteTemplates.map((t) => {
          const ls = templateLines(t.id);
          return (
            <Panel key={t.id} bodyClassName="flex h-full flex-col p-4">
              <p className="font-semibold">{t.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t.desc}</p>
              <ul className="mt-3 flex-1 space-y-1 text-sm">{ls.map((l) => <li key={l.code} className="flex justify-between gap-2"><span className="truncate">{l.name}</span><span className="shrink-0 tabular text-muted-foreground">₹{l.rate}</span></li>)}</ul>
              <div className="mt-4 flex items-center justify-between"><span className="text-xs text-muted-foreground">Used {t.used} times</span><Button size="sm" onClick={() => setOpen(t.id)}>Use template</Button></div>
            </Panel>
          );
        })}
      </div>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader><DialogTitle>New quotation from template</DialogTitle><DialogDescription>{quoteTemplates.find((t) => t.id === open)?.name}</DialogDescription></DialogHeader>
          {open ? <DocumentEditor mode="quotation" initial={{ lines: templateLines(open) }} onSaved={() => setOpen(null)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function QuoteDetail({ id }: { id: string }) {
  const a = useQuoteActions();
  const [qData, setQData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<any>(`/sales/quotations/${id}/`)
      .then((res) => {
        setQData({
          id: res.code || `QT-${res.id}`,
          backendId: res.id,
          date: res.quotation_date,
          iso: res.quotation_date,
          validTill: res.valid_until || res.quotation_date,
          customerId: String(res.customer),
          customer: res.customer_name || `Customer #${res.customer}`,
          lines: (res.lines || []).map((l: any) => ({
            code: l.item_code || "",
            name: l.item_name || l.description || "Item",
            description: l.description || "",
            qty: Number(l.quantity) || 1,
            unit: "Nos",
            rate: Number(l.unit_price) || 0,
            defaultRate: Number(l.unit_price) || 0,
            discount: Number(l.discount_percentage) || 0,
            tax: Number(l.tax_rate) || 18,
          })),
          total: Number(res.total_amount) || 0,
          status: res.status as QuoteStatus,
          owner: "Admin",
          notes: res.notes || "",
          terms: res.terms || defaultTerms,
          attachments: 0,
          convertedTo: res.converted_to,
        });
      })
      .catch(() => {
        const found = a.rows.find((x) => x.id === id);
        setQData(found || null);
      })
      .finally(() => setLoading(false));
  }, [id, a.rows]);

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading quotation...</div>;
  }
  const q = qData;
  if (!q) return <EmptyState title="Quotation not found" description={`No quotation ${id}.`} action={<Button asChild variant="outline"><Link to="/quotations/$section" params={{ section: "list" }}>Back to quotations</Link></Button>} />;

  const c = customers.find((x) => x.id === q.customerId) || {
    id: q.customerId,
    name: q.customer,
    contact: "Primary Contact",
    phone: "—",
    email: "—",
  };
  const hist = [
    { id: "1", kind: "Quotation", when: `${q.date}, 11:05`, text: `${q.id} created`, by: q.owner },
    ...(q.status !== "Draft" ? [{ id: "2", kind: "Email", when: `${q.date}, 11:30`, text: `Sent to ${c.email}`, by: q.owner }] : []),
    ...(["Accepted", "Converted"].includes(q.status) ? [{ id: "3", kind: "Call", when: "24 Sep 2026, 16:10", text: `${c.contact} confirmed acceptance`, by: q.owner }] : []),
    ...(q.status === "Converted" ? [{ id: "4", kind: "Sale", when: "25 Sep 2026, 10:00", text: `Converted to ${q.convertedTo}`, by: "Anoop Krishnan" }] : []),
    ...(q.status === "Rejected" ? [{ id: "5", kind: "Note", when: "23 Sep 2026, 12:00", text: "Customer chose a lower quote", by: q.owner }] : []),
  ].reverse();
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/quotations/$section" params={{ section: "list" }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3" /> Quotations</Link>
          <h1 className="mt-1 flex items-center gap-3 text-xl font-semibold sm:text-2xl">{q.id} <QuoteBadge s={q.status} /></h1>
          <p className="text-sm text-muted-foreground">{q.customer} · valid till {q.validTill}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => a.setPreview(q)}><Eye className="size-4" /> Preview</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Download className="size-4" /> Download</Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              a.setOverrides((o) => ({ ...o, [q.id]: { status: "Sent" } }));
              toast.success(`Quotation ${q.id} sent to ${c.email}`);
            }}
          >
            <Send className="size-4" /> Send
          </Button>
          <Button variant="outline" size="sm" onClick={() => a.duplicate(q)}><Copy className="size-4" /> Duplicate</Button>
          {q.status === "Accepted" ? <Button size="sm" onClick={() => a.convert(q)}><ArrowRightLeft className="size-4" /> Convert to sale</Button> : null}
          {q.status === "Converted" && q.convertedTo ? <Button size="sm" variant="secondary" disabled>Converted to {q.convertedTo}</Button> : null}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <DocumentSheet title="QUOTATION" number={q.id} date={q.date} customerId={q.customerId} lines={q.lines}
            extra={<div className="sm:text-right"><p className="text-xs text-muted-foreground">Validity</p><p>Valid till {q.validTill}</p><p>Prepared by {q.owner}</p></div>} />
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Notes"><p className="text-sm text-muted-foreground">{q.notes || "No notes."}</p></Panel>
            <Panel title="Terms & conditions"><p className="whitespace-pre-line text-sm text-muted-foreground">{q.terms}</p></Panel>
          </div>
          <AttachmentPanel items={attachments.slice(0, q.attachments)} compact />
        </div>
        <div className="space-y-4">
          <Panel title="Customer"><Link to="/crm/customer/$id" params={{ id: c.id }} className="font-medium hover:text-accent">{c.name}</Link><p className="text-sm text-muted-foreground">{c.contact} · {c.phone}</p></Panel>
          <Panel title="History"><Timeline items={hist} /></Panel>
        </div>
      </div>
      {a.dialogs}
    </>
  );
}
