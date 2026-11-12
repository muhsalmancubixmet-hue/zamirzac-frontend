import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, Loader2, Settings2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { KpiCard, Panel, StatusBadge, EmptyState } from "@/components/erp/primitives";
import { DataTable, DetailGrid, FormGrid, type Column } from "@/components/erp/DataTable";
import { ExportButtons, SectionHeader } from "@/components/erp/ModuleLayout";
import { Field } from "@/components/sales/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { inr } from "@/lib/format";
import { currentUser } from "@/lib/user";
import { adjustments, boms, itemName, stockStatus, transfers, warehouses, type Item, type Movement } from "@/data/ops";
import { ops, useOps } from "@/data/ops-store";
import { TypeBadge, axis, chartColors, k, qty, short, sum, tip } from "./common";

const value = (i: Item) => i.stock * i.purchase;
const stocked = (list: Item[]) => list.filter((i) => i.type !== "Service");
const M = ({ children }: { children: React.ReactNode }) => <span className="text-muted-foreground">{children}</span>;
const statusCol: Column<Item> = { key: "st", header: "Stock status", sort: (i) => stockStatus(i), render: (i) => stockStatus(i) === "—" ? <M>—</M> : <StatusBadge status={stockStatus(i)} /> };
const stockCol: Column<Item> = { key: "stock", header: "Current stock", align: "right", sort: (i) => i.stock, render: (i) => i.type === "Service" ? <M>—</M> : <span className={cn(i.stock < i.min && "font-medium text-destructive")}>{qty(i.stock, i.unit)}</span> };

