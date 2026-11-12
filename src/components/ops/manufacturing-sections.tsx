import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowDownRight, ArrowUpRight, CheckCircle2, Factory, Layers, Pencil, Play, Plus, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { KpiCard, Panel, StatusBadge } from "@/components/erp/primitives";
import { DataTable, DetailGrid } from "@/components/erp/DataTable";
import { ExportButtons, SectionHeader } from "@/components/erp/ModuleLayout";
import { Field } from "@/components/sales/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { inr } from "@/lib/format";
import { currentUser } from "@/lib/user";
import { boms as seedBoms, itemName, users, type Bom, type BomLine, type Item, type ProductionOrder } from "@/data/ops";
import { ops, useOps } from "@/data/ops-store";
import { api } from "@/lib/api";
import { TypeBadge, axis, qty, short, sum, tip } from "./common";

const M = ({ children }: { children: React.ReactNode }) => <span className="text-muted-foreground">{children}</span>;

let bomState = seedBoms;
const bomFor = (code: string) => bomState.find((b) => b.product === code);
const requirement = (b: Bom, planned: number, items: Item[]) => b.lines.map((l) => {
  const it = items.find((i) => i.code === l.code) || {
    code: l.code,
    name: l.code,
    type: "Raw Material" as const,
    stock: 0,
    unit: "Nos",
    category: "Materials",
    purchase: 0,
    sell: 0,
    min: 0,
    lead: 0,
    location: "Main",
    hsn: "",
    tax: 18,
  };
  const net = (planned * l.qty) / b.output;
  const req = Math.round(net * (1 + l.wastage / 100) * 1000) / 1000;
  return { ...l, item: it, net, req, available: it.stock, short: Math.max(0, Math.round((req - it.stock) * 1000) / 1000) };
});

const bomCost = (b: Bom, items: Item[]) => b.lines.reduce((s, l) => s + (items.find((i) => i.code === l.code)?.purchase ?? 0) * l.qty * (1 + l.wastage / 100), 0) / b.output + b.labour;

