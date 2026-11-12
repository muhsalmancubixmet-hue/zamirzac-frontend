// In-memory demo store so workflows (production completion, bill posting, adjustments) visibly change stock.
// Resets on reload. Replace with API calls when the backend is connected.
import { useSyncExternalStore } from "react";
import { bills, items, movements, productionOrders, type Bill, type Item, type Movement, type ProductionOrder } from "./ops";

type State = { items: Item[]; movements: Movement[]; production: ProductionOrder[]; bills: Bill[] };
let state: State = { items: [], movements: [], production: [], bills: [] };
const subs = new Set<() => void>();
const set = (fn: (s: State) => State) => { state = fn(state); subs.forEach((f) => f()); };
export const useOps = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state, () => state);

let seq = 1;
const move = (s: State, code: string, qty: number, type: Movement["type"], ref: string, user: string): Movement => {
  const it = s.items.find((i) => i.code === code)!;
  return { id: `MV-N${seq++}`, date: "27 Sep 2026", iso: "2026-09-27", code, type, qty, prev: it.stock, next: it.stock + qty, ref, user, warehouse: it.warehouse };
};
const applyStock = (list: Item[], changes: Record<string, number>) => list.map((i) => (changes[i.code] ? { ...i, stock: Math.round((i.stock + changes[i.code]!) * 1000) / 1000, lastMovedDays: 0 } : i));

import { api, getAccessToken } from "@/lib/api";

export const ops = {
  adjust(code: string, qty: number, reason: string, user: string) {
    set((s) => ({ ...s, movements: [move(s, code, qty, "Adjustment", reason, user), ...s.movements], items: applyStock(s.items, { [code]: qty }) }));
  },
  setMin(code: string, min: number, max?: number) {
    set((s) => ({ ...s, items: s.items.map((i) => (i.code === code ? { ...i, min, max: max ?? i.max } : i)) }));
  },
  saveProduction(o: ProductionOrder) {
    set((s) => ({ ...s, production: s.production.some((p) => p.id === o.id) ? s.production.map((p) => (p.id === o.id ? o : p)) : [o, ...s.production] }));
  },
  completeProduction(id: string, consumed: { code: string; qty: number }[], produced: number, wastage: number, user: string) {
    set((s) => {
      const o = s.production.find((p) => p.id === id)!;
      const mv = [move(s, o.product, produced, "Production", id, user), ...consumed.map((c) => move(s, c.code, -c.qty, "Consumption", id, user))];
      const changes: Record<string, number> = { [o.product]: produced };
      consumed.forEach((c) => (changes[c.code] = (changes[c.code] ?? 0) - c.qty));
      return { ...s, items: applyStock(s.items, changes), movements: [...mv, ...s.movements], production: s.production.map((p) => (p.id === id ? { ...p, status: "Completed", produced, wastage } : p)) };
    });
  },
  postBill(b: Bill, user: string) {
    set((s) => {
      const exists = s.bills.some((x) => x.id === b.id);
      const posted = { ...b, stage: "Posted" as const };
      const stocked = b.lines.filter((l) => s.items.some((i) => i.code === l.code && i.type !== "Service"));
      const changes: Record<string, number> = {};
      stocked.forEach((l) => (changes[l.code] = (changes[l.code] ?? 0) + l.qty));
      return { ...s, items: applyStock(s.items, changes), movements: [...stocked.map((l) => move(s, l.code, l.qty, "Purchase", b.id, user)), ...s.movements], bills: exists ? s.bills.map((x) => (x.id === b.id ? posted : x)) : [posted, ...s.bills] };
    });
  },
  saveBill(b: Bill) {
    set((s) => ({ ...s, bills: s.bills.some((x) => x.id === b.id) ? s.bills.map((x) => (x.id === b.id ? b : x)) : [b, ...s.bills] }));
  },
};

