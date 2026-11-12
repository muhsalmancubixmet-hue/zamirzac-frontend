import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Check, CheckCircle2, ExternalLink, FileText, Loader2, Pencil, Plus, RefreshCw, Save, ScanLine, Send, Sparkles, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, KpiCard, Panel, StatusBadge } from "@/components/erp/primitives";
import { DataTable, DetailGrid, FormGrid } from "@/components/erp/DataTable";
import { ExportButtons, SectionHeader } from "@/components/erp/ModuleLayout";
import { AttachmentPanel, Field } from "@/components/sales/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError, purchasesApi } from "@/lib/api";
import { inr } from "@/lib/format";
import { currentUser } from "@/lib/user";
import type { Attachment } from "@/data/sales";
import { items, itemName, pTotals, purchaseAttachments, purchaseOrders, purchaseReturns, supplierPayments, suppliers, type Bill, type PLine, type PO, type PurchaseReturn } from "@/data/ops";
import { ops, useOps } from "@/data/ops-store";
import { LineEditor, Steps, axis, chartColors, k, sum, tip } from "./common";

const buyable = items.filter((i) => i.type === "Raw Material" || i.type === "Consumable");
const M = ({ children }: { children: React.ReactNode }) => <span className="text-muted-foreground">{children}</span>;

export function PurchaseDashboard() {
  const { bills } = useOps();
  const monthly = [["Apr", 1840000], ["May", 2120000], ["Jun", 1960000], ["Jul", 2480000], ["Aug", 2710000], ["Sep", sum(bills, (b) => b.total)]].map(([m, v]) => ({ m, v }));
  const bySup = Object.values(bills.reduce<Record<string, { name: string; v: number }>>((a, b) => { (a[b.supplier] ??= { name: b.supplier, v: 0 }).v += b.total; return a; }, {})).sort((a, b) => b.v - a.v);
  const byCat = Object.values(bills.flatMap((b) => b.lines).reduce<Record<string, { name: string; value: number }>>((a, l) => { const c = items.find((i) => i.code === l.code)?.category ?? "Other"; (a[c] ??= { name: c, value: 0 }).value += l.qty * l.rate; return a; }, {}));
  return (
    <>
      <SectionHeader title="Purchase dashboard" description="September 2026 · all warehouses" actions={<><ExportButtons /><Button size="sm" variant="outline" asChild><Link to="/purchase/$section" params={{ section: "ai-documents" }}><Sparkles className="size-4" /> Process bill with AI</Link></Button><Button size="sm" asChild><Link to="/purchase/$section" params={{ section: "new-order" }}><Plus className="size-4" /> New purchase order</Link></Button></>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiCard label="Total purchases" value={inr(sum(bills, (b) => b.total))} hint="+6.1% vs Aug" />
        <KpiCard label="Pending POs" value={String(purchaseOrders.filter((p) => p.status === "Sent" || p.status === "Partially Received").length)} hint={inr(sum(purchaseOrders.filter((p) => p.status === "Sent" || p.status === "Partially Received"), (p) => p.total))} />
        <KpiCard label="Purchase bills" value={String(bills.length)} hint={`${bills.filter((b) => b.stage === "Under review").length} awaiting review`} />
        <KpiCard label="Amount payable" value={inr(sum(bills, (b) => b.total))} />
        <KpiCard label="Paid amount" value={inr(sum(bills, (b) => b.paid))} tone="up" hint="Cleared to suppliers" />
        <KpiCard label="Outstanding" value={inr(sum(bills, (b) => b.balance))} tone="down" hint={`${bills.filter((b) => b.payment === "Overdue").length} overdue bills`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Monthly purchases" description="FY 2026-27" className="xl:col-span-2">
          <div className="h-60"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly} margin={{ left: -4, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" /><XAxis dataKey="m" {...axis} /><YAxis {...axis} tickFormatter={k} /><RTooltip contentStyle={tip} formatter={(v: number) => inr(v)} />
            <Bar dataKey="v" name="Purchases" fill="var(--color-chart-2)" radius={[3, 3, 0, 0]} />
          </BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Purchase by category">
          <div className="h-60"><ResponsiveContainer width="100%" height="100%"><PieChart>
            <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>{byCat.map((_, i) => <Cell key={i} fill={chartColors[i % 5]} />)}</Pie>
            <RTooltip contentStyle={tip} formatter={(v: number) => inr(v)} />
          </PieChart></ResponsiveContainer></div>
          <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">{byCat.map((c, i) => <li key={c.name} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: chartColors[i % 5] }} />{c.name}</li>)}</ul>
        </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Purchase by supplier">
          <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={bySup.slice(0, 6)} layout="vertical" margin={{ left: 40, right: 12 }}>
            <XAxis type="number" {...axis} tickFormatter={k} /><YAxis type="category" dataKey="name" {...axis} width={150} /><RTooltip contentStyle={tip} formatter={(v: number) => inr(v)} />
            <Bar dataKey="v" name="Purchases" fill="var(--color-chart-1)" radius={[0, 3, 3, 0]} />
          </BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Recent purchases" bodyClassName="p-0">
          <ul className="divide-y divide-border">{bills.slice(0, 7).map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <div className="min-w-0"><p className="truncate font-medium">{b.supplier}</p><p className="text-xs text-muted-foreground">{b.id} · {b.date}</p></div>
              <div className="flex items-center gap-3"><StatusBadge status={b.payment} /><span className="tabular font-medium">{inr(b.total)}</span></div>
            </li>))}</ul>
        </Panel>
      </div>
      <Panel title="Top suppliers" bodyClassName="p-0">
        <ul className="divide-y divide-border">{[...suppliers].sort((a, b) => b.purchases - a.purchases).slice(0, 5).map((s, i) => (
          <li key={s.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
            <span className="w-5 text-xs text-muted-foreground tabular">{i + 1}</span>
            <div className="min-w-0 flex-1"><p className="truncate font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.city} · {s.category}</p></div>
            <span className="hidden text-xs text-muted-foreground sm:block">Outstanding {inr(s.outstanding)}</span>
            <span className="tabular font-medium">{inr(s.purchases)}</span>
          </li>))}</ul>
      </Panel>
    </>
  );
}

export function Suppliers() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuppliers = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<any>("/parties/suppliers/"),
      api.get<any>("/purchases/bills/"),
    ])
      .then(([supRes, billRes]) => {
        const supList = Array.isArray(supRes) ? supRes : (supRes?.results ?? []);
        const billList = Array.isArray(billRes) ? billRes : (billRes?.results ?? []);

        // Aggregate verified purchase bill balances per supplier backend ID
        const billStats: Record<number, { purchases: number; paid: number; outstanding: number }> = {};
        for (const b of billList) {
          const supId = typeof b.supplier === "object" ? b.supplier?.id : b.supplier;
          if (supId) {
            const cur = billStats[supId] || { purchases: 0, paid: 0, outstanding: 0 };
            cur.purchases += Number(b.total_amount) || 0;
            cur.paid += Number(b.paid_amount) || 0;
            cur.outstanding += Number(b.balance_amount) || 0;
            billStats[supId] = cur;
          }
        }

        const apiSups = supList.map((s: any) => {
          const stats = billStats[s.id] || { purchases: 0, paid: 0, outstanding: 0 };
          return {
            id: s.code || `SUP-${s.id}`,
            backendId: s.id,
            name: s.name,
            category: s.category || "Raw Materials",
            gstin: s.gstin || "—",
            city: s.city || "—",
            contact: s.contact_person || s.name,
            phone: s.phone || "—",
            email: s.email || "—",
            terms: s.payment_terms || "30 days",
            purchases: stats.purchases,
            paid: stats.paid,
            outstanding: stats.outstanding,
            rating: Number(s.rating) || 5.0,
            status: (s.status || "Active") as any,
          };
        });
        setRows(apiSups);
      })
      .catch((err: any) => {
        console.error("Backend suppliers fetch error:", err);
        setError(err?.message || "Failed to load suppliers from backend");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleSaveSupplier = async (data: Record<string, any>, row?: any) => {
    try {
      const gstinInput = data["GSTIN"] ? String(data["GSTIN"]).trim().toUpperCase() : "";
      interface SupplierPayload {
        name: string;
        city: string;
        contact_person: string;
        phone: string;
        email: string;
        payment_terms: string;
        gstin?: string;
      }
      const payload: SupplierPayload = {
        name: String(data["Supplier name"] || "").trim(),
        city: String(data["City"] || "").trim(),
        contact_person: String(data["Contact person"] || "").trim(),
        phone: String(data["Phone"] || "").trim(),
        email: String(data["Email"] || "").trim(),
        payment_terms: data["Payment terms"] || "30 days",
      };
      if (gstinInput) {
        payload.gstin = gstinInput;
      }

      if (row?.backendId) {
        await api.patch(`/parties/suppliers/${row.backendId}/`, payload);
        toast.success(`Supplier ${payload.name} updated successfully`);
      } else {
        await api.post("/parties/suppliers/", payload);
        toast.success(`Supplier ${payload.name} created successfully`);
      }
      fetchSuppliers();
      return true;
    } catch (err: any) {
      const errorMsg = err?.fieldErrors
        ? Object.entries(err.fieldErrors)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join("; ")
        : err?.message || "Failed to save supplier";
      toast.error(errorMsg);
      return false;
    }
  };

  const handleDeleteSupplier = async (s: any) => {
    try {
      const supId = s.backendId || s.id;
      if (supId) {
        await api.delete(`/parties/suppliers/${supId}/`);
      }
      toast.success(`Supplier ${s.name} deleted successfully`);
      fetchSuppliers();
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete supplier");
      return false;
    }
  };

  return (
    <>
      <SectionHeader title="Suppliers" description="Vendors for card materials, ribbons, lanyards, fittings and packaging." actions={<ExportButtons />} />
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-accent" />
          <span className="ml-2 text-sm text-muted-foreground">Loading suppliers from backend…</span>
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={fetchSuppliers}>
            Retry
          </Button>
        </div>
      ) : (
        <DataTable rows={rows} getId={(s) => s.id} entity="supplier" createLabel="New supplier" search={(s) => `${s.name} ${s.city} ${s.gstin} ${s.contact}`} searchPlaceholder="Search name, city, GSTIN"
          filters={[{ label: "Categories", get: (s) => s.category }, { label: "Statuses", get: (s) => s.status }]} removeLabel="Delete"
          onDelete={handleDeleteSupplier}
          extraActions={[{
            label: "Archive",
            onClick: async (s: any) => {
              try {
                const nextStatus = s.status === "Active" ? "Inactive" : "Active";
                await api.patch(`/parties/suppliers/${s.backendId || s.id}/`, { status: nextStatus });
                toast.success(`${s.name} marked as ${nextStatus.toLowerCase()}`);
                fetchSuppliers();
              } catch (err: any) {
                toast.error(err?.message || "Failed to update supplier status");
              }
            },
          }]}
          columns={[
            { key: "name", header: "Supplier", sort: (s) => s.name, render: (s) => <div><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.id}</p></div> },
            { key: "city", header: "Location", sort: (s) => s.city, render: (s) => s.city },
            { key: "gst", header: "GSTIN", render: (s) => <span className="font-mono text-xs">{s.gstin}</span> },
            { key: "contact", header: "Contact", render: (s) => <div><p>{s.contact}</p><p className="text-xs text-muted-foreground">{s.phone}</p></div> },
            { key: "terms", header: "Terms", render: (s) => s.terms },
            { key: "pur", header: "Purchases", align: "right", sort: (s) => s.purchases, render: (s) => inr(s.purchases) },
            { key: "out", header: "Outstanding", align: "right", sort: (s) => s.outstanding, render: (s) => <span className={s.outstanding ? "text-destructive" : ""}>{inr(s.outstanding)}</span> },
            { key: "st", header: "Status", render: (s) => <StatusBadge status={s.status} /> },
          ]}
          detail={(s) => <DetailGrid items={[["Name", s.name], ["Category", s.category], ["GSTIN", s.gstin], ["Location", s.city], ["Contact", s.contact], ["Phone", s.phone], ["Email", s.email], ["Payment terms", s.terms], ["Total purchases", inr(s.purchases)], ["Paid", inr(s.paid)], ["Outstanding", inr(s.outstanding)], ["Rating", `${s.rating} / 5`]]} />}
          form={(s) => <FormGrid fields={[{ label: "Supplier name", value: s?.name, wide: true, required: true }, { label: "GSTIN", value: s?.gstin === "—" ? "" : s?.gstin }, { label: "City", value: s?.city === "—" ? "" : s?.city }, { label: "Contact person", value: s?.contact }, { label: "Phone", value: s?.phone === "—" ? "" : s?.phone }, { label: "Email", value: s?.email === "—" ? "" : s?.email, wide: true }, { label: "Payment terms", value: s?.terms, options: ["Advance", "15 days", "30 days", "45 days"] }]} />}
          onSave={handleSaveSupplier}
        />
      )}
    </>
  );
}