export function MfgDashboard() {
  const { items: mockItems } = useOps();
  const [items, setItems] = useState<Item[]>([]);
  const [boms, setBoms] = useState<Bom[]>(bomState);
  const [production, setProduction] = useState<ProductionOrder[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<any>("/manufacturing/orders/"),
      api.get<any>("/catalog/items/"),
      api.get<any>("/catalog/boms/?status=Active"),
    ])
      .then(([ordersRes, itemsRes, bomsRes]) => {
        const list = Array.isArray(ordersRes) ? ordersRes : (ordersRes?.results ?? []);
        const itemList = Array.isArray(itemsRes) ? itemsRes : (itemsRes?.results ?? []);
        const bomList = Array.isArray(bomsRes) ? bomsRes : (bomsRes?.results ?? []);

        const mapped: ProductionOrder[] = list.map((o: any) => ({
          id: o.code || `PRD-${o.id}`,
          product: o.product_code || "FG-IDC-PVC",
          planned: Number(o.planned_quantity) || 0,
          produced: Number(o.produced_quantity) || 0,
          wastage: Number(o.wastage_quantity) || 0,
          date: o.order_date,
          iso: o.order_date,
          assigned: o.assigned_to_name || "Production Team",
          status: o.status as ProductionOrder["status"],
          customer: o.customer_name || o.purpose_notes || "Stock replenishment",
          notes: o.notes || "",
          batch: o.batch_number || "—",
        }));
        setProduction(mapped);

        if (itemList.length > 0) {
          setItems(
            itemList.map((i: any) => ({
              code: i.code,
              name: i.name,
              type: (i.item_type || "Raw Material") as Item["type"],
              category: i.category_name || "General",
              unit: i.uom_code || "Nos",
              purchase: Number(i.purchase_price) || 0,
              sell: Number(i.selling_price) || 0,
              minSell: Number(i.min_selling_price) || 0,
              tax: Number(i.default_tax_rate) || 18,
              min: Number(i.min_stock_alert) || 0,
              max: Number(i.max_stock_level) || 0,
              stock: Number(i.current_stock ?? 0),
              warehouse: "Kalamassery",
              status: i.status === "Inactive" ? "Inactive" : "Active",
              salesFreq: 0,
              salesQty: 0,
              lastMovedDays: 0,
              ageDays: 0,
            }))
          );
        }

        if (bomList.length > 0) {
          const mappedBoms: Bom[] = bomList.map((b: any) => ({
            id: b.code || `BOM-${b.id}`,
            product: b.finished_good_code || "FG-IDC-PVC",
            version: b.version || "v1",
            output: Number(b.output_quantity) || 1,
            labour: Number(b.labour_cost) || 0,
            updated: "Recent",
            status: b.status as Bom["status"],
            lines: (b.lines || []).map((l: any) => ({
              code: l.component_code || "",
              qty: Number(l.quantity) || 1,
              wastage: Number(l.wastage_percentage) || 0,
              notes: l.notes || "",
            })),
          }));
          setBoms(mappedBoms);
          bomState = mappedBoms;
        }
      })
      .catch(() => {});
  }, []);

  const activeItems = items.length > 0 ? items : mockItems;
  const activeBoms = boms.length > 0 ? boms : bomState;

  const done = production.filter((p) => p.status === "Completed");
  const byProd = Object.values(done.reduce<Record<string, { name: string; v: number }>>((a, p) => { (a[p.product] ??= { name: short(itemName(p.product)).slice(0, 20), v: 0 }).v += p.produced; return a; }, {}));
  const blocked = production.filter((p) => {
    const b = activeBoms.find((bm) => bm.product === p.product) || bomFor(p.product);
    return (p.status === "Planned" || p.status === "Draft") && b && requirement(b, p.planned, activeItems).some((r) => r.short > 0);
  });

  return (
    <>
      <SectionHeader title="Manufacturing dashboard" description="Live production orders, output, wastage and active batches · Kalamassery unit" actions={<Button size="sm" asChild><Link to="/manufacturing/$section" params={{ section: "new-order" }}><Plus className="size-4" /> New production order</Link></Button>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiCard label="In production" value={String(production.filter((p) => p.status === "In Production").length)} />
        <KpiCard label="Planned" value={String(production.filter((p) => p.status === "Planned").length)} />
        <KpiCard label="Completed" value={String(done.length)} tone="up" hint={`${qty(sum(done, (p) => p.produced))} units`} />
        <KpiCard label="Wastage" value={`${((sum(done, (p) => p.wastage) / Math.max(1, sum(done, (p) => p.planned))) * 100).toFixed(1)}%`} hint="Of planned quantity" />
        <KpiCard label="Material shortages" value={String(blocked.length)} tone={blocked.length ? "down" : undefined} hint="Orders short of stock" />
        <KpiCard label="Active BOMs" value={String(bomState.filter((b) => b.status === "Active").length)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Units produced by product" className="xl:col-span-2"><div className="h-60"><ResponsiveContainer width="100%" height="100%"><BarChart data={byProd}><CartesianGrid vertical={false} stroke="var(--color-border)" /><XAxis dataKey="name" {...axis} fontSize={11} /><YAxis {...axis} /><RTooltip contentStyle={tip} /><Bar dataKey="v" name="Units" fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></Panel>
        <Panel title="Live orders" bodyClassName="p-0">
          <ul className="divide-y divide-border">{production.filter((p) => p.status === "In Production" || p.status === "Planned").slice(0, 6).map((p) => (
            <li key={p.id} className="px-4 py-2.5 text-sm">
              <div className="flex justify-between gap-2"><span className="truncate font-medium">{short(itemName(p.product))}</span><StatusBadge status={p.status} /></div>
              <p className="text-xs text-muted-foreground">{p.id} · {qty(p.planned)} units · {p.customer}</p>
              {p.status === "In Production" ? <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-accent" style={{ width: `${p.planned > 0 ? (p.produced / p.planned) * 100 : 0}%` }} /></div> : null}
            </li>))}</ul>
        </Panel>
      </div>
    </>
  );
}

export function FinishedProducts() {
  const { items: mockItems } = useOps();
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<any>("/catalog/items/?type=Finished Good"),
      api.get<any>("/catalog/boms/?status=Active"),
    ])
      .then(([itemsRes, bomsRes]) => {
        const itemList = Array.isArray(itemsRes) ? itemsRes : (itemsRes?.results ?? []);
        const bomList = Array.isArray(bomsRes) ? bomsRes : (bomsRes?.results ?? []);
        if (itemList.length > 0) {
          setItems(
            itemList.map((i: any) => ({
              code: i.code,
              name: i.name,
              type: "Finished Good" as const,
              category: i.category_name || "General",
              unit: i.uom_code || "Nos",
              purchase: Number(i.purchase_price) || 0,
              sell: Number(i.selling_price) || 0,
              minSell: Number(i.min_selling_price) || 0,
              tax: Number(i.default_tax_rate) || 18,
              min: Number(i.min_stock_alert) || 0,
              max: Number(i.max_stock_level) || 0,
              stock: Number(i.current_stock ?? 0),
              warehouse: "Kalamassery",
              status: i.status === "Inactive" ? "Inactive" : "Active",
              salesFreq: 0,
              salesQty: 0,
              lastMovedDays: 0,
              ageDays: 0,
            }))
          );
        }
        if (bomList.length > 0) {
          const mappedBoms: Bom[] = bomList.map((b: any) => ({
            id: b.code || `BOM-${b.id}`,
            product: b.finished_good_code || "FG-IDC-PVC",
            version: b.version || "v1",
            output: Number(b.output_quantity) || 1,
            labour: Number(b.labour_cost) || 0,
            updated: "Recent",
            status: b.status as Bom["status"],
            lines: (b.lines || []).map((l: any) => ({
              code: l.component_code || "",
              qty: Number(l.quantity) || 1,
              wastage: Number(l.wastage_percentage) || 0,
              notes: l.notes || "",
            })),
          }));
          bomState = mappedBoms;
        }
      })
      .catch(() => {});
  }, []);

  const activeItems = items.length > 0 ? items : mockItems;
  const fg = activeItems.filter((i) => i.type === "Finished Good");
  return (
    <>
      <SectionHeader title="Finished products" description="Manufactured products with their bill of materials and cost." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{fg.map((i) => {
        const b = bomFor(i.code);
        const cost = b ? bomCost(b, activeItems) : 0;
        return (
          <Panel key={i.code}>
            <div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{i.name}</p><p className="font-mono text-xs text-muted-foreground">{i.code}</p></div><TypeBadge type={i.type} /></div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div><dt className="text-xs text-muted-foreground">Stock</dt><dd className={cn("font-semibold tabular", i.stock < i.min && "text-destructive")}>{qty(i.stock)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Unit cost</dt><dd className="font-semibold tabular">₹{cost.toFixed(2)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Sells at</dt><dd className="font-semibold tabular">₹{i.sell}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">{b ? `${b.id} ${b.version} · ${b.lines.length} components · margin ${i.sell > 0 ? (((i.sell - cost) / i.sell) * 100).toFixed(0) : 0}%` : "No BOM defined"}</p>
          </Panel>
        );
      })}</div>
    </>
  );
}

export function MfgRawMaterials() {
  const { items: mockItems } = useOps();
  const [items, setItems] = useState<Item[]>([]);
  const [boms, setBoms] = useState<any[]>(bomState);

  useEffect(() => {
    Promise.all([
      api.get<any>("/catalog/items/?type=Raw Material"),
      api.get<any>("/catalog/boms/?status=Active"),
    ])
      .then(([itemsRes, bomsRes]) => {
        const itemList = Array.isArray(itemsRes) ? itemsRes : (itemsRes?.results ?? []);
        const bomList = Array.isArray(bomsRes) ? bomsRes : (bomsRes?.results ?? []);
        if (itemList.length > 0) {
          setItems(
            itemList.map((i: any) => ({
              code: i.code,
              name: i.name,
              type: "Raw Material" as const,
              category: i.category_name || "Materials",
              unit: i.uom_code || "Nos",
              purchase: Number(i.purchase_price) || 0,
              sell: Number(i.selling_price) || 0,
              minSell: Number(i.min_selling_price) || 0,
              tax: Number(i.default_tax_rate) || 18,
              min: Number(i.min_stock_alert) || 0,
              max: Number(i.max_stock_level) || 0,
              stock: Number(i.current_stock ?? 0),
              warehouse: "Kalamassery",
              status: i.status === "Inactive" ? "Inactive" : "Active",
              salesFreq: 0,
              salesQty: 0,
              lastMovedDays: 0,
              ageDays: 0,
            }))
          );
        }
        if (bomList.length > 0) {
          setBoms(bomList);
        }
      })
      .catch(() => {});
  }, []);

  const activeItems = items.length > 0 ? items : mockItems;
  const rows = activeItems.filter((i) => i.type === "Raw Material");

  const getUsedIn = (code: string) => {
    const matched = boms.filter((b: any) => {
      const lines = b.lines || [];
      return lines.some((l: any) => (l.component_code || l.code) === code);
    });
    if (matched.length > 0) {
      return matched.map((b: any) => short(b.finished_good_name || itemName(b.product || b.finished_good_code))).join(", ");
    }
    return bomState.filter((b) => b.lines.some((l) => l.code === code)).map((b) => short(itemName(b.product))).join(", ") || "—";
  };

  return (
    <>
      <SectionHeader title="Raw materials" description="Materials consumed by production and where they are used." actions={<ExportButtons />} />
      <DataTable rows={rows} getId={(i) => i.code} entity="material" search={(i) => `${i.code} ${i.name}`} removeLabel={null} filters={[{ label: "Categories", get: (i) => i.category }]}
        columns={[
          { key: "name", header: "Material", sort: (i) => i.name, render: (i) => <div><p className="font-medium">{i.name}</p><p className="font-mono text-xs text-muted-foreground">{i.code}</p></div> },
          { key: "used", header: "Used in", render: (i) => <M>{getUsedIn(i.code)}</M> },
          { key: "cost", header: "Cost", align: "right", render: (i) => `₹${i.purchase} / ${i.unit}` },
          { key: "stock", header: "Stock", align: "right", sort: (i) => i.stock, render: (i) => <span className={cn(i.stock < i.min && "font-medium text-destructive")}>{qty(i.stock, i.unit)}</span> },
          { key: "min", header: "Minimum", align: "right", render: (i) => qty(i.min) },
        ]} />
    </>
  );
}

export function BillOfMaterials() {
  const { items } = useOps();
  const [boms, setBoms] = useState<(Bom & { backendId?: number })[]>(bomState);
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [edit, setEdit] = useState<(Bom & { backendId?: number }) | null>(null);
  const [open, setOpen] = useState<string>("");

  const fetchBoms = () => {
    api.get<any>("/catalog/boms/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        if (list.length > 0) {
          const mapped: (Bom & { backendId?: number })[] = list.map((b: any) => ({
            id: b.code || `BOM-${b.id}`,
            backendId: b.id,
            product: b.finished_good_code || "FG-IDC-PVC",
            version: b.version || "v1",
            output: Number(b.output_quantity) || 1,
            labour: Number(b.labour_cost) || 0,
            updated: b.updated_at ? new Date(b.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Recent",
            status: b.status as Bom["status"],
            lines: (b.lines || []).map((l: any) => ({
              code: l.component_code || "",
              qty: Number(l.quantity) || 1,
              wastage: Number(l.wastage_percentage) || 0,
              notes: l.notes || "",
            })),
          }));
          bomState = mapped;
          setBoms(mapped);
          if (mapped[0] && !open) setOpen(mapped[0].id);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchBoms();
    api.get<any>("/catalog/items/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        setItemsList(list);
      })
      .catch(() => {});
  }, []);

  const save = async (b: Bom & { backendId?: number }) => {
    try {
      const matchedFG = itemsList.find((i) => i.code === b.product) || items.find((i) => i.code === b.product);
      if (!matchedFG) {
        toast.error("Please select a valid finished product");
        return;
      }
      const payload: any = {
        code: b.id,
        finished_good: matchedFG.id,
        version: b.version || "v1",
        output_quantity: Number(b.output) || 1,
        labour_cost: Number(b.labour) || 0,
        status: b.status || "Active",
        notes: "",
        lines: b.lines.map((l) => {
          const comp = itemsList.find((m) => m.code === l.code) || items.find((m) => m.code === l.code);
          return {
            component_item: comp?.id,
            quantity: Number(l.qty) || 1,
            wastage_percentage: Number(l.wastage) || 0,
            notes: l.notes || "",
          };
        }),
      };

      if (b.backendId) {
        await api.put(`/catalog/boms/${b.backendId}/`, payload);
        toast.success(`BOM ${b.id} updated`);
      } else {
        const res = await api.post<any>("/catalog/boms/", payload);
        toast.success(`BOM ${res.code || b.id} created`);
      }
      setEdit(null);
      fetchBoms();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save BOM");
    }
  };

  const materials = items.filter((i) => i.type !== "Service");

  return (
    <>
      <SectionHeader title="Bill of materials" description="Components, quantities and wastage required to make one unit of each finished product." actions={<Button size="sm" onClick={() => setEdit({ id: `BOM-0${boms.length + 1}`, product: items.find((i) => i.type === "Finished Good" && !bomFor(i.code))?.code ?? "FG-IDC-PVC", version: "v1", output: 1, labour: 0, updated: "Recent", status: "Active", lines: [] })}><Plus className="size-4" /> New BOM</Button>} />
      <div className="space-y-3">{boms.map((b) => {
        const fg = items.find((i) => i.code === b.product) || { name: b.product, unit: "Nos" };
        const isOpen = open === b.id;
        return (
          <Panel key={b.id} bodyClassName="p-0">
            <button className="flex w-full flex-wrap items-center gap-3 px-5 py-3 text-left" onClick={() => setOpen(isOpen ? "" : b.id)}>
              <Factory className="size-5 text-accent" />
              <div className="min-w-0 flex-1"><p className="font-semibold">{fg.name}</p><p className="text-xs text-muted-foreground">{b.id} · {b.version} · {b.lines.length} components · updated {b.updated}</p></div>
              <span className="text-sm tabular">Cost ₹{bomCost(b, items).toFixed(2)}/{fg.unit}</span>
              <StatusBadge status={b.status} />
            </button>
            {isOpen ? (
              <div className="border-t border-border p-5">
                <div className="flex flex-col gap-0 pl-1">
                  <div className="inline-flex w-fit items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary">{fg.name} <M>× {b.output}</M></div>
                  {b.lines.map((l) => { const it = items.find((i) => i.code === l.code) || { name: l.code, type: "Raw Material", unit: "Nos" }; return (
                    <div key={l.code} className="ml-4 flex items-stretch">
                      <span className="w-6 border-b border-l border-border" style={{ height: 22 }} />
                      <div className="mt-2 flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border px-3 py-2 text-sm">
                        <span className="min-w-52 flex-1 font-medium">{it.name}</span><TypeBadge type={it.type} />
                        <span className="tabular">{qty(l.qty, it.unit)}</span><span className="text-xs text-muted-foreground">+{l.wastage}% wastage</span>
                        {l.notes ? <span className="w-full text-xs text-muted-foreground">{l.notes}</span> : null}
                      </div>
                    </div>); })}
                </div>
                <div className="mt-4 flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setEdit(b)}><Pencil className="size-4" /> Edit BOM</Button></div>
              </div>
            ) : null}
          </Panel>
        );
      })}</div>
      {edit ? <BomEditor bom={edit} materials={materials} finished={items.filter((i) => i.type === "Finished Good")} onClose={() => setEdit(null)} onSave={save} /> : null}
    </>
  );
}

function BomEditor({ bom, materials, finished, onClose, onSave }: { bom: Bom & { backendId?: number }; materials: Item[]; finished: Item[]; onClose: () => void; onSave: (b: Bom & { backendId?: number }) => void }) {
  const [b, setB] = useState(bom);
  const upd = (i: number, p: Partial<BomLine>) => setB({ ...b, lines: b.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) });
  const opts = materials.filter((m) => m.code !== b.product);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>{b.id} · bill of materials</DialogTitle><DialogDescription>Quantities are per {b.output} unit(s) of the finished product.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Finished product" required><Select value={b.product} onValueChange={(v) => setB({ ...b, product: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{finished.map((f) => <SelectItem key={f.code} value={f.code}>{f.name}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Output quantity" required><Input type="number" value={b.output} onChange={(e) => setB({ ...b, output: Math.max(1, Number(e.target.value)) })} /></Field>
          <Field label="Labour / overhead per unit (₹)"><Input type="number" value={b.labour} onChange={(e) => setB({ ...b, labour: Number(e.target.value) })} /></Field>
          <Field label="Status"><Select value={b.status} onValueChange={(v) => setB({ ...b, status: v as Bom["status"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Draft">Draft</SelectItem></SelectContent></Select></Field>
        </div>
        <div className="max-h-80 overflow-auto rounded-md border border-border">
          <Table><TableHeader><TableRow><TableHead className="min-w-56">Material / component</TableHead><TableHead className="w-28 text-right">Qty required</TableHead><TableHead className="w-16">Unit</TableHead><TableHead className="w-24 text-right">Wastage %</TableHead><TableHead>Notes</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>{b.lines.map((l, i) => (
              <TableRow key={i}>
                <TableCell><Select value={l.code} onValueChange={(v) => upd(i, { code: v })}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{opts.map((m) => <SelectItem key={m.code} value={m.code}>{m.name}</SelectItem>)}</SelectContent></Select></TableCell>
                <TableCell><Input type="number" step="0.001" value={l.qty} onChange={(e) => upd(i, { qty: Number(e.target.value) })} className="h-8 text-right" /></TableCell>
                <TableCell className="text-muted-foreground">{materials.find((m) => m.code === l.code)?.unit}</TableCell>
                <TableCell><Input type="number" value={l.wastage} onChange={(e) => upd(i, { wastage: Number(e.target.value) })} className="h-8 text-right" /></TableCell>
                <TableCell><Input value={l.notes} onChange={(e) => upd(i, { notes: e.target.value })} className="h-8" placeholder="Optional" /></TableCell>
                <TableCell><Button variant="ghost" size="icon" className="size-8" aria-label="Remove" onClick={() => setB({ ...b, lines: b.lines.filter((_, j) => j !== i) })}><Trash2 className="size-4" /></Button></TableCell>
              </TableRow>))}
              {b.lines.length === 0 ? <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">No components yet. Add the first material.</TableCell></TableRow> : null}
            </TableBody></Table>
        </div>
        <Button variant="outline" size="sm" className="w-fit" onClick={() => setB({ ...b, lines: [...b.lines, { code: opts[0]?.code ?? "MAT-01", qty: 1, wastage: 0, notes: "" }] })}><Plus className="size-4" /> Add component</Button>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!b.lines.length} onClick={() => onSave({ ...b, updated: "Recent" })}>Save BOM</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequirementPreview({ product, planned, lines }: { product: string; planned: number; lines?: any[] | undefined }) {
  const { items: mockItems } = useOps();
  const [liveItems, setLiveItems] = useState<Item[]>([]);
  const [liveBoms, setLiveBoms] = useState<Bom[]>(bomState);

  useEffect(() => {
    Promise.all([
      api.get<any>("/catalog/items/"),
      api.get<any>("/catalog/boms/?status=Active"),
    ]).then(([itemsRes, bomsRes]) => {
      const itemList = Array.isArray(itemsRes) ? itemsRes : (itemsRes?.results ?? []);
      const bomList = Array.isArray(bomsRes) ? bomsRes : (bomsRes?.results ?? []);
      if (itemList.length > 0) {
        setLiveItems(
          itemList.map((i: any) => ({
            code: i.code,
            name: i.name,
            type: (i.item_type || "Raw Material") as Item["type"],
            category: i.category_name || "General",
            unit: i.uom_code || "Nos",
            purchase: Number(i.purchase_price) || 0,
            sell: Number(i.selling_price) || 0,
            minSell: Number(i.min_selling_price) || 0,
            tax: Number(i.default_tax_rate) || 18,
            min: Number(i.min_stock_alert) || 0,
            max: Number(i.max_stock_level) || 0,
            stock: Number(i.current_stock ?? 0),
            warehouse: "Kalamassery HQ",
            status: i.status === "Inactive" ? "Inactive" : "Active",
            salesFreq: 0,
            salesQty: 0,
            lastMovedDays: 0,
            ageDays: 0,
          }))
        );
      }
      if (bomList.length > 0) {
        const mapped = bomList.map((b: any) => ({
          id: b.code || `BOM-${b.id}`,
          product: b.finished_good_code || "FG-IDC-PVC",
          version: b.version || "v1",
          output: Number(b.output_quantity) || 1,
          labour: Number(b.labour_cost) || 0,
          updated: "Recent",
          status: b.status as Bom["status"],
          lines: (b.lines || []).map((l: any) => ({
            code: l.component_code || "",
            qty: Number(l.quantity) || 1,
            wastage: Number(l.wastage_percentage) || 0,
            notes: l.notes || "",
          })),
        }));
        setLiveBoms(mapped);
        bomState = mapped;
      }
    }).catch(() => {});
  }, [product]);

  const items = liveItems.length > 0 ? liveItems : mockItems;
  const b = liveBoms.find((bm) => bm.product === product) || bomFor(product);
  const hasBackendLines = Array.isArray(lines) && lines.length > 0;

  if (!b && !hasBackendLines) {
    return <Panel><p className="text-sm text-muted-foreground">No bill of materials for this product. Create one before planning production.</p></Panel>;
  }

  const reqs = hasBackendLines
    ? lines.map((l: any) => {
        const it = items.find((i) => i.code === l.item_code) || {
          code: l.item_code,
          name: l.item_name || l.item_code,
          type: "Raw Material" as const,
          stock: 0,
          unit: l.item_unit || "Nos",
        };
        const req = Number(l.planned_quantity);
        const avail = it.stock;
        return {
          code: l.item_code,
          item: it,
          qty: req,
          unit: l.item_unit || "Nos",
          wastage: Number(l.wastage_percentage) || 0,
          net: req,
          req,
          available: avail,
          short: Math.max(0, Math.round((req - avail) * 1000) / 1000),
        };
      })
    : (b ? requirement(b, planned, items) : []);

  const shortCount = reqs.filter((r) => r.short > 0).length;
  const Stage = ({ n, label }: { n: number; label: string }) => <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">{n}</span>{label}</div>;
  return (
    <Panel title="Material requirement preview" description={b ? `Based on ${b.id} ${b.version}` : "Based on allocated order recipe"}>
      <div className="space-y-3">
        <Stage n={1} label="Production quantity" />
        <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3"><span className="text-2xl font-semibold tabular text-primary">{qty(planned)}</span> <M>× {itemName(product)}</M></div>
        <ArrowDown className="mx-auto size-4 text-muted-foreground" />
        <Stage n={2} label="Required materials → 3 Available stock → 4 Shortage" />
        <div className="grid gap-2">{reqs.map((r) => {
          const pct = Math.min(100, (r.available / Math.max(r.req, 0.0001)) * 100);
          return (
            <div key={r.code} className={cn("grid items-center gap-3 rounded-md border px-3 py-2.5 text-sm sm:grid-cols-[1.6fr_1fr_1fr_1fr]", r.short > 0 ? "border-destructive/40 bg-destructive/5" : "border-border")}>
              <div className="min-w-0"><p className="truncate font-medium">{r.item.name}</p><p className="text-xs text-muted-foreground">{r.qty} {r.item.unit}/unit · +{r.wastage}% wastage</p></div>
              <div><p className="text-xs text-muted-foreground">Required</p><p className="font-semibold tabular">{qty(r.req, r.item.unit)}</p></div>
              <div><p className="text-xs text-muted-foreground">Available</p><p className="tabular">{qty(r.available, r.item.unit)}</p><div className="mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className={cn("h-full", r.short ? "bg-destructive" : "bg-success")} style={{ width: `${pct}%` }} /></div></div>
              <div>{r.short > 0 ? <StatusBadge status="shortage" label={`Short ${qty(r.short, r.item.unit)}`} /> : <StatusBadge status="healthy" label="Available" />}</div>
            </div>);
        })}</div>
        <ArrowDown className="mx-auto size-4 text-muted-foreground" />
        <Stage n={5} label="Production confirmation" />
        <div className={cn("rounded-md border px-4 py-3 text-sm", shortCount ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-success/30 bg-success/10 text-success")}>
          {shortCount ? `${shortCount} material(s) short. Raise a purchase order or reduce the quantity before starting production.` : "All materials available. This order can go into production."}
        </div>
      </div>
    </Panel>
  );
}

export function NewProductionOrder() {
  const nav = useNavigate();
  const { items } = useOps();
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [bomsList, setBomsList] = useState<any[]>([]);
  const [userOptions, setUserOptions] = useState<{ id: number; name: string }[]>([]);
  const [product, setProduct] = useState("");
  const [planned, setPlanned] = useState(1000);
  const [assigned, setAssigned] = useState(users[3] ?? users[0] ?? "Operations Team");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<any>("/catalog/items/?type=Finished Good"),
      api.get<any>("/catalog/boms/?status=Active"),
      api.get<any>("/core/users/").catch(() => []),
    ]).then(([itemsRes, bomsRes, usersRes]) => {
      const itemsData = Array.isArray(itemsRes) ? itemsRes : (itemsRes?.results ?? []);
      const bomsData = Array.isArray(bomsRes) ? bomsRes : (bomsRes?.results ?? []);
      const usersData = Array.isArray(usersRes) ? usersRes : (usersRes?.results ?? []);
      setItemsList(itemsData);
      setBomsList(bomsData);
      if (usersData.length > 0) {
        setUserOptions(usersData.map((u: any) => ({
          id: u.id,
          name: u.first_name ? `${u.first_name} ${u.last_name || ""}`.trim() : (u.username || `User ${u.id}`),
        })));
      }
      if (itemsData.length > 0) {
        setProduct(itemsData[0].code);
      }
    }).catch(() => {});
  }, []);

  const finishedOptions = itemsList.length > 0
    ? itemsList.map((i) => ({ code: i.code, name: i.name }))
    : items.filter((i) => i.type === "Finished Good").map((i) => ({ code: i.code, name: i.name }));

  const displayUsers = userOptions.length > 0 ? userOptions.map((u) => u.name) : users;

  const save = async (status: ProductionOrder["status"]) => {
    if (planned <= 0) {
      toast.error("Enter a valid production quantity");
      return;
    }
    const matchedProduct = itemsList.find((i) => i.code === product) || items.find((i) => i.code === product);
    if (!matchedProduct) {
      toast.error("Please select a finished product");
      return;
    }
    const matchedBom = bomsList.find((b) => b.finished_good_code === product || b.finished_good === matchedProduct.id);
    const matchedUser = userOptions.find((u) => u.name === assigned);

    setSubmitting(true);
    try {
      const payload: any = {
        product: matchedProduct.id || 1,
        bom: matchedBom?.id || null,
        planned_quantity: planned,
        order_date: date,
        status: status === "Planned" ? "Planned" : "Draft",
        notes,
        purpose_notes: "Stock replenishment",
      };
      if (matchedUser?.id) {
        payload.assigned_to = matchedUser.id;
      }
      const res = await api.post<any>("/manufacturing/orders/", payload);
      toast.success(`Production order ${res.code || "PRD"} saved as ${status}`);
      nav({ to: "/manufacturing/$section", params: { section: "orders" } });
    } catch (err: any) {
      toast.error(err?.message || "Failed to create production order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SectionHeader title="New production order" description="Create a production order against BOM recipe. Snapshots material requirements automatically." actions={<><Button variant="outline" size="sm" disabled={submitting} onClick={() => save("Draft")}>Save draft</Button><Button size="sm" disabled={submitting} onClick={() => save("Planned")}>Plan production</Button></>} />
      <div className="grid gap-4 xl:grid-cols-5">
        <Panel title="Order" className="xl:col-span-2">
          <div className="grid gap-4">
            <Field label="Finished product" required><Select value={product || finishedOptions[0]?.code} onValueChange={setProduct}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{finishedOptions.map((f) => <SelectItem key={f.code} value={f.code}>{f.name}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Production quantity" required><Input type="number" min={1} value={planned} onChange={(e) => setPlanned(Math.max(1, Number(e.target.value)))} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Production date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Assigned to"><Select value={assigned} onValueChange={setAssigned}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{displayUsers.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></Field></div>
            <Field label="Notes"><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Use St. Thomas HSS artwork v2" /></Field>
          </div>
        </Panel>
        <div className="xl:col-span-3"><RequirementPreview product={product || finishedOptions[0]?.code || "FG-IDC-PVC"} planned={planned} /></div>
      </div>
    </>
  );
}

export function ProductionOrders() {
  const { items } = useOps();
  const nav = useNavigate();
  const [orders, setOrders] = useState<(ProductionOrder & { backendId?: number; lines?: any[]; productName?: string })[]>([]);
  const [view, setView] = useState<(ProductionOrder & { backendId?: number; lines?: any[]; productName?: string }) | null>(null);
  const [complete, setComplete] = useState<(ProductionOrder & { backendId?: number; lines?: any[]; productName?: string }) | null>(null);
  const [cancel, setCancel] = useState<(ProductionOrder & { backendId?: number; lines?: any[]; productName?: string }) | null>(null);

  const fetchOrders = () => {
    api.get<any>("/manufacturing/orders/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const mapped: (ProductionOrder & { backendId?: number; lines?: any[]; productName?: string })[] = list.map((o: any) => ({
          id: o.code || `PRD-${o.id}`,
          backendId: o.id,
          product: o.product_code || "FG-IDC-PVC",
          productName: o.product_name,
          planned: Number(o.planned_quantity) || 0,
          produced: Number(o.produced_quantity) || 0,
          wastage: Number(o.wastage_quantity) || 0,
          date: o.order_date,
          iso: o.order_date,
          assigned: o.assigned_to_name || "Production Team",
          status: o.status as ProductionOrder["status"],
          customer: o.customer_name || o.purpose_notes || "Stock replenishment",
          notes: o.notes || "",
          batch: o.batch_number || "—",
          lines: o.lines || [],
        }));
        setOrders(mapped);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const setStatus = async (p: ProductionOrder & { backendId?: number }, status: ProductionOrder["status"]) => {
    try {
      const targetId = p.backendId || p.id;
      await api.patch(`/manufacturing/orders/${targetId}/`, { status });
      toast.success(`${p.id} moved to ${status}`);
      fetchOrders();
    } catch (err: any) {
      toast.error(err?.message || `Failed to update status to ${status}`);
    }
  };

  return (
    <>
      <SectionHeader title="Production orders" description="Draft → Planned → In Production → Completed" actions={<><ExportButtons /><Button size="sm" onClick={() => nav({ to: "/manufacturing/$section", params: { section: "new-order" } })}><Plus className="size-4" /> New order</Button></>} />
      <div className="grid gap-3 sm:grid-cols-5">{(["Draft", "Planned", "In Production", "Completed", "Cancelled"] as const).map((s) => <KpiCard key={s} label={s} value={String(orders.filter((p) => p.status === s).length)} />)}</div>
      <DataTable rows={orders} getId={(p) => p.id} entity="production order" search={(p) => `${p.id} ${itemName(p.product)} ${p.assigned} ${p.customer}`} date={(p) => p.iso} onRowClick={setView} removeLabel={null}
        filters={[{ label: "Statuses", get: (p) => p.status }, { label: "Assigned", get: (p) => p.assigned }]}
        detail={(p) => <DetailGrid items={[["Product", itemName(p.product)], ["Planned", qty(p.planned)], ["Produced", qty(p.produced)], ["Wastage", qty(p.wastage)], ["Date", p.date], ["Assigned", p.assigned], ["For", p.customer], ["Batch", p.batch], ["Status", p.status]]} />}
        extraActions={[
          { label: "Plan", show: (p) => p.status === "Draft", onClick: (p) => setStatus(p, "Planned") },
          { label: "Start production", icon: <Play className="size-4" />, show: (p) => p.status === "Planned", onClick: (p) => { const b = bomFor(p.product); if (b && requirement(b, p.planned, items).some((r) => r.short > 0)) toast.error("Materials short — resolve shortages first"); else setStatus(p, "In Production"); } },
          { label: "Complete production", icon: <CheckCircle2 className="size-4" />, show: (p) => p.status === "In Production", onClick: setComplete },
          { label: "Cancel order", icon: <XCircle className="size-4" />, show: (p) => p.status !== "Completed" && p.status !== "Cancelled", onClick: setCancel },
        ]}
        columns={[
          { key: "id", header: "Order", sort: (p) => p.id, render: (p) => <span className="font-medium text-accent">{p.id}</span> },
          { key: "date", header: "Date", sort: (p) => p.iso, render: (p) => p.date },
          { key: "prod", header: "Finished product", sort: (p) => itemName(p.product), render: (p) => <div><p>{short(itemName(p.product))}</p><p className="text-xs text-muted-foreground">{p.customer}</p></div> },
          { key: "plan", header: "Planned", align: "right", sort: (p) => p.planned, render: (p) => qty(p.planned) },
          { key: "done", header: "Produced", align: "right", render: (p) => p.produced ? qty(p.produced) : <M>—</M> },
          { key: "as", header: "Assigned", render: (p) => p.assigned },
          { key: "st", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
        ]} />
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{view?.id} · {view ? itemName(view.product) : ""}</DialogTitle><DialogDescription>{view?.customer} · assigned to {view?.assigned}</DialogDescription></DialogHeader>
          {view ? <div className="max-h-[60vh] space-y-3 overflow-auto"><DetailGrid items={[["Status", <StatusBadge key="s" status={view.status} />], ["Planned", qty(view.planned)], ["Produced", qty(view.produced)], ["Wastage", qty(view.wastage)], ["Production date", view.date], ["Batch", view.batch]]} />{view.notes ? <p className="text-sm"><M>Notes:</M> {view.notes}</p> : null}<RequirementPreview product={view.product} planned={view.planned} lines={view.lines} /></div> : null}
          <DialogFooter>{view?.status === "In Production" ? <Button onClick={() => { setComplete(view); setView(null); }}><CheckCircle2 className="size-4" /> Complete production</Button> : null}</DialogFooter>
        </DialogContent>
      </Dialog>
      {complete ? <CompletionDialog order={complete} onClose={() => setComplete(null)} onCompleted={fetchOrders} /> : null}
      <AlertDialog open={!!cancel} onOpenChange={(o) => !o && setCancel(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Cancel {cancel?.id}?</AlertDialogTitle><AlertDialogDescription>No stock will be consumed. The order stays in history as cancelled.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep order</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (cancel) setStatus(cancel, "Cancelled"); setCancel(null); }}>Cancel order</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CompletionDialog({ order, onClose, onCompleted }: { order: ProductionOrder & { backendId?: number; lines?: any[]; productName?: string }; onClose: () => void; onCompleted?: () => void }) {
  const { items } = useOps();
  const b = bomFor(order.product);
  const reqs = useMemo(() => (b ? requirement(b, order.planned, items) : []), [b, order, items]);

  const hasBackendLines = Array.isArray(order.lines) && order.lines.length > 0;
  const linesToRender = useMemo(() => {
    if (hasBackendLines) {
      return order.lines!.map((l: any) => ({
        code: l.item_code,
        name: l.item_name || l.item_code,
        unit: l.item_unit || "Nos",
        req: Number(l.planned_quantity) || 0,
        net: Number(l.planned_quantity) || 0,
        wastage: Number(l.wastage_percentage) || 0,
        itemId: l.item,
        available: items.find((i) => i.code === l.item_code)?.stock ?? 9999,
      }));
    }
    return reqs.map((r) => ({
      code: r.code,
      name: r.item.name,
      unit: r.item.unit,
      req: r.req,
      net: r.net,
      wastage: r.wastage,
      itemId: (r.item as any).id,
      available: r.available,
    }));
  }, [hasBackendLines, order.lines, reqs, items]);

  const [actual, setActual] = useState<Record<string, number>>(() =>
    Object.fromEntries(linesToRender.map((r) => [r.code, r.req]))
  );
  const [produced, setProduced] = useState(order.planned - Math.round(order.planned * 0.01));
  const [result, setResult] = useState<{ before: Record<string, number> } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fg = items.find((i) => i.code === order.product) || {
    code: order.product,
    name: order.productName || order.product,
    stock: 0,
    unit: "Nos",
  };

  const confirm = async () => {
    setSubmitting(true);
    try {
      const targetId = order.backendId || order.id;
      const wastage = Math.max(0, order.planned - produced);
      const payload: any = {
        produced_quantity: produced,
        wastage_quantity: wastage,
      };

      const consumptions = linesToRender
        .filter((l) => l.itemId)
        .map((l) => ({
          item: l.itemId,
          actual_quantity: actual[l.code] ?? l.req,
        }));

      if (consumptions.length > 0) {
        payload.consumptions = consumptions;
      }

      await api.post(`/manufacturing/orders/${targetId}/complete/`, payload);

      // Backend handles all stock movements (Production Issue OUT + Production Receipt IN)
      // via record_stock_movement() inside a DB transaction — no in-memory update needed.
      setResult({ before: Object.fromEntries([[fg.code, fg.stock], ...linesToRender.map((r) => [r.code, r.available])]) });
      toast.success(`${order.id} completed — ${qty(produced)} units recorded`);
      if (onCompleted) onCompleted();
    } catch (err: any) {
      toast.error(err?.message || "Failed to record production completion");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{result ? "Production completed" : `Complete ${order.id}`}</DialogTitle><DialogDescription>{fg.name} · batch {order.batch}</DialogDescription></DialogHeader>
        {result ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-destructive"><ArrowDownRight className="size-4" /> Raw materials consumed</p>
              <ul className="space-y-1.5 text-sm">{linesToRender.map((r) => { const now = items.find((i) => i.code === r.code)?.stock ?? 0; return <li key={r.code} className="flex justify-between gap-2"><span className="truncate">{short(r.name)}</span><span className="shrink-0 tabular"><M>{qty(result.before[r.code] ?? 0)}</M> → <b>{qty(now)}</b></span></li>; })}</ul>
            </div>
            <div className="rounded-lg border border-success/30 bg-success/10 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-success"><ArrowUpRight className="size-4" /> Finished goods produced</p>
              <p className="text-sm">{fg.name}</p>
              <p className="mt-2 text-2xl font-semibold tabular"><span className="text-base font-normal text-muted-foreground">{qty(result.before[fg.code] ?? 0)} →</span> {qty(items.find((i) => i.code === fg.code)?.stock ?? Number(produced))}</p>
              <p className="text-xs text-muted-foreground">+{qty(produced)} {fg.unit} · batch {order.batch}</p>
            </div>
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-4 overflow-auto">
            <div>
              <p className="mb-2 text-sm font-semibold">Materials consumed</p>
              <div className="rounded-md border border-border"><Table><TableHeader><TableRow><TableHead>Material</TableHead><TableHead className="text-right">Required</TableHead><TableHead className="w-32 text-right">Actual used</TableHead><TableHead className="text-right">Wastage</TableHead></TableRow></TableHeader>
                <TableBody>{linesToRender.map((r) => { const a = actual[r.code] ?? r.req; const w = a - r.net; return (
                  <TableRow key={r.code}><TableCell>{r.name}</TableCell><TableCell className="text-right tabular">{qty(r.req, r.unit)}</TableCell>
                    <TableCell><Input type="number" step="0.001" value={a} onChange={(e) => setActual({ ...actual, [r.code]: Number(e.target.value) })} className={cn("h-8 text-right", a > r.available && "border-destructive")} /></TableCell>
                    <TableCell className={cn("text-right tabular", w > r.net * (r.wastage / 100) + 0.0001 && "text-destructive")}>{qty(Math.max(0, Math.round(w * 1000) / 1000))}</TableCell></TableRow>); })}</TableBody></Table></div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Finished goods produced</p>
              <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-4">
                <div><M>Product</M><p className="text-sm font-medium">{short(fg.name)}</p></div>
                <Field label="Good quantity" required><Input type="number" value={produced} onChange={(e) => setProduced(Math.max(0, Number(e.target.value)))} /></Field>
                <div><M>Batch</M><p className="font-mono text-sm">{order.batch}</p></div>
                <div><M>Rejected</M><p className="text-sm tabular">{qty(Math.max(0, order.planned - produced))} of {qty(order.planned)}</p></div>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          {result ? <><Button variant="outline" asChild><Link to="/inventory/$section" params={{ section: "movements" }}>View stock movements</Link></Button><Button onClick={onClose}>Done</Button></> : <><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={submitting || produced <= 0} onClick={confirm}><CheckCircle2 className="size-4" /> {submitting ? "Recording..." : "Confirm completion"}</Button></>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProductionHistory() {
  const { items } = useOps();
  const [rows, setRows] = useState<ProductionOrder[]>([]);

  useEffect(() => {
    api.get<any>("/manufacturing/orders/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const filtered = list.filter((o: any) => o.status === "Completed" || o.status === "Cancelled");
        const mapped: ProductionOrder[] = filtered.map((o: any) => ({
          id: o.code || `PRD-${o.id}`,
          product: o.product_code || "FG-IDC-PVC",
          planned: Number(o.planned_quantity) || 0,
          produced: Number(o.produced_quantity) || 0,
          wastage: Number(o.wastage_quantity) || 0,
          date: o.order_date,
          iso: o.order_date,
          assigned: o.assigned_to_name || "Production Team",
          status: o.status as ProductionOrder["status"],
          customer: o.customer_name || o.purpose_notes || "Stock replenishment",
          notes: o.notes || "",
          batch: o.batch_number || "—",
        }));
        setRows(mapped);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <SectionHeader title="Production history" description="Completed and cancelled production with yield and wastage." actions={<ExportButtons />} />
      <DataTable rows={rows} getId={(p) => p.id} entity="production record" search={(p) => `${p.id} ${itemName(p.product)} ${p.batch}`} date={(p) => p.iso} removeLabel={null} filters={[{ label: "Statuses", get: (p) => p.status }]}
        columns={[
          { key: "id", header: "Order", sort: (p) => p.id, render: (p) => <span className="font-medium">{p.id}</span> },
          { key: "date", header: "Date", sort: (p) => p.iso, render: (p) => p.date },
          { key: "prod", header: "Product", render: (p) => short(itemName(p.product)) },
          { key: "batch", header: "Batch", render: (p) => <span className="font-mono text-xs">{p.batch}</span> },
          { key: "plan", header: "Planned", align: "right", render: (p) => qty(p.planned) },
          { key: "done", header: "Produced", align: "right", sort: (p) => p.produced, render: (p) => qty(p.produced) },
          { key: "yield", header: "Yield", align: "right", sort: (p) => (p.planned > 0 ? p.produced / p.planned : 0), render: (p) => p.produced ? `${((p.produced / Math.max(1, p.planned)) * 100).toFixed(1)}%` : <M>—</M> },
          { key: "as", header: "By", render: (p) => p.assigned },
          { key: "st", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
        ]}
        detail={(p) => <DetailGrid items={[["Product", itemName(p.product)], ["Batch", p.batch], ["Planned", qty(p.planned)], ["Produced", qty(p.produced)], ["Wastage", qty(p.wastage)], ["Customer / purpose", p.customer], ["Assigned", p.assigned], ["Estimated cost", inr(p.produced * (bomFor(p.product) ? bomCost(bomFor(p.product)!, items) : 0))]]} />}
      />
    </>
  );
}

export function MfgOperations() {
  const [orders, setOrders] = useState<(ProductionOrder & { backendId?: number })[]>([]);

  const fetchOperations = () => {
    api.get<any>("/manufacturing/orders/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const mapped: (ProductionOrder & { backendId?: number })[] = list.map((o: any) => ({
          id: o.code || `PRD-${o.id}`,
          backendId: o.id,
          product: o.product_code || "FG-IDC-PVC",
          planned: Number(o.planned_quantity) || 0,
          produced: Number(o.produced_quantity) || 0,
          wastage: Number(o.wastage_quantity) || 0,
          date: o.order_date,
          iso: o.order_date,
          assigned: o.assigned_to_name || "Production Team",
          status: o.status as ProductionOrder["status"],
          customer: o.customer_name || o.purpose_notes || "Stock replenishment",
          notes: o.notes || "",
          batch: o.batch_number || "—",
        }));
        setOrders(mapped);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchOperations();
  }, []);

  const inProduction = orders.filter((o) => o.status === "In Production");
  const planned = orders.filter((o) => o.status === "Planned");
  const completed = orders.filter((o) => o.status === "Completed");

  return (
    <>
      <SectionHeader title="Manufacturing operations" description="Live shop floor batch execution, stages, and work order transitions." actions={<ExportButtons />} />
      <div className="grid gap-3 sm:grid-cols-4">
        <KpiCard label="Active batches" value={String(inProduction.length)} tone="up" hint="Running on shop floor" />
        <KpiCard label="Queued runs" value={String(planned.length)} hint="Planned / awaiting start" />
        <KpiCard label="Completed runs" value={String(completed.length)} />
        <KpiCard label="Total batch units" value={qty(sum(inProduction, (o) => o.planned))} hint="Units in progress" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Production work centers & stages" className="xl:col-span-2">
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-border p-4">
              <Layers className="mt-0.5 size-5 text-accent" />
              <div>
                <p className="font-semibold">Station 1: Raw Material Preparation & Allocation</p>
                <p className="text-xs text-muted-foreground">Checks BOM recipes and verifies PVC cores, overlay films and lanyards before dispatching to lines.</p>
                <p className="mt-2 text-xs font-medium text-primary">{planned.length} order(s) queued for allocation</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
              <Factory className="mt-0.5 size-5 text-primary" />
              <div>
                <p className="font-semibold">Station 2: Thermal Printing & Lamination Press</p>
                <p className="text-xs text-muted-foreground">High-precision digital card printing, hot-press lamination and die-cutting.</p>
                <p className="mt-2 text-xs font-medium text-accent">{inProduction.length} active batch run(s) executing</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border p-4">
              <CheckCircle2 className="mt-0.5 size-5 text-success" />
              <div>
                <p className="font-semibold">Station 3: Quality Inspection & Finished Goods Staging</p>
                <p className="text-xs text-muted-foreground">Scrap quantification, barcode verification, and lot packaging.</p>
                <p className="mt-2 text-xs font-medium text-success">{completed.length} completed batch runs closed</p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Active shop floor batches" bodyClassName="p-0">
          {inProduction.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No active batch runs executing right now.</div>
          ) : (
            <ul className="divide-y divide-border">
              {inProduction.map((o) => (
                <li key={o.id} className="p-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-accent">{o.id}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="mt-1 font-semibold">{short(itemName(o.product))}</p>
                  <p className="text-xs text-muted-foreground">Batch: {o.batch} · {qty(o.planned)} units</p>
                  <p className="mt-1 text-xs text-muted-foreground">Assigned to: {o.assigned}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Shop floor execution schedule" bodyClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Planned qty</TableHead>
              <TableHead>Supervisor</TableHead>
              <TableHead>Execution status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.slice(0, 10).map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium text-accent">{o.id}</TableCell>
                <TableCell className="font-mono text-xs">{o.batch}</TableCell>
                <TableCell>{short(itemName(o.product))}</TableCell>
                <TableCell className="text-muted-foreground">{o.date}</TableCell>
                <TableCell className="text-right tabular font-medium">{qty(o.planned)}</TableCell>
                <TableCell>{o.assigned}</TableCell>
                <TableCell><StatusBadge status={o.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}
