// Operations data store types and helpers.
// Initial data arrays start empty; populated by user actions or backend API.

export const users: string[] = [];
export const warehouses: string[] = [];

export type Supplier = { id: string; name: string; city: string; gstin: string; contact: string; phone: string; email: string; category: string; terms: string; purchases: number; paid: number; outstanding: number; rating: number; status: "Active" | "Inactive" };
export const suppliers: Supplier[] = [];

export type ItemType = "Raw Material" | "Finished Good" | "Consumable" | "Service";
export type Item = { code: string; name: string; category: string; type: ItemType; unit: string; purchase: number; sell: number; minSell: number; tax: number; min: number; max: number; stock: number; status: "Active" | "Inactive"; lastMovedDays: number; warehouse: string; salesQty: number; purchaseQty: number; productionQty: number; salesFreq: number; ageDays: number; expiry?: string; supplierId?: string };
export const items: Item[] = [];

export const stockStatus = (i: Item): "Out of stock" | "Low" | "Overstock" | "Dead" | "Healthy" | "—" =>
  i.type === "Service" ? "—" : i.stock <= 0 ? "Out of stock" : i.lastMovedDays > 60 ? "Dead" : i.stock < i.min ? "Low" : i.stock > i.max ? "Overstock" : "Healthy";
export const unitCost = (i: Item) => i.purchase;

export type BomLine = { code: string; qty: number; wastage: number; notes: string };
export type Bom = { id: string; product: string; version: string; output: number; lines: BomLine[]; labour: number; updated: string; status: "Active" | "Draft" };
export const boms: Bom[] = [];

export type ProdStatus = "Draft" | "Planned" | "In Production" | "Completed" | "Cancelled";
export type ProductionOrder = { id: string; product: string; planned: number; produced: number; wastage: number; date: string; iso: string; assigned: string; status: ProdStatus; customer: string; notes: string; batch: string };
export const productionOrders: ProductionOrder[] = [];

export type Movement = { id: string; date: string; iso: string; code: string; type: "Purchase" | "Production" | "Sale" | "Sale Return" | "Purchase Return" | "Adjustment" | "Transfer" | "Consumption"; qty: number; prev: number; next: number; ref: string; user: string; warehouse: string };
export const movements: Movement[] = [];

export const adjustments: any[] = [];
export const transfers: any[] = [];

export type PLine = { code: string; qty: number; rate: number; discount: number; tax: number };
export const pTotals = (lines: PLine[]) => {
  const gross = lines.reduce((s, l) => s + l.qty * l.rate, 0);
  const sub = lines.reduce((s, l) => s + l.qty * l.rate * (1 - l.discount / 100), 0);
  const tax = lines.reduce((s, l) => s + (l.qty * l.rate * (1 - l.discount / 100) * l.tax) / 100, 0);
  return { gross, discount: gross - sub, sub, tax, total: Math.round(sub + tax) };
};

export type PO = { id: string; backendId?: number; supplierId: string; supplier: string; date: string; iso: string; expected: string; lines: PLine[]; total: number; status: "Draft" | "Sent" | "Partially Received" | "Received" | "Cancelled"; notes: string; attachments: number };
export const purchaseOrders: PO[] = [];

export type Bill = { id: string; backendId?: number; supplierBillNo: string; supplierId: string; supplier: string; gstin: string; date: string; iso: string; due: string; po: string; lines: PLine[]; total: number; paid: number; balance: number; payment: "Paid" | "Partial" | "Pending" | "Overdue"; stage: "Draft" | "Under review" | "Confirmed" | "Posted"; source: "Manual" | "AI extracted" };
export const bills: Bill[] = [];

export type PurchaseReturn = { id: string; backendId?: number; date: string; iso: string; bill: string; billId?: number; supplier: string; code: string; itemName?: string; qty: number; amount: number; reason: string; status: "Pending" | "Approved" | "Debit note issued" | "Rejected"; lines?: any[] };
export const purchaseReturns: PurchaseReturn[] = [];

export const supplierPayments: any[] = [];
export const purchaseAttachments: any[] = [];

export const itemName = (code: string) => items.find((i) => i.code === code)?.name ?? code;