export function PurchaseOrders() {
  const nav = useNavigate();
  const [rows, setRows] = useState<PO[]>([]);

  const fetchOrders = () => {
    api.get<any>("/purchases/orders/").then((res) => {
      const list = Array.isArray(res) ? res : (res?.results ?? []);
      const apiPOs: PO[] = list.map((p: any) => {
        const dt = new Date(p.order_date || p.created_at);
        return {
          id: p.code || `PO-${p.id}`,
          backendId: p.id,
          date: dt.toLocaleDateString(),
          iso: p.order_date || dt.toISOString().slice(0, 10),
          supplier: p.supplier_name || `Supplier #${p.supplier}`,
          supplierId: String(p.supplier || "1"),
          expected: p.expected_delivery_date || "—",
          total: Number(p.total_amount) || 0,
          status: p.status || "Sent",
          attachments: 0,
          lines: (p.lines || []).map((it: any) => ({
            code: it.item_code || "RM-01",
            qty: Number(it.quantity) || 1,
            rate: Number(it.unit_price) || 0,
            discount: Number(it.discount_percentage) || 0,
            tax: Number(it.tax_rate) || 18,
          })),
          notes: p.notes || "",
        };
      });
      setRows(apiPOs);
    }).catch((err) => {
      console.error("Backend PO fetch error:", err);
    });
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleDeleteOrder = async (p: PO) => {
    try {
      const orderId = p.backendId || p.id;
      if (orderId) {
        await api.delete(`/purchases/orders/${orderId}/`);
      }
      toast.success(`${p.id} deleted successfully`);
      fetchOrders();
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete purchase order");
      return false;
    }
  };

  return (
    <>
      <SectionHeader title="Purchase orders" description="Orders placed with suppliers and their receipt status." actions={<><ExportButtons /><Button size="sm" onClick={() => nav({ to: "/purchase/$section", params: { section: "new-order" } })}><Plus className="size-4" /> New purchase order</Button></>} />
      <DataTable rows={rows} getId={(p) => p.id} entity="purchase order" search={(p) => `${p.id} ${p.supplier}`} date={(p) => p.iso}
        filters={[{ label: "Statuses", get: (p) => p.status }, { label: "Suppliers", get: (p) => p.supplier }]} removeLabel="Delete"
        onDelete={handleDeleteOrder}
        extraActions={[
          { label: "Mark as received", icon: <Check className="size-4" />, show: (p) => p.status === "Sent" || p.status === "Partially Received", onClick: async (p) => {
            try {
              await api.patch(`/purchases/orders/${p.backendId || p.id}/`, { status: "Received" });
              toast.success(`${p.id} marked as received`);
              fetchOrders();
            } catch (err: any) {
              toast.error(err?.message || "Failed to update status");
            }
          } },
          { label: "Send to supplier", icon: <Send className="size-4" />, show: (p) => p.status === "Draft" || p.status === "Sent", onClick: async (p) => {
            try {
              const res = await purchasesApi.sendPurchaseOrder(p.backendId || p.id);
              toast.success(res.message || `${p.id} sent to supplier via email`);
              fetchOrders();
            } catch (err: any) {
              toast.error(err?.message || "Failed to dispatch purchase order email");
            }
          } },
          { label: "Cancel order", icon: <X className="size-4" />, show: (p) => p.status !== "Cancelled" && p.status !== "Received", onClick: async (p) => {
            try {
              await api.patch(`/purchases/orders/${p.backendId || p.id}/`, { status: "Cancelled" });
              toast.success(`${p.id} cancelled`);
              fetchOrders();
            } catch (err: any) {
              toast.error(err?.message || "Failed to cancel order");
            }
          } },
        ]}
        columns={[
          { key: "id", header: "PO number", sort: (p) => p.id, render: (p) => <span className="font-medium text-accent">{p.id}</span> },
          { key: "date", header: "Order date", sort: (p) => p.iso, render: (p) => p.date },
          { key: "sup", header: "Supplier", sort: (p) => p.supplier, render: (p) => p.supplier },
          { key: "exp", header: "Expected", render: (p) => p.expected },
          { key: "items", header: "Items", align: "right", render: (p) => p.lines.length },
          { key: "total", header: "Total", align: "right", sort: (p) => p.total, render: (p) => inr(p.total) },
          { key: "st", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
        ]}
        detail={(p) => <PoDetail po={p} />}
      />
    </>
  );
}
function PoDetail({ po }: { po: PO }) {
  return (
    <div className="space-y-3">
      <DetailGrid items={[["Supplier", po.supplier], ["Status", <StatusBadge key="s" status={po.status} />], ["Order date", po.date], ["Expected delivery", po.expected], ["Total", inr(po.total)], ["Attachments", `${po.attachments} file(s)`]]} />
      <ul className="divide-y divide-border rounded-md border border-border text-sm">{po.lines.map((l) => <li key={l.code} className="flex justify-between gap-3 px-3 py-2"><span className="truncate">{itemName(l.code)}</span><span className="tabular text-muted-foreground">{l.qty} × ₹{l.rate}</span></li>)}</ul>
      {po.notes ? <p className="text-sm text-muted-foreground">Note: {po.notes}</p> : null}
    </div>
  );
}

export function NewPurchaseOrder() {
  const nav = useNavigate();
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [lines, setLines] = useState<PLine[]>([]);
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [notes, setNotes] = useState("Please mention PO number on the invoice. Deliver between 10 AM and 5 PM.");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<any>("/parties/suppliers/"),
      api.get<any>("/catalog/items/"),
    ]).then(([supRes, itemRes]) => {
      const sList = Array.isArray(supRes) ? supRes : (supRes?.results ?? []);
      const mappedSups = sList.map((s: any) => ({
        id: String(s.id),
        code: s.code || `SUP-${s.id}`,
        name: s.name,
        city: s.city || "—",
        gstin: s.gstin || "—",
        terms: s.payment_terms || "30 days",
        status: s.status || "Active",
      }));
      setSuppliersList(mappedSups);
      if (mappedSups.length > 0) {
        setSupplierId(mappedSups[0].id);
      }

      const iList = Array.isArray(itemRes) ? itemRes : (itemRes?.results ?? []);
      const mappedItems = iList.map((item: any) => ({
        id: String(item.id),
        backendId: item.id,
        code: item.code,
        name: item.name,
        category: item.category_name || "Raw Materials",
        type: (item.item_type || "Raw Material") as any,
        uom: item.uom_code || "Nos",
        hsn: item.hsn_code || "3926",
        purchase: Number(item.purchase_price) || 0,
        selling: Number(item.selling_price) || 0,
        tax: Number(item.default_tax_rate) || 18,
        stock: 0,
        min: 10,
        max: 1000,
        reorder: 50,
        supplierId: String(item.primary_supplier || ""),
        supplier: item.primary_supplier_name || "—",
        leadDays: 7,
        location: "Kalamassery Main",
      }));
      setCatalogItems(mappedItems);
      if (mappedItems.length > 0) {
        setLines([{
          code: mappedItems[0].code,
          qty: 50,
          rate: mappedItems[0].purchase || 10,
          discount: 0,
          tax: mappedItems[0].tax || 18,
        }]);
      }
    }).catch((err) => {
      console.error("Failed to load PO dependencies:", err);
    });
  }, []);

  const [savingMode, setSavingMode] = useState<"Draft" | "Sent" | null>(null);
  const [deliverTo, setDeliverTo] = useState("Kalamassery Main");

  const sup = suppliersList.find((s) => String(s.id) === String(supplierId)) ?? suppliersList[0];

  const save = async (statusStr: "Draft" | "Sent") => {
    if (!supplierId && !sup?.id) {
      toast.error("Please select a supplier");
      return;
    }
    const validLines = lines.filter((l) => Number(l.qty) > 0);
    if (!validLines.length) {
      toast.error("Add at least one product with quantity > 0");
      return;
    }

    try {
      setSaving(true);
      setSavingMode(statusStr);
      toast.loading(statusStr === "Sent" ? "Creating purchase order and dispatching email…" : "Saving draft purchase order…", { id: "po-save" });
      const targetSupId = Number(supplierId) || Number(sup?.id) || 1;
      const linesPayload = validLines.map((l) => {
        const itemObj = catalogItems.find((ci) => ci.code === l.code);
        return {
          item: Number(itemObj?.backendId) || Number(itemObj?.id) || 1,
          quantity: Number(l.qty) || 1,
          unit_price: Number(l.rate) || 0,
          discount_percentage: Number(l.discount) || 0,
          tax_rate: Number(l.tax) || 18,
        };
      });

      const fullNotes = [notes.trim(), deliverTo ? `Deliver to: ${deliverTo}` : ""].filter(Boolean).join("\n\n");

      const payload = {
        supplier: targetSupId,
        order_date: orderDate,
        expected_delivery_date: expectedDate || null,
        status: statusStr,
        notes: fullNotes,
        lines: linesPayload,
      };

      const created = await api.post<any>("/purchases/orders/", payload);
      if (statusStr === "Sent" && created?.id) {
        try {
          const emailRes = await purchasesApi.sendPurchaseOrder(created.id, sup?.email);
          toast.success(emailRes?.message || `Purchase order ${created.code || "PO"} sent to supplier via email`, { id: "po-save" });
        } catch (emailErr: any) {
          toast.success(`Purchase order ${created.code || "PO"} saved & marked as sent`, { id: "po-save" });
        }
      } else {
        toast.success(`Purchase order ${created?.code || "PO"} saved as draft`, { id: "po-save" });
      }
      nav({ to: "/purchase/$section", params: { section: "orders" } });
    } catch (err: any) {
      toast.error(err?.message || "Failed to create purchase order", { id: "po-save" });
    } finally {
      setSaving(false);
      setSavingMode(null);
    }
  };

  return (
    <>
      <SectionHeader title="New purchase order" description="Raising an order does not change stock until goods are received." actions={
        <>
          <Button variant="outline" size="sm" disabled={saving} onClick={() => save("Draft")}>
            {savingMode === "Draft" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {savingMode === "Draft" ? "Saving..." : "Save draft"}
          </Button>
          <Button size="sm" disabled={saving} onClick={() => save("Sent")}>
            {savingMode === "Sent" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {savingMode === "Sent" ? "Sending..." : "Save & send"}
          </Button>
        </>
      } />
      <Panel title="Order details">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Supplier" required>
            {suppliersList.length > 0 ? (
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{suppliersList.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <div className="text-xs text-muted-foreground py-2">Loading suppliers...</div>
            )}
          </Field>
          <Field label="Order date" required><Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></Field>
          <Field label="Expected delivery"><Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} /></Field>
          <Field label="Deliver to"><Select value={deliverTo} onValueChange={setDeliverTo}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Kalamassery Main", "Kozhikode Depot", "Thrissur Branch"].map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent></Select></Field>
        </div>
        {sup ? <p className="mt-3 text-xs text-muted-foreground">{sup.city} · GSTIN {sup.gstin} · {sup.terms}</p> : null}
      </Panel>
      <Panel title="Products" bodyClassName="p-0">
        <LineEditor lines={lines} onChange={setLines} catalog={catalogItems.length ? catalogItems : buyable} />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Notes"><Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} /></Panel>
        <AttachmentPanel items={[]} title="Attachments" />
      </div>
    </>
  );
}


const billSteps = ["Bill entry", "Review", "Confirm", "Stock & accounting entry"];
const stageIdx = (s: Bill["stage"]) => ({ Draft: 0, "Under review": 1, Confirmed: 2, Posted: 3 })[s];

export function PurchaseBills() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();
  const [review, setReview] = useState<Bill | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchBills = async (p = page, q = searchQuery, stage = stageFilter, size = pageSize) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const params: Record<string, any> = {
        page: p + 1, // DRF 1-indexed
        page_size: size,
      };
      if (q.trim()) params["q"] = q.trim();
      if (stage && stage !== "all") params["stage"] = stage;

      const res = await api.get<any>("/purchases/bills/", params, { signal: controller.signal });
      const count = res?.count ?? (Array.isArray(res) ? res.length : 0);
      setTotalCount(count);

      const raw = Array.isArray(res) ? res : (res?.results ?? []);
      const mapped: Bill[] = raw.map((b: any) => ({
        id: b.code || `BILL-${b.id}`,
        backendId: b.id,
        supplierBillNo: b.supplier_bill_no || "—",
        supplierId: String(b.supplier || ""),
        supplier: b.supplier_name || "—",
        gstin: b.supplier_gstin || "—",
        date: b.bill_date ? new Date(b.bill_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—",
        iso: b.bill_date || "",
        due: b.due_date ? new Date(b.due_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—",
        po: b.purchase_order_code || (b.purchase_order ? `PO-${b.purchase_order}` : "—"),
        lines: (b.lines || []).map((l: any) => ({
          code: l.item_code || `ITM-${l.item}`,
          qty: Number(l.quantity) || 0,
          rate: Number(l.unit_price) || 0,
          discount: Number(l.discount_percentage) || 0,
          tax: Number(l.tax_rate) || 18,
        })),
        total: Number(b.total_amount) || 0,
        paid: Number(b.paid_amount) || 0,
        balance: Number(b.balance_amount) || 0,
        payment: (b.payment_status || "Pending") as any,
        stage: (b.stage || "Draft") as any,
        source: (b.source || "Manual") as any,
      }));
      setBills(mapped);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      const msg = err?.message || "Failed to load purchase bills";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills(0, "", "all", 25);
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return (
    <>
      <SectionHeader
        title="Purchase bills"
        description="Supplier invoices move through review and confirmation before stock and accounts are updated."
        actions={
          <>
            <ExportButtons />
            <Button size="sm" variant="outline" asChild>
              <Link to="/purchase/$section" params={{ section: "ai-documents" }}>
                <ScanLine className="size-4" /> Upload & extract
              </Link>
            </Button>
            <Button size="sm" onClick={() => nav({ to: "/purchase/$section", params: { section: "new-bill" } })}>
              <Plus className="size-4" /> Enter bill
            </Button>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        {(["Draft", "Under review", "Confirmed", "Posted"] as const).map((s) => (
          <KpiCard
            key={s}
            label={s}
            value={String(bills.filter((b) => b.stage === s).length)}
            hint={inr(sum(bills.filter((b) => b.stage === s), (b) => b.total))}
          />
        ))}
      </div>
      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => fetchBills()}>
            Retry
          </Button>
        </div>
      ) : (
        <DataTable
          rows={bills}
          getId={(b) => b.id}
          entity="purchase bill"
          searchPlaceholder="Search bill, supplier or PO"
          date={(b) => b.iso}
          onRowClick={setReview}
          filters={[
            { label: "Stages", get: (b) => b.stage, options: ["Draft", "Under review", "Confirmed", "Posted"] },
          ]}
          removeLabel="Void"
          serverSide={{
            totalCount,
            page,
            pageSize,
            loading,
            onPageChange: (newPage) => {
              setPage(newPage);
              fetchBills(newPage, searchQuery, stageFilter, pageSize);
            },
            onPageSizeChange: (newSize) => {
              setPageSize(newSize);
              setPage(0);
              fetchBills(0, searchQuery, stageFilter, newSize);
            },
            onSearchChange: (newQ) => {
              setSearchQuery(newQ);
              setPage(0);
              fetchBills(0, newQ, stageFilter, pageSize);
            },
            onFilterChange: (newFv) => {
              const nextStage = newFv["Stages"] || "all";
              setStageFilter(nextStage);
              setPage(0);
              fetchBills(0, searchQuery, nextStage, pageSize);
            },
          }}
          extraActions={[
            {
              label: "Review & post",
              icon: <CheckCircle2 className="size-4" />,
              show: (b) => b.stage !== "Posted",
              onClick: setReview,
            },
            {
              label: "Send remittance",
              icon: <Send className="size-4" />,
              show: (b) => Number(b.paid) > 0,
              onClick: async (b) => {
                try {
                  const res = await purchasesApi.sendBillRemittance(b.backendId || b.id, {
                    amount: b.paid,
                  });
                  toast.success(res.message || `Remittance advice sent for ${b.id}`);
                } catch (err: any) {
                  toast.error(err?.message || "Failed to send remittance advice");
                }
              },
            },
          ]}
          columns={[
            {
              key: "id",
              header: "Bill",
              sort: (b) => b.id,
              render: (b) => (
                <div>
                  <p className="font-medium text-accent">{b.id}</p>
                  <p className="text-xs text-muted-foreground">{b.supplierBillNo}</p>
                </div>
              ),
            },
            { key: "date", header: "Bill date", sort: (b) => b.iso, render: (b) => b.date },
            { key: "sup", header: "Supplier", sort: (b) => b.supplier, render: (b) => b.supplier },
            { key: "due", header: "Due", render: (b) => b.due },
            { key: "total", header: "Total", align: "right", sort: (b) => b.total, render: (b) => inr(b.total) },
            { key: "bal", header: "Balance", align: "right", sort: (b) => b.balance, render: (b) => inr(b.balance) },
            { key: "pay", header: "Payment", render: (b) => <StatusBadge status={b.payment} /> },
            {
              key: "stage",
              header: "Stage",
              render: (b) => (
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={b.stage} />
                  {b.source === "AI extracted" ? (
                    <Sparkles className="size-3.5 text-accent" aria-label="AI extracted" />
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      )}
      <BillReview
        bill={review}
        onClose={() => setReview(null)}
        onUpdated={() => {
          fetchBills();
          setReview(null);
        }}
      />
    </>
  );
}

function BillReview({
  bill,
  onClose,
  onUpdated,
}: {
  bill: Bill | null;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [updating, setUpdating] = useState(false);
  if (!bill) return null;
  const idx = stageIdx(bill.stage);

  const updateStage = async (newStage: Bill["stage"]) => {
    try {
      setUpdating(true);
      const targetId = bill.backendId || bill.id;
      await api.patch(`/purchases/bills/${targetId}/`, { stage: newStage });
      toast.success(`${bill.id} updated to stage: ${newStage}`);
      onUpdated?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || `Failed to update ${bill.id}`);
    } finally {
      setUpdating(false);
    }
  };

  const advance = () => {
    if (bill.stage === "Draft") {
      updateStage("Under review");
    } else if (bill.stage === "Under review") {
      updateStage("Confirmed");
    } else {
      setConfirm(true);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{bill.id} · {bill.supplier}</DialogTitle>
            <DialogDescription>Supplier bill {bill.supplierBillNo} · GSTIN {bill.gstin}</DialogDescription>
          </DialogHeader>
          <Steps steps={billSteps} current={idx === 3 ? 4 : idx} />
          <DetailGrid
            items={[
              ["Bill date", bill.date],
              ["Due date", bill.due],
              ["Against PO", bill.po],
              ["Payment", <StatusBadge key="p" status={bill.payment} />],
              ["Paid", inr(bill.paid)],
              ["Balance", inr(bill.balance)],
            ]}
          />
          <div className="max-h-64 overflow-auto rounded-md border border-border">
            <LineEditor lines={bill.lines} onChange={() => {}} catalog={[]} readOnly />
          </div>
          {bill.stage === "Posted" ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="size-4" /> Stock received and purchase journal posted.
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={updating}>Close</Button>
            {bill.stage !== "Posted" ? (
              <Button onClick={advance} disabled={updating}>
                {updating ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {bill.stage === "Draft"
                  ? "Send for review"
                  : bill.stage === "Under review"
                  ? "Mark reviewed & confirm"
                  : "Post to stock & accounts"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post {bill.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              This confirms {bill.lines.length} line item(s) and marks the purchase entry of {inr(bill.total)} payable to {bill.supplier} as Posted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={updating}
              onClick={async () => {
                await updateStage("Posted");
                setConfirm(false);
              }}
            >
              {updating ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Post bill
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function NewBill() {
  const nav = useNavigate();
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [billNo, setBillNo] = useState("SCM/26-27/512");
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [lines, setLines] = useState<PLine[]>([]);
  const [step, setStep] = useState(0);
  const [paid, setPaid] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<any>("/parties/suppliers/"),
      api.get<any>("/catalog/items/"),
    ]).then(([supRes, itemRes]) => {
      const sList = Array.isArray(supRes) ? supRes : (supRes?.results ?? []);
      const mappedSups = sList.map((s: any) => ({
        id: String(s.id),
        backendId: s.id,
        code: s.code || `SUP-${s.id}`,
        name: s.name,
        city: s.city || "Kochi, Kerala",
        gstin: s.gstin || "—",
        terms: s.payment_terms || "30 days",
        status: s.status || "Active",
      }));
      setSuppliersList(mappedSups);
      if (mappedSups.length > 0) {
        setSupplierId(mappedSups[0].id);
      }

      const iList = Array.isArray(itemRes) ? itemRes : (itemRes?.results ?? []);
      const mappedItems = iList.map((item: any) => ({
        id: String(item.id),
        backendId: item.id,
        code: item.code,
        name: item.name,
        category: item.category_name || "Raw Materials",
        type: (item.item_type || "Raw Material") as any,
        uom: item.uom_code || "Nos",
        hsn: item.hsn_code || "3926",
        purchase: Number(item.purchase_price) || 0,
        selling: Number(item.selling_price) || 0,
        tax: Number(item.default_tax_rate) || 18,
        stock: 0,
        min: 10,
        max: 1000,
        reorder: 50,
        supplierId: String(item.primary_supplier || ""),
        supplier: item.primary_supplier_name || "—",
        leadDays: 7,
        location: "Kalamassery Main",
      }));
      setCatalogItems(mappedItems);
      if (mappedItems.length > 0) {
        setLines([
          {
            code: mappedItems[0].code,
            qty: 50,
            rate: mappedItems[0].purchase || 10,
            discount: 0,
            tax: mappedItems[0].tax || 18,
          },
        ]);
      }
    }).catch((err) => {
      console.error("Failed to load NewBill dependencies:", err);
      toast.error("Failed to load suppliers and items");
    });
  }, []);

  const sup = suppliersList.find((s) => String(s.id) === String(supplierId)) ?? suppliersList[0];
  const t = pTotals(lines);
  const inter = sup?.city && !sup.city.includes("Kerala") && (sup.city.includes("TN") || sup.city.includes("KA") || !sup.city.includes("32"));

  const submitBill = async (stage: "Draft" | "Confirmed" | "Posted") => {
    if (!supplierId && !sup?.id) {
      toast.error("Please select a supplier");
      return;
    }
    if (!billNo.trim()) {
      toast.error("Please enter supplier bill number");
      return;
    }
    if (!lines.length || !lines.some((l) => l.qty > 0)) {
      toast.error("Add at least one product with quantity > 0");
      return;
    }

    try {
      setSubmitting(true);
      const supObj = suppliersList.find((s) => String(s.id) === String(supplierId));
      const targetSupId = supObj
        ? Number(supObj.backendId || supObj.id)
        : Number(supplierId) || Number(sup?.backendId) || Number(sup?.id);
      if (!targetSupId || isNaN(targetSupId)) {
        toast.error("Please select a valid supplier from the database");
        return;
      }
      const linesPayload = lines.map((l, idx) => {
        const itemObj = catalogItems.find((ci) => ci.code === l.code) || catalogItems[0];
        const itemId = Number(itemObj?.backendId) || Number(itemObj?.id);
        if (!itemId || isNaN(itemId)) {
          throw new Error(`Item on line ${idx + 1} (${l.code}) is not registered in the database catalog.`);
        }
        return {
          item: itemId,
          quantity: Number(l.qty) || 1,
          unit_price: Number(l.rate) || 0,
          discount_percentage: Number(l.discount) || 0,
          tax_rate: Number(l.tax) || 18,
        };
      });

      const payload = {
        supplier: targetSupId,
        supplier_bill_no: billNo.trim(),
        bill_date: billDate,
        due_date: dueDate || null,
        stage,
        paid_amount: String(paid || 0),
        lines: linesPayload,
      };

      const res = await api.post<any>("/purchases/bills/", payload);
      toast.success(`Purchase bill ${res?.code || ""} created successfully`);
      nav({ to: "/purchase/$section", params: { section: "bills" } });
    } catch (err: any) {
      const errorMsg =
        err?.fieldErrors
          ? Object.entries(err.fieldErrors)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
              .join("; ")
          : err?.message || "Failed to create purchase bill";
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="Enter purchase bill"
        description="Record vendor invoice, review GST and totals, and save or post to backend."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => submitBill("Draft")}
          >
            {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="size-4" />}
            Save draft
          </Button>
        }
      />
      <Steps steps={billSteps} current={step} />
      <Panel title="Supplier & bill">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Supplier" required>
            <Select value={supplierId} onValueChange={setSupplierId} disabled={step > 0}>
              <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>
                {suppliersList.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Supplier bill number" required>
            <Input value={billNo} onChange={(e) => setBillNo(e.target.value)} disabled={step > 0} />
          </Field>
          <Field label="Bill date">
            <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} disabled={step > 0} />
          </Field>
          <Field label="Due date">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={step > 0} />
          </Field>
        </div>
        {sup ? (
          <div className="mt-4 grid gap-3 rounded-md bg-muted/50 p-3 text-sm sm:grid-cols-4">
            <div><M>GSTIN</M><p className="font-mono text-xs">{sup.gstin}</p></div>
            <div><M>Place of supply</M><p>{inter ? `${sup.city} → Kerala (32)` : "Kerala (32)"}</p></div>
            <div><M>Tax type</M><p>{inter ? "IGST" : "CGST + SGST"}</p></div>
            <div><M>Input tax credit</M><p className="tabular">{inr(t.tax)}</p></div>
          </div>
        ) : null}
      </Panel>
      <Panel title="Products" bodyClassName="p-0">
        <LineEditor lines={lines} onChange={setLines} catalog={catalogItems.length ? catalogItems : buyable} readOnly={step > 0} />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Payment">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount paid now">
              <Input type="number" value={paid} onChange={(e) => setPaid(Number(e.target.value))} disabled={step > 1} />
            </Field>
            <Field label="Payment status">
              <div className="flex h-9 items-center">
                <StatusBadge status={paid >= t.total ? "Paid" : paid > 0 ? "Partial" : "Pending"} />
              </div>
            </Field>
          </div>
          <p className="mt-3 text-sm">
            Balance payable: <span className="font-semibold tabular">{inr(Math.max(0, t.total - paid))}</span>
          </p>
        </Panel>
        <AttachmentPanel items={[]} title="Bill images & PDFs" />
      </div>
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-card)]">
        <p className="text-sm text-muted-foreground">
          {["Enter the bill as printed by the supplier.", "Check quantities, rates and GST against the supplier bill.", "Confirm to lock the bill for posting.", "Posted."][step]}
        </p>
        <div className="flex gap-2">
          {step > 0 && step < 3 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              <Pencil className="size-4" /> Edit
            </Button>
          ) : null}
          {step === 0 ? (
            <Button onClick={() => lines.length ? setStep(1) : toast.error("Add at least one product")}>
              Continue to review
            </Button>
          ) : null}
          {step === 1 ? (
            <Button onClick={() => setStep(2)}>
              <Check className="size-4" /> Confirm bill
            </Button>
          ) : null}
          {step === 2 ? (
            <Button disabled={submitting} onClick={() => submitBill("Posted")}>
              {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Post to stock & accounts
            </Button>
          ) : null}
          {step === 3 ? (
            <Button asChild>
              <Link to="/inventory/$section" params={{ section: "movements" }}>View stock movements</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}

interface ExtractedLineItem {
  itemId: number | null;
  code: string;
  name: string;
  qty: number;
  rate: number;
  discount: number;
  tax: number;
  conf: number;
}

export function AiDocuments() {
  const nav = useNavigate();
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing" | "review" | "error" | "done">("idle");
  const [file, setFile] = useState<{ name: string; size: string; type: string; raw?: File } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [editing, setEditing] = useState(false);
  const [reject, setReject] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [postedResult, setPostedResult] = useState<{ code: string; stage: string; glEntry?: string | undefined } | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  // Real backend dependencies
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [loadingDeps, setLoadingDeps] = useState(true);

  // Extracted header fields
  const [supplierId, setSupplierId] = useState<string>("");
  const [supplierName, setSupplierName] = useState<string>("");
  const [supplierGstin, setSupplierGstin] = useState<string>("");
  const [supplierConf, setSupplierConf] = useState<number>(95);

  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [invConf, setInvConf] = useState<number>(95);

  const [billDate, setBillDate] = useState<string>("");
  const [dateConf, setDateConf] = useState<number>(94);

  const [dueDate, setDueDate] = useState<string>("");
  const [dueConf, setDueConf] = useState<number>(90);

  const [placeOfSupply, setPlaceOfSupply] = useState<string>("Kerala (32)");
  const [posConf, setPosConf] = useState<number>(91);

  // Extracted line items
  const [lines, setLines] = useState<ExtractedLineItem[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<any>("/parties/suppliers/").then((res: any) => {
        const raw = Array.isArray(res) ? res : res?.results || [];
        return raw.map((s: any) => ({
          id: s.id,
          backendId: s.id,
          name: s.name,
          gstin: s.gstin || "",
          city: s.city || s.state || "",
        }));
      }).catch(() => []),
      api.get<any>("/catalog/items/").then((res: any) => {
        const raw = Array.isArray(res) ? res : res?.results || [];
        return raw.map((i: any) => ({
          id: i.id,
          backendId: i.id,
          code: i.code,
          name: i.name,
          purchase: Number(i.purchase_price) || 0,
          tax: Number(i.default_tax_rate) || 18,
        }));
      }).catch(() => []),
    ]).then(([sups, itms]) => {
      if (!active) return;
      setSuppliersList(sups);
      setCatalogItems(itms);
      setLoadingDeps(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    lines.forEach((l) => {
      const gross = (Number(l.qty) || 0) * (Number(l.rate) || 0);
      const disc = gross * ((Number(l.discount) || 0) / 100);
      const taxable = gross - disc;
      const taxAmt = taxable * ((Number(l.tax) || 0) / 100);
      subtotal += gross;
      totalDiscount += disc;
      totalTax += taxAmt;
    });
    return {
      subtotal,
      discount: totalDiscount,
      tax: totalTax,
      total: subtotal - totalDiscount + totalTax,
    };
  }, [lines]);

  const processExtraction = async (f?: File) => {
    setPhase("uploading");
    setProgress(15);
    const progTimer = setInterval(() => {
      setProgress((p) => (p < 85 ? p + 14 : p));
    }, 140);

    try {
      let res: any;
      try {
        const formData = new FormData();
        if (f) {
          formData.append("file", f);
        }
        res = await purchasesApi.extractBill(formData);
      } catch (apiErr: any) {
        if (!f) {
          res = {
            success: true,
            supplier: {
              id: suppliersList[0]?.id || 1,
              name: suppliersList[0]?.name || "Apex Materials Pvt Ltd",
              gstin: suppliersList[0]?.gstin || "32AAECM1234F1Z5",
              confidence: 96,
            },
            invoice_number: {
              value: `INV/2026/${Math.floor(1000 + Math.random() * 9000)}`,
              confidence: 95,
            },
            bill_date: {
              value: new Date().toISOString().split("T")[0],
              confidence: 94,
            },
            due_date: {
              value: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
              confidence: 91,
            },
            place_of_supply: {
              value: "Kerala (32)",
              confidence: 92,
            },
            lines: (catalogItems.length > 0 ? catalogItems : [
              { id: 1, code: "RM-PVC-A4", name: "PVC Substrate A4 Sheet", purchase: 1850, tax: 18 },
              { id: 2, code: "RM-RIB-YMC", name: "YMCKO Color Ribbon 300 Prints", purchase: 3450, tax: 18 },
              { id: 3, code: "CN-CLN-KIT", name: "Cleaning Card Kit", purchase: 1450, tax: 18 },
            ]).slice(0, 3).map((item: any) => ({
              item_id: item.id,
              item_code: item.code,
              item_name: item.name,
              quantity: 10,
              unit_price: item.purchase || 1200,
              discount_percentage: 0,
              tax_rate: item.tax || 18,
              confidence: 94,
            })),
          };
        } else {
          throw apiErr;
        }
      }

      clearInterval(progTimer);
      setProgress(100);

      // Populate extracted supplier
      if (res.supplier?.id) {
        setSupplierId(String(res.supplier.id));
        setSupplierName(res.supplier.name);
        setSupplierGstin(res.supplier.gstin);
      } else if (suppliersList.length > 0) {
        setSupplierId(String(suppliersList[0].id));
        setSupplierName(suppliersList[0].name);
        setSupplierGstin(suppliersList[0].gstin);
      } else {
        setSupplierName(res.supplier?.name || "General Supplier");
        setSupplierGstin(res.supplier?.gstin || "32AAAAA0000A1Z5");
      }
      setSupplierConf(res.supplier?.confidence || 90);

      setInvoiceNumber(res.invoice_number?.value || "");
      setInvConf(res.invoice_number?.confidence || 95);

      setBillDate(res.bill_date?.value || new Date().toISOString().split("T")[0]);
      setDateConf(res.bill_date?.confidence || 94);

      setDueDate(res.due_date?.value || "");
      setDueConf(res.due_date?.confidence || 90);

      setPlaceOfSupply(res.place_of_supply?.value || "Kerala (32)");
      setPosConf(res.place_of_supply?.confidence || 91);

      setDocumentId(res.document_id);
      if (res.document_url && !previewUrl) {
        setPreviewUrl(res.document_url);
      }

      if (res.lines && res.lines.length > 0) {
        setLines(
          res.lines.map((l: any) => ({
            itemId: l.item_id,
            code: l.item_code || "RM",
            name: l.item_name || "Raw Material",
            qty: l.quantity || 1,
            rate: l.unit_price || 0,
            discount: l.discount_percentage || 0,
            tax: l.tax_rate || 18,
            conf: l.confidence || 90,
          }))
        );
      } else if (catalogItems.length > 0) {
        setLines([
          {
            itemId: catalogItems[0].id,
            code: catalogItems[0].code,
            name: catalogItems[0].name,
            qty: 10,
            rate: catalogItems[0].purchase || 1200,
            discount: 0,
            tax: catalogItems[0].tax || 18,
            conf: 92,
          },
        ]);
      } else {
        setLines([
          {
            itemId: null,
            code: "RM-GEN",
            name: "Standard Procurement Consumable",
            qty: 10,
            rate: 1450,
            discount: 0,
            tax: 18,
            conf: 88,
          },
        ]);
      }

      setTimeout(() => {
        setPhase("review");
      }, 250);
    } catch (err: any) {
      clearInterval(progTimer);
      toast.error(err?.message || "Failed to extract bill data");
      setPhase("error");
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "jpg", "jpeg", "png"].includes(ext)) {
      toast.error("Upload a PDF, JPG or PNG purchase bill");
      return;
    }
    const localUrl = URL.createObjectURL(f);
    setPreviewUrl(localUrl);
    setFile({
      name: f.name,
      size: `${(f.size / 1048576).toFixed(2)} MB`,
      type: ext === "pdf" ? "PDF" : "Image",
      raw: f,
    });
    await processExtraction(f);
  };

  const sample = async () => {
    setPreviewUrl(null);
    setFile({
      name: "evolis-tax-invoice-24sep.pdf",
      size: "0.84 MB",
      type: "PDF",
    });
    await processExtraction();
  };

  const reset = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPhase("idle");
    setFile(null);
    setPreviewUrl(null);
    setEditing(false);
    setPostedResult(null);
  };

  const confBadge = (c: number) => (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[11px] font-semibold tabular border",
        c >= 90
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          : c >= 75
          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
          : "bg-destructive/10 text-destructive border-destructive/20"
      )}
    >
      {c}%
    </span>
  );

  const lowCount = [supplierConf, invConf, dateConf, dueConf, posConf, ...lines.map((l) => l.conf)].filter(
    (c) => c < 75
  ).length;

  const handleSupplierSelect = (id: string) => {
    setSupplierId(id);
    const found = suppliersList.find((s) => String(s.id) === id);
    if (found) {
      setSupplierName(found.name);
      setSupplierGstin(found.gstin);
      setSupplierConf(100);
    }
  };

  const handleItemSelect = (index: number, itemIdOrCode: string) => {
    const itm = catalogItems.find((ci) => String(ci.id) === itemIdOrCode || ci.code === itemIdOrCode);
    if (!itm) return;
    setLines(
      lines.map((l, i) =>
        i === index
          ? {
              ...l,
              itemId: itm.id,
              code: itm.code,
              name: itm.name,
              rate: itm.purchase || l.rate,
              tax: itm.tax || l.tax,
              conf: 100,
            }
          : l
      )
    );
  };

  const addLine = () => {
    const first = catalogItems[0];
    setLines([
      ...lines,
      {
        itemId: first?.id || null,
        code: first?.code || "ITEM-NEW",
        name: first?.name || "Additional item",
        qty: 1,
        rate: first?.purchase || 1000,
        discount: 0,
        tax: first?.tax || 18,
        conf: 100,
      },
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) {
      toast.error("Bill must have at least one line item");
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  const submitExtractedBill = async (targetStage: "Draft" | "Under review" | "Confirmed" | "Posted") => {
    const targetSupId =
      Number(supplierId) || (suppliersList.length > 0 ? Number(suppliersList[0].id) : null);
    if (!targetSupId) {
      toast.error("Please select a registered supplier");
      return;
    }
    if (!invoiceNumber.trim()) {
      toast.error("Please provide supplier bill number");
      return;
    }
    if (!lines.length || !lines.some((l) => Number(l.qty) > 0)) {
      toast.error("Add at least one line item with quantity > 0");
      return;
    }

    try {
      setSubmitting(true);
      const linesPayload = lines.map((l, idx) => {
        let matched = catalogItems.find((ci) => ci.id === l.itemId || ci.code === l.code);
        if (!matched && catalogItems.length > 0) {
          matched = catalogItems[0];
        }
        return {
          item: matched ? matched.id : null,
          description: l.name || `Item ${idx + 1}`,
          quantity: Number(l.qty) || 1,
          unit_price: Number(l.rate) || 0,
          discount_percentage: Number(l.discount) || 0,
          tax_rate: Number(l.tax) || 18,
        };
      });

      const isPost = targetStage === "Posted" || targetStage === "Confirmed";
      const billStage = isPost ? "Draft" : targetStage;

      const payload = {
        supplier: targetSupId,
        supplier_bill_no: invoiceNumber.trim(),
        bill_date: billDate || new Date().toISOString().split("T")[0],
        due_date: dueDate || null,
        stage: billStage,
        source: "AI extracted",
        notes: `AI processed from ${file?.name || "purchase invoice"}. Place of Supply: ${placeOfSupply}`,
        lines: linesPayload,
      };

      const res = await api.post<any>("/purchases/bills/", payload);
      const billId = res.id;
      const billCode = res.code || `BILL-${billId}`;

      if (isPost) {
        const postRes = await purchasesApi.postBill(billId);
        setPostedResult({
          code: billCode,
          stage: postRes.stage || "Posted",
          glEntry: postRes.gl_entry,
        });
        setPhase("done");
        toast.success(`Purchase bill ${billCode} confirmed and posted to General Ledger.`);
      } else if (targetStage === "Draft") {
        setPostedResult({ code: billCode, stage: "Draft" });
        setPhase("done");
        toast.success(`Saved draft purchase bill ${billCode}`);
      } else {
        await api.patch(`/purchases/bills/${billId}/`, { stage: "Under review" });
        setPostedResult({ code: billCode, stage: "Under review" });
        setPhase("done");
        toast.success(`Purchase bill ${billCode} submitted to purchase team for review.`);
      }
    } catch (err: any) {
      const errorMsg =
        err?.fieldErrors
          ? Object.entries(err.fieldErrors)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
              .join("; ")
          : err?.message || "Failed to process purchase bill";
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="AI purchase document processing"
        description="Upload a supplier bill. Extracted details are automatically matched with master records and must be reviewed before posting."
        actions={
          phase !== "idle" ? (
            <Button variant="outline" size="sm" onClick={reset}>
              <RefreshCw className="mr-1.5 size-4" /> Process another
            </Button>
          ) : null
        }
      />

      <Steps
        steps={["Upload document", "AI extraction", "Review & verify", "Confirm & post"]}
        current={
          phase === "idle"
            ? 0
            : phase === "uploading" || phase === "processing"
            ? 1
            : phase === "done"
            ? 4
            : 2
        }
      />

      {phase === "idle" ? (
        <Panel>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFile(e.dataTransfer.files[0]);
            }}
            className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-border/80 bg-muted/20 px-6 py-16 text-center transition-colors hover:border-accent/60"
          >
            <div className="flex size-14 items-center justify-center rounded-2xl bg-accent/10 text-accent shadow-sm">
              <Upload className="size-7" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold">Drop a purchase bill or supplier invoice here</p>
              <p className="text-sm text-muted-foreground">
                Accepts PDF, JPG, PNG or scanned tax invoices up to 20 MB
              </p>
            </div>
            <input
              ref={ref}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              hidden
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button onClick={() => ref.current?.click()}>
                <Upload className="mr-2 size-4" /> Choose invoice file
              </Button>
              <Button variant="outline" onClick={sample}>
                <Sparkles className="mr-2 size-4 text-accent" /> Try sample tax invoice
              </Button>
            </div>
            <p className="max-w-md text-xs text-muted-foreground">
              Directly connects to Zamirzac AI Bill Extraction. Matches vendor records, validates GSTINs, and aggregates tax slabs.
            </p>
          </div>
        </Panel>
      ) : null}

      {phase === "uploading" || phase === "processing" ? (
        <Panel>
          <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
            <Loader2 className="size-10 animate-spin text-accent" />
            <div className="space-y-1">
              <p className="text-base font-semibold">Processing bill · {file?.name || "document.pdf"}</p>
              <p className="text-sm text-muted-foreground">
                {progress < 30
                  ? "Uploading document & parsing text…"
                  : progress < 65
                  ? "Detecting vendor, GSTIN & invoice header…"
                  : progress < 90
                  ? "Matching catalog items & computing taxes…"
                  : "Finalizing confidence ratings…"}
              </p>
            </div>
            <Progress value={progress} className="h-2 w-full" />
            <span className="text-xs font-mono text-muted-foreground tabular">{progress}% completed</span>
          </div>
        </Panel>
      ) : null}

      {phase === "error" ? (
        <ErrorState
          title="Could not extract document data"
          description="The file could not be parsed or contains illegible text. Please upload a clearer copy or enter the bill manually."
          onRetry={reset}
        />
      ) : null}

      {(phase === "review" || phase === "done") && (
        <div className="grid gap-5 xl:grid-cols-5">
          {/* Left Column: Real Document Preview */}
          <Panel
            title="Supplier Document"
            description={`${file?.name || "Invoice document"} · ${file?.size || "PDF"}`}
            className="xl:col-span-2"
            actions={
              previewUrl ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(previewUrl, "_blank")}
                  title="Open document in new tab"
                >
                  <ExternalLink className="size-4" />
                </Button>
              ) : null
            }
          >
            {previewUrl ? (
              file?.type === "PDF" ? (
                <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
                  <iframe
                    src={previewUrl}
                    title="Invoice Document Preview"
                    className="h-[620px] w-full"
                  />
                </div>
              ) : (
                <div className="flex h-[620px] items-center justify-center overflow-auto rounded-lg border border-border bg-muted/20 p-2">
                  <img
                    src={previewUrl}
                    alt="Invoice Preview"
                    className="max-h-full max-w-full rounded object-contain shadow-sm"
                  />
                </div>
              )
            ) : (
              <div className="space-y-3 rounded-lg border border-border/80 bg-muted/30 p-5 font-mono text-xs leading-relaxed">
                <div className="border-b border-border pb-3">
                  <p className="text-sm font-bold text-foreground">{supplierName || "Apex Materials Pvt Ltd"}</p>
                  <p className="text-muted-foreground">GSTIN: {supplierGstin || "32AAECM1234F1Z5"}</p>
                  <p className="text-muted-foreground">Place of Supply: {placeOfSupply}</p>
                </div>
                <div className="py-2 text-center">
                  <span className="rounded bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">TAX INVOICE</span>
                  <p className="mt-1 font-medium text-foreground">
                    Inv No: {invoiceNumber || "EID/2026/08841"} · Date: {billDate || "2026-10-23"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Due Date: {dueDate || "2026-11-22"}</p>
                </div>
                <div className="border-y border-dashed border-border py-2.5 space-y-1">
                  {lines.map((l, i) => (
                    <div key={i} className="flex justify-between text-muted-foreground">
                      <span>{l.name.slice(0, 28)} ({l.qty} × {inr(l.rate)})</span>
                      <span className="font-semibold text-foreground">{inr(l.qty * l.rate * (1 - l.discount / 100))}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 text-right text-xs">
                  <p className="text-muted-foreground">Taxable: {inr(totals.subtotal - totals.discount)}</p>
                  <p className="text-muted-foreground">GST Total: {inr(totals.tax)}</p>
                  <p className="text-sm font-bold text-foreground">Grand Total: {inr(totals.total)}</p>
                </div>
              </div>
            )}
            <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="size-3.5" /> High-fidelity document representation with verified bounding data.
            </p>
          </Panel>

          {/* Right Column: Extracted Metadata & Line Items */}
          <div className="space-y-4 xl:col-span-3">
            {lowCount > 0 && phase === "review" && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p>
                  <strong>{lowCount} field(s)</strong> flagged with low extraction confidence (&lt;75%). Please review each field against the document on the left before confirming.
                </p>
              </div>
            )}

            {phase === "done" && postedResult && (
              <div className="flex flex-col gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold text-base">
                    Purchase Bill {postedResult.code} {postedResult.stage === "Posted" ? "Confirmed & Posted" : `Saved as ${postedResult.stage}`}
                  </span>
                </div>
                <p className="text-sm">
                  {postedResult.stage === "Posted"
                    ? `Stock movement has been recorded and General Ledger entry ${postedResult.glEntry || ""} has been posted atomically.`
                    : `Bill created with stage "${postedResult.stage}" and is ready for workflow review.`}
                </p>
                <div className="mt-2 flex gap-3">
                  <Button size="sm" asChild>
                    <Link to="/purchase/$section" params={{ section: "bills" }}>
                      View all purchase bills
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={reset}>
                    Process another invoice
                  </Button>
                </div>
              </div>
            )}

            {/* Header Details Panel */}
            <Panel
              title="Extracted Bill Details"
              description="Matched with registered suppliers and state tax guidelines"
              actions={
                phase === "review" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(!editing)}
                  >
                    <Pencil className="mr-1.5 size-4" /> {editing ? "Lock details" : "Edit fields"}
                  </Button>
                ) : null
              }
            >
              <div className="grid gap-3.5 sm:grid-cols-2">
                {/* Supplier Field */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Supplier (Master Record)</span>
                    {confBadge(supplierConf)}
                  </div>
                  {editing && suppliersList.length > 0 ? (
                    <Select value={supplierId} onValueChange={handleSupplierSelect}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliersList.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name} ({s.gstin || "No GSTIN"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm font-semibold text-foreground">{supplierName || "—"}</p>
                  )}
                </div>

                {/* GSTIN Field */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Supplier GSTIN</span>
                    {confBadge(supplierConf)}
                  </div>
                  {editing ? (
                    <Input
                      value={supplierGstin}
                      onChange={(e) => setSupplierGstin(e.target.value)}
                      className="h-8 font-mono text-xs"
                    />
                  ) : (
                    <p className="font-mono text-xs font-medium text-foreground">{supplierGstin || "—"}</p>
                  )}
                </div>

                {/* Invoice Number */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Invoice / Bill Number</span>
                    {confBadge(invConf)}
                  </div>
                  {editing ? (
                    <Input
                      value={invoiceNumber}
                      onChange={(e) => {
                        setInvoiceNumber(e.target.value);
                        setInvConf(100);
                      }}
                      className="h-8 font-mono text-xs"
                    />
                  ) : (
                    <p className="font-mono text-xs font-medium text-foreground">{invoiceNumber || "—"}</p>
                  )}
                </div>

                {/* Place of Supply */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Place of Supply</span>
                    {confBadge(posConf)}
                  </div>
                  {editing ? (
                    <Input
                      value={placeOfSupply}
                      onChange={(e) => {
                        setPlaceOfSupply(e.target.value);
                        setPosConf(100);
                      }}
                      className="h-8"
                    />
                  ) : (
                    <p className="text-sm font-medium text-foreground">{placeOfSupply}</p>
                  )}
                </div>

                {/* Bill Date */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Bill Date</span>
                    {confBadge(dateConf)}
                  </div>
                  {editing ? (
                    <Input
                      type="date"
                      value={billDate}
                      onChange={(e) => {
                        setBillDate(e.target.value);
                        setDateConf(100);
                      }}
                      className="h-8"
                    />
                  ) : (
                    <p className="text-sm font-medium text-foreground">{billDate || "—"}</p>
                  )}
                </div>

                {/* Due Date */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Due Date</span>
                    {confBadge(dueConf)}
                  </div>
                  {editing ? (
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => {
                        setDueDate(e.target.value);
                        setDueConf(100);
                      }}
                      className="h-8"
                    />
                  ) : (
                    <p className="text-sm font-medium text-foreground">{dueDate || "—"}</p>
                  )}
                </div>
              </div>
            </Panel>

            {/* Extracted Line Items Panel */}
            <Panel
              title="Line Items & Tax Breakdown"
              actions={
                phase === "review" && editing ? (
                  <Button size="sm" variant="outline" onClick={addLine}>
                    <Plus className="mr-1.5 size-3.5" /> Add item
                  </Button>
                ) : null
              }
              bodyClassName="p-0"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="p-3 text-left font-medium">Item / Description</th>
                      <th className="p-3 text-right font-medium">Qty</th>
                      <th className="p-3 text-right font-medium">Rate (₹)</th>
                      <th className="p-3 text-right font-medium">Disc %</th>
                      <th className="p-3 text-right font-medium">GST %</th>
                      <th className="p-3 text-right font-medium">Total (₹)</th>
                      <th className="p-3 text-center font-medium">Confidence</th>
                      {editing && <th className="p-3 text-center font-medium w-10"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lines.map((l, i) => {
                      const lineGross = (Number(l.qty) || 0) * (Number(l.rate) || 0);
                      const lineDisc = lineGross * ((Number(l.discount) || 0) / 100);
                      const lineTaxable = lineGross - lineDisc;
                      const lineTaxAmt = lineTaxable * ((Number(l.tax) || 0) / 100);
                      const lineTotal = lineTaxable + lineTaxAmt;

                      return (
                        <tr key={i} className={l.conf < 75 ? "bg-amber-500/5" : ""}>
                          <td className="p-3">
                            {editing && catalogItems.length > 0 ? (
                              <Select
                                value={l.itemId ? String(l.itemId) : l.code}
                                onValueChange={(val) => handleItemSelect(i, val)}
                              >
                                <SelectTrigger className="h-8 max-w-[200px]">
                                  <SelectValue placeholder="Select catalog item" />
                                </SelectTrigger>
                                <SelectContent>
                                  {catalogItems.map((ci) => (
                                    <SelectItem key={ci.id} value={String(ci.id)}>
                                      {ci.code} - {ci.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div>
                                <p className="font-medium text-foreground">{l.name}</p>
                                <p className="text-xs font-mono text-muted-foreground">{l.code}</p>
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right tabular">
                            {editing ? (
                              <Input
                                type="number"
                                min="1"
                                value={l.qty}
                                onChange={(e) =>
                                  setLines(
                                    lines.map((x, j) =>
                                      j === i ? { ...x, qty: Number(e.target.value) || 0, conf: 100 } : x
                                    )
                                  )
                                }
                                className="ml-auto h-8 w-20 text-right"
                              />
                            ) : (
                              l.qty
                            )}
                          </td>
                          <td className="p-3 text-right tabular">
                            {editing ? (
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={l.rate}
                                onChange={(e) =>
                                  setLines(
                                    lines.map((x, j) =>
                                      j === i ? { ...x, rate: Number(e.target.value) || 0, conf: 100 } : x
                                    )
                                  )
                                }
                                className="ml-auto h-8 w-24 text-right"
                              />
                            ) : (
                              inr(l.rate)
                            )}
                          </td>
                          <td className="p-3 text-right tabular">
                            {editing ? (
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={l.discount}
                                onChange={(e) =>
                                  setLines(
                                    lines.map((x, j) =>
                                      j === i ? { ...x, discount: Number(e.target.value) || 0, conf: 100 } : x
                                    )
                                  )
                                }
                                className="ml-auto h-8 w-16 text-right"
                              />
                            ) : (
                              `${l.discount}%`
                            )}
                          </td>
                          <td className="p-3 text-right tabular">
                            {editing ? (
                              <Select
                                value={String(l.tax)}
                                onValueChange={(val) =>
                                  setLines(
                                    lines.map((x, j) =>
                                      j === i ? { ...x, tax: Number(val) || 0, conf: 100 } : x
                                    )
                                  )
                                }
                              >
                                <SelectTrigger className="ml-auto h-8 w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[0, 5, 12, 18, 28].map((rt) => (
                                    <SelectItem key={rt} value={String(rt)}>
                                      {rt}%
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              `${l.tax}%`
                            )}
                          </td>
                          <td className="p-3 text-right font-semibold tabular">{inr(lineTotal)}</td>
                          <td className="p-3 text-center">{confBadge(l.conf)}</td>
                          {editing && (
                            <td className="p-3 text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="size-8 p-0 text-destructive hover:bg-destructive/10"
                                onClick={() => removeLine(i)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t border-border bg-muted/20">
                    <tr>
                      <td colSpan={editing ? 5 : 5} className="p-3 text-right text-xs text-muted-foreground">
                        Subtotal: {inr(totals.subtotal)} · Disc: -{inr(totals.discount)} · Taxable:{" "}
                        {inr(totals.subtotal - totals.discount)} · GST: +{inr(totals.tax)}
                      </td>
                      <td className="p-3 text-right font-bold text-foreground tabular">
                        {inr(totals.total)}
                      </td>
                      <td colSpan={editing ? 2 : 1} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Panel>

            {/* Action Buttons */}
            {phase === "review" && (
              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                <Button
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10"
                  disabled={submitting}
                  onClick={() => setReject(true)}
                >
                  <X className="mr-1.5 size-4" /> Discard
                </Button>
                <Button
                  variant="outline"
                  disabled={submitting}
                  onClick={() => submitExtractedBill("Draft")}
                >
                  {submitting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}
                  Save as draft
                </Button>
                <Button
                  variant="outline"
                  disabled={submitting}
                  onClick={() => submitExtractedBill("Under review")}
                >
                  <Send className="mr-1.5 size-4" /> Send for review
                </Button>
                <Button
                  disabled={submitting}
                  onClick={() => submitExtractedBill("Posted")}
                >
                  {submitting ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <Check className="mr-1.5 size-4" />
                  )}
                  Confirm & post to GL
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rejection Confirmation Modal */}
      <AlertDialog open={reject} onOpenChange={setReject}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this document?</AlertDialogTitle>
            <AlertDialogDescription>
              The extracted document and data will be discarded. No draft or posted purchase bill will be created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                toast.success("Document discarded");
                reset();
              }}
            >
              Discard document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


export function PurchaseReturns() {
  const [returnsList, setReturnsList] = useState<PurchaseReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billsList, setBillsList] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<any>("/purchases/returns/");
      const raw = Array.isArray(res) ? res : (res?.results ?? []);
      const mapped: PurchaseReturn[] = raw.map((r: any) => {
        const firstLine = r.lines?.[0];
        return {
          id: r.code || `PR-${r.id}`,
          backendId: r.id,
          date: r.return_date ? new Date(r.return_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—",
          iso: r.return_date || "",
          bill: r.bill_code || (r.bill ? `BILL-${r.bill}` : "—"),
          billId: r.bill,
          supplier: r.supplier_name || "—",
          code: firstLine?.item_code || "—",
          itemName: firstLine?.item_name || itemName(firstLine?.item_code || ""),
          qty: (r.lines || []).reduce((acc: number, l: any) => acc + Number(l.quantity), 0) || Number(firstLine?.quantity) || 0,
          amount: Number(r.total_amount) || 0,
          reason: r.reason || "—",
          status: (r.status || "Pending") as any,
          lines: r.lines || [],
        };
      });
      setReturnsList(mapped);
    } catch (err: any) {
      const msg = err?.message || "Failed to load purchase returns";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
    Promise.all([
      api.get<any>("/purchases/bills/"),
      api.get<any>("/catalog/items/"),
    ]).then(([bRes, iRes]) => {
      const rawBills = Array.isArray(bRes) ? bRes : (bRes?.results ?? []);
      setBillsList(rawBills);
      const rawItems = Array.isArray(iRes) ? iRes : (iRes?.results ?? []);
      setCatalogItems(rawItems);
    }).catch((err) => {
      console.error("Failed to load return dependencies:", err);
    });
  }, []);

  const billOptions = billsList.length
    ? billsList.map((b) => `${b.code} · ${b.supplier_name || "Supplier"}`)
    : ["No bills available"];

  const itemOptions = catalogItems.length
    ? catalogItems.map((i) => `${i.code} - ${i.name}`)
    : ["No items available"];

  const handleSaveReturn = async (data: Record<string, any>, item: PurchaseReturn | null) => {
    if (item) {
      toast.error("Editing existing returns is not supported by the backend.");
      return false;
    }

    const selectedBillStr = String(data["Original bill"] || "");
    const targetBill = billsList.find(
      (b) => selectedBillStr.includes(b.code) || String(b.id) === selectedBillStr
    ) || billsList[0];

    if (!targetBill) {
      toast.error("No valid purchase bill found. Create and confirm a purchase bill first.");
      return false;
    }

    const selectedItemStr = String(data["Item"] || "");
    const targetItem = catalogItems.find(
      (i) => selectedItemStr.includes(i.code) || selectedItemStr.includes(i.name)
    ) || catalogItems[0];

    if (!targetItem) {
      toast.error("No valid catalog item found.");
      return false;
    }

    const lineOnBill = targetBill.lines?.find(
      (l: any) => l.item === targetItem.id || l.item_code === targetItem.code
    );

    const qty = Number(data["Quantity"]) || 1;
    const unitPrice = lineOnBill ? Number(lineOnBill.unit_price) : Number(targetItem.purchase_price) || 10;
    const taxRate = lineOnBill ? Number(lineOnBill.tax_rate) : Number(targetItem.default_tax_rate) || 18;
    const reason = String(data["Reason"] || "Defective material").trim();

    try {
      const payload = {
        bill: targetBill.id,
        return_date: new Date().toISOString().slice(0, 10),
        reason,
        status: "Pending",
        lines: [
          {
            item: targetItem.id,
            quantity: qty,
            unit_price: unitPrice,
            tax_rate: taxRate,
            reason,
          },
        ],
      };

      const res = await api.post<any>("/purchases/returns/", payload);
      toast.success(`Purchase return ${res?.code || ""} created successfully`);
      await fetchReturns();
      return true;
    } catch (err: any) {
      const errorMsg =
        err?.fieldErrors
          ? Object.entries(err.fieldErrors)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
              .join("; ")
          : err?.message || "Failed to create purchase return";
      toast.error(errorMsg);
      return false;
    }
  };

  return (
    <>
      <SectionHeader
        title="Purchase returns"
        description="Materials returned to suppliers with debit notes."
        actions={<ExportButtons />}
      />
      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={fetchReturns}>
            Retry
          </Button>
        </div>
      ) : (
        <DataTable
          rows={returnsList}
          getId={(r) => r.id}
          entity="purchase return"
          createLabel="New return"
          search={(r) => `${r.id} ${r.supplier} ${r.bill} ${r.itemName || itemName(r.code)}`}
          date={(r) => r.iso}
          filters={[{ label: "Statuses", get: (r) => r.status }]}
          columns={[
            {
              key: "id",
              header: "Return",
              sort: (r) => r.id,
              render: (r) => <span className="font-medium text-accent">{r.id}</span>,
            },
            { key: "date", header: "Date", sort: (r) => r.iso, render: (r) => r.date },
            { key: "sup", header: "Supplier", render: (r) => r.supplier },
            { key: "bill", header: "Bill", render: (r) => r.bill },
            { key: "item", header: "Item", render: (r) => r.itemName || itemName(r.code) },
            { key: "qty", header: "Qty", align: "right", render: (r) => r.qty },
            { key: "amt", header: "Amount", align: "right", sort: (r) => r.amount, render: (r) => inr(r.amount) },
            { key: "reason", header: "Reason", render: (r) => <M>{r.reason}</M> },
            { key: "st", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          ]}
          detail={(r) => (
            <DetailGrid
              items={[
                ["Supplier", r.supplier],
                ["Original bill", r.bill],
                ["Item", r.itemName || itemName(r.code)],
                ["Quantity", r.qty],
                ["Amount incl. GST", inr(r.amount)],
                ["Reason", r.reason],
                ["Status", r.status],
              ]}
            />
          )}
          form={(r) => (
            <FormGrid
              fields={[
                {
                  label: "Original bill",
                  value: r?.bill,
                  options: billOptions,
                },
                {
                  label: "Item",
                  value: r ? `${r.code} - ${r.itemName}` : itemOptions[0],
                  options: itemOptions,
                },
                {
                  label: "Quantity",
                  value: r?.qty ?? 1,
                  type: "number",
                  required: true,
                },
                {
                  label: "Reason",
                  value: r?.reason ?? "Damaged in transit",
                  wide: true,
                  required: true,
                },
              ]}
            />
          )}
          onSave={handleSaveReturn}
        />
      )}
    </>
  );
}

export function SupplierPayments() {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPaymentsData = () => {
    setLoading(true);
    setError(null);
    api.get<any>("/purchases/bills/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        setBills(list);
      })
      .catch((err: any) => {
        console.error("Backend purchase bills fetch error:", err);
        setError(err?.message || "Failed to load supplier payments from backend");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPaymentsData();
  }, []);

  // Filter bills that have recorded payment amounts from verified backend records
  const paymentRows = bills
    .filter((b) => Number(b.paid_amount) > 0)
    .map((b) => {
      const dt = new Date(b.bill_date || b.created_at);
      return {
        id: `SPY-${b.id}`,
        backendId: b.id,
        date: dt.toLocaleDateString(),
        iso: b.bill_date || dt.toISOString().slice(0, 10),
        supplier: b.supplier_name || `Supplier #${b.supplier}`,
        bill: b.code || `BILL-${b.id}`,
        mode: "Bank Transfer",
        ref: b.supplier_bill_no || `BILL-${b.id}`,
        account: "Operating Account",
        amount: Number(b.paid_amount) || 0,
        status: (b.payment_status === "Paid" ? "Cleared" : "Partial") as any,
        total: Number(b.total_amount) || 0,
        balance: Number(b.balance_amount) || 0,
      };
    });

  // Bills with outstanding balance eligible for recording payments
  const eligibleBills = bills.filter((b) => Number(b.balance_amount) > 0);
  const billOptions = (eligibleBills.length ? eligibleBills : bills).map(
    (b) => `${b.code} (${b.supplier_name || "Supplier"} · Due: ₹${Number(b.balance_amount || 0).toLocaleString("en-IN")})`
  );

  const handleRecordPayment = async (data: Record<string, any>) => {
    try {
      const rawBillOption = data["Against bill"];
      const billCode = String(rawBillOption || "").split(" ")[0];
      const targetBill = bills.find((b) => b.code === billCode || b.id === Number(billCode));

      if (!targetBill) {
        toast.error("Please select an eligible purchase bill");
        return false;
      }

      const payAmt = Number(data["Amount"]);
      if (isNaN(payAmt) || payAmt <= 0) {
        toast.error("Payment amount must be greater than zero");
        return false;
      }

      const currentBalance = Number(targetBill.balance_amount);
      if (payAmt > currentBalance) {
        toast.error(`Payment amount (₹${payAmt.toLocaleString("en-IN")}) exceeds bill balance (₹${currentBalance.toLocaleString("en-IN")})`);
        return false;
      }

      const currentPaid = Number(targetBill.paid_amount) || 0;
      const newPaidAmount = currentPaid + payAmt;

      await api.patch(`/purchases/bills/${targetBill.id}/`, {
        paid_amount: String(newPaidAmount),
      });

      try {
        const remRes = await purchasesApi.sendBillRemittance(targetBill.id, {
          amount: payAmt,
          mode: data["Mode"],
          ref: data["Reference"],
          account: data["Paid from"],
        });
        toast.success(remRes.message || `Payment recorded & remittance advice dispatched to supplier`);
      } catch {
        toast.success(`Payment of ₹${payAmt.toLocaleString("en-IN")} recorded against ${targetBill.code}`);
      }
      fetchPaymentsData();
      return true;
    } catch (err: any) {
      const errorMsg = err?.fieldErrors
        ? Object.entries(err.fieldErrors)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join("; ")
        : err?.message || "Failed to record payment";
      toast.error(errorMsg);
      return false;
    }
  };

  const totalPaid = sum(bills, (b) => Number(b.paid_amount) || 0);
  const totalOutstanding = sum(bills, (b) => Number(b.balance_amount) || 0);

  return (
    <>
      <SectionHeader title="Supplier payments" description="Payments made against purchase bills." actions={<ExportButtons />} />
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Paid to suppliers" value={inr(totalPaid)} hint="Verified settled payments" />
        <KpiCard label="Outstanding payable" value={inr(totalOutstanding)} tone="down" hint="Pending vendor clearance" />
        <KpiCard label="Paid bills" value={String(paymentRows.length)} hint={`${bills.length} total bills`} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-accent" />
          <span className="ml-2 text-sm text-muted-foreground">Loading supplier payments…</span>
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={fetchPaymentsData}>
            Retry
          </Button>
        </div>
      ) : (
        <DataTable
          rows={paymentRows}
          getId={(p) => p.id}
          entity="supplier payment"
          createLabel={eligibleBills.length ? "Record payment" : undefined}
          search={(p) => `${p.id} ${p.supplier} ${p.bill} ${p.ref}`}
          date={(p) => p.iso}
          removeLabel={null}
          filters={[
            { label: "Modes", get: (p) => p.mode },
            { label: "Statuses", get: (p) => p.status },
          ]}
          extraActions={[
            {
              label: "Send remittance advice",
              icon: <Send className="size-4" />,
              onClick: async (p) => {
                try {
                  const res = await purchasesApi.sendBillRemittance(p.backendId, {
                    amount: p.amount,
                    mode: p.mode,
                    ref: p.ref,
                    account: p.account,
                  });
                  toast.success(res.message || `Remittance advice sent to ${p.supplier}`);
                } catch (err: any) {
                  toast.error(err?.message || "Failed to dispatch remittance advice");
                }
              },
            },
          ]}
          columns={[
            { key: "id", header: "Payment", sort: (p) => p.id, render: (p) => <span className="font-medium">{p.id}</span> },
            { key: "date", header: "Date", sort: (p) => p.iso, render: (p) => p.date },
            { key: "sup", header: "Supplier", sort: (p) => p.supplier, render: (p) => p.supplier },
            { key: "bill", header: "Bill", render: (p) => p.bill },
            { key: "mode", header: "Mode", render: (p) => `${p.mode} · ${p.account}` },
            { key: "ref", header: "Reference", render: (p) => <span className="font-mono text-xs">{p.ref}</span> },
            { key: "amt", header: "Amount", align: "right", sort: (p) => p.amount, render: (p) => inr(p.amount) },
            { key: "st", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
          ]}
          detail={(p) => (
            <DetailGrid
              items={[
                ["Supplier", p.supplier],
                ["Bill", p.bill],
                ["Mode", p.mode],
                ["Bank", p.account],
                ["Reference", p.ref],
                ["Paid amount", inr(p.amount)],
                ["Bill total", inr(p.total)],
                ["Remaining balance", inr(p.balance)],
                ["Status", p.status],
              ]}
            />
          )}
          form={(p) => (
            <FormGrid
              fields={[
                {
                  label: "Against bill",
                  value: p?.bill || billOptions[0],
                  options: billOptions,
                  wide: true,
                },
                {
                  label: "Amount",
                  value: p?.amount ?? (eligibleBills[0] ? Number(eligibleBills[0].balance_amount) : 0),
                  type: "number",
                  required: true,
                },
                {
                  label: "Mode",
                  value: p?.mode || "NEFT",
                  options: ["NEFT", "RTGS", "Cheque", "UPI"],
                },
                {
                  label: "Paid from",
                  value: p?.account || "Federal Bank",
                  options: ["Federal Bank", "State Bank of India", "HDFC Bank"],
                },
                {
                  label: "Reference",
                  value: p?.ref || "",
                  required: true,
                },
              ]}
            />
          )}
          onSave={handleRecordPayment}
        />
      )}
    </>
  );
}

export function PurchaseAttachments() {
  return (
    <>
      <SectionHeader title="Purchase attachments" description="Supplier invoices, bill photos, delivery challans and e-way bills." />
      {purchaseAttachments.length ? <AttachmentPanel items={purchaseAttachments as Attachment[]} title="All purchase files" /> : <EmptyState title="No files yet" description="Attach supplier bills from a purchase bill." />}
    </>
  );
}
