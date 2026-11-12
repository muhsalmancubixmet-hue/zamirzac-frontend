// Sales, quotations and CRM data store types and helpers.
// Initial data arrays start empty; populated by user actions or backend API.

export const staff: string[] = [];

export type CustomerType = "School" | "College" | "Institution" | "Business" | "Distributor" | "Individual";
export type Customer = {
  id: string; name: string; type: CustomerType; contact: string; phone: string; email: string;
  city: string; district: string; address: string; gstin: string | null; group: string;
  creditLimit: number; totalSales: number; paid: number; outstanding: number;
  lastTxn: string; since: string; status: "Active" | "Inactive"; owner: string;
};
export const customers: Customer[] = [];

export type Product = { code: string; name: string; unit: string; price: number; tax: number; hsn: string };
export const products: Product[] = [];

export type Line = { code: string; name: string; description: string; qty: number; unit: string; rate: number; defaultRate: number; discount: number; tax: number };
export const lineAmount = (l: Line) => l.qty * l.rate * (1 - l.discount / 100);
export const lineTax = (l: Line) => (lineAmount(l) * l.tax) / 100;
export const totals = (lines: Line[], received = 0) => {
  const gross = lines.reduce((s, l) => s + l.qty * l.rate, 0);
  const sub = lines.reduce((s, l) => s + lineAmount(l), 0);
  const tax = lines.reduce((s, l) => s + lineTax(l), 0);
  const grand = Math.round(sub + tax);
  return { gross, discount: gross - sub, sub, tax, grand, received, balance: grand - received };
};

export type Invoice = { id: string; date: string; iso: string; due: string; customerId: string; customer: string; lines: Line[]; grand: number; received: number; balance: number; status: "Paid" | "Partial" | "Pending" | "Overdue" | "Draft"; salesperson: string; attachments: number; po: string };
export const invoices: Invoice[] = [];

export const salesOrders: any[] = [];
export const customerPayments: any[] = [];
export const salesReturns: any[] = [];
export const creditNotes: any[] = [];

export type Attachment = { id: string; name: string; type: "PDF" | "Image" | "Excel" | "Word" | "ZIP"; size: string; uploaded: string; by: string; record: string; category: string; customer: string; fileUrl?: string };
export const attachments: Attachment[] = [];

export type QuoteStatus = "Draft" | "Sent" | "Accepted" | "Rejected" | "Expired" | "Converted";
export type Quotation = { id: string; date: string; iso: string; validTill: string; customerId: string; customer: string; lines: Line[]; total: number; status: QuoteStatus; owner: string; notes: string; terms: string; attachments: number; convertedTo?: string };
export const defaultTerms = "1. Prices are inclusive of GST as shown.\n2. 50% advance with order, balance on delivery.\n3. Delivery within 10 working days of artwork approval.\n4. Quotation valid for 15 days.";
export const quotations: Quotation[] = [];

export const quoteTemplates: { id: string; name: string; desc: string; items: string[]; used: number }[] = [];

export const leadStages = ["New", "Contacted", "Follow-up", "Quotation Sent", "Negotiation", "Converted", "Lost"] as const;
export type Lead = { id: string; name: string; org: string; type: CustomerType; phone: string; city: string; value: number; stage: (typeof leadStages)[number]; owner: string; source: string; created: string };
export const leads: Lead[] = [];

export type FollowUp = { id: string; customer: string; contact: string; date: string; iso: string; type: "Call" | "Visit" | "WhatsApp" | "Email" | "Meeting"; assigned: string; notes: string; status: "Scheduled" | "Completed" | "Overdue" | "Cancelled" };
export const followUps: FollowUp[] = [];

export type Activity = { id: string; when: string; iso: string; kind: "Call" | "Message" | "Email" | "Quotation" | "Sale" | "Payment" | "Follow-up" | "Note"; customer: string; customerId: string; text: string; by: string };
export const activities: Activity[] = [];

export const customerGroups: any[] = [];
export const customerNotes: any[] = [];
