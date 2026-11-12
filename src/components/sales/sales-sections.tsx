import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Bell, Download, FileText, Plus, Printer, Send } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis, Area, AreaChart } from "recharts";
import { KpiCard, Panel, StatusBadge, EmptyState } from "@/components/erp/primitives";
import { DataTable, DetailGrid, FormGrid } from "@/components/erp/DataTable";
import { ExportButtons, SectionHeader } from "@/components/erp/ModuleLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr } from "@/lib/format";
import { dayOffset } from "@/data/finance";
import { lineAmount, lineTax, type Invoice } from "@/data/sales";
import { api, salesApi } from "@/lib/api";
import { companyConfig as company } from "@/config/company";
import { AttachmentPanel, DocumentEditor, DocumentSheet, Field, inr2 } from "./shared";

const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);
const tip = { borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 };
const axis = { tickLine: false, axisLine: false, fontSize: 12 } as const;
const k = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${Math.round(n / 1000)}k`);
const M = ({ children }: { children: React.ReactNode }) => <span className="text-muted-foreground">{children}</span>;

function InvoiceLink({ id }: { id: string }) {
  return <Link to="/sales/invoice/$id" params={{ id }} className="font-medium text-accent hover:underline">{id}</Link>;
}

export function SalesOverview() {
  const [invoicesList, setInvoicesList] = useState<Invoice[]>([]);
  const [returnsList, setReturnsList] = useState<any[]>([]);

  useEffect(() => {
    api.get<any>("/sales/invoices/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const mapped: Invoice[] = list.map((inv: any) => ({
          id: inv.code || `INV-${inv.id}`,
          date: inv.invoice_date,
          iso: inv.invoice_date,
          due: inv.due_date || inv.invoice_date,
          customerId: `CUST-${inv.customer}`,
          customer: inv.customer_name || `Customer #${inv.customer}`,
          lines: (inv.lines || []).map((l: any) => ({
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
          grand: Number(inv.total_amount) || 0,
          received: Number(inv.received_amount) || 0,
          balance: Number(inv.balance_amount) || 0,
          status: inv.status as Invoice["status"],
          salesperson: inv.salesperson || "Sales Team",
          attachments: 0,
          po: inv.customer_po_ref || "—",
        }));
        setInvoicesList(mapped);
      })
      .catch(() => {});

    api.get<any>("/sales/returns/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        setReturnsList(list);
      })
      .catch(() => {});
  }, []);

  const live = invoicesList.filter((i) => i.status !== "Draft");
  const todayStr = new Date().toISOString().slice(0, 10);
  const today = sum(live.filter((i) => i.iso === todayStr), (i) => i.grand);
  const curMonth = todayStr.slice(0, 7);
  const month = sum(live.filter((i) => i.iso.startsWith(curMonth)), (i) => i.grand);
  const outstanding = sum(live, (i) => i.balance);
  const paid = sum(live, (i) => i.received);
  const pendingCount = live.filter((i) => i.balance > 0).length;
  const returnsTotal = sum(returnsList, (r) => Number(r.total_amount) || 0);

  const daily = Array.from({ length: 14 }, (_, d) => {
    const o = dayOffset(13 - d);
    return { day: o.label.slice(0, 6), sales: sum(live.filter((i) => i.iso === o.iso), (i) => i.grand) };
  });

  const monthsMap: Record<string, number> = {};
  live.forEach((i) => {
    const m = new Date(i.iso).toLocaleString("en-US", { month: "short" });
    monthsMap[m] = (monthsMap[m] || 0) + i.grand;
  });
  const monthly = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]
    .map((m) => ({ m, v: monthsMap[m] || 0 }));

  const byCust = Object.values(
    live.reduce<Record<string, { name: string; v: number; id: string }>>((a, i) => {
      (a[i.customer] ??= { name: i.customer, v: 0, id: i.customerId }).v += i.grand;
      return a;
    }, {})
  ).sort((a, b) => b.v - a.v);

  const prodMap: Record<string, { name: string; qty: number; v: number }> = {};
  live.flatMap((i) => i.lines).forEach((l) => {
    const pName = (l.name || "Item").split(/[—(,]/)[0]?.trim() || "Item";
    prodMap[pName] ??= { name: pName, qty: 0, v: 0 };
    prodMap[pName].qty += l.qty;
    prodMap[pName].v += lineAmount(l);
  });
  const byProd = Object.values(prodMap).sort((a, b) => b.v - a.v);

  const status = ["Paid", "Partial", "Pending", "Overdue"].map((s) => ({
    name: s,
    value: sum(live.filter((i) => i.status === s), (i) => i.grand),
  }));
  const colors = ["var(--color-success)", "var(--color-chart-2)", "var(--color-warning)", "var(--color-destructive)"];

  return (
    <>
      <SectionHeader title="Sales overview" description="Live analytics from sales invoices and orders" actions={<><ExportButtons /><Button size="sm" asChild><Link to="/sales/$section" params={{ section: "new-invoice" }}><Plus className="size-4" /> New invoice</Link></Button></>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiCard label="Today's sales" value={inr(today)} hint={todayStr} />
        <KpiCard label="Monthly sales" value={inr(month)} tone="up" />
        <KpiCard label="Outstanding" value={inr(outstanding)} hint={`${live.filter((i) => i.status === "Overdue").length} overdue`} tone="down" />
        <KpiCard label="Paid amount" value={inr(paid)} />
        <KpiCard label="Pending invoices" value={String(pendingCount)} />
        <KpiCard label="Sales returns" value={inr(returnsTotal)} hint={`${returnsList.length} returns`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Daily sales" description="Last 14 days" className="xl:col-span-2">
          <div className="h-60"><ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ left: -8, right: 8, top: 8 }}>
              <defs><linearGradient id="dsf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.02} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} /><XAxis dataKey="day" {...axis} /><YAxis tickFormatter={k} {...axis} />
              <RTooltip formatter={(v: number) => inr(v)} contentStyle={tip} /><Area dataKey="sales" name="Sales" type="monotone" stroke="var(--color-chart-2)" strokeWidth={2} fill="url(#dsf)" />
            </AreaChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Payment status">
          <div className="h-60"><ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={status} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>{status.map((_, i) => <Cell key={i} fill={colors[i]} />)}</Pie><RTooltip formatter={(v: number) => inr(v)} contentStyle={tip} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} /></PieChart>
          </ResponsiveContainer></div>
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Monthly sales"><div className="h-56"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthly} margin={{ left: -8, right: 8, top: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} /><XAxis dataKey="m" {...axis} /><YAxis tickFormatter={k} {...axis} /><RTooltip formatter={(v: number) => inr(v)} contentStyle={tip} /><Bar dataKey="v" name="Sales" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} /></BarChart>
        </ResponsiveContainer></div></Panel>
        <Panel title="Sales by customer"><div className="h-56"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={byCust.slice(0, 6).map((c) => ({ ...c, short: c.name.split(" ").slice(0, 2).join(" ") }))} layout="vertical" margin={{ left: 8, right: 8 }}><XAxis type="number" hide /><YAxis type="category" dataKey="short" width={110} {...axis} fontSize={11} /><RTooltip formatter={(v: number) => inr(v)} contentStyle={tip} /><Bar dataKey="v" name="Sales" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} /></BarChart>
        </ResponsiveContainer></div></Panel>
        <Panel title="Sales by product"><div className="h-56"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={byProd.slice(0, 6)} layout="vertical" margin={{ left: 8, right: 8 }}><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={110} {...axis} fontSize={11} /><RTooltip formatter={(v: number) => inr(v)} contentStyle={tip} /><Bar dataKey="v" name="Sales" fill="var(--color-chart-3)" radius={[0, 4, 4, 0]} /></BarChart>
        </ResponsiveContainer></div></Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Top customers" bodyClassName="p-0">
          <Table><TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Invoices</TableHead><TableHead className="text-right">Sales</TableHead></TableRow></TableHeader>
            <TableBody>{byCust.slice(0, 6).map((c) => <TableRow key={c.id}><TableCell><span className="font-medium">{c.name}</span></TableCell><TableCell className="text-right tabular">{live.filter((i) => i.customerId === c.id).length}</TableCell><TableCell className="text-right tabular">{inr(c.v)}</TableCell></TableRow>)}</TableBody></Table>
        </Panel>
        <Panel title="Top-selling products" bodyClassName="p-0">
          <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty sold</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
            <TableBody>{byProd.slice(0, 6).map((p) => <TableRow key={p.name}><TableCell className="font-medium">{p.name}</TableCell><TableCell className="text-right tabular">{p.qty.toLocaleString("en-IN")}</TableCell><TableCell className="text-right tabular">{inr(p.v)}</TableCell></TableRow>)}</TableBody></Table>
        </Panel>
      </div>
    </>
  );
}