export async function hydrateOpsFromApi() {
  if (typeof window === "undefined") return;
  if (!getAccessToken()) return;

  try {
    const [itemsRes, billsRes, mfgRes] = await Promise.allSettled([
      api.get<{ results: any[] }>("/catalog/items/"),
      api.get<{ results: any[] }>("/purchases/bills/"),
      api.get<{ results: any[] }>("/manufacturing/orders/"),
    ]);

    const rawItems = itemsRes.status === "fulfilled"
      ? (Array.isArray(itemsRes.value) ? itemsRes.value : ((itemsRes.value as any)?.results ?? []))
      : [];
    if (rawItems.length > 0) {
      const apiItems: Item[] = rawItems.map((it: any) => ({
        code: it.code,
        name: it.name,
        type: (it.item_type || "Raw Material") as Item["type"],
        category: it.category_name || "General",
        unit: it.uom_code || "Nos",
        purchase: Number(it.purchase_price) || 0,
        sell: Number(it.selling_price) || 0,
        minSell: Number(it.min_selling_price) || Number(it.selling_price) || 0,
        tax: Number(it.default_tax_rate) || 18,
        min: Number(it.min_stock_alert) || 0,
        max: Number(it.max_stock_level) || 1000,
        stock: Number(it.current_stock ?? 0),
        warehouse: "Kalamassery HQ",
        lastMovedDays: 1,
        salesQty: 0,
        purchaseQty: 0,
        productionQty: 0,
        salesFreq: 1,
        ageDays: 1,
        status: (it.status || "Active") as any,
      }));
      set((s) => ({ ...s, items: apiItems }));
    }

    const rawBills = billsRes.status === "fulfilled"
      ? (Array.isArray(billsRes.value) ? billsRes.value : ((billsRes.value as any)?.results ?? []))
      : [];
    if (rawBills.length > 0) {
      const apiBills: Bill[] = rawBills.map((b: any) => ({
        id: b.code || `BILL-${b.id}`,
        supplierBillNo: b.bill_number || "—",
        supplierId: String(b.supplier || "SUP-201"),
        supplier: b.supplier_name || "Supplier",
        gstin: b.supplier_gstin || "—",
        date: b.bill_date ? new Date(b.bill_date).toLocaleDateString() : "27 Sep 2026",
        iso: b.bill_date || "2026-09-27",
        due: b.due_date ? new Date(b.due_date).toLocaleDateString() : "—",
        po: b.purchase_order_code || "—",
        total: Number(b.total_amount) || 0,
        paid: Number(b.paid_amount) || 0,
        balance: Number(b.balance_amount) || 0,
        stage: (b.status === "Paid" ? "Posted" : b.status === "Approved" ? "Confirmed" : "Draft") as Bill["stage"],
        payment: (b.status === "Paid" ? "Paid" : Number(b.paid_amount) > 0 ? "Partial" : "Pending") as any,
        source: "Manual",
        lines: [],
      }));
      set((s) => ({ ...s, bills: apiBills }));
    }

    const rawMfg = mfgRes.status === "fulfilled"
      ? (Array.isArray(mfgRes.value) ? mfgRes.value : ((mfgRes.value as any)?.results ?? []))
      : [];
    if (rawMfg.length > 0) {
      const apiMfg: ProductionOrder[] = rawMfg.map((o: any) => ({
        id: o.code || `PRD-${o.id}`,
        product: o.product_name || o.bom_name || "Card",
        planned: Number(o.planned_quantity) || 100,
        produced: Number(o.produced_quantity) || 0,
        wastage: Number(o.waste_quantity) || 0,
        status: o.status || "Planned",
        date: o.planned_start_date || "2026-09-27",
        iso: o.planned_start_date || "2026-09-27",
        assigned: "Admin",
        customer: "Stock",
        notes: "",
        batch: `B-${o.id}`,
        lines: [],
      }));
      set((s) => ({ ...s, production: apiMfg }));
    }
  } catch (err) {
    console.debug("Ops hydration deferred:", err);
  }
}

if (typeof window !== "undefined") {
  hydrateOpsFromApi();
  window.addEventListener("zs_auth_changed", () => {
    hydrateOpsFromApi();
  });
}