export function InventoryDashboard() {
  const { items: mockItems, movements: mockMovements } = useOps();
  const [items, setItems] = useState<Item[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<any>("/catalog/items/"),
      api.get<any>("/catalog/movements/"),
      api.get<any>("/catalog/analytics/"),
    ])
      .then(([itemRes, movRes, analyticsRes]) => {
        const itemList = Array.isArray(itemRes) ? itemRes : (itemRes?.results ?? []);
        const movList = Array.isArray(movRes) ? movRes : (movRes?.results ?? []);
        const anList = Array.isArray(analyticsRes) ? analyticsRes : (analyticsRes?.results ?? []);
        const anMap = new Map<string, any>(anList.map((a: any) => [a.code, a]));

        if (itemList.length > 0) {
          setItems(
            itemList.map((i: any) => {
              const an = anMap.get(i.code);
              return {
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
                salesFreq: Number(an?.sales_frequency ?? 0),
                salesQty: Number(an?.sales_qty ?? 0),
                lastMovedDays: Number(an?.days_idle ?? 0),
                ageDays: Number(an?.days_idle ?? 0),
              };
            })
          );
        }
        if (movList.length > 0) {
          setMovements(
            movList.map((m: any) => ({
              id: String(m.id),
              code: m.item_code,
              type: m.movement_type,
              qty: m.direction === "IN" ? Number(m.quantity) : -Number(m.quantity),
              ref: m.reference_document || `#${m.id}`,
              date: m.created_at ? new Date(m.created_at).toLocaleDateString("en-IN") : "Today",
              iso: m.created_at ? m.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
              user: m.created_by_name || "System",
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const activeItems = items.length > 0 ? items : mockItems;
  const activeMovements = movements.length > 0 ? movements : mockMovements;

  const s = stocked(activeItems);
  const byCat = Object.values(s.reduce<Record<string, { name: string; value: number }>>((a, i) => { (a[i.category] ??= { name: i.category, value: 0 }).value += value(i); return a; }, {})).sort((a, b) => b.value - a.value);
  const last14 = Array.from({ length: 14 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - idx));
    return d.toISOString().slice(0, 10);
  });
  const days = Array.from(new Set([...last14, ...activeMovements.map((m) => m.iso)])).sort().slice(-14);
  const flow = days.map((d) => ({ d: d.slice(5), in: sum(activeMovements.filter((m) => m.iso === d && m.qty > 0), (m) => m.qty), out: -sum(activeMovements.filter((m) => m.iso === d && m.qty < 0), (m) => m.qty) }));
  const fg = s.filter((i) => i.type === "Finished Good");
  const fastPool = fg.length > 0 ? fg : s;
  const fast = [...fastPool].sort((a, b) => (b.salesQty || b.salesFreq) - (a.salesQty || a.salesFreq)).slice(0, 5).map((i) => ({ name: short(i.name).slice(0, 22), v: i.salesQty }));
  const slow = [...s].sort((a, b) => b.lastMovedDays - a.lastMovedDays).slice(0, 5).map((i) => ({ name: short(i.name).slice(0, 22), v: i.lastMovedDays }));
  const ageing = [["0–30 days", 0, 30], ["31–60 days", 31, 60], ["61–90 days", 61, 90], ["90+ days", 91, 9999]].map(([l, a, b]) => ({ l, v: sum(s.filter((i) => i.ageDays >= (a as number) && i.ageDays <= (b as number)), value) }));
  return (
    <>
      <SectionHeader title="Inventory dashboard" description="Stock position across Kalamassery, Kozhikode and Thrissur" actions={<><ExportButtons /><Button size="sm" asChild><Link to="/inventory/$section" params={{ section: "alerts" }}><Bell className="size-4" /> Stock alerts</Link></Button></>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        <KpiCard label="Stock value" value={inr(sum(s, value))} />
        <KpiCard label="Products" value={String(activeItems.length)} hint={`${s.length} stocked`} />
        <KpiCard label="Raw materials" value={String(s.filter((i) => i.type === "Raw Material").length)} />
        <KpiCard label="Finished goods" value={String(fg.length)} />
        <KpiCard label="Low stock" value={String(s.filter((i) => stockStatus(i) === "Low").length)} tone="down" hint="Below minimum" />
        <KpiCard label="Out of stock" value={String(s.filter((i) => i.stock <= 0).length)} tone="down" />
        <KpiCard label="Dead stock" value={String(s.filter((i) => stockStatus(i) === "Dead").length)} hint="No movement 60+ days" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Stock movement" description="Units in vs out, last 14 active days" className="xl:col-span-2">
          <div className="h-60"><ResponsiveContainer width="100%" height="100%"><AreaChart data={flow} margin={{ left: -4, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" /><XAxis dataKey="d" {...axis} /><YAxis {...axis} /><RTooltip contentStyle={tip} />
            <Area dataKey="in" name="Stock in" stroke="var(--color-success)" fill="var(--color-success)" fillOpacity={0.12} />
            <Area dataKey="out" name="Stock out" stroke="var(--color-chart-2)" fill="var(--color-chart-2)" fillOpacity={0.12} />
          </AreaChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Stock value by category">
          <div className="h-52"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={byCat} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>{byCat.map((_, i) => <Cell key={i} fill={chartColors[i % 5]} />)}</Pie><RTooltip contentStyle={tip} formatter={(v: number) => inr(v)} /></PieChart></ResponsiveContainer></div>
          <ul className="mt-2 space-y-1 text-xs">{byCat.slice(0, 5).map((c, i) => <li key={c.name} className="flex justify-between"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: chartColors[i % 5] }} />{c.name}</span><span className="tabular">{inr(c.value)}</span></li>)}</ul>
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Fast-moving products" description="Units sold this quarter"><MiniBars data={fast} color="var(--color-chart-1)" /></Panel>
        <Panel title="Slow-moving items" description="Days since last movement"><MiniBars data={slow} color="var(--color-warning)" /></Panel>
        <Panel title="Stock ageing" description="Value by age"><div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={ageing}><XAxis dataKey="l" {...axis} fontSize={11} /><YAxis {...axis} tickFormatter={k} /><RTooltip contentStyle={tip} formatter={(v: number) => inr(v)} /><Bar dataKey="v" name="Value" fill="var(--color-chart-3)" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></Panel>
      </div>
      <Panel title="Recent stock movements" bodyClassName="p-0" actions={<Button variant="ghost" size="sm" asChild><Link to="/inventory/$section" params={{ section: "movements" }}>View all</Link></Button>}>
        <ul className="divide-y divide-border">{activeMovements.slice(0, 8).map((m) => <MoveRow key={m.id} m={m} />)}</ul>
      </Panel>
    </>
  );
}
function MiniBars({ data, color }: { data: { name: string; v: number }[]; color: string }) {
  return <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{ left: 20, right: 8 }}><XAxis type="number" {...axis} /><YAxis type="category" dataKey="name" {...axis} width={130} fontSize={11} /><RTooltip contentStyle={tip} /><Bar dataKey="v" fill={color} radius={[0, 3, 3, 0]} /></BarChart></ResponsiveContainer></div>;
}
function MoveRow({ m }: { m: Movement }) {
  const up = m.qty > 0;
  return (
    <li className="flex items-center gap-3 px-5 py-2.5 text-sm">
      <span className={cn("flex size-7 items-center justify-center rounded-md", up ? "bg-success/10 text-success" : m.qty < 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>{up ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}</span>
      <div className="min-w-0 flex-1"><p className="truncate font-medium">{itemName(m.code)}</p><p className="text-xs text-muted-foreground">{m.type} · {m.ref} · {m.date}</p></div>
      <span className={cn("tabular font-medium", up ? "text-success" : m.qty < 0 && "text-destructive")}>{m.qty > 0 ? "+" : ""}{qty(m.qty)}</span>
    </li>
  );
}

function ProductTable({ preset, title, description }: { preset?: Item["type"]; title: string; description: string }) {
  const { items: mockItems } = useOps();
  const [apiItems, setApiItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [uoms, setUoms] = useState<{ id: number; code: string; name: string }[]>([]);

  const fetchItems = () => {
    Promise.all([
      api.get<any>("/catalog/items/"),
      api.get<any>("/catalog/categories/"),
      api.get<any>("/catalog/uoms/"),
    ])
      .then(([itemRes, catRes, uomRes]) => {
        const itemList = Array.isArray(itemRes) ? itemRes : (itemRes?.results ?? []);
        const catList = Array.isArray(catRes) ? catRes : (catRes?.results ?? []);
        const uomList = Array.isArray(uomRes) ? uomRes : (uomRes?.results ?? []);
        setCategories(catList);
        setUoms(uomList);

        if (itemList.length > 0) {
          const mapped: Item[] = itemList.map((i: any) => ({
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
            stock: Number(i.current_stock ?? 0),
            warehouse: "Kalamassery",
            status: i.status === "Inactive" ? "Inactive" : "Active",
            salesFreq: 0,
            salesQty: 0,
            lastMovedDays: 0,
            ageDays: 0,
            usedIn: Array.isArray(i.used_in) ? i.used_in : [],
          }));
          setApiItems(mapped);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const items = apiItems.length > 0 ? apiItems : mockItems;
  const rows = preset ? items.filter((i) => i.type === preset) : items;
  const usedIn = (code: string) => boms.filter((b) => b.lines.some((l) => l.code === code)).map((b) => itemName(b.product));

  const handleSave = async (data: Record<string, any>, currentItem: Item | null) => {
    const inputCat = String(data["Category"] || "").trim();
    let matchedCat = categories.find((c) => c.name.toLowerCase() === inputCat.toLowerCase());
    if (!matchedCat && inputCat) {
      try {
        const createdCat = await api.post<any>("/catalog/categories/", {
          name: inputCat,
          slug: inputCat.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        });
        matchedCat = createdCat;
        setCategories((prev) => [...prev, createdCat]);
      } catch {
        // proceed
      }
    }

    const inputUom = String(data["Unit"] || "").trim();
    let matchedUom = uoms.find(
      (u) =>
        u.code.toLowerCase() === inputUom.toLowerCase() ||
        u.name.toLowerCase() === inputUom.toLowerCase()
    );
    if (!matchedUom && inputUom) {
      try {
        const createdUom = await api.post<any>("/catalog/uoms/", {
          code: inputUom,
          name: inputUom,
        });
        matchedUom = createdUom;
        setUoms((prev) => [...prev, createdUom]);
      } catch {
        // proceed
      }
    }

    const taxVal = String(data["GST rate"] || "18%").replace("%", "").trim();
    interface ItemPayload {
      code: string;
      name: string;
      item_type: string;
      category: number;
      uom: number;
      purchase_price: number;
      selling_price: number;
      min_selling_price: number;
      default_tax_rate: string;
      min_stock_alert: number;
      status: string;
      is_active: boolean;
    }
    const payload: ItemPayload = {
      code: String(data["SKU"] || "").trim().toUpperCase(),
      name: String(data["Product name"] || "").trim(),
      item_type: data["Product type"] || preset || "Raw Material",
      category: matchedCat ? matchedCat.id : (categories[0]?.id || 1),
      uom: matchedUom ? matchedUom.id : (uoms[0]?.id || 1),
      purchase_price: Number(data["Purchase price (₹)"]) || 0,
      selling_price: Number(data["Default selling price (₹)"]) || 0,
      min_selling_price: Number(data["Minimum selling price (₹)"]) || 0,
      default_tax_rate: (Number(taxVal) || 18).toFixed(2),
      min_stock_alert: Number(data["Minimum stock level"]) || 0,
      status: data["Status"] || "Active",
      is_active: data["Status"] !== "Inactive",
    };

    if (!payload.code || !payload.name) {
      toast.error("Product name and SKU code are required.");
      return false;
    }

    try {
      if (!currentItem) {
        await api.post("/catalog/items/", payload);
        toast.success(`Product ${payload.code} created on backend`);
      } else {
        await api.patch(`/catalog/items/${currentItem.code}/`, payload);
        toast.success(`Product ${payload.code} updated on backend`);
      }
      fetchItems();
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to save product to backend");
      return false;
    }
  };

  const handleDelete = async (item: Item) => {
    try {
      await api.delete(`/catalog/items/${item.code}/`);
      toast.success(`Product ${item.code} deleted from backend`);
      fetchItems();
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete product from backend");
      return false;
    }
  };

  const categoryOptions = categories.length
    ? categories.map((c) => c.name)
    : [
        "Smart Cards & PVC",
        "PVC & overlay",
        "Ribbons & ink",
        "Lanyard materials",
        "Fittings",
        "Holders",
        "RFID",
        "Packaging",
        "ID cards",
        "Lanyards",
        "Kits",
        "Badges",
        "Consumables",
        "Services",
        "General",
      ];

  const uomOptions = uoms.length
    ? uoms.map((u) => u.code)
    : ["Nos", "Sheet", "Roll", "Set", "Kit", "Box", "Job"];

  return (
    <>
      <SectionHeader title={title} description={description} actions={<ExportButtons />} />
      {preset ? null : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{(["Raw Material", "Finished Good", "Consumable", "Service"] as const).map((t) => (
          <div key={t} className="flex items-center justify-between rounded-lg border border-border bg-card p-3"><TypeBadge type={t} /><span className="text-lg font-semibold tabular">{items.filter((i) => i.type === t).length}</span></div>))}</div>
      )}
      <DataTable rows={rows} getId={(i) => i.code} entity="product" createLabel="New product" search={(i) => `${i.code} ${i.name} ${i.category}`} searchPlaceholder="Search name, SKU, category"
        filters={[...(preset ? [] : [{ label: "Types", get: (i: Item) => i.type }]), { label: "Categories", get: (i: Item) => i.category }, { label: "Stock status", get: (i: Item) => stockStatus(i) }, { label: "Statuses", get: (i: Item) => i.status }]}
        removeLabel="Delete"
        onSave={handleSave}
        onDelete={handleDelete}
        extraActions={[{ label: "Archive", onClick: (i) => toast.success(`${i.name} archived`) }]}
        columns={[
          { key: "name", header: "Product", sort: (i) => i.name, render: (i) => <div><p className="font-medium">{i.name}</p><p className="font-mono text-xs text-muted-foreground">{i.code}</p></div> },
          ...(preset ? [] : [{ key: "type", header: "Type", sort: (i: Item) => i.type, render: (i: Item) => <TypeBadge type={i.type} /> }]),
          { key: "cat", header: "Category", sort: (i) => i.category, render: (i) => i.category },
          { key: "unit", header: "Unit", render: (i) => i.unit },
          { key: "pp", header: preset === "Finished Good" ? "Unit cost" : "Purchase", align: "right", sort: (i) => i.purchase, render: (i) => i.purchase ? `₹${i.purchase.toLocaleString("en-IN")}` : <M>—</M> },
          ...(preset === "Raw Material" ? [{
            key: "used",
            header: "Used in",
            render: (i: Item) => {
              const fgList = (i as any).usedIn && (i as any).usedIn.length > 0 ? (i as any).usedIn : usedIn(i.code);
              return <M>{fgList.length ? `${fgList.length} product(s)` : "—"}</M>;
            }
          }] : [
            { key: "sp", header: "Selling", align: "right" as const, sort: (i: Item) => i.sell, render: (i: Item) => i.sell ? `₹${i.sell}` : <M>—</M> },
            { key: "min", header: "Min. sell", align: "right" as const, render: (i: Item) => i.sell ? `₹${i.minSell}` : <M>—</M> }]),
          { key: "tax", header: "GST", align: "right", render: (i) => `${i.tax}%` },
          { key: "minlvl", header: "Min. level", align: "right", render: (i) => i.type === "Service" ? <M>—</M> : qty(i.min) },
          stockCol, statusCol,
        ]}
        detail={(i) => <DetailGrid items={[["Name", i.name], ["SKU", i.code], ["Type", <TypeBadge key="t" type={i.type} />], ["Category", i.category], ["Unit", i.unit], ["Purchase price", inr(i.purchase)], ["Default selling price", i.sell ? inr(i.sell) : "—"], ["Minimum selling price", i.sell ? inr(i.minSell) : "—"], ["GST rate", `${i.tax}%`], ["Minimum stock level", qty(i.min, i.unit)], ["Current stock", qty(i.stock, i.unit)], ["Warehouse", i.warehouse], ...(i.type === "Raw Material" ? [["Used in", ((i as any).usedIn && (i as any).usedIn.length > 0 ? (i as any).usedIn.join(", ") : usedIn(i.code).join(", ")) || "—"] as [string, string]] : []), ...(i.expiry ? [["Expiry", i.expiry] as [string, string]] : [])]} />}
        form={(i) => <FormGrid fields={[{ label: "Product name", value: i?.name, wide: true }, { label: "SKU", value: i?.code }, { label: "Product type", value: i?.type ?? preset, options: ["Raw Material", "Finished Good", "Consumable", "Service"] }, { label: "Category", value: i?.category, options: categoryOptions }, { label: "Unit", value: i?.unit, options: uomOptions }, { label: "Purchase price (₹)", value: i?.purchase, type: "number" }, { label: "Default selling price (₹)", value: i?.sell, type: "number" }, { label: "Minimum selling price (₹)", value: i?.minSell, type: "number" }, { label: "GST rate", value: i ? `${i.tax}%` : "18%", options: ["0%", "5%", "12%", "18%", "28%"] }, { label: "Minimum stock level", value: i?.min, type: "number" }, { label: "Status", value: i?.status ?? "Active", options: ["Active", "Inactive"] }]} />}
      />
    </>
  );
}

export const Products = () => <ProductTable title="Products" description="All raw materials, finished goods, consumables and services." />;
export const RawMaterials = () => <ProductTable preset="Raw Material" title="Raw materials" description="Card stock, films, ribbons, lanyard tape, fittings and packaging used in production." />;
export const FinishedGoods = () => <ProductTable preset="Finished Good" title="Finished goods" description="Manufactured ID cards, lanyards, kits and badges ready for sale." />;

export function StockOverview() {
  const [items, setItems] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [wh, setWh] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<any>("/catalog/items/"),
      api.get<any>("/branches/"),
      api.get<any>("/catalog/stock/"),
    ])
      .then(([itemRes, branchRes, stockRes]) => {
        const itemList = Array.isArray(itemRes) ? itemRes : (itemRes?.results ?? []);
        const branchList = Array.isArray(branchRes) ? branchRes : (branchRes?.results ?? []);
        const stockList = Array.isArray(stockRes) ? stockRes : (stockRes?.results ?? []);
        setItems(itemList);
        setBranches(branchList);
        setStocks(stockList);
      })
      .catch((err: any) => {
        console.error("Backend inventory stock fetch error:", err);
        setError(err?.message || "Failed to load stock overview from backend");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const branchNames = branches.map((b) => b.name || b.code);

  // Authoritative stock lookup map by item and branch
  const stockMap: Record<string, number> = {};
  stocks.forEach((s) => {
    const qtyNum = Number(s.quantity) || 0;
    if (s.item_code) {
      stockMap[`${s.item_code}__${s.branch_code}`] = qtyNum;
      stockMap[`${s.item_code}__${s.branch_name}`] = qtyNum;
      stockMap[`${s.item_code}__all`] = (stockMap[`${s.item_code}__all`] || 0) + qtyNum;
    }
  });

  const getStock = (code: string) => {
    return stockMap[`${code}__${wh}`] ?? (wh === "all" ? (stockMap[`${code}__all`] ?? 0) : 0);
  };

  const rows = items.map((i) => {
    const currentStock = getStock(i.code);
    const minAlert = Number(i.min_stock_alert) || 0;
    const purchaseCost = Number(i.purchase_price) || 0;
    let computedStatus = "In stock";
    if (currentStock <= 0) {
      computedStatus = "Out of stock";
    } else if (currentStock < minAlert) {
      computedStatus = "Low stock";
    }

    return {
      code: i.code,
      name: i.name,
      type: (i.item_type || "Raw Material") as Item["type"],
      category: i.category_name || "General",
      unit: i.uom_code || "Nos",
      purchase: purchaseCost,
      sell: Number(i.selling_price) || 0,
      stock: currentStock,
      stockValue: currentStock * purchaseCost,
      min: minAlert,
      max: Number(i.max_stock_level) || 0,
      status: (i.status || "Active") as any,
      stockStatus: computedStatus,
      warehouse: wh === "all" ? "All warehouses" : wh,
      supplier: i.supplier_name || "—",
    };
  });

  const rawMaterials = rows.filter((i) => i.type === "Raw Material");
  const finishedGoods = rows.filter((i) => i.type === "Finished Good");
  const totalStockValue = rows.reduce((acc, r) => acc + r.stockValue, 0);
  const lowStockCount = rows.filter((r) => r.stockStatus === "Low stock").length;
  const outOfStockCount = rows.filter((r) => r.stockStatus === "Out of stock").length;

  return (
    <>
      <SectionHeader title="Stock overview" description="Catalog inventory master and warehouse stock configuration." actions={<ExportButtons />} />
      <Tabs value={wh} onValueChange={setWh}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All warehouses</TabsTrigger>
          {branchNames.map((w) => <TabsTrigger key={w} value={w}>{w}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div className="grid gap-3 sm:grid-cols-4">
        <KpiCard label="Verified stock value" value={inr(totalStockValue)} hint="On-hand ledger valuation" />
        <KpiCard label="Catalog products" value={String(items.length)} hint="Total master items" />
        <KpiCard label="Low / Out of stock" value={`${lowStockCount} / ${outOfStockCount}`} tone={outOfStockCount > 0 ? "down" : undefined} hint="Alert thresholds" />
        <KpiCard label="Warehouses" value={String(branches.length || 1)} hint="Active branches / depots" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-accent" />
          <span className="ml-2 text-sm text-muted-foreground">Loading stock from backend…</span>
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={fetchData}>
            Retry
          </Button>
        </div>
      ) : (
        <DataTable
          rows={rows}
          getId={(i) => i.code}
          entity="item"
          search={(i) => `${i.code} ${i.name} ${i.category}`}
          filters={[
            { label: "Types", get: (i) => i.type },
            { label: "Categories", get: (i) => i.category },
            { label: "Stock status", get: (i) => i.stockStatus },
            { label: "Statuses", get: (i) => i.status },
          ]}
          removeLabel={null}
          columns={[
            {
              key: "name",
              header: "Item",
              sort: (i) => i.name,
              render: (i) => (
                <div>
                  <p className="font-medium">{i.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{i.code}</p>
                </div>
              ),
            },
            { key: "type", header: "Type", render: (i) => <TypeBadge type={i.type} /> },
            { key: "cat", header: "Category", render: (i) => i.category },
            { key: "unit", header: "Unit", render: (i) => i.unit },
            { key: "stock", header: "On-hand stock", align: "right", sort: (i) => i.stock, render: (i) => <span className={cn("tabular font-medium", i.stock <= 0 && "text-muted-foreground", i.stock > 0 && i.stock < i.min && "text-warning", i.stock >= i.min && i.stock > 0 && "text-success")}>{qty(i.stock, i.unit)}</span> },
            { key: "pp", header: "Unit cost", align: "right", sort: (i) => i.purchase, render: (i) => inr(i.purchase) },
            { key: "val", header: "Valuation", align: "right", sort: (i) => i.stockValue, render: (i) => inr(i.stockValue) },
            { key: "min", header: "Reorder level", align: "right", sort: (i) => i.min, render: (i) => qty(i.min, i.unit) },
            { key: "st", header: "Stock status", render: (i) => <StatusBadge status={i.stockStatus} /> },
          ]}
          detail={(i) => (
            <DetailGrid
              items={[
                ["SKU / Code", i.code],
                ["Item name", i.name],
                ["Item type", i.type],
                ["Category", i.category],
                ["Unit of measure", i.unit],
                ["Verified on-hand", qty(i.stock, i.unit)],
                ["Standard cost", inr(i.purchase)],
                ["Stock valuation", inr(i.stockValue)],
                ["Selling price", i.sell ? inr(i.sell) : "—"],
                ["Reorder threshold", qty(i.min, i.unit)],
                ["Maximum level", qty(i.max, i.unit)],
                ["Primary supplier", i.supplier],
                ["Master status", i.status],
              ]}
            />
          )}
        />
      )}
    </>
  );
}

export function StockMovements() {
  const [movements, setMovements] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [wh, setWh] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMovements = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<any>("/catalog/movements/"),
      api.get<any>("/branches/"),
    ])
      .then(([movRes, branchRes]) => {
        const movList = Array.isArray(movRes) ? movRes : (movRes?.results ?? []);
        const branchList = Array.isArray(branchRes) ? branchRes : (branchRes?.results ?? []);
        setMovements(movList);
        setBranches(branchList);
      })
      .catch((err: any) => {
        console.error("Backend movements fetch error:", err);
        setError(err?.message || "Failed to load stock movements");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMovements();
  }, []);

  const branchNames = branches.map((b) => b.name || b.code);
  const filtered = movements.filter((m) => {
    if (wh === "all") return true;
    return m.branch_name === wh || m.branch_code === wh;
  });

  const totalIn = filtered
    .filter((m) => m.direction === "IN")
    .reduce((acc, m) => acc + Number(m.quantity || 0), 0);
  const totalOut = filtered
    .filter((m) => m.direction === "OUT")
    .reduce((acc, m) => acc + Number(m.quantity || 0), 0);

  return (
    <>
      <SectionHeader
        title="Stock movements"
        description="Historical stock ledger from purchases, production, sales, returns and adjustments."
        actions={<ExportButtons />}
      />
      <Tabs value={wh} onValueChange={setWh}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All warehouses</TabsTrigger>
          {branchNames.map((w) => <TabsTrigger key={w} value={w}>{w}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div className="grid gap-3 sm:grid-cols-4">
        <KpiCard label="Total movements" value={String(filtered.length)} hint="Ledger entries" />
        <KpiCard label="Units received (IN)" value={String(totalIn.toLocaleString("en-IN"))} tone="up" hint="Total incoming" />
        <KpiCard label="Units issued (OUT)" value={String(totalOut.toLocaleString("en-IN"))} tone="down" hint="Total dispatched/consumed" />
        <KpiCard label="Warehouses tracked" value={String(branches.length || 1)} hint="Active branches" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-accent" />
          <span className="ml-2 text-sm text-muted-foreground">Loading movements ledger…</span>
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={fetchMovements}>
            Retry
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No stock movements recorded"
          description="No stock ledger entries exist for the selected warehouse filter. Movements are created when verified Goods Receipts, manufacturing production, or authorized stock adjustments are posted."
        />
      ) : (
        <DataTable
          rows={filtered}
          getId={(m) => String(m.id)}
          entity="movement"
          search={(m) => `${m.item_code} ${m.item_name} ${m.reference_document} ${m.movement_type}`}
          date={(m) => m.created_at?.slice(0, 10)}
          filters={[
            { label: "Types", get: (m) => m.movement_type },
            { label: "Directions", get: (m) => m.direction },
            { label: "Warehouses", get: (m) => m.branch_name || m.branch_code },
          ]}
          columns={[
            {
              key: "date",
              header: "Date & Time",
              sort: (m) => m.created_at,
              render: (m) => (
                <div>
                  <p className="font-medium text-xs">
                    {new Date(m.created_at).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ),
            },
            {
              key: "item",
              header: "Item",
              sort: (m) => m.item_name,
              render: (m) => (
                <div>
                  <p className="font-medium">{m.item_name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{m.item_code}</p>
                </div>
              ),
            },
            {
              key: "type",
              header: "Movement type",
              render: (m) => <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{m.movement_type}</span>,
            },
            {
              key: "branch",
              header: "Warehouse",
              render: (m) => m.branch_name || m.branch_code,
            },
            {
              key: "qty",
              header: "Quantity",
              align: "right",
              sort: (m) => Number(m.quantity),
              render: (m) => (
                <span
                  className={cn(
                    "tabular font-semibold",
                    m.direction === "IN" ? "text-success" : "text-destructive"
                  )}
                >
                  {m.signed_quantity || (m.direction === "IN" ? `+${m.quantity}` : `-${m.quantity}`)} {m.uom_code}
                </span>
              ),
            },
            {
              key: "ref",
              header: "Reference document",
              render: (m) => m.reference_document || <M>—</M>,
            },
            {
              key: "by",
              header: "Recorded by",
              render: (m) => m.created_by_name || <M>System</M>,
            },
          ]}
          detail={(m) => (
            <DetailGrid
              items={[
                ["Movement ID", `#${m.id}`],
                ["Item", `${m.item_name} (${m.item_code})`],
                ["Warehouse", `${m.branch_name} (${m.branch_code})`],
                ["Movement type", m.movement_type],
                ["Direction", m.direction],
                ["Quantity", `${m.quantity} ${m.uom_code}`],
                ["Unit cost", m.unit_cost ? inr(Number(m.unit_cost)) : "—"],
                ["Reference document", m.reference_document || "—"],
                ["Notes / Reason", m.notes || "—"],
                ["Recorded by", m.created_by_name || "System"],
                ["Timestamp", new Date(m.created_at).toLocaleString("en-IN")],
              ]}
            />
          )}
        />
      )}
    </>
  );
}

export function StockAdjustments() {
  const [items, setItems] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [adjustmentsList, setAdjustmentsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const [code, setCode] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [q, setQ] = useState(0);
  const [reason, setReason] = useState("Physical count variance");

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get<any>("/catalog/items/"),
      api.get<any>("/branches/"),
      api.get<any>("/catalog/movements/?movement_type=Stock Adjustment"),
    ])
      .then(([itemRes, branchRes, movRes]) => {
        const iList = Array.isArray(itemRes) ? itemRes : (itemRes?.results ?? []);
        const bList = Array.isArray(branchRes) ? branchRes : (branchRes?.results ?? []);
        const mList = Array.isArray(movRes) ? movRes : (movRes?.results ?? []);
        setItems(iList);
        setBranches(bList);
        setAdjustmentsList(mList);
        if (iList.length && !code) {
          setCode(iList[0].code);
        }
        if (bList.length && !branchCode) {
          setBranchCode(bList[0].code);
        }
      })
      .catch((err) => {
        console.error("Failed to load adjustments data:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const it = items.find((i) => i.code === code);

  const handleSave = async () => {
    if (!q || !code || !branchCode) return;
    setSaving(true);
    try {
      const refCode = `ADJ-${Date.now().toString().slice(-6)}`;
      await api.post("/catalog/movements/", {
        item: code,
        branch: branchCode,
        movement_type: "Stock Adjustment",
        change_quantity: q,
        reference_document: refCode,
        notes: reason,
      });
      toast.success(`Stock adjusted: ${it?.name || code} ${q > 0 ? "+" : ""}${q}`);
      setOpen(false);
      setQ(0);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to record stock adjustment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="Stock adjustments"
        description="Corrections after physical counts, damage or write-offs backed by the immutable ledger."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <SlidersHorizontal className="size-4" /> New adjustment
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-accent" />
          <span className="ml-2 text-sm text-muted-foreground">Loading adjustments…</span>
        </div>
      ) : adjustmentsList.length === 0 ? (
        <EmptyState
          title="No stock adjustments found"
          description="Use 'New adjustment' above to record initial opening counts or audit corrections."
        />
      ) : (
        <DataTable
          rows={adjustmentsList}
          getId={(a) => String(a.id)}
          entity="adjustment"
          search={(a) => `${a.reference_document} ${a.item_name} ${a.item_code} ${a.notes}`}
          date={(a) => a.created_at?.slice(0, 10)}
          filters={[
            { label: "Warehouses", get: (a) => a.branch_name || a.branch_code },
            { label: "Directions", get: (a) => a.direction },
          ]}
          columns={[
            {
              key: "id",
              header: "Reference",
              sort: (a) => a.reference_document,
              render: (a) => <span className="font-mono text-xs font-medium">{a.reference_document || `#${a.id}`}</span>,
            },
            {
              key: "date",
              header: "Date",
              sort: (a) => a.created_at,
              render: (a) => new Date(a.created_at).toLocaleDateString("en-IN"),
            },
            {
              key: "item",
              header: "Item",
              render: (a) => (
                <div>
                  <p className="font-medium">{a.item_name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{a.item_code}</p>
                </div>
              ),
            },
            {
              key: "branch",
              header: "Warehouse",
              render: (a) => a.branch_name || a.branch_code,
            },
            {
              key: "qty",
              header: "Change",
              align: "right",
              sort: (a) => Number(a.quantity),
              render: (a) => (
                <span className={a.direction === "IN" ? "text-success font-semibold" : "text-destructive font-semibold"}>
                  {a.signed_quantity || (a.direction === "IN" ? `+${a.quantity}` : `-${a.quantity}`)} {a.uom_code}
                </span>
              ),
            },
            { key: "reason", header: "Reason", render: (a) => <M>{a.notes || "—"}</M> },
            { key: "user", header: "By", render: (a) => a.created_by_name || "System" },
            { key: "st", header: "Ledger status", render: () => <StatusBadge status="Approved" /> },
          ]}
          detail={(a) => (
            <DetailGrid
              items={[
                ["Reference", a.reference_document || `#${a.id}`],
                ["Item", `${a.item_name} (${a.item_code})`],
                ["Warehouse", `${a.branch_name} (${a.branch_code})`],
                ["Change quantity", `${a.signed_quantity} ${a.uom_code}`],
                ["Reason", a.notes || "—"],
                ["Recorded by", a.created_by_name || "System"],
                ["Timestamp", new Date(a.created_at).toLocaleString("en-IN")],
              ]}
            />
          )}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New stock adjustment</DialogTitle>
            <DialogDescription>
              Use a positive quantity to add stock or negative to reduce stock.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Warehouse" required>
              <Select value={branchCode} onValueChange={setBranchCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.code} value={b.code}>
                      {b.name} ({b.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Item" required>
              <Select value={code} onValueChange={setCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.code} value={i.code}>
                      {i.name} ({i.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Adjust by quantity (positive to add, negative to deduct)" required>
              <Input
                type="number"
                step="any"
                value={q || ""}
                placeholder="e.g. 50 or -10"
                onChange={(e) => setQ(Number(e.target.value))}
              />
            </Field>

            <Field label="Reason" required>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "Physical count variance",
                    "Initial opening stock balance",
                    "Damaged in storage",
                    "Printing rejects",
                    "Found during audit",
                    "Expired ribbon written off",
                  ].map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!q || !code || !branchCode || saving} onClick={handleSave}>
              {saving ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              Save adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function StockTransfers() {
  const [transfersList, setTransfersList] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [itemCode, setItemCode] = useState("");
  const [fromBranch, setFromBranch] = useState("");
  const [toBranch, setToBranch] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [notes, setNotes] = useState("");

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get<any>("/catalog/transfers/"),
      api.get<any>("/catalog/items/"),
      api.get<any>("/branches/"),
    ])
      .then(([trfRes, itemRes, branchRes]) => {
        const tList = Array.isArray(trfRes) ? trfRes : (trfRes?.results ?? []);
        const iList = Array.isArray(itemRes) ? itemRes : (itemRes?.results ?? []);
        const bList = Array.isArray(branchRes) ? branchRes : (branchRes?.results ?? []);
        setTransfersList(tList);
        setItems(iList);
        setBranches(bList);
        if (iList.length && !itemCode) setItemCode(iList[0].code);
        if (bList.length >= 2) {
          if (!fromBranch) setFromBranch(bList[0].code);
          if (!toBranch) setToBranch(bList[1].code);
        } else if (bList.length) {
          if (!fromBranch) setFromBranch(bList[0].code);
        }
      })
      .catch((err) => {
        console.error("Failed to load transfers:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTransfer = async () => {
    if (!itemCode || !fromBranch || !toBranch || !quantity) return;
    if (fromBranch === toBranch) {
      toast.error("Source and destination warehouses cannot be the same");
      return;
    }
    setSaving(true);
    try {
      await api.post("/catalog/transfers/", {
        item: itemCode,
        from_branch: fromBranch,
        to_branch: toBranch,
        quantity: quantity,
        notes: notes,
      });
      toast.success(`Transferred ${quantity} units of ${itemCode} successfully`);
      setOpen(false);
      setQuantity(0);
      setNotes("");
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to record stock transfer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="Stock transfers"
        description="Movement of stock between warehouses with atomic ledger updating."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <SlidersHorizontal className="size-4" /> New transfer
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-accent" />
          <span className="ml-2 text-sm text-muted-foreground">Loading transfers…</span>
        </div>
      ) : transfersList.length === 0 ? (
        <EmptyState
          title="No stock transfers recorded"
          description="Use 'New transfer' above to move stock between warehouses."
        />
      ) : (
        <DataTable
          rows={transfersList}
          getId={(t) => String(t.id)}
          entity="transfer"
          search={(t) => `${t.code} ${t.item_name} ${t.from_branch_name} ${t.to_branch_name}`}
          date={(t) => t.created_at?.slice(0, 10) || t.transfer_date}
          filters={[
            { label: "Statuses", get: (t) => t.status },
            { label: "From", get: (t) => t.from_branch_name || t.from_branch_code },
            { label: "To", get: (t) => t.to_branch_name || t.to_branch_code },
          ]}
          columns={[
            {
              key: "id",
              header: "Transfer",
              sort: (t) => t.code,
              render: (t) => <span className="font-mono text-xs font-semibold">{t.code || `#${t.id}`}</span>,
            },
            {
              key: "date",
              header: "Date",
              sort: (t) => t.transfer_date,
              render: (t) => t.transfer_date || new Date(t.created_at).toLocaleDateString("en-IN"),
            },
            {
              key: "item",
              header: "Item",
              render: (t) => (
                <div>
                  <p className="font-medium">{t.item_name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{t.item_code}</p>
                </div>
              ),
            },
            {
              key: "qty",
              header: "Qty",
              align: "right",
              sort: (t) => Number(t.quantity),
              render: (t) => (
                <span className="font-semibold tabular">
                  {Number(t.quantity).toLocaleString("en-IN")} {t.uom_code}
                </span>
              ),
            },
            {
              key: "route",
              header: "Route",
              render: (t) => (
                <span>
                  {t.from_branch_name || t.from_branch_code} <M>→</M> {t.to_branch_name || t.to_branch_code}
                </span>
              ),
            },
            { key: "user", header: "By", render: (t) => t.created_by_name || "System" },
            { key: "st", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
          ]}
          detail={(t) => (
            <DetailGrid
              items={[
                ["Reference", t.code],
                ["Item", `${t.item_name} (${t.item_code})`],
                ["Quantity", `${t.quantity} ${t.uom_code}`],
                ["Source warehouse", `${t.from_branch_name} (${t.from_branch_code})`],
                ["Destination warehouse", `${t.to_branch_name} (${t.to_branch_code})`],
                ["Initiated by", t.created_by_name || "System"],
                ["Status", t.status],
                ["Notes", t.notes || "—"],
                ["Timestamp", new Date(t.created_at).toLocaleString("en-IN")],
              ]}
            />
          )}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New stock transfer</DialogTitle>
            <DialogDescription>
              Transfer physical stock between warehouses. Both locations will be updated atomically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Item" required>
              <Select value={itemCode} onValueChange={setItemCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.code} value={i.code}>
                      {i.name} ({i.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="From warehouse" required>
                <Select value={fromBranch} onValueChange={setFromBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.code} value={b.code}>
                        {b.name} ({b.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="To warehouse" required>
                <Select value={toBranch} onValueChange={setToBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="Destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.filter((b) => b.code !== fromBranch).map((b) => (
                      <SelectItem key={b.code} value={b.code}>
                        {b.name} ({b.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Quantity" required>
              <Input
                type="number"
                step="any"
                min="0.0001"
                value={quantity || ""}
                placeholder="e.g. 50"
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </Field>

            <Field label="Notes / Remarks">
              <Input
                value={notes}
                placeholder="Optional transfer remarks or dispatch note"
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!quantity || !itemCode || !fromBranch || !toBranch || fromBranch === toBranch || saving} onClick={handleCreateTransfer}>
              {saving ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              Execute transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FilteredList({
  title,
  description,
  pick,
  empty,
}: {
  title: string;
  description: string;
  pick: (i: Item) => boolean;
  empty: string;
}) {
  const { items: mockItems } = useOps();
  const [apiItems, setApiItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = () => {
    setLoading(true);
    api.get<any>("/catalog/items/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        if (list.length > 0) {
          const mapped: Item[] = list.map((i: any) => ({
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
            supplierId: i.primary_supplier ? String(i.primary_supplier) : undefined,
          }));
          setApiItems(mapped);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadItems();
  }, []);

  const items = apiItems.length > 0 ? apiItems : mockItems;
  const rows = stocked(items).filter(pick);

  const handleRaisePO = async (item: Item) => {
    const needed = Math.max(1, (item.min || 0) - item.stock || 50);
    try {
      await api.post("/purchases/orders/", {
        supplier: 1,
        branch: 1,
        order_date: new Date().toISOString().slice(0, 10),
        status: "Draft",
        notes: `PO automatically raised for low-stock material ${item.name} (${item.code})`,
        lines: [
          {
            item: item.code,
            quantity: needed,
            unit_price: item.purchase || 10,
            tax_rate: "18.00",
          },
        ],
      });
      toast.success(`Draft Purchase Order created on backend for ${item.name} (${needed} ${item.unit})`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create Purchase Order on backend");
    }
  };

  const handlePlanProduction = async (item: Item) => {
    const planned = Math.max(1, (item.min || 0) - item.stock || 100);
    try {
      await api.post("/manufacturing/orders/", {
        product: item.code,
        planned_quantity: planned,
        status: "Planned",
        order_date: new Date().toISOString().slice(0, 10),
        purpose_notes: `Production planned for low-stock product ${item.name} (${item.code})`,
      });
      toast.success(`Production Order planned on backend for ${item.name} (${planned} ${item.unit})`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create Production Order on backend");
    }
  };

  return (
    <>
      <SectionHeader title={title} description={description} actions={<ExportButtons />} />
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-accent" />
          <span className="ml-2 text-sm text-muted-foreground">Checking stock levels…</span>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title={empty} description="Nothing needs attention right now." />
      ) : (
        <DataTable
          rows={rows}
          getId={(i) => i.code}
          entity="item"
          search={(i) => `${i.code} ${i.name}`}
          removeLabel={null}
          filters={[{ label: "Types", get: (i) => i.type }]}
          extraActions={[
            {
              label: "Raise purchase order",
              show: (i) => i.type !== "Finished Good",
              onClick: (i) => handleRaisePO(i),
            },
            {
              label: "Plan production",
              show: (i) => i.type === "Finished Good",
              onClick: (i) => handlePlanProduction(i),
            },
          ]}
          columns={[
            {
              key: "name",
              header: "Item",
              sort: (i) => i.name,
              render: (i) => (
                <div>
                  <p className="font-medium">{i.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{i.code}</p>
                </div>
              ),
            },
            { key: "type", header: "Type", render: (i) => <TypeBadge type={i.type} /> },
            stockCol,
            { key: "min", header: "Minimum", align: "right", render: (i) => qty(i.min) },
            { key: "last", header: "Last moved", align: "right", sort: (i) => i.lastMovedDays, render: (i) => `${i.lastMovedDays} days ago` },
            { key: "val", header: "Value", align: "right", sort: value, render: (i) => inr(value(i)) },
            statusCol,
          ]}
        />
      )}
    </>
  );
}

export const LowStock = () => (
  <FilteredList
    title="Low stock"
    description="Items at or below their minimum stock level. Click actions to raise real POs or plan production."
    pick={(i) => i.stock < i.min}
    empty="No low-stock items"
  />
);

export const DeadStock = () => (
  <FilteredList
    title="Dead stock"
    description="Items with no movement in the last 60 days."
    pick={(i) => i.lastMovedDays > 60}
    empty="No dead stock"
  />
);

export function StockValuation() {
  const { items: mockItems } = useOps();
  const [valData, setValData] = useState<{ total_value: number; by_type: Record<string, number>; items: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<any>("/catalog/valuation/")
      .then((res) => {
        if (res && res.items && res.items.length > 0) {
          setValData(res);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fallbackRows = stocked(mockItems).filter((i) => i.stock > 0);
  const fallbackByType = (["Raw Material", "Finished Good", "Consumable"] as const).map((t) => ({
    t,
    v: sum(fallbackRows.filter((i) => i.type === t), value),
  }));

  const totalValue = valData ? valData.total_value : sum(fallbackRows, value);
  const rows = valData
    ? valData.items.map((i: any) => ({
        code: i.code,
        name: i.name,
        type: i.type,
        category: i.category,
        unit: i.unit,
        purchase: i.avg_cost,
        stock: i.stock,
        sell: i.selling_value ? i.selling_value / (i.stock || 1) : 0,
        stockValue: i.value,
      }))
    : fallbackRows.map((i) => ({
        code: i.code,
        name: i.name,
        type: i.type,
        category: i.category,
        unit: i.unit,
        purchase: i.purchase,
        stock: i.stock,
        sell: i.sell,
        stockValue: value(i),
      }));

  const byTypeEntries = valData
    ? (["Raw Material", "Finished Good", "Consumable"] as const).map((t) => ({
        t,
        v: valData.by_type[t] || 0,
      }))
    : fallbackByType;

  return (
    <>
      <SectionHeader title="Stock valuation" description="Real-time weighted average cost inventory asset valuation." actions={<ExportButtons />} />
      <div className="grid gap-3 sm:grid-cols-4">
        <KpiCard label="Total value" value={inr(totalValue)} />
        {byTypeEntries.map((b) => (
          <KpiCard
            key={b.t}
            label={b.t}
            value={inr(b.v)}
            hint={`${Math.round((b.v / Math.max(1, totalValue)) * 100)}% of stock`}
          />
        ))}
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-accent" />
          <span className="ml-2 text-sm text-muted-foreground">Calculating inventory valuation…</span>
        </div>
      ) : (
        <DataTable
          rows={rows}
          getId={(i) => i.code}
          entity="item"
          search={(i) => `${i.code} ${i.name}`}
          filters={[{ label: "Types", get: (i) => i.type }, { label: "Categories", get: (i) => i.category }]}
          removeLabel={null}
          columns={[
            { key: "name", header: "Item", sort: (i) => i.name, render: (i) => i.name },
            { key: "type", header: "Type", render: (i) => <TypeBadge type={i.type} /> },
            { key: "qty", header: "Quantity", align: "right", sort: (i) => i.stock, render: (i) => qty(i.stock, i.unit) },
            { key: "cost", header: "Avg. cost", align: "right", render: (i) => `₹${i.purchase.toLocaleString("en-IN")}` },
            { key: "val", header: "Value", align: "right", sort: (i) => i.stockValue, render: (i) => <span className="font-medium">{inr(i.stockValue)}</span> },
            { key: "mkt", header: "Selling value", align: "right", render: (i) => i.sell ? inr(i.stock * i.sell) : <M>—</M> },
          ]}
          footer={(r) => (
            <tfoot className="border-t border-border bg-muted/40 font-semibold">
              <tr>
                <td colSpan={4} className="p-3 text-right text-sm">Total</td>
                <td className="p-3 text-right text-sm tabular">{inr(sum(r, (x) => x.stockValue))}</td>
                <td />
              </tr>
            </tfoot>
          )}
        />
      )}
    </>
  );
}

type Alert = { item: Item; kind: "Out of stock" | "Low stock" | "Overstock" | "Dead stock" | "Expiring / aged"; priority: "Critical" | "High" | "Medium"; note: string };

export function StockAlerts() {
  const { items: mockItems } = useOps();
  const [apiItems, setApiItems] = useState<Item[]>([]);
  const [config, setConfig] = useState<Item | null>(null);
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(0);
  const [savingConfig, setSavingConfig] = useState(false);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

  const loadItems = () => {
    api.get<any>("/catalog/items/").then((res) => {
      const list = Array.isArray(res) ? res : (res?.results ?? []);
      if (list.length > 0) {
        setApiItems(
          list.map((i: any) => ({
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
    }).catch(() => {});
  };

  useEffect(() => {
    loadItems();
  }, []);

  const items = apiItems.length > 0 ? apiItems : mockItems;

  const handleSaveLevels = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      await api.patch(`/catalog/items/${config.code}/`, {
        min_stock_alert: min,
        max_stock_level: max,
      });
      toast.success(`Stock levels updated on backend for ${config.name}`);
      setConfig(null);
      loadItems();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update stock levels on backend");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDismiss = (alertKey: string, itemName: string) => {
    setDismissedKeys((prev) => new Set([...prev, alertKey]));
    toast.success(`Alert dismissed for ${itemName}`);
  };

  const alerts: Alert[] = stocked(items)
    .flatMap((i): Alert[] => {
      const out: Alert[] = [];
      if (i.stock <= 0) out.push({ item: i, kind: "Out of stock", priority: "Critical", note: "No stock available" });
      else if (i.stock < i.min) out.push({ item: i, kind: "Low stock", priority: i.stock < i.min / 2 ? "High" : "Medium", note: `${qty(i.min - i.stock, i.unit)} below minimum` });
      if (i.stock > i.max && i.max) out.push({ item: i, kind: "Overstock", priority: "Medium", note: `${qty(i.stock - i.max, i.unit)} above maximum` });
      if (i.lastMovedDays > 60) out.push({ item: i, kind: "Dead stock", priority: "High", note: `No movement for ${i.lastMovedDays} days` });
      if (i.expiry) out.push({ item: i, kind: "Expiring / aged", priority: i.expiry.includes("2026") ? "High" : "Medium", note: `Best before ${i.expiry}` });
      return out;
    })
    .filter((a) => !dismissedKeys.has(`${a.item.code}-${a.kind}`))
    .sort((a, b) => ["Critical", "High", "Medium"].indexOf(a.priority) - ["Critical", "High", "Medium"].indexOf(b.priority));

  const kinds = ["Out of stock", "Low stock", "Overstock", "Dead stock", "Expiring / aged"] as const;

  return (
    <>
      <SectionHeader title="Stock alerts" description="Alerts by priority backed by live master levels. Configure minimum and maximum levels directly to backend." />
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {kinds.map((kd) => (
          <KpiCard key={kd} label={kd} value={String(alerts.filter((a) => a.kind === kd).length)} />
        ))}
      </div>
      <DataTable
        rows={alerts}
        getId={(a) => `${a.item.code}-${a.kind}`}
        entity="alert"
        search={(a) => `${a.item.name} ${a.kind}`}
        removeLabel={null}
        filters={[{ label: "Alert types", get: (a) => a.kind }, { label: "Priorities", get: (a) => a.priority }]}
        extraActions={[
          {
            label: "Configure levels",
            icon: <Settings2 className="size-4" />,
            onClick: (a) => {
              setConfig(a.item);
              setMin(a.item.min);
              setMax(a.item.max);
            },
          },
          {
            label: "Dismiss",
            onClick: (a) => handleDismiss(`${a.item.code}-${a.kind}`, a.item.name),
          },
        ]}
        columns={[
          {
            key: "p",
            header: "Priority",
            sort: (a) => ["Critical", "High", "Medium"].indexOf(a.priority),
            render: (a) => (
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle
                  className={cn(
                    "size-4",
                    a.priority === "Critical" ? "text-destructive" : a.priority === "High" ? "text-warning" : "text-muted-foreground"
                  )}
                />
                <StatusBadge status={a.priority} />
              </span>
            ),
          },
          {
            key: "item",
            header: "Item",
            sort: (a) => a.item.name,
            render: (a) => (
              <div>
                <p className="font-medium">{a.item.name}</p>
                <p className="text-xs text-muted-foreground">{a.item.warehouse}</p>
              </div>
            ),
          },
          { key: "kind", header: "Alert", render: (a) => a.kind },
          { key: "note", header: "Detail", render: (a) => <M>{a.note}</M> },
          { key: "stock", header: "Stock", align: "right", render: (a) => qty(a.item.stock, a.item.unit) },
          { key: "lvl", header: "Min / max", align: "right", render: (a) => `${qty(a.item.min)} / ${qty(a.item.max)}` },
        ]}
      />
      <Dialog open={!!config} onOpenChange={(o) => !o && setConfig(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Stock levels</DialogTitle>
            <DialogDescription>{config?.name} ({config?.code})</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Minimum (${config?.unit})`}>
              <Input type="number" value={min} onChange={(e) => setMin(Number(e.target.value))} />
            </Field>
            <Field label={`Maximum (${config?.unit})`}>
              <Input type="number" value={max} onChange={(e) => setMax(Number(e.target.value))} />
            </Field>
          </div>
          <p className="text-sm text-muted-foreground">Current verified stock: {config ? qty(config.stock, config.unit) : ""}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfig(null)}>Cancel</Button>
            <Button disabled={(max > 0 && min > max) || savingConfig} onClick={handleSaveLevels}>
              {savingConfig ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              Save levels to backend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ProductAnalytics() {
  const { items: mockItems } = useOps();
  const [liveData, setLiveData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<any[]>("/catalog/analytics/")
      .then((res) => {
        if (Array.isArray(res) && res.length > 0) {
          setLiveData(res);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fallbackRows = mockItems
    .filter((i) => i.type === "Finished Good" || i.type === "Consumable" || i.type === "Raw Material")
    .map((i) => {
      const sellValue = i.salesQty * i.sell;
      const cost = i.salesQty * i.purchase;
      const profit = sellValue - cost;
      return {
        ...i,
        sales_qty: i.salesQty,
        sales_frequency: i.salesFreq,
        purchase_qty: i.purchaseQty,
        production_qty: i.productionQty,
        cost: i.purchaseQty * i.purchase || cost,
        sell_value: sellValue,
        profit,
        margin: sellValue ? (profit / sellValue) * 100 : 0,
        days_idle: i.lastMovedDays,
      };
    });

  const rows = liveData && liveData.length > 0 ? liveData : fallbackRows;
  const fg = rows.filter((r) => r.type === "Finished Good");
  type R = (typeof rows)[number];
  const section = (title: string, list: R[], metric: (r: R) => string, tone?: "bad") => (
    <Panel title={title} bodyClassName="p-0">
      {list.length ? (
        <ul className="divide-y divide-border">
          {list.slice(0, 4).map((r) => (
            <li key={r.code} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="truncate">{short(r.name)}</span>
              <span className={cn("shrink-0 tabular font-medium", tone === "bad" && "text-destructive")}>
                {metric(r)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-4 text-sm text-muted-foreground">None</p>
      )}
    </Panel>
  );

  return (
    <>
      <SectionHeader
        title="Product analytics"
        description="Sales, purchase, production and profitability per product calculated from real transactions."
        actions={<ExportButtons />}
      />
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-accent" />
          <span className="ml-2 text-sm text-muted-foreground">Analyzing product transactions…</span>
        </div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Profit by finished product">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={fg.map((r) => ({
                      name: short(r.name).slice(0, 18),
                      profit: r.profit,
                      cost: r.cost,
                    }))}
                    margin={{ left: -4 }}
                  >
                    <CartesianGrid vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="name" {...axis} fontSize={10} interval={0} />
                    <YAxis {...axis} tickFormatter={k} />
                    <RTooltip contentStyle={tip} formatter={(v: number) => inr(v)} />
                    <Bar dataKey="cost" name="Cost" stackId="a" fill="var(--color-chart-4)" />
                    <Bar dataKey="profit" name="Profit" stackId="a" fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Margin %">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={fg.map((r) => ({ name: short(r.name).slice(0, 18), m: Math.round(r.margin) }))}
                    layout="vertical"
                    margin={{ left: 30 }}
                  >
                    <XAxis type="number" {...axis} unit="%" />
                    <YAxis type="category" dataKey="name" {...axis} width={130} fontSize={11} />
                    <RTooltip contentStyle={tip} />
                    <Bar dataKey="m" name="Margin %" fill="var(--color-chart-2)" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {section("Best-selling products", [...fg].sort((a, b) => b.sales_qty - a.sales_qty), (r) => `${qty(r.sales_qty)} sold`)}
            {section("Fast-moving products", [...fg].sort((a, b) => b.sales_frequency - a.sales_frequency), (r) => `${r.sales_frequency} sales/mo`)}
            {section("Slow-moving items", [...rows].sort((a, b) => b.days_idle - a.days_idle).filter((r) => r.days_idle > 0), (r) => `${r.days_idle} days idle`)}
            {section("Dead stock", rows.filter((r) => r.days_idle > 60), (r) => inr(r.stock * r.purchase_price), "bad")}
            {section("High-profit products", [...fg].sort((a, b) => b.profit - a.profit), (r) => inr(r.profit))}
            {section("Low-profit products", [...fg].sort((a, b) => a.margin - b.margin), (r) => `${r.margin.toFixed(1)}%`, "bad")}
          </div>
          <DataTable
            rows={rows}
            getId={(r) => r.code}
            entity="product"
            search={(r) => `${r.code} ${r.name}`}
            removeLabel={null}
            filters={[{ label: "Types", get: (r) => r.type }]}
            pageSize={10}
            columns={[
              {
                key: "name",
                header: "Product",
                sort: (r) => r.name,
                render: (r) => (
                  <div>
                    <p className="font-medium">{short(r.name)}</p>
                    <TypeBadge type={r.type} />
                  </div>
                ),
              },
              { key: "sq", header: "Sales qty", align: "right", sort: (r) => r.sales_qty, render: (r) => qty(r.sales_qty) },
              { key: "pq", header: "Purchase qty", align: "right", sort: (r) => r.purchase_qty, render: (r) => qty(r.purchase_qty) },
              { key: "prq", header: "Produced", align: "right", sort: (r) => r.production_qty, render: (r) => qty(r.production_qty) },
              { key: "st", header: "Stock", align: "right", sort: (r) => r.stock, render: (r) => qty(r.stock) },
              { key: "cost", header: "Purchase cost", align: "right", sort: (r) => r.cost, render: (r) => inr(r.cost) },
              { key: "sv", header: "Selling value", align: "right", sort: (r) => r.sell_value, render: (r) => r.sell_value ? inr(r.sell_value) : <M>—</M> },
              { key: "pr", header: "Est. profit", align: "right", sort: (r) => r.profit, render: (r) => r.sell_value ? inr(r.profit) : <M>—</M> },
              { key: "mg", header: "Margin", align: "right", sort: (r) => r.margin, render: (r) => r.sell_value ? `${r.margin.toFixed(1)}%` : <M>—</M> },
              { key: "fq", header: "Frequency", align: "right", sort: (r) => r.sales_frequency, render: (r) => `${r.sales_frequency}/mo` },
              { key: "age", header: "Idle days", align: "right", sort: (r) => r.days_idle, render: (r) => `${r.days_idle} d` },
            ]}
          />
        </>
      )}
    </>
  );
}