export function SalesInvoices() {
  const nav = useNavigate();
  const [rows, setRows] = useState<(Invoice & { backendId?: number })[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchInvoices = (p = page, q = searchQuery, status = statusFilter, size = pageSize) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    const params: Record<string, any> = {
      page: p + 1, // DRF 1-indexed
      page_size: size,
    };
    if (q.trim()) params["q"] = q.trim();
    if (status && status !== "all") params["status"] = status;

    api.get<any>("/sales/invoices/", params, { signal: controller.signal })
      .then((res) => {
        const count = res?.count ?? (Array.isArray(res) ? res.length : 0);
        setTotalCount(count);
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const mapped = list.map((inv: any) => ({
          id: inv.code || `INV-${inv.id}`,
          backendId: inv.id,
          date: inv.invoice_date,
          iso: inv.invoice_date,
          due: inv.due_date || inv.invoice_date,
          customerId: `CUST-${inv.customer}`,
          customer: inv.customer_name || `Customer #${inv.customer}`,
          lines: (inv.lines || []).map((l: any) => ({
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
          grand: Number(inv.total_amount) || 0,
          received: Number(inv.received_amount) || 0,
          balance: Number(inv.balance_amount) || 0,
          status: inv.status as Invoice["status"],
          salesperson: inv.salesperson || "Sales Team",
          attachments: 0,
          po: inv.customer_po_ref || "—",
        }));
        setRows(mapped);
      })
      .catch((err: any) => {
        if (err?.name === "AbortError") return;
        setRows([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchInvoices(0, "", "all", 25);
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return (
    <>
      <SectionHeader
        title="Sales invoices"
        description="GST tax invoices raised to customers."
        actions={
          <>
            <ExportButtons />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const tid = toast.loading("Dispatching batch payment reminders for invoices with balance...");
                try {
                  const res = await salesApi.sendBatchReminders(1.0);
                  toast.success(`Dispatched ${res.sent_count} reminders (${res.failed_count} failed).`, { id: tid });
                } catch (err: any) {
                  toast.error(err?.message || "Failed to send batch reminders", { id: tid });
                }
              }}
            >
              <Bell className="size-4" /> Send Reminders
            </Button>
            <Button size="sm" asChild>
              <Link to="/sales/$section" params={{ section: "new-invoice" }}>
                <Plus className="size-4" /> New invoice
              </Link>
            </Button>
          </>
        }
      />
      <DataTable<Invoice & { backendId?: number }>
        rows={rows}
        getId={(i) => i.id}
        entity="invoice"
        removeLabel="Void"
        searchPlaceholder="Search invoice, customer or PO"
        filters={[{ label: "Status", get: (i) => i.status, options: ["Draft", "Pending", "Partial", "Paid"] }]}
        extraActions={[
          {
            label: "Email invoice",
            icon: <Send className="size-4" />,
            onClick: async (i) => {
              if (!i.backendId) {
                toast.error("Invalid invoice ID");
                return;
              }
              const tid = toast.loading(`Emailing invoice ${i.id}...`);
              try {
                const res = await salesApi.sendInvoiceEmail(i.backendId);
                if (res.success) {
                  toast.success(res.message || `Invoice emailed to ${res.recipient}`, { id: tid });
                } else {
                  toast.error(res.message || res.error || "Failed to send invoice email", { id: tid });
                }
              } catch (err: any) {
                toast.error(err?.message || "Failed to send email", { id: tid });
              }
            },
          },
          {
            label: "Send reminder",
            icon: <Bell className="size-4" />,
            show: (i) => Boolean(i.balance && i.balance > 0),
            onClick: async (i) => {
              if (!i.backendId) {
                toast.error("Invalid invoice ID");
                return;
              }
              const tid = toast.loading(`Sending payment reminder for ${i.id}...`);
              try {
                const res = await salesApi.sendInvoiceReminder(i.backendId);
                if (res.success) {
                  toast.success(res.message || `Payment reminder sent to ${res.recipient}`, { id: tid });
                } else {
                  toast.error(res.message || res.error || "Failed to send reminder", { id: tid });
                }
              } catch (err: any) {
                toast.error(err?.message || "Failed to send reminder", { id: tid });
              }
            },
          },
        ]}
        form={(i) => <FormGrid fields={[{ label: "Customer", value: i?.customer, wide: true }, { label: "Due date", value: i?.due }, { label: "Customer PO", value: i?.po }, { label: "Salesperson", value: i?.salesperson }, { label: "Status", value: i?.status, options: ["Draft", "Pending", "Partial", "Paid"] }]} />}
        onDelete={async (i) => {
          if (i.backendId) {
            await api.delete(`/sales/invoices/${i.backendId}/`);
            toast.success(`Invoice ${i.id} voided`);
            fetchInvoices(page, searchQuery, statusFilter, pageSize);
          }
        }}
        detail={(i) => (
          <div className="space-y-4">
            <DetailGrid items={[["Customer", i.customer], ["Date", i.date], ["Due", i.due], ["PO", i.po], ["Total", inr(i.grand)], ["Balance", inr(i.balance)]]} />
            <Button className="w-full" onClick={() => nav({ to: "/sales/invoice/$id", params: { id: i.id } })}>Open full invoice</Button>
          </div>
        )}
        columns={[
          { key: "id", header: "Invoice", sort: (i) => i.id, render: (i) => <InvoiceLink id={i.id} /> },
          { key: "date", header: "Date", sort: (i) => i.iso, render: (i) => <M>{i.date}</M> },
          { key: "cust", header: "Customer", sort: (i) => i.customer, render: (i) => <span className="block max-w-56 truncate">{i.customer}</span> },
          { key: "sp", header: "Salesperson", className: "hidden xl:table-cell", render: (i) => <M>{i.salesperson}</M> },
          { key: "total", header: "Total", align: "right", sort: (i) => i.grand, render: (i) => inr(i.grand) },
          { key: "bal", header: "Balance", align: "right", sort: (i) => i.balance, className: "hidden md:table-cell", render: (i) => (i.balance ? <span className="font-medium">{inr(i.balance)}</span> : <M>—</M>) },
          { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
        ]}
        serverSide={{
          totalCount,
          page,
          pageSize,
          loading,
          onPageChange: (newPage) => {
            setPage(newPage);
            fetchInvoices(newPage, searchQuery, statusFilter, pageSize);
          },
          onPageSizeChange: (newSize) => {
            setPageSize(newSize);
            setPage(0);
            fetchInvoices(0, searchQuery, statusFilter, newSize);
          },
          onSearchChange: (newQ) => {
            setSearchQuery(newQ);
            setPage(0);
            fetchInvoices(0, newQ, statusFilter, pageSize);
          },
          onFilterChange: (newFv) => {
            const nextStatus = newFv["Status"] || "all";
            setStatusFilter(nextStatus);
            setPage(0);
            fetchInvoices(0, searchQuery, nextStatus, pageSize);
          },
        }}
      />
    </>
  );
}

export function NewInvoice() {
  const nav = useNavigate();
  return (
    <>
      <SectionHeader title="New sales invoice" description="Default prices are filled in automatically; users with price-override permission can change the selling price." />
      <DocumentEditor mode="invoice" onSaved={() => nav({ to: "/sales/$section", params: { section: "invoices" } })} />
    </>
  );
}

type SO = {
  id: string;
  backendId?: number;
  date: string;
  iso: string;
  delivery: string;
  customer: string;
  customerId: string;
  items: number;
  total: number;
  status: "Draft" | "Confirmed" | "In production" | "Ready to dispatch" | "Delivered" | "Cancelled";
};

export function SalesOrders() {
  const [rows, setRows] = useState<SO[]>([]);
  const [customersList, setCustomersList] = useState<{ id: number; name: string }[]>([]);

  const fetchOrders = () => {
    api.get<any>("/sales/orders/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const mapped: SO[] = list.map((o: any) => ({
          id: o.code || `SO-${o.id}`,
          backendId: o.id,
          date: o.order_date,
          iso: o.order_date,
          delivery: o.delivery_date || o.order_date,
          customer: o.customer_name || `Customer #${o.customer}`,
          customerId: `CUST-${o.customer}`,
          items: (o.lines || []).length,
          total: Number(o.total_amount) || 0,
          status: o.status as SO["status"],
        }));
        setRows(mapped);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchOrders();
    api.get<any>("/parties/customers/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        setCustomersList(list.map((c: any) => ({ id: c.id, name: c.name })));
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <SectionHeader title="Sales orders" description="Confirmed customer orders before invoicing." actions={<ExportButtons />} />
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Open orders" value={String(rows.filter((o) => !["Invoiced", "Cancelled", "Delivered"].includes(o.status)).length)} />
        <KpiCard label="Order value" value={inr(sum(rows, (o) => o.total))} />
        <KpiCard label="Ready to dispatch" value={String(rows.filter((o) => o.status === "Ready to dispatch").length)} />
        <KpiCard label="In production" value={String(rows.filter((o) => o.status === "In production").length)} />
      </div>
      <DataTable<SO>
        rows={rows}
        getId={(o) => o.id}
        entity="sales order"
        removeLabel="Cancel"
        search={(o) => `${o.id} ${o.customer}`}
        filters={[{ label: "Status", get: (o) => o.status }]}
        extraActions={[
          {
            label: "Convert to invoice",
            icon: <FileText className="size-4" />,
            show: (o) => !["Invoiced", "Cancelled"].includes(o.status),
            onClick: async (o) => {
              if (!o.backendId) {
                toast.error("Invalid sales order ID");
                return;
              }
              const tid = toast.loading(`Converting order ${o.id} to tax invoice...`);
              try {
                const res = await salesApi.convertOrderToInvoice(o.backendId);
                if (res.success) {
                  toast.success(res.message || "Tax invoice created and emailed!", { id: tid });
                  fetchOrders();
                } else {
                  toast.error(res.message || "Failed to convert order", { id: tid });
                }
              } catch (err: any) {
                toast.error(err?.message || "Failed to convert order", { id: tid });
              }
            },
          },
        ]}
        createLabel="New order"
        form={(o) => (
          <FormGrid fields={[
            { label: "Customer", value: o?.customer, options: customersList.length ? customersList.map((c) => c.name) : ["Default Customer"], wide: true },
            { label: "Order date", value: o?.iso ?? new Date().toISOString().slice(0, 10), type: "date" },
            { label: "Delivery by", value: o?.delivery ?? new Date().toISOString().slice(0, 10), type: "date" },
            { label: "Status", value: o?.status ?? "Confirmed", options: ["Draft", "Confirmed", "In production", "Ready to dispatch", "Delivered", "Cancelled"] },
          ]} />
        )}
        onSave={async (data) => {
          const selectedCustName = data["Customer"];
          const matchedCust = customersList.find((c) => c.name === selectedCustName) || customersList[0];
          const orderDate = data["Order date"] || new Date().toISOString().slice(0, 10);
          const deliveryDate = data["Delivery by"] || orderDate;
          const statusVal = data["Status"] || "Confirmed";

          const existing = rows.find((r) => r.customer === selectedCustName && r.status === data["Status"]);
          if (existing?.backendId) {
            await api.patch(`/sales/orders/${existing.backendId}/`, {
              status: statusVal,
              delivery_date: deliveryDate,
            });
            toast.success(`Sales order ${existing.id} updated`);
          } else {
            await api.post("/sales/orders/", {
              customer: matchedCust?.id || 1,
              order_date: orderDate,
              delivery_date: deliveryDate,
              status: statusVal,
            });
            toast.success("Sales order created!");
          }
          fetchOrders();
        }}
        onDelete={async (o) => {
          if (o.backendId) {
            await api.patch(`/sales/orders/${o.backendId}/`, { status: "Cancelled" });
            toast.success(`Order ${o.id} cancelled`);
            fetchOrders();
          }
        }}
        detail={(o) => (
          <div className="space-y-4">
            <DetailGrid items={[["Customer", o.customer], ["Order date", o.date], ["Delivery by", o.delivery], ["Items", String(o.items)], ["Total", inr(o.total)], ["Status", <StatusBadge key="s" status={o.status} />]]} />
            {!["Invoiced", "Cancelled"].includes(o.status) && (
              <Button
                className="w-full"
                onClick={async () => {
                  if (!o.backendId) return;
                  const tid = toast.loading(`Converting order ${o.id} to tax invoice...`);
                  try {
                    const res = await salesApi.convertOrderToInvoice(o.backendId);
                    if (res.success) {
                      toast.success(res.message || "Tax invoice created and emailed!", { id: tid });
                      fetchOrders();
                    } else {
                      toast.error(res.message || "Failed to convert order", { id: tid });
                    }
                  } catch (err: any) {
                    toast.error(err?.message || "Failed to convert order", { id: tid });
                  }
                }}
              >
                <FileText className="mr-2 size-4" /> Deliver & Create Tax Invoice
              </Button>
            )}
          </div>
        )}
        columns={[
          { key: "id", header: "Order", render: (o) => <span className="font-medium">{o.id}</span> },
          { key: "date", header: "Date", sort: (o) => o.iso, render: (o) => <M>{o.date}</M> },
          { key: "cust", header: "Customer", sort: (o) => o.customer, render: (o) => o.customer },
          { key: "del", header: "Delivery by", className: "hidden md:table-cell", render: (o) => <M>{o.delivery}</M> },
          { key: "items", header: "Items", align: "right", render: (o) => o.items },
          { key: "total", header: "Total", align: "right", sort: (o) => o.total, render: (o) => inr(o.total) },
          { key: "status", header: "Status", render: (o) => <StatusBadge status={o.status} /> },
        ]}
      />
    </>
  );
}

type CP = {
  id: string;
  backendId?: number;
  date: string;
  iso: string;
  customer: string;
  customerId?: number;
  invoice: string;
  invoiceId?: number;
  amount: number;
  mode: string;
  ref: string;
  status: "Cleared" | "Pending" | "Bounced";
};

export function printPaymentReceipt(p: CP) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    window.print();
    return;
  }
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>PaymentReceipt_${p.id}_${(p.customer || "Customer").replace(/\\s+/g, "_")}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #111; line-height: 1.5; padding: 24px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #13213f; padding-bottom: 16px; margin-bottom: 20px; }
          .company-name { font-size: 22px; font-weight: bold; color: #13213f; }
          .title-block { text-align: right; }
          .title-block h1 { margin: 0; font-size: 20px; color: #13213f; text-transform: uppercase; }
          .meta-box { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
          .meta-item { display: flex; flex-direction: column; }
          .meta-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 2px; }
          .meta-value { font-size: 14px; font-weight: 600; color: #0f172a; }
          .amount-card { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 28px; }
          .amount-label { font-size: 12px; font-weight: 600; text-transform: uppercase; color: #166534; }
          .amount-val { font-size: 28px; font-weight: bold; color: #15803d; margin-top: 4px; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; font-size: 12px; color: #64748b; }
          .signature-box { text-align: center; border-top: 1px dashed #94a3b8; width: 200px; padding-top: 6px; font-weight: 600; color: #334155; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="company-name">${company.name}</div>
            <div style="font-size: 12px; color: #475569;">${company.location}</div>
            <div style="font-size: 12px; color: #475569;">GSTIN: ${company.gstin} · Phone: ${company.phone} · Email: ${company.email}</div>
          </div>
          <div class="title-block">
            <h1>Payment Receipt</h1>
            <div style="font-size: 14px; font-weight: 600; color: #334155; margin-top: 4px;">${p.id}</div>
            <div style="font-size: 12px; color: #64748b;">Date: ${p.date}</div>
          </div>
        </div>

        <div class="amount-card">
          <div class="amount-label">Amount Received</div>
          <div class="amount-val">${inr(p.amount)}</div>
          <div style="font-size: 12px; color: #15803d; margin-top: 4px;">Status: <strong>${p.status}</strong></div>
        </div>

        <div class="meta-box">
          <div class="meta-item"><span class="meta-label">Received From (Customer)</span><span class="meta-value">${p.customer}</span></div>
          <div class="meta-item"><span class="meta-label">Payment Mode</span><span class="meta-value">${p.mode}</span></div>
          <div class="meta-item"><span class="meta-label">Against Invoice</span><span class="meta-value">${p.invoice}</span></div>
          <div class="meta-item"><span class="meta-label">Reference / UTR</span><span class="meta-value">${p.ref}</span></div>
        </div>

        <div class="footer">
          <div>
            <div>Thank you for your business.</div>
            <div style="font-size: 10px; margin-top: 4px;">System-generated receipt from Zamirzac Solutions ERP.</div>
          </div>
          <div class="signature-box">
            Authorized Signatory
          </div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 300);
  toast.success(`Receipt ${p.id} ready for printing / PDF save`);
}

export function CustomerPayments() {
  const [rows, setRows] = useState<CP[]>([]);
  const [customersList, setCustomersList] = useState<{ id: number; name: string }[]>([]);
  const [invoicesList, setInvoicesList] = useState<{ id: number; code: string; customer: number }[]>([]);

  const fetchPayments = () => {
    api.get<any>("/sales/payments/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const mapped: CP[] = list.map((p: any) => ({
          id: p.code || `RCPT-${p.id}`,
          backendId: p.id,
          date: p.payment_date,
          iso: p.payment_date,
          customer: p.customer_name || `Customer #${p.customer}`,
          customerId: p.customer,
          invoice: p.invoice_code || (p.invoice ? `INV-${p.invoice}` : "—"),
          invoiceId: p.invoice,
          amount: Number(p.amount) || 0,
          mode: p.payment_mode,
          ref: p.reference_number || "—",
          status: p.status as CP["status"],
        }));
        setRows(mapped);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchPayments();
    api.get<any>("/parties/customers/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        setCustomersList(list.map((c: any) => ({ id: c.id, name: c.name })));
      })
      .catch(() => {});
    api.get<any>("/sales/invoices/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        setInvoicesList(list.map((i: any) => ({ id: i.id, code: i.code, customer: i.customer })));
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <SectionHeader title="Customer payments" description="Money received against sales invoices." actions={<ExportButtons />} />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Received" value={inr(sum(rows.filter((p) => p.status === "Cleared"), (p) => p.amount))} tone="up" hint="Cleared" />
        <KpiCard label="Pending clearance" value={inr(sum(rows.filter((p) => p.status === "Pending"), (p) => p.amount))} />
        <KpiCard label="Bounced" value={String(rows.filter((p) => p.status === "Bounced").length)} tone="down" />
      </div>
      <DataTable<CP>
        rows={rows}
        getId={(p) => p.id}
        entity="payment"
        removeLabel="Void"
        search={(p) => `${p.id} ${p.customer} ${p.invoice} ${p.ref}`}
        filters={[{ label: "Modes", get: (p) => p.mode }, { label: "Status", get: (p) => p.status }]}
        extraActions={[
          {
            label: "Print / Save PDF",
            icon: <Printer className="size-4" />,
            onClick: (p) => printPaymentReceipt(p),
          },
          {
            label: "Email receipt",
            icon: <Send className="size-4" />,
            onClick: async (p) => {
              if (!p.backendId) {
                toast.error("Invalid payment record");
                return;
              }
              const tid = toast.loading(`Emailing payment receipt ${p.id}...`);
              try {
                const res = await salesApi.sendPaymentReceiptEmail(p.backendId);
                if (res.success) {
                  toast.success(res.message || `Payment receipt emailed to ${res.recipient}`, { id: tid });
                } else {
                  toast.error(res.message || res.error || "Failed to send receipt email", { id: tid });
                }
              } catch (err: any) {
                toast.error(err?.message || "Failed to send email", { id: tid });
              }
            },
          },
        ]}
        createLabel="Record payment"
        onSave={async (data) => {
          const amt = Number(data["Amount (₹)"]) || 0;
          if (amt <= 0) {
            throw new Error("Amount must be greater than zero");
          }
          const selectedCustName = data["Customer"];
          const matchedCust = customersList.find((c) => c.name === selectedCustName) || customersList[0];
          const matchedInv = invoicesList.find((i) => i.code === data["Against invoice"]);
          await api.post("/sales/payments/", {
            customer: matchedCust?.id || 1,
            invoice: matchedInv?.id || null,
            amount: amt,
            payment_mode: data["Mode"] || "NEFT",
            reference_number: data["Reference / UTR"] || "",
            payment_date: new Date().toISOString().slice(0, 10),
            status: "Cleared",
          });
          toast.success("Payment recorded in database!");
          fetchPayments();
        }}
        form={(p) => (
          <FormGrid fields={[
            { label: "Customer", value: p?.customer, options: customersList.length ? customersList.map((c) => c.name) : ["Default Customer"], wide: true },
            { label: "Against invoice", value: p?.invoice, options: invoicesList.map((i) => i.code) },
            { label: "Amount (₹)", value: p?.amount, type: "number" },
            { label: "Mode", value: p?.mode, options: ["NEFT", "UPI", "RTGS", "Cheque", "Cash"] },
            { label: "Reference / UTR", value: p?.ref },
          ]} />
        )}
        detail={(p) => <DetailGrid items={[["Customer", p.customer], ["Invoice", p.invoice], ["Date", p.date], ["Amount", inr(p.amount)], ["Mode", p.mode], ["Reference", p.ref], ["Status", <StatusBadge key="s" status={p.status} />]]} />}
        columns={[
          { key: "id", header: "Receipt", render: (p) => <span className="font-medium">{p.id}</span> },
          { key: "date", header: "Date", sort: (p) => p.iso, render: (p) => <M>{p.date}</M> },
          { key: "cust", header: "Customer", sort: (p) => p.customer, render: (p) => <span className="block max-w-52 truncate">{p.customer}</span> },
          { key: "inv", header: "Invoice", render: (p) => <InvoiceLink id={p.invoice} /> },
          { key: "mode", header: "Mode", className: "hidden md:table-cell", render: (p) => p.mode },
          { key: "ref", header: "Reference", className: "hidden xl:table-cell", render: (p) => <M>{p.ref}</M> },
          { key: "amt", header: "Amount", align: "right", sort: (p) => p.amount, render: (p) => <span className="font-medium">{inr(p.amount)}</span> },
          { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
        ]}
      />
    </>
  );
}

type SR = {
  id: string;
  backendId?: number;
  date: string;
  iso: string;
  invoice: string;
  customer: string;
  item: string;
  qty: number;
  amount: number;
  reason: string;
  status: "Draft" | "Pending" | "Approved" | "Completed" | "Rejected";
};

export function SalesReturns() {
  const [rows, setRows] = useState<SR[]>([]);
  const [invoicesList, setInvoicesList] = useState<any[]>([]);

  const fetchReturns = () => {
    api.get<any>("/sales/returns/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const mapped: SR[] = list.map((s: any) => ({
          id: s.code || `SR-${s.id}`,
          backendId: s.id,
          date: s.return_date,
          iso: s.return_date,
          invoice: s.invoice_code || `INV-${s.invoice}`,
          customer: s.customer_name || "Customer",
          item: s.lines?.[0]?.item_name || "Item",
          qty: s.lines?.[0]?.quantity || 1,
          amount: Number(s.total_amount) || 0,
          reason: s.reason || "Return",
          status: s.status as SR["status"],
        }));
        setRows(mapped);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchReturns();
    api.get<any>("/sales/invoices/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        setInvoicesList(list.filter((inv: any) => inv.status !== "Draft"));
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <SectionHeader title="Sales returns" description="Goods returned by customers against invoices." actions={<ExportButtons />} />
      <DataTable<SR>
        rows={rows}
        getId={(s) => s.id}
        entity="return"
        search={(s) => `${s.id} ${s.customer} ${s.invoice} ${s.item}`}
        filters={[{ label: "Status", get: (s) => s.status }, { label: "Reasons", get: (s) => s.reason }]}
        createLabel="New return"
        form={(s) => (
          <FormGrid fields={[
            { label: "Invoice", value: s?.invoice, options: invoicesList.map((i) => i.code || `INV-${i.id}`), wide: true },
            { label: "Reason", value: s?.reason ?? "Defective / Damaged", options: ["Defective / Damaged", "Incorrect item delivered", "Order cancelled by customer", "Quality dissatisfaction", "Other"] },
            { label: "Quantity", value: s?.qty ?? 1, type: "number" },
          ]} />
        )}
        onSave={async (data) => {
          const matchedInv = invoicesList.find((i) => (i.code || `INV-${i.id}`) === data["Invoice"]);
          if (!matchedInv) {
            throw new Error("Please select an active invoice for return");
          }
          const qty = Number(data["Quantity"]) || 1;
          const invLine = matchedInv.lines?.[0];
          const payload: any = {
            invoice: matchedInv.id,
            return_date: new Date().toISOString().slice(0, 10),
            reason: data["Reason"] || "Defective / Damaged",
            status: "Pending",
          };
          if (invLine && invLine.item) {
            payload.lines = [
              {
                item: invLine.item,
                quantity: Math.min(qty, Number(invLine.quantity) || 1),
                unit_price: Number(invLine.unit_price) || 0,
                tax_rate: Number(invLine.tax_rate) || 18,
                reason: data["Reason"] || "Defective / Damaged",
              },
            ];
          }
          await api.post("/sales/returns/", payload);
          toast.success("Sales return recorded in backend!");
          fetchReturns();
        }}
        onDelete={async (s) => {
          if (s.backendId) {
            await api.delete(`/sales/returns/${s.backendId}/`);
            toast.success(`Sales return ${s.id} removed`);
            fetchReturns();
          }
        }}
        detail={(s) => <DetailGrid items={[["Customer", s.customer], ["Invoice", s.invoice], ["Item", s.item], ["Qty", String(s.qty)], ["Value", inr(s.amount)], ["Reason", s.reason]]} />}
        columns={[
          { key: "id", header: "Return", render: (s) => <span className="font-medium">{s.id}</span> },
          { key: "date", header: "Date", sort: (s) => s.iso, render: (s) => <M>{s.date}</M> },
          { key: "cust", header: "Customer", render: (s) => <span className="block max-w-48 truncate">{s.customer}</span> },
          { key: "inv", header: "Invoice", render: (s) => <InvoiceLink id={s.invoice} /> },
          { key: "item", header: "Item", className: "hidden lg:table-cell", render: (s) => <M>{s.item} × {s.qty}</M> },
          { key: "reason", header: "Reason", className: "hidden xl:table-cell", render: (s) => s.reason },
          { key: "amt", header: "Value", align: "right", sort: (s) => s.amount, render: (s) => inr(s.amount) },
          { key: "status", header: "Status", render: (s) => <StatusBadge status={s.status} /> },
        ]}
      />
    </>
  );
}

type CN = {
  id: string;
  backendId?: number;
  date: string;
  iso: string;
  customer: string;
  against: string;
  returnRef: string;
  amount: number;
  adjusted: number;
  status: "Adjusted" | "Pending" | "Refunded";
};

export function CreditNotes() {
  const [rows, setRows] = useState<CN[]>([]);
  const [invoicesList, setInvoicesList] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]);

  const fetchCreditNotes = () => {
    api.get<any>("/sales/credit-notes/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const mapped: CN[] = list.map((c: any) => ({
          id: c.code || `CN-${c.id}`,
          backendId: c.id,
          date: c.note_date,
          iso: c.note_date,
          customer: c.customer_name || `Customer #${c.customer}`,
          against: c.invoice_code || (c.invoice ? `INV-${c.invoice}` : "—"),
          returnRef: c.sales_return_code || "—",
          amount: Number(c.amount) || 0,
          adjusted: Number(c.adjusted_amount) || 0,
          status: c.status as CN["status"],
        }));
        setRows(mapped);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchCreditNotes();
    api.get<any>("/sales/invoices/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        setInvoicesList(list);
      })
      .catch(() => {});
    api.get<any>("/parties/customers/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        setCustomersList(list);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <SectionHeader title="Credit notes" description="Credits issued for approved returns and adjustments." actions={<ExportButtons />} />
      <DataTable<CN>
        rows={rows}
        getId={(c) => c.id}
        entity="credit note"
        removeLabel="Void"
        search={(c) => `${c.id} ${c.customer} ${c.against}`}
        filters={[{ label: "Status", get: (c) => c.status }]}
        createLabel="Issue credit note"
        form={(c) => (
          <FormGrid fields={[
            { label: "Customer", value: c?.customer, options: customersList.length ? customersList.map((x) => x.name) : ["Default Customer"], wide: true },
            { label: "Against invoice", value: c?.against, options: invoicesList.map((i) => i.code || `INV-${i.id}`) },
            { label: "Amount (₹)", value: c?.amount, type: "number" },
            { label: "Reason", value: "Credit adjustment" },
          ]} />
        )}
        onSave={async (data) => {
          const amt = Number(data["Amount (₹)"]) || 0;
          if (amt <= 0) {
            throw new Error("Credit note amount must be greater than zero");
          }
          const matchedCust = customersList.find((x) => x.name === data["Customer"]) || customersList[0];
          const matchedInv = invoicesList.find((i) => (i.code || `INV-${i.id}`) === data["Against invoice"]);
          await api.post("/sales/credit-notes/", {
            customer: matchedCust?.id || 1,
            invoice: matchedInv?.id || null,
            amount: amt,
            note_date: new Date().toISOString().slice(0, 10),
            reason: data["Reason"] || "Credit adjustment",
            status: "Pending",
          });
          toast.success("Credit note issued!");
          fetchCreditNotes();
        }}
        onDelete={async (c) => {
          if (c.backendId) {
            await api.delete(`/sales/credit-notes/${c.backendId}/`);
            toast.success(`Credit note ${c.id} voided`);
            fetchCreditNotes();
          }
        }}
        detail={(c) => <DetailGrid items={[["Customer", c.customer], ["Against", c.against], ["Return", c.returnRef], ["Amount", inr(c.amount)], ["Adjusted", inr(c.adjusted)], ["Status", c.status]]} />}
        columns={[
          { key: "id", header: "Credit note", render: (c) => <span className="font-medium">{c.id}</span> },
          { key: "date", header: "Date", sort: (c) => c.iso, render: (c) => <M>{c.date}</M> },
          { key: "cust", header: "Customer", render: (c) => c.customer },
          { key: "inv", header: "Against", render: (c) => <InvoiceLink id={c.against} /> },
          { key: "amt", header: "Amount", align: "right", sort: (c) => c.amount, render: (c) => inr(c.amount) },
          { key: "adj", header: "Adjusted", align: "right", className: "hidden md:table-cell", render: (c) => inr(c.adjusted) },
          { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status === "Adjusted" ? "Completed" : "Pending"} /> },
        ]}
      />
    </>
  );
}

type SalesAtt = {
  id: string;
  name: string;
  type: "PDF" | "Image" | "Excel" | "Word" | "ZIP";
  size: string;
  uploaded: string;
  by: string;
  record: string;
  category: string;
  customer: string;
};

export function SalesAttachments() {
  const [items, setItems] = useState<SalesAtt[]>([]);

  useEffect(() => {
    api.get<any>("/sales/attachments/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const mapped: SalesAtt[] = list.map((a: any) => ({
          id: a.code || `ATT-${a.id}`,
          name: a.name,
          type: (a.file_type || "PDF") as SalesAtt["type"],
          size: a.file_size || "1.0 MB",
          uploaded: a.created_at ? new Date(a.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Recent",
          by: a.uploaded_by || "System",
          record: a.record_ref || a.invoice_code || "—",
          category: a.category,
          customer: a.customer_name || "—",
        }));
        setItems(mapped);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <SectionHeader title="Sales attachments" description="School order letters, ID-card data, approvals, purchase orders and delivery proofs linked to sales." />
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Files" value={String(items.length)} />
        <KpiCard label="ID-card data files" value={String(items.filter((a) => a.category === "ID-card files").length)} />
        <KpiCard label="Approvals" value={String(items.filter((a) => a.category === "Approval").length)} />
        <KpiCard label="Delivery proofs" value={String(items.filter((a) => a.category === "Delivery confirmation" || a.category === "Customer PO").length)} />
      </div>
      <AttachmentPanel items={items} title="All sales files" />
    </>
  );
}

export function InvoiceDetail({ id }: { id: string }) {
  const [inv, setInv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recordOpen, setRecordOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("NEFT");
  const [payRef, setPayRef] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadInvoice = () => {
    setLoading(true);
    api.get<any>(`/sales/invoices/${id}/`)
      .then((res) => {
        setInv(res);
        setPayAmount(String(res.balance_amount || ""));
      })
      .catch(() => {
        api.get<any>(`/sales/invoices/?q=${id}`)
          .then((res) => {
            const list = Array.isArray(res) ? res : (res?.results ?? []);
            const found = list.find((x: any) => x.code === id || String(x.id) === id);
            if (found) {
              setInv(found);
              setPayAmount(String(found.balance_amount || ""));
            } else {
              setInv(null);
            }
          })
          .catch(() => setInv(null));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const handleRecordPayment = async () => {
    const amt = Number(payAmount);
    if (!inv || isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }
    try {
      setSubmitting(true);
      await api.post("/sales/payments/", {
        customer: inv.customer,
        invoice: inv.id,
        amount: amt,
        payment_mode: payMode,
        reference_number: payRef,
        payment_date: new Date().toISOString().slice(0, 10),
        status: "Cleared",
      });
      toast.success("Payment recorded successfully!");
      setRecordOpen(false);
      loadInvoice();
    } catch (err: any) {
      toast.error(err?.message || "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading invoice details...</div>;
  }

  if (!inv) {
    return <EmptyState title="Invoice not found" description={`No invoice with identifier ${id}.`} action={<Button asChild variant="outline"><Link to="/sales/$section" params={{ section: "invoices" }}>Back to invoices</Link></Button>} />;
  }

  const lines = (inv.lines || []).map((l: any) => ({
    code: l.item_code || "",
    name: l.item_name || l.description || "Item",
    description: l.description || "",
    qty: Number(l.quantity) || 1,
    unit: "Nos",
    rate: Number(l.unit_price) || 0,
    defaultRate: Number(l.unit_price) || 0,
    discount: Number(l.discount_percentage) || 0,
    tax: Number(l.tax_rate) || 18,
  }));
  const grand = Number(inv.total_amount) || 0;
  const received = Number(inv.received_amount) || 0;
  const balance = Number(inv.balance_amount) || 0;
  const taxes = Number(inv.tax_amount) || 0;
  const inter = (inv.customer_gstin || "").startsWith("33");
  const pays: any[] = inv.payments || [];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/sales/$section" params={{ section: "invoices" }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3" /> Sales invoices</Link>
          <h1 className="mt-1 flex items-center gap-3 text-xl font-semibold sm:text-2xl">{inv.code} <StatusBadge status={inv.status} /></h1>
          <p className="text-sm text-muted-foreground">{inv.customer_name} · {inv.invoice_date}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Download className="size-4" /> Download</Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const tid = toast.loading(`Emailing invoice ${inv.code}...`);
              try {
                const res = await salesApi.sendInvoiceEmail(inv.id);
                if (res.success) {
                  toast.success(res.message || `Tax invoice emailed to ${res.recipient}`, { id: tid });
                } else {
                  toast.error(res.message || res.error || "Failed to send invoice email", { id: tid });
                }
              } catch (err: any) {
                toast.error(err?.message || "Failed to send email", { id: tid });
              }
            }}
          >
            <Send className="size-4" /> Send Email
          </Button>
          {balance > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const tid = toast.loading(`Sending payment reminder for invoice ${inv.code}...`);
                try {
                  const res = await salesApi.sendInvoiceReminder(inv.id);
                  if (res.success) {
                    toast.success(res.message || `Payment reminder emailed to ${res.recipient}`, { id: tid });
                  } else {
                    toast.error(res.message || res.error || "Failed to send reminder", { id: tid });
                  }
                } catch (err: any) {
                  toast.error(err?.message || "Failed to send reminder", { id: tid });
                }
              }}
            >
              <Bell className="size-4" /> Send Reminder
            </Button>
          ) : null}
          {balance > 0 ? <Button size="sm" onClick={() => setRecordOpen(true)}>Record payment</Button> : null}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Invoice total" value={inr(grand)} />
        <KpiCard label="Tax" value={inr2(taxes)} hint={inter ? "IGST" : "CGST + SGST"} />
        <KpiCard label="Received" value={inr(received)} tone="up" />
        <KpiCard label="Outstanding" value={inr(balance)} hint={balance ? `Due ${inv.due_date}` : "Fully paid"} tone={balance ? "down" : "up"} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <DocumentSheet
            title="TAX INVOICE"
            number={inv.code}
            date={inv.invoice_date}
            customerId={String(inv.customer)}
            lines={lines}
            received={received}
            extra={<div className="sm:text-right"><p className="text-xs text-muted-foreground">Invoice information</p><p>Due {inv.due_date}</p><p>PO: {inv.customer_po_ref || "—"}</p><p>Salesperson: {inv.salesperson || "Sales Team"}</p></div>}
          />
          <Panel title="Tax breakup" bodyClassName="p-0">
            <Table><TableHeader><TableRow><TableHead>Rate</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">{inter ? "IGST" : "CGST"}</TableHead>{inter ? null : <TableHead className="text-right">SGST</TableHead>}</TableRow></TableHeader>
              <TableBody>{Array.from(new Set(lines.map((l: any) => l.tax))).map((rate: any) => { const ls = lines.filter((l: any) => l.tax === rate); const tx = ls.reduce((s: number, l: any) => s + lineTax(l), 0); return <TableRow key={rate}><TableCell>{rate}%</TableCell><TableCell className="text-right tabular">{inr2(ls.reduce((s: number, l: any) => s + lineAmount(l), 0))}</TableCell><TableCell className="text-right tabular">{inr2(inter ? tx : tx / 2)}</TableCell>{inter ? null : <TableCell className="text-right tabular">{inr2(tx / 2)}</TableCell>}</TableRow>; })}</TableBody></Table>
          </Panel>
          <Panel title="Payments" bodyClassName="p-0">
            {pays.length === 0 ? <div className="p-5"><EmptyState title="No payments yet" description="Payments recorded against this invoice will show here." /></div> : (
              <Table><TableHeader><TableRow><TableHead>Receipt</TableHead><TableHead>Date</TableHead><TableHead>Mode</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{pays.map((p: any) => <TableRow key={p.id}><TableCell className="font-medium">{p.code || `RCPT-${p.id}`}</TableCell><TableCell className="text-muted-foreground">{p.payment_date}</TableCell><TableCell>{p.payment_mode} · <M>{p.reference_number || "—"}</M></TableCell><TableCell className="text-right tabular">{inr(Number(p.amount) || 0)}</TableCell><TableCell><StatusBadge status={p.status} /></TableCell></TableRow>)}</TableBody></Table>
            )}
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Customer">
            <p className="font-medium">{inv.customer_name}</p>
            <p className="text-sm text-muted-foreground">{inv.customer_city || "Kerala"}</p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div>{inv.customer_contact || "Primary Contact"}</div>
              <div className="text-muted-foreground">{inv.customer_phone || "—"}</div>
              <div className="text-muted-foreground">{inv.customer_email || "—"}</div>
              <div className="font-mono text-xs">{inv.customer_gstin || "Unregistered"}</div>
            </dl>
          </Panel>
        </div>
      </div>

      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record payment for {inv.code}</DialogTitle>
            <DialogDescription>Balance due: {inr(balance)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Field label="Amount (₹)" required>
              <Input type="number" min={0.01} max={balance} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </Field>
            <Field label="Payment mode" required>
              <select value={payMode} onChange={(e) => setPayMode(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                {["NEFT", "UPI", "RTGS", "Cheque", "Cash"].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Reference / UTR number">
              <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="e.g. UTR123456789" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordOpen(false)}>Cancel</Button>
            <Button disabled={submitting} onClick={handleRecordPayment}>{submitting ? "Saving..." : "Save payment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const recentSalesActivity = [];
