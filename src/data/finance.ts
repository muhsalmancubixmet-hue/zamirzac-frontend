// Finance and accounting data types and helpers.
// Initial data arrays start empty; populated by user actions or backend API.

export function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function dayOffset(n: number) {
  const d = new Date(Date.UTC(2026, 8, 27 - n));
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return {
    label: `${dd} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
    iso: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${dd}`,
  };
}

export const customers: readonly { name: string; place: string; gstin: string }[] = [];
export const suppliers: readonly { name: string; place: string; gstin: string }[] = [];

export const cashAccounts: any[] = [];
export const bankAccounts: any[] = [];

export type AccountType = "Assets" | "Liabilities" | "Equity" | "Income" | "Expenses";
export type Account = {
  id?: number;
  code: string;
  name: string;
  type: AccountType;
  parent: string | null;
  opening: number;
  current: number;
  status: "Active" | "Inactive";
  group?: boolean;
};

export const accounts: Account[] = [];
export const leafAccounts: Account[] = [];
export const trialBalance: any[] = [];

export type Journal = {
  id: string; date: string; iso: string; ref: string; description: string;
  lines: { account: string; debit: number; credit: number }[];
  amount: number; notes: string; attachments: number; status: "Posted" | "Draft" | "Void";
};
export const journals: Journal[] = [];

export const receipts: any[] = [];
export const payments: any[] = [];
export const expenses: any[] = [];
export const income: any[] = [];
export const bankTxns: any[] = [];
export const transfers: any[] = [];

export type LedgerLine = { date: string; iso: string; voucher: string; type: string; narration: string; debit: number; credit: number };
export const customerLedgers: any[] = [];
export const supplierLedgers: any[] = [];
export const generalLedgers: any[] = [];

export const dayBook: any[] = [];

export const profitLoss = {
  revenue: [] as [string, number][],
  cost: [] as [string, number][],
  opex: [] as [string, number][],
  other: [] as [string, number][],
  tax: 0,
};

export const cashFlow = {
  operating: [] as [string, number][],
  investing: [] as [string, number][],
  financing: [] as [string, number][],
  opening: 0,
};

// ---------------- GST ----------------
export type GstInvoice = {
  id: string; party: string; place: string; gstin: string; date: string; iso: string; hsn: string; item: string;
  taxable: number; rate: number; cgst: number; sgst: number; igst: number; total: number; status: string;
};
export const hsnMaster = [
  { code: "3926", desc: "PVC ID cards, printed", rate: 18, uqc: "NOS" },
  { code: "3920", desc: "PVC sheets / overlay film", rate: 18, uqc: "KGS" },
  { code: "6307", desc: "Printed lanyards / straps", rate: 12, uqc: "NOS" },
  { code: "8308", desc: "Hooks, clips & buckles", rate: 18, uqc: "NOS" },
  { code: "3215", desc: "Printing inks", rate: 18, uqc: "NOS" },
  { code: "3702", desc: "Printer ribbons (YMCKO)", rate: 18, uqc: "NOS" },
  { code: "8523", desc: "RFID / smart cards", rate: 18, uqc: "NOS" },
  { code: "4911", desc: "Printed certificates & tags", rate: 18, uqc: "NOS" },
  { code: "9983", desc: "Card design services (SAC)", rate: 18, uqc: "OTH" },
  { code: "9965", desc: "Goods transport services (SAC)", rate: 18, uqc: "OTH" },
  { code: "8443", desc: "Card printer spares", rate: 18, uqc: "NOS" },
];

export const gstSales: GstInvoice[] = [];
export const gstPurchases: GstInvoice[] = [];
export const taxOf = (r: GstInvoice) => r.cgst + r.sgst + r.igst;

export const gstMonthly: any[] = [];
export const gstReturns: any[] = [];
