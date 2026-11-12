import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Boxes, Building2, Calculator, Car, Factory, Landmark, ReceiptIndianRupee, ShoppingCart, TrendingUp, Users, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { KpiCard, Panel } from "@/components/erp/primitives";
import { SectionHeader } from "@/components/erp/ModuleLayout";
import { inr } from "@/lib/format";
import { invoices, salesReturns, customers, lineAmount, lineTax } from "@/data/sales";
import { bills, purchaseReturns, items, movements, productionOrders, itemName, stockStatus, boms } from "@/data/ops";
import { accounts, gstSales, gstPurchases, taxOf } from "@/data/finance";
import { employees, slipFor, months, travels, empById, attendance } from "@/data/hr";
import { axis, chartColors, k, tip } from "@/components/ops/common";
import { api } from "@/lib/api";
import { ReportView, groupBy, type Report, type Row } from "./ReportView";

// ---------- shared line-level datasets ----------
const catOf = (code: string) => code.startsWith("IDC") ? "ID cards" : code.startsWith("LAN") ? "Lanyards & straps" : code.startsWith("IDH") ? "Holders & accessories" : code.startsWith("SRV") ? "Services" : "Printing & passes";
const costRatio: Record<string, number> = { "ID cards": 0.46, "Lanyards & straps": 0.54, "Holders & accessories": 0.58, Services: 0.3, "Printing & passes": 0.5 };
const custType = (id: string) => customers.find((c) => c.id === id)?.type ?? "Business";

export const salesLines: Row[] = invoices.filter((v) => v.status !== "Draft").flatMap((v) => v.lines.map((l) => {
  const category = catOf(l.code); const revenue = Math.round(lineAmount(l));
  return { iso: v.iso, date: v.date, invoice: v.id, customer: v.customer, customerType: custType(v.customerId), salesperson: v.salesperson, product: l.name, category, qty: l.qty, revenue, tax: Math.round(lineTax(l)), cost: Math.round(revenue * costRatio[category]!), status: v.status };
}));
const purchaseLines: Row[] = bills.flatMap((b) => b.lines.map((l) => ({ iso: b["iso"], date: b.date, bill: b.id, supplier: b.supplier, product: itemName(l.code), qty: l.qty, amount: Math.round(l.qty * l.rate * (1 - l.discount / 100)), tax: Math.round(l.qty * l.rate * (1 - l.discount / 100) * l.tax / 100), status: b.payment })));
const withMargin = (_: Row[], o: Row) => { o["profit"] = Number(o["revenue"]) - Number(o["cost"]); o["margin"] = Number(o["revenue"]) ? (Number(o["profit"]) / Number(o["revenue"])) * 100 : 0; };
const sortBy = (key: string) => (rows: Row[]) => rows.sort((a, b) => Number(b[key]) - Number(a[key]));

// ---------- Sales ----------
const salesReports: Report[] = [
  { key: "date", label: "Sales by date", cols: [{ key: "date", header: "Date" }, { key: "count", header: "Lines", kind: "num" }, { key: "revenue", header: "Taxable", kind: "inr", total: true }, { key: "tax", header: "GST", kind: "inr", total: true }], raw: salesLines, date: "iso", filters: ["category"], aggregate: (r) => groupBy(r, "date", ["revenue", "tax"], (l, o) => (o["iso"] = l[0]?.["iso"] ?? "")).sort((a, b) => String(a["iso"]).localeCompare(String(b["iso"]))), chart: { x: "date", y: "revenue", type: "line" } },
  { key: "product", label: "Sales by product", cols: [{ key: "product", header: "Product" }, { key: "qty", header: "Qty", kind: "num", total: true }, { key: "revenue", header: "Revenue", kind: "inr", total: true }], raw: salesLines, date: "iso", filters: ["category", "customerType"], search: ["product"], aggregate: (r) => sortBy("revenue")(groupBy(r, "product", ["qty", "revenue"])), chart: { x: "product", y: "revenue" } },
  { key: "customer", label: "Sales by customer", cols: [{ key: "customer", header: "Customer" }, { key: "count", header: "Lines", kind: "num" }, { key: "revenue", header: "Revenue", kind: "inr", total: true }, { key: "tax", header: "GST", kind: "inr", total: true }], raw: salesLines, date: "iso", filters: ["customerType"], search: ["customer"], aggregate: (r) => sortBy("revenue")(groupBy(r, "customer", ["revenue", "tax"])), chart: { x: "customer", y: "revenue" } },
  { key: "employee", label: "Sales by employee", cols: [{ key: "salesperson", header: "Salesperson" }, { key: "count", header: "Lines", kind: "num" }, { key: "revenue", header: "Revenue", kind: "inr", total: true }], raw: salesLines, date: "iso", filters: ["category"], aggregate: (r) => sortBy("revenue")(groupBy(r, "salesperson", ["revenue"])), chart: { x: "salesperson", y: "revenue" } },
  { key: "category", label: "Sales by category", cols: [{ key: "category", header: "Category" }, { key: "qty", header: "Qty", kind: "num", total: true }, { key: "revenue", header: "Revenue", kind: "inr", total: true }], raw: salesLines, date: "iso", filters: ["customerType"], aggregate: (r) => sortBy("revenue")(groupBy(r, "category", ["qty", "revenue"])), chart: { x: "category", y: "revenue" } },
  { key: "status", label: "Payment status", cols: [{ key: "id", header: "Invoice" }, { key: "date", header: "Date" }, { key: "customer", header: "Customer" }, { key: "grand", header: "Total", kind: "inr", total: true }, { key: "received", header: "Received", kind: "inr", total: true }, { key: "balance", header: "Balance", kind: "inr", total: true }, { key: "status", header: "Status", kind: "status" }], raw: invoices.map((v) => ({ id: v.id, iso: v.iso, date: v.date, customer: v.customer, grand: v.grand, received: v.received, balance: v.balance, status: v.status })), date: "iso", filters: ["status"], search: ["id", "customer"] },
  { key: "returns", label: "Sales returns", cols: [{ key: "id", header: "Return" }, { key: "date", header: "Date" }, { key: "invoice", header: "Invoice" }, { key: "customer", header: "Customer" }, { key: "item", header: "Item" }, { key: "qty", header: "Qty", kind: "num", total: true }, { key: "amount", header: "Amount", kind: "inr", total: true }, { key: "reason", header: "Reason" }, { key: "status", header: "Status", kind: "status" }], raw: salesReturns, date: "iso", filters: ["reason", "status"], search: ["customer", "invoice"] },
];

// ---------- Purchase ----------
const mapPurchaseReturnToRow = (p: (typeof purchaseReturns)[number]): Row => ({
  id: p.id,
  date: p.date,
  iso: p.iso,
  bill: p.bill,
  supplier: p.supplier,
  code: p.code,
  item: itemName(p.code),
  qty: p.qty,
  amount: p.amount,
  reason: p.reason,
  status: p.status,
});

const purchaseReports: Report[] = [
  { key: "date", label: "Purchases by date", cols: [{ key: "date", header: "Date" }, { key: "count", header: "Lines", kind: "num" }, { key: "amount", header: "Taxable", kind: "inr", total: true }, { key: "tax", header: "GST", kind: "inr", total: true }], raw: purchaseLines, date: "iso", aggregate: (r) => groupBy(r, "date", ["amount", "tax"], (l, o) => (o["iso"] = l[0]?.["iso"] ?? "")).sort((a, b) => String(a["iso"]).localeCompare(String(b["iso"]))), chart: { x: "date", y: "amount", type: "line" } },
  { key: "supplier", label: "Purchases by supplier", cols: [{ key: "supplier", header: "Supplier" }, { key: "count", header: "Lines", kind: "num" }, { key: "amount", header: "Taxable", kind: "inr", total: true }, { key: "tax", header: "GST", kind: "inr", total: true }], raw: purchaseLines, date: "iso", search: ["supplier"], aggregate: (r) => sortBy("amount")(groupBy(r, "supplier", ["amount", "tax"])), chart: { x: "supplier", y: "amount" } },
  { key: "product", label: "Purchases by product", cols: [{ key: "product", header: "Material" }, { key: "qty", header: "Qty", kind: "num", total: true }, { key: "amount", header: "Amount", kind: "inr", total: true }], raw: purchaseLines, date: "iso", filters: ["supplier"], search: ["product"], aggregate: (r) => sortBy("amount")(groupBy(r, "product", ["qty", "amount"])), chart: { x: "product", y: "amount" } },
  { key: "outstanding", label: "Purchase outstanding", cols: [{ key: "id", header: "Bill" }, { key: "date", header: "Date" }, { key: "supplier", header: "Supplier" }, { key: "due", header: "Due" }, { key: "total", header: "Total", kind: "inr", total: true }, { key: "paid", header: "Paid", kind: "inr", total: true }, { key: "balance", header: "Balance", kind: "inr", total: true }, { key: "payment", header: "Status", kind: "status" }], raw: bills.filter((b) => b.balance > 0).map((b) => ({ id: b.id, iso: b["iso"], date: b.date, supplier: b.supplier, due: b.due, total: b.total, paid: b.paid, balance: b.balance, payment: b.payment })), date: "iso", filters: ["supplier", "payment"], search: ["id", "supplier"] },
  { key: "returns", label: "Purchase returns", cols: [{ key: "id", header: "Return" }, { key: "date", header: "Date" }, { key: "bill", header: "Bill" }, { key: "supplier", header: "Supplier" }, { key: "item", header: "Material" }, { key: "qty", header: "Qty", kind: "num", total: true }, { key: "amount", header: "Amount", kind: "inr", total: true }, { key: "reason", header: "Reason" }, { key: "status", header: "Status", kind: "status" }], raw: purchaseReturns.map(mapPurchaseReturnToRow), date: "iso", filters: ["supplier", "status"] },
];

// ---------- Inventory ----------
const stocked = items.filter((i) => i.type !== "Service");
const invRow = (i: (typeof items)[number]) => ({ code: i.code, name: i.name, type: i.type, category: i.category, warehouse: i.warehouse, unit: i.unit, stock: i.stock, min: i.min, rate: i.purchase || i.sell, value: Math.round(i.stock * (i.purchase || i.sell * 0.5)), status: stockStatus(i), lastMoved: i.lastMovedDays, sold: i.salesQty, freq: i.salesFreq, age: i.ageDays });
const invRows = stocked.map(invRow);
const baseCols = [{ key: "code", header: "Code" }, { key: "name", header: "Item" }];
const inventoryReports: Report[] = [
  { key: "current", label: "Current stock", cols: [...baseCols, { key: "type", header: "Type" }, { key: "warehouse", header: "Warehouse" }, { key: "stock", header: "Stock", kind: "num" }, { key: "unit", header: "Unit" }, { key: "status", header: "Status", kind: "status" }], raw: invRows, filters: ["type", "category", "warehouse"], search: ["code", "name"] },
  { key: "valuation", label: "Stock valuation", description: "Valued at weighted purchase cost; finished goods at 50% of selling price.", cols: [...baseCols, { key: "stock", header: "Stock", kind: "num" }, { key: "rate", header: "Rate", kind: "inr" }, { key: "value", header: "Value", kind: "inr", total: true }], raw: invRows, filters: ["type", "category"], search: ["name"], aggregate: sortBy("value"), chart: { x: "name", y: "value" } },
  { key: "movement", label: "Stock movement", cols: [{ key: "date", header: "Date" }, { key: "id", header: "Ref" }, { key: "item", header: "Item" }, { key: "type", header: "Type" }, { key: "qty", header: "Qty", kind: "num" }, { key: "next", header: "Balance", kind: "num" }, { key: "warehouse", header: "Warehouse" }, { key: "user", header: "User" }], raw: movements.map((m) => ({ ...m, item: itemName(m.code) })), date: "iso", filters: ["type", "warehouse"], search: ["item", "id"] },
  { key: "low", label: "Low stock", cols: [...baseCols, { key: "stock", header: "Stock", kind: "num" }, { key: "min", header: "Minimum", kind: "num" }, { key: "status", header: "Status", kind: "status" }], raw: invRows.filter((r) => Number(r.stock) < Number(r.min)), filters: ["category"] },
  { key: "dead", label: "Dead stock", description: "Items with no movement for 60+ days.", cols: [...baseCols, { key: "stock", header: "Stock", kind: "num" }, { key: "lastMoved", header: "Days idle", kind: "num" }, { key: "value", header: "Value blocked", kind: "inr", total: true }], raw: invRows.filter((r) => Number(r.lastMoved) >= 60), filters: ["category"] },
  { key: "fast", label: "Fast-moving", cols: [...baseCols, { key: "sold", header: "Qty moved (90d)", kind: "num" }, { key: "freq", header: "Transactions", kind: "num" }], raw: invRows, filters: ["type"], aggregate: (r) => sortBy("freq")([...r]).slice(0, 10), chart: { x: "name", y: "freq" } },
  { key: "slow", label: "Slow-moving", cols: [...baseCols, { key: "sold", header: "Qty moved (90d)", kind: "num" }, { key: "freq", header: "Transactions", kind: "num" }, { key: "lastMoved", header: "Days idle", kind: "num" }], raw: invRows, filters: ["type"], aggregate: (r) => [...r].sort((a, b) => Number(a["freq"]) - Number(b["freq"])).slice(0, 10) },
  { key: "ageing", label: "Stock ageing", cols: [{ key: "bucket", header: "Age bucket" }, { key: "count", header: "Items", kind: "num" }, { key: "stock", header: "Qty", kind: "num", total: true }, { key: "value", header: "Value", kind: "inr", total: true }], raw: invRows.map((r) => ({ ...r, bucket: Number(r.age) <= 30 ? "0–30 days" : Number(r.age) <= 60 ? "31–60 days" : Number(r.age) <= 90 ? "61–90 days" : "90+ days" })), filters: ["category"], aggregate: (r) => groupBy(r, "bucket", ["stock", "value"]).sort((a, b) => String(a["bucket"]).localeCompare(String(b["bucket"]), "en", { numeric: true })), chart: { x: "bucket", y: "value" } },
];

// ---------- Manufacturing ----------
const prodRows: Row[] = productionOrders.map((p) => ({ id: p.id, iso: p.iso, date: p.date, product: p.product, customer: p.customer, planned: p.planned, produced: p.produced, wastage: p.wastage, wastagePct: p.planned ? (p.wastage / p.planned) * 100 : 0, assigned: p.assigned, status: p.status }));
const manufacturingReports: Report[] = [
  { key: "orders", label: "Production summary", cols: [{ key: "id", header: "Order" }, { key: "date", header: "Date" }, { key: "product", header: "Product" }, { key: "customer", header: "For" }, { key: "planned", header: "Planned", kind: "num", total: true }, { key: "produced", header: "Produced", kind: "num", total: true }, { key: "status", header: "Status", kind: "status" }], raw: prodRows, date: "iso", filters: ["status", "product"], search: ["id", "customer"] },
  { key: "product", label: "Output by product", cols: [{ key: "product", header: "Product" }, { key: "count", header: "Orders", kind: "num" }, { key: "planned", header: "Planned", kind: "num", total: true }, { key: "produced", header: "Produced", kind: "num", total: true }], raw: prodRows, date: "iso", aggregate: (r) => sortBy("produced")(groupBy(r, "product", ["planned", "produced"])), chart: { x: "product", y: "produced" } },
  { key: "wastage", label: "Wastage", cols: [{ key: "id", header: "Order" }, { key: "product", header: "Product" }, { key: "planned", header: "Planned", kind: "num" }, { key: "wastage", header: "Wasted cards", kind: "num", total: true }, { key: "wastagePct", header: "Wastage %", kind: "pct" }], raw: prodRows.filter((r) => r["status"] === "Completed"), date: "iso", filters: ["product"] },
  { key: "bom", label: "BOM material cost", cols: [{ key: "id", header: "BOM" }, { key: "product", header: "Product" }, { key: "output", header: "Output qty", kind: "num" }, { key: "material", header: "Material cost", kind: "inr" }, { key: "labour", header: "Labour", kind: "inr" }, { key: "perUnit", header: "Cost / unit", kind: "inr" }], raw: boms.map((b) => { const material = Math.round(b.lines.reduce((s, l) => s + l.qty * (items.find((i) => i.code === l.code)?.purchase ?? 0) * (1 + l.wastage / 100), 0)); return { id: b.id, product: b.product, output: b.output, material, labour: b.labour, perUnit: Math.round(((material + b.labour) / b.output) * 100) / 100 }; }) },
];

// ---------- Accounting ----------
const acc = accounts.filter((a) => !a.group);
const accountingReports: Report[] = [
  { key: "pl", label: "Profit & loss", cols: [{ key: "type", header: "Type" }, { key: "name", header: "Account" }, { key: "current", header: "Amount (FY to date)", kind: "inr" }], raw: acc.filter((a) => a.type === "Income" || a.type === "Expenses").map((a) => ({ type: a.type, name: a.name, current: a.current })), filters: ["type"] },
  { key: "tb", label: "Trial balance", cols: [{ key: "code", header: "Code" }, { key: "name", header: "Account" }, { key: "debit", header: "Debit", kind: "inr", total: true }, { key: "credit", header: "Credit", kind: "inr", total: true }], raw: acc.map((a) => ({ code: a.code, name: a.name, type: a.type, debit: a.type === "Assets" || a.type === "Expenses" ? a.current : 0, credit: a.type === "Assets" || a.type === "Expenses" ? 0 : a.current })), filters: ["type"], search: ["name"] },
  { key: "bs", label: "Balance summary", cols: [{ key: "type", header: "Group" }, { key: "count", header: "Accounts", kind: "num" }, { key: "current", header: "Balance", kind: "inr" }], raw: acc.filter((a) => ["Assets", "Liabilities", "Equity"].includes(a.type)).map((a) => ({ type: a.type, current: a.current })), aggregate: (r) => groupBy(r, "type", ["current"]), chart: { x: "type", y: "current" } },
];

// ---------- GST ----------
const gstRow = (g: (typeof gstSales)[number]) => ({ id: g.id, iso: g.iso, date: g.date, party: g.party, gstin: g.gstin, hsn: g.hsn, item: g.item, taxable: g.taxable, rate: `${g.rate}%`, cgst: g.cgst, sgst: g.sgst, igst: g.igst, tax: taxOf(g), status: g.status });
const gstCols = [{ key: "id", header: "Doc" }, { key: "date", header: "Date" }, { key: "party", header: "Party" }, { key: "gstin", header: "GSTIN" }, { key: "taxable", header: "Taxable", kind: "inr" as const, total: true }, { key: "cgst", header: "CGST", kind: "inr" as const, total: true }, { key: "sgst", header: "SGST", kind: "inr" as const, total: true }, { key: "igst", header: "IGST", kind: "inr" as const, total: true }, { key: "status", header: "Status", kind: "status" as const }];
const gstReports: Report[] = [
  { key: "out", label: "Output GST (GSTR-1)", cols: gstCols, raw: gstSales.map(gstRow), date: "iso", filters: ["status", "rate"], search: ["party", "gstin"] },
  { key: "in", label: "Input GST (GSTR-2B)", cols: gstCols, raw: gstPurchases.map(gstRow), date: "iso", filters: ["status", "rate"], search: ["party", "gstin"] },
  { key: "hsn", label: "HSN summary", cols: [{ key: "hsn", header: "HSN/SAC" }, { key: "item", header: "Description" }, { key: "count", header: "Docs", kind: "num" }, { key: "taxable", header: "Taxable", kind: "inr", total: true }, { key: "tax", header: "Tax", kind: "inr", total: true }], raw: gstSales.map(gstRow), date: "iso", aggregate: (r) => groupBy(r, "hsn", ["taxable", "tax"], (l, o) => (o["item"] = l[0]?.["item"] ?? "")), chart: { x: "item", y: "taxable" } },
];

// ---------- Customers ----------
const customerReports: Report[] = [
  { key: "outstanding", label: "Customer outstanding", cols: [{ key: "id", header: "ID" }, { key: "name", header: "Customer" }, { key: "type", header: "Type" }, { key: "city", header: "City" }, { key: "totalSales", header: "Total sales", kind: "inr", total: true }, { key: "outstanding", header: "Outstanding", kind: "inr", total: true }], raw: customers.map((c) => ({ id: c.id, name: c.name, type: c.type, city: c.city, district: c.district, totalSales: c.totalSales, outstanding: c.outstanding })), filters: ["type", "district"], search: ["name"], aggregate: sortBy("outstanding"), chart: { x: "name", y: "outstanding" } },
  { key: "type", label: "Customers by segment", cols: [{ key: "type", header: "Segment" }, { key: "count", header: "Customers", kind: "num", total: true }, { key: "totalSales", header: "Sales", kind: "inr", total: true }, { key: "outstanding", header: "Outstanding", kind: "inr", total: true }], raw: customers.map((c) => ({ type: c.type, district: c.district, totalSales: c.totalSales, outstanding: c.outstanding })), filters: ["district"], aggregate: (r) => sortBy("totalSales")(groupBy(r, "type", ["totalSales", "outstanding"])), chart: { x: "type", y: "totalSales" } },
  { key: "district", label: "Customers by district", cols: [{ key: "district", header: "District" }, { key: "count", header: "Customers", kind: "num", total: true }, { key: "totalSales", header: "Sales", kind: "inr", total: true }], raw: customers.map((c) => ({ district: c.district, type: c.type, totalSales: c.totalSales })), filters: ["type"], aggregate: (r) => sortBy("totalSales")(groupBy(r, "district", ["totalSales"])), chart: { x: "district", y: "totalSales" } },
];

// ---------- Employees ----------
const empRows = employees.map((e) => ({ id: e.id, name: e.name, dept: e.dept, designation: e.designation, city: e.city, joined: e.joined, status: e.status, gross: e.gross, present: attendance.filter((a) => a.emp === e.id && a["iso"] >= "2026-09-01" && (a["status"] === "Present" || a["status"] === "Late")).length }));
const employeeReports: Report[] = [
  { key: "directory", label: "Employee directory", cols: [{ key: "id", header: "ID" }, { key: "name", header: "Name" }, { key: "dept", header: "Department" }, { key: "designation", header: "Designation" }, { key: "city", header: "City" }, { key: "joined", header: "Joined" }, { key: "status", header: "Status", kind: "status" }], raw: empRows, filters: ["dept", "status"], search: ["name", "id"] },
  { key: "headcount", label: "Headcount by department", cols: [{ key: "dept", header: "Department" }, { key: "count", header: "Employees", kind: "num", total: true }, { key: "gross", header: "Monthly gross", kind: "inr", total: true }], raw: empRows, filters: ["status"], aggregate: (r) => sortBy("count")(groupBy(r, "dept", ["gross"])), chart: { x: "dept", y: "count" } },
  { key: "attendance", label: "Attendance (Sep 2026)", cols: [{ key: "name", header: "Employee" }, { key: "dept", header: "Department" }, { key: "present", header: "Days present", kind: "num" }], raw: empRows.filter((e) => e.status !== "Resigned"), filters: ["dept"], search: ["name"], aggregate: sortBy("present") },
];

// ---------- Payroll ----------
const slips = months.flatMap((m, mi) => employees.filter((e) => e.status !== "Resigned").map((e) => ({ ...slipFor(e, m, mi), name: e.name, dept: e.dept })));
const payrollReports: Report[] = [
  { key: "month", label: "Payroll by month", cols: [{ key: "month", header: "Month" }, { key: "count", header: "Employees", kind: "num" }, { key: "gross", header: "Gross", kind: "inr", total: true }, { key: "deductions", header: "Deductions", kind: "inr", total: true }, { key: "net", header: "Net pay", kind: "inr", total: true }], raw: slips, filters: ["dept"], aggregate: (r) => groupBy(r, "month", ["gross", "deductions", "net"]), chart: { x: "month", y: "net", type: "line" } },
  { key: "statutory", label: "PF / ESI / PT / TDS", cols: [{ key: "month", header: "Month" }, { key: "pf", header: "PF", kind: "inr", total: true }, { key: "esi", header: "ESI", kind: "inr", total: true }, { key: "pt", header: "Professional tax", kind: "inr", total: true }, { key: "tds", header: "TDS", kind: "inr", total: true }], raw: slips, filters: ["dept"], aggregate: (r) => groupBy(r, "month", ["pf", "esi", "pt", "tds"]) },
  { key: "dept", label: "Cost by department", cols: [{ key: "dept", header: "Department" }, { key: "gross", header: "Gross", kind: "inr", total: true }, { key: "net", header: "Net", kind: "inr", total: true }], raw: slips, filters: ["month"], aggregate: (r) => sortBy("gross")(groupBy(r, "dept", ["gross", "net"])), chart: { x: "dept", y: "gross" } },
];

// ---------- Travel ----------
const travelRows = travels.map((t) => ({ id: t.id, iso: t.iso, date: t.date, employee: empById(t.emp)?.name ?? t.emp, route: `${t.from.name} → ${t.to.name}`, purpose: t.purpose, customer: t.customer, km: t.km, allowance: t.allowance, status: t.status }));
const travelReports: Report[] = [
  { key: "trips", label: "Trip register", cols: [{ key: "id", header: "Trip" }, { key: "date", header: "Date" }, { key: "employee", header: "Employee" }, { key: "route", header: "Route" }, { key: "purpose", header: "Purpose" }, { key: "km", header: "Km", kind: "num", total: true }, { key: "allowance", header: "Allowance", kind: "inr", total: true }, { key: "status", header: "Status", kind: "status" }], raw: travelRows, date: "iso", filters: ["employee", "purpose", "status"], search: ["route", "customer"] },
  { key: "employee", label: "Allowance by employee", cols: [{ key: "employee", header: "Employee" }, { key: "count", header: "Trips", kind: "num" }, { key: "km", header: "Km", kind: "num", total: true }, { key: "allowance", header: "Allowance", kind: "inr", total: true }], raw: travelRows, date: "iso", aggregate: (r) => sortBy("allowance")(groupBy(r, "employee", ["km", "allowance"])), chart: { x: "employee", y: "allowance" } },
  { key: "purpose", label: "Travel by purpose", cols: [{ key: "purpose", header: "Purpose" }, { key: "count", header: "Trips", kind: "num", total: true }, { key: "km", header: "Km", kind: "num", total: true }], raw: travelRows, date: "iso", aggregate: (r) => sortBy("count")(groupBy(r, "purpose", ["km"])), chart: { x: "purpose", y: "count" } },
];

// ---------- Profitability ----------
const profCols = (first: string, header: string) => [{ key: first, header }, { key: "revenue", header: "Revenue", kind: "inr" as const, total: true }, { key: "cost", header: "Cost", kind: "inr" as const, total: true }, { key: "profit", header: "Gross profit", kind: "inr" as const, total: true }, { key: "margin", header: "Margin", kind: "pct" as const }];
const profitReports: Report[] = [
  { key: "product", label: "Product profitability", description: "Cost = material + direct labour estimate per category (demo ratios).", cols: profCols("product", "Product"), raw: salesLines, date: "iso", filters: ["product", "customer", "category"], aggregate: (r) => sortBy("profit")(groupBy(r, "product", ["revenue", "cost"], withMargin)), chart: { x: "product", y: "profit" } },
  { key: "customer", label: "Customer profitability", cols: profCols("customer", "Customer"), raw: salesLines, date: "iso", filters: ["customer", "product", "category"], search: ["customer"], aggregate: (r) => sortBy("profit")(groupBy(r, "customer", ["revenue", "cost"], withMargin)), chart: { x: "customer", y: "profit" } },
  { key: "category", label: "Category profitability", cols: profCols("category", "Category"), raw: salesLines, date: "iso", filters: ["customer", "customerType"], aggregate: (r) => sortBy("profit")(groupBy(r, "category", ["revenue", "cost"], withMargin)), chart: { x: "category", y: "profit" } },
];

const make = (title: string, description: string, reports: Report[]) => () => <ReportView title={title} description={description} reports={reports} />;

export function SalesReports() {
  const [lines, setLines] = useState<Row[]>(salesLines);
  const [invList, setInvList] = useState<Row[]>(() =>
    invoices.map((v) => ({
      id: v.id,
      iso: v.iso,
      date: v.date,
      customer: v.customer,
      grand: v.grand,
      received: v.received,
      balance: v.balance,
      status: v.status,
    }))
  );
  const [returnsList, setReturnsList] = useState<Row[]>(salesReturns);

  const fetchSales = () => {
    Promise.all([
      api.get<any>("/sales/invoices/").catch(() => null),
      api.get<any>("/sales/returns/").catch(() => null),
    ]).then(([invRes, retRes]) => {
      const list = Array.isArray(invRes) ? invRes : (invRes?.results ?? []);
      const rList = Array.isArray(retRes) ? retRes : (retRes?.results ?? []);

      if (invRes !== null) {
        const liveLines: Row[] = list.flatMap((v: any) => {
          const itemsList = Array.isArray(v.lines) ? v.lines : (Array.isArray(v.items) ? v.items : []);
          if (itemsList.length === 0) {
            const rev = Math.round(Number(v.taxable_amount || v.subtotal || v.total_amount || 0));
            return [{
              iso: v.invoice_date || v.issue_date || v.date || new Date().toISOString().slice(0, 10),
              date: v.invoice_date || v.issue_date || v.date || new Date().toISOString().slice(0, 10),
              invoice: v.code || v.invoice_number || `INV-${v.id}`,
              customer: v.customer_name || v.customer || "General Customer",
              customerType: "Business",
              salesperson: v.salesperson || "Sales Team",
              product: "Identity Card Printing",
              category: "ID cards",
              qty: 1,
              revenue: rev,
              tax: Math.round(Number(v.tax_amount || (rev * 0.18))),
              cost: Math.round(rev * 0.46),
              status: v.status || "Paid",
            }];
          }
          return itemsList.map((l: any) => {
            const code = l.item_code || l.code || "";
            const category = catOf(code);
            const qty = Number(l.quantity || l.qty) || 1;
            const rate = Number(l.unit_price || l.rate) || 0;
            const revenue = Math.round(Number(l.taxable_amount || l.line_total || (qty * rate)));
            const tax = Math.round(Number(l.tax_amount || (revenue * 0.18)));
            return {
              iso: v.invoice_date || v.issue_date || v.date || new Date().toISOString().slice(0, 10),
              date: v.invoice_date || v.issue_date || v.date || new Date().toISOString().slice(0, 10),
              invoice: v.code || v.invoice_number || `INV-${v.id}`,
              customer: v.customer_name || v.customer || "General Customer",
              customerType: "Business",
              salesperson: v.salesperson || "Sales Team",
              product: l.item_name || l.name || "Product",
              category,
              qty,
              revenue,
              tax,
              cost: Math.round(revenue * (costRatio[category] || 0.46)),
              status: v.status || "Paid",
            };
          });
        });
        setLines(liveLines);

        const liveInvs: Row[] = list.map((v: any) => ({
          id: v.code || v.invoice_number || `INV-${v.id}`,
          iso: v.invoice_date || v.date,
          date: v.invoice_date || v.date,
          customer: v.customer_name || v.customer,
          grand: Number(v.total_amount || v.grand || 0),
          received: Number(v.paid_amount || v.received || 0),
          balance: Number(v.balance_amount || v.balance || 0),
          status: v.status,
        }));
        setInvList(liveInvs);
      }

      if (retRes !== null) {
        const liveReturns: Row[] = rList.map((r: any) => ({
          id: r.code || `SRTN-${r.id}`,
          date: r.return_date || r.date,
          iso: r.return_date || r.date,
          invoice: r.invoice_code || r.invoice,
          customer: r.customer_name || r.customer,
          item: r.item_name || "Returned Item",
          qty: Number(r.quantity || r.qty) || 1,
          amount: Number(r.total_amount || r.amount) || 0,
          reason: r.reason || "Defective Printing",
          status: r.status || "Approved",
        }));
        setReturnsList(liveReturns);
      }
    });
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const reports: Report[] = useMemo(() => [
    { key: "date", label: "Sales by date", cols: [{ key: "date", header: "Date" }, { key: "count", header: "Lines", kind: "num" }, { key: "revenue", header: "Taxable", kind: "inr", total: true }, { key: "tax", header: "GST", kind: "inr", total: true }], raw: lines, date: "iso", filters: ["category"], aggregate: (r) => groupBy(r, "date", ["revenue", "tax"], (l, o) => (o["iso"] = l[0]?.["iso"] ?? "")).sort((a, b) => String(a["iso"]).localeCompare(String(b["iso"]))), chart: { x: "date", y: "revenue", type: "line" }, onGenerate: fetchSales },
    { key: "product", label: "Sales by product", cols: [{ key: "product", header: "Product" }, { key: "qty", header: "Qty", kind: "num", total: true }, { key: "revenue", header: "Revenue", kind: "inr", total: true }], raw: lines, date: "iso", filters: ["category", "customerType"], search: ["product"], aggregate: (r) => sortBy("revenue")(groupBy(r, "product", ["qty", "revenue"])), chart: { x: "product", y: "revenue" }, onGenerate: fetchSales },
    { key: "customer", label: "Sales by customer", cols: [{ key: "customer", header: "Customer" }, { key: "count", header: "Lines", kind: "num" }, { key: "revenue", header: "Revenue", kind: "inr", total: true }, { key: "tax", header: "GST", kind: "inr", total: true }], raw: lines, date: "iso", filters: ["customerType"], search: ["customer"], aggregate: (r) => sortBy("revenue")(groupBy(r, "customer", ["revenue", "tax"])), chart: { x: "customer", y: "revenue" }, onGenerate: fetchSales },
    { key: "employee", label: "Sales by employee", cols: [{ key: "salesperson", header: "Salesperson" }, { key: "count", header: "Lines", kind: "num" }, { key: "revenue", header: "Revenue", kind: "inr", total: true }], raw: lines, date: "iso", filters: ["category"], aggregate: (r) => sortBy("revenue")(groupBy(r, "salesperson", ["revenue"])), chart: { x: "salesperson", y: "revenue" }, onGenerate: fetchSales },
    { key: "category", label: "Sales by category", cols: [{ key: "category", header: "Category" }, { key: "qty", header: "Qty", kind: "num", total: true }, { key: "revenue", header: "Revenue", kind: "inr", total: true }], raw: lines, date: "iso", filters: ["customerType"], aggregate: (r) => sortBy("revenue")(groupBy(r, "category", ["qty", "revenue"])), chart: { x: "category", y: "revenue" }, onGenerate: fetchSales },
    { key: "status", label: "Payment status", cols: [{ key: "id", header: "Invoice" }, { key: "date", header: "Date" }, { key: "customer", header: "Customer" }, { key: "grand", header: "Total", kind: "inr", total: true }, { key: "received", header: "Received", kind: "inr", total: true }, { key: "balance", header: "Balance", kind: "inr", total: true }, { key: "status", header: "Status", kind: "status" }], raw: invList, date: "iso", filters: ["status"], search: ["id", "customer"], onGenerate: fetchSales },
    { key: "returns", label: "Sales returns", cols: [{ key: "id", header: "Return" }, { key: "date", header: "Date" }, { key: "invoice", header: "Invoice" }, { key: "customer", header: "Customer" }, { key: "item", header: "Item" }, { key: "qty", header: "Qty", kind: "num", total: true }, { key: "amount", header: "Amount", kind: "inr", total: true }, { key: "reason", header: "Reason" }, { key: "status", header: "Status", kind: "status" }], raw: returnsList, date: "iso", filters: ["reason", "status"], search: ["customer", "invoice"], onGenerate: fetchSales },
  ], [lines, invList, returnsList]);

  return <ReportView title="Sales reports" description="ID card, lanyard and accessory sales by date, product, customer, salesperson and category." reports={reports} />;
}

export function PurchaseReports() {
  const [lines, setLines] = useState<Row[]>(purchaseLines);
  const [outstandingBills, setOutstandingBills] = useState<Row[]>(() =>
    bills.filter((b) => b.balance > 0).map((b) => ({
      id: b.id,
      iso: b["iso"],
      date: b.date,
      supplier: b.supplier,
      due: b.due,
      total: b.total,
      paid: b.paid,
      balance: b.balance,
      payment: b.payment,
    }))
  );
  const [returns, setReturns] = useState<Row[]>(() =>
    purchaseReturns.map(mapPurchaseReturnToRow)
  );

  const fetchPurchases = () => {
    Promise.all([
      api.get<any>("/purchases/bills/").catch(() => null),
      api.get<any>("/purchases/returns/").catch(() => null),
    ]).then(([billsRes, retRes]) => {
      const bList = Array.isArray(billsRes) ? billsRes : (billsRes?.results ?? []);
      const rList = Array.isArray(retRes) ? retRes : (retRes?.results ?? []);

      if (bList.length > 0) {
        const liveLines: Row[] = bList.flatMap((b: any) => {
          const lList = Array.isArray(b.lines) ? b.lines : (Array.isArray(b.items) ? b.items : []);
          if (lList.length === 0) {
            return [{
              iso: b.bill_date || b.date || new Date().toISOString().slice(0, 10),
              date: b.bill_date || b.date || new Date().toISOString().slice(0, 10),
              bill: b.code || `BILL-${b.id}`,
              supplier: b.supplier_name || b.supplier || "Supplier",
              product: "Raw Materials",
              qty: 1,
              amount: Math.round(Number(b.taxable_amount || b.total_amount || 0)),
              tax: Math.round(Number(b.tax_amount || 0)),
              status: b.payment_status || b.status || "Paid",
            }];
          }
          return lList.map((l: any) => ({
            iso: b.bill_date || b.date || new Date().toISOString().slice(0, 10),
            date: b.bill_date || b.date || new Date().toISOString().slice(0, 10),
            bill: b.code || `BILL-${b.id}`,
            supplier: b.supplier_name || b.supplier || "Supplier",
            product: l.item_name || itemName(l.item_code || l.code) || "Material",
            qty: Number(l.quantity || l.qty) || 1,
            amount: Math.round(Number(l.taxable_amount || l.line_total || 0)),
            tax: Math.round(Number(l.tax_amount || 0)),
            status: b.payment_status || b.status || "Paid",
          }));
        });
        setLines(liveLines);

        const liveOutstanding: Row[] = bList
          .filter((b: any) => Number(b.balance_amount || b.balance || 0) > 0)
          .map((b: any) => ({
            id: b.code || `BILL-${b.id}`,
            iso: b.bill_date || b.date,
            date: b.bill_date || b.date,
            supplier: b.supplier_name || b.supplier,
            due: b.due_date || b.due || "—",
            total: Number(b.total_amount || b.total || 0),
            paid: Number(b.paid_amount || b.paid || 0),
            balance: Number(b.balance_amount || b.balance || 0),
            payment: b.payment_status || b.status || "Unpaid",
          }));
        setOutstandingBills(liveOutstanding);
      }

      if (rList.length > 0) {
        const liveReturns: Row[] = rList.map((p: any) => ({
          id: p.code || `PRTN-${p.id}`,
          date: p.return_date || p.date,
          iso: p.return_date || p.date,
          bill: p.bill_code || p.bill,
          supplier: p.supplier_name || p.supplier,
          item: p.item_name || "Material",
          qty: Number(p.quantity || p.qty) || 1,
          amount: Number(p.total_amount || p.amount) || 0,
          reason: p.reason || "Defective Material",
          status: p.status || "Processed",
        }));
        setReturns(liveReturns);
      }
    });
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  const reports: Report[] = useMemo(() => [
    { key: "date", label: "Purchases by date", cols: [{ key: "date", header: "Date" }, { key: "count", header: "Lines", kind: "num" }, { key: "amount", header: "Taxable", kind: "inr", total: true }, { key: "tax", header: "GST", kind: "inr", total: true }], raw: lines, date: "iso", aggregate: (r) => groupBy(r, "date", ["amount", "tax"], (l, o) => (o["iso"] = l[0]?.["iso"] ?? "")).sort((a, b) => String(a["iso"]).localeCompare(String(b["iso"]))), chart: { x: "date", y: "amount", type: "line" }, onGenerate: fetchPurchases },
    { key: "supplier", label: "Purchases by supplier", cols: [{ key: "supplier", header: "Supplier" }, { key: "count", header: "Lines", kind: "num" }, { key: "amount", header: "Taxable", kind: "inr", total: true }, { key: "tax", header: "GST", kind: "inr", total: true }], raw: lines, date: "iso", search: ["supplier"], aggregate: (r) => sortBy("amount")(groupBy(r, "supplier", ["amount", "tax"])), chart: { x: "supplier", y: "amount" }, onGenerate: fetchPurchases },
    { key: "product", label: "Purchases by product", cols: [{ key: "product", header: "Material" }, { key: "qty", header: "Qty", kind: "num", total: true }, { key: "amount", header: "Amount", kind: "inr", total: true }], raw: lines, date: "iso", filters: ["supplier"], search: ["product"], aggregate: (r) => sortBy("amount")(groupBy(r, "product", ["qty", "amount"])), chart: { x: "product", y: "amount" }, onGenerate: fetchPurchases },
    { key: "outstanding", label: "Purchase outstanding", cols: [{ key: "id", header: "Bill" }, { key: "date", header: "Date" }, { key: "supplier", header: "Supplier" }, { key: "due", header: "Due" }, { key: "total", header: "Total", kind: "inr", total: true }, { key: "paid", header: "Paid", kind: "inr", total: true }, { key: "balance", header: "Balance", kind: "inr", total: true }, { key: "payment", header: "Status", kind: "status" }], raw: outstandingBills, date: "iso", filters: ["supplier", "payment"], search: ["id", "supplier"], onGenerate: fetchPurchases },
    { key: "returns", label: "Purchase returns", cols: [{ key: "id", header: "Return" }, { key: "date", header: "Date" }, { key: "bill", header: "Bill" }, { key: "supplier", header: "Supplier" }, { key: "item", header: "Material" }, { key: "qty", header: "Qty", kind: "num", total: true }, { key: "amount", header: "Amount", kind: "inr", total: true }, { key: "reason", header: "Reason" }, { key: "status", header: "Status", kind: "status" }], raw: returns, date: "iso", filters: ["supplier", "status"], onGenerate: fetchPurchases },
  ], [lines, outstandingBills, returns]);

  return <ReportView title="Purchase reports" description="PVC, ribbon, lanyard and consumable purchases by supplier and material." reports={reports} />;
}

export function CustomerReports() {
  const [custRows, setCustRows] = useState<Row[]>(() =>
    customers.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      city: c.city,
      district: c.district,
      totalSales: c.totalSales,
      outstanding: c.outstanding,
    }))
  );

  const fetchCustomers = () => {
    api.get<any>("/parties/customers/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        if (list.length > 0) {
          const live: Row[] = list.map((c: any) => ({
            id: c.code || `CUST-${c.id}`,
            name: c.name,
            type: c.customer_type || c.type || "School",
            city: c.city || "Kozhikode",
            district: c.district || "Kozhikode",
            totalSales: Number(c.total_billed || c.totalSales || 0),
            outstanding: Number(c.outstanding_balance || c.outstanding || 0),
          }));
          setCustRows(live);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const reports: Report[] = useMemo(() => [
    { key: "outstanding", label: "Customer outstanding", cols: [{ key: "id", header: "ID" }, { key: "name", header: "Customer" }, { key: "type", header: "Type" }, { key: "city", header: "City" }, { key: "totalSales", header: "Total sales", kind: "inr", total: true }, { key: "outstanding", header: "Outstanding", kind: "inr", total: true }], raw: custRows, filters: ["type", "district"], search: ["name"], aggregate: sortBy("outstanding"), chart: { x: "name", y: "outstanding" }, onGenerate: fetchCustomers },
    { key: "type", label: "Customers by segment", cols: [{ key: "type", header: "Segment" }, { key: "count", header: "Customers", kind: "num", total: true }, { key: "totalSales", header: "Sales", kind: "inr", total: true }, { key: "outstanding", header: "Outstanding", kind: "inr", total: true }], raw: custRows, filters: ["district"], aggregate: (r) => sortBy("totalSales")(groupBy(r, "type", ["totalSales", "outstanding"])), chart: { x: "type", y: "totalSales" }, onGenerate: fetchCustomers },
    { key: "district", label: "Customers by district", cols: [{ key: "district", header: "District" }, { key: "count", header: "Customers", kind: "num", total: true }, { key: "totalSales", header: "Sales", kind: "inr", total: true }], raw: custRows, filters: ["type"], aggregate: (r) => sortBy("totalSales")(groupBy(r, "district", ["totalSales"])), chart: { x: "district", y: "totalSales" }, onGenerate: fetchCustomers },
  ], [custRows]);

  return <ReportView title="Customer reports" description="Schools, colleges and institutions by outstanding, segment and district." reports={reports} />;
}

export function InventoryReports() {
  const [stockRows, setStockRows] = useState<Row[]>(invRows);
  const [stockMovements, setStockMovements] = useState<Row[]>(() =>
    movements.map((m) => ({ ...m, item: itemName(m.code) }))
  );

  const fetchInventory = () => {
    Promise.all([
      api.get<any>("/catalog/valuation/").catch(() => null),
      api.get<any>("/catalog/movements/").catch(() => null),
    ]).then(([valRes, movRes]) => {
      const vList = Array.isArray(valRes) ? valRes : (valRes?.results ?? []);
      const mList = Array.isArray(movRes) ? movRes : (movRes?.results ?? []);

      if (vList.length > 0) {
        const liveRows: Row[] = vList.map((i: any) => ({
          code: i.code,
          name: i.name,
          type: i.type,
          category: i.category || "General",
          warehouse: i.warehouse || "Main Warehouse",
          unit: i.unit || "Nos",
          stock: Number(i.stock) || 0,
          min: Number(i.reorder_level || 50),
          rate: Number(i.avg_cost || i.selling_price || 0),
          value: Number(i.value || 0),
          status: Number(i.stock) <= 0 ? "Out of Stock" : Number(i.stock) < Number(i.reorder_level || 50) ? "Low Stock" : "In Stock",
          lastMoved: 14,
          sold: 120,
          freq: 10,
          age: 30,
        }));
        setStockRows(liveRows);
      }

      if (mList.length > 0) {
        const liveMovements: Row[] = mList.map((m: any) => ({
          id: m.code || `MOV-${m.id}`,
          date: m.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          iso: m.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          item: m.item_name || m.item || "Stock Item",
          type: m.movement_type || "Transfer",
          qty: Number(m.quantity) || 0,
          next: Number(m.balance_quantity) || 0,
          warehouse: m.warehouse_name || "Main Warehouse",
          user: m.created_by_name || "Staff",
        }));
        setStockMovements(liveMovements);
      }
    });
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const reports: Report[] = useMemo(() => [
    { key: "current", label: "Current stock", cols: [...baseCols, { key: "type", header: "Type" }, { key: "warehouse", header: "Warehouse" }, { key: "stock", header: "Stock", kind: "num" }, { key: "unit", header: "Unit" }, { key: "status", header: "Status", kind: "status" }], raw: stockRows, filters: ["type", "category", "warehouse"], search: ["code", "name"], onGenerate: fetchInventory },
    { key: "valuation", label: "Stock valuation", description: "Valued at weighted purchase cost; finished goods at 50% of selling price.", cols: [...baseCols, { key: "stock", header: "Stock", kind: "num" }, { key: "rate", header: "Rate", kind: "inr" }, { key: "value", header: "Value", kind: "inr", total: true }], raw: stockRows, filters: ["type", "category"], search: ["name"], aggregate: sortBy("value"), chart: { x: "name", y: "value" }, onGenerate: fetchInventory },
    { key: "movement", label: "Stock movement", cols: [{ key: "date", header: "Date" }, { key: "id", header: "Ref" }, { key: "item", header: "Item" }, { key: "type", header: "Type" }, { key: "qty", header: "Qty", kind: "num" }, { key: "next", header: "Balance", kind: "num" }, { key: "warehouse", header: "Warehouse" }, { key: "user", header: "User" }], raw: stockMovements, date: "iso", filters: ["type", "warehouse"], search: ["item", "id"], onGenerate: fetchInventory },
    { key: "low", label: "Low stock", cols: [...baseCols, { key: "stock", header: "Stock", kind: "num" }, { key: "min", header: "Minimum", kind: "num" }, { key: "status", header: "Status", kind: "status" }], raw: stockRows.filter((r) => Number(r["stock"]) < Number(r["min"])), filters: ["category"], onGenerate: fetchInventory },
    { key: "dead", label: "Dead stock", description: "Items with no movement for 60+ days.", cols: [...baseCols, { key: "stock", header: "Stock", kind: "num" }, { key: "lastMoved", header: "Days idle", kind: "num" }, { key: "value", header: "Value blocked", kind: "inr", total: true }], raw: stockRows.filter((r) => Number(r["lastMoved"]) >= 60), filters: ["category"], onGenerate: fetchInventory },
    { key: "fast", label: "Fast-moving", cols: [...baseCols, { key: "sold", header: "Qty moved (90d)", kind: "num" }, { key: "freq", header: "Transactions", kind: "num" }], raw: stockRows, filters: ["type"], aggregate: (r) => sortBy("freq")([...r]).slice(0, 10), chart: { x: "name", y: "freq" }, onGenerate: fetchInventory },
    { key: "slow", label: "Slow-moving", cols: [...baseCols, { key: "sold", header: "Qty moved (90d)", kind: "num" }, { key: "freq", header: "Transactions", kind: "num" }, { key: "lastMoved", header: "Days idle", kind: "num" }], raw: stockRows, filters: ["type"], aggregate: (r) => [...r].sort((a, b) => Number(a["freq"]) - Number(b["freq"])).slice(0, 10), onGenerate: fetchInventory },
    { key: "ageing", label: "Stock ageing", cols: [{ key: "bucket", header: "Age bucket" }, { key: "count", header: "Items", kind: "num" }, { key: "stock", header: "Qty", kind: "num", total: true }, { key: "value", header: "Value", kind: "inr", total: true }], raw: stockRows.map((r) => ({ ...r, bucket: Number(r["age"]) <= 30 ? "0–30 days" : Number(r["age"]) <= 60 ? "31–60 days" : Number(r["age"]) <= 90 ? "61–90 days" : "90+ days" })), filters: ["category"], aggregate: (r) => groupBy(r, "bucket", ["stock", "value"]).sort((a, b) => String(a["bucket"]).localeCompare(String(b["bucket"]), "en", { numeric: true })), chart: { x: "bucket", y: "value" }, onGenerate: fetchInventory },
  ], [stockRows, stockMovements]);

  return <ReportView title="Inventory reports" description="Stock position, valuation, movement, ageing and velocity." reports={reports} />;
}

export function ManufacturingReports() {
  const [orders, setOrders] = useState<Row[]>(prodRows);
  const [bomRows, setBomRows] = useState<Row[]>(() =>
    boms.map((b) => {
      const material = Math.round(b.lines.reduce((s, l) => s + l.qty * (items.find((i) => i.code === l.code)?.purchase ?? 0) * (1 + l.wastage / 100), 0));
      return { id: b.id, product: b.product, output: b.output, material, labour: b.labour, perUnit: Math.round(((material + b.labour) / b.output) * 100) / 100 };
    })
  );

  const fetchManufacturing = () => {
    Promise.all([
      api.get<any>("/manufacturing/orders/").catch(() => null),
      api.get<any>("/catalog/boms/").catch(() => null),
    ]).then(([ordersRes, bomsRes]) => {
      const oList = Array.isArray(ordersRes) ? ordersRes : (ordersRes?.results ?? []);
      const bList = Array.isArray(bomsRes) ? bomsRes : (bomsRes?.results ?? []);

      if (oList.length > 0) {
        const liveOrders: Row[] = oList.map((p: any) => ({
          id: p.code || `PRD-${p.id}`,
          iso: p.order_date || p.created_at?.slice(0, 10),
          date: p.order_date || p.created_at?.slice(0, 10),
          product: p.item_name || p.product || "ID Card Production",
          customer: p.customer_name || "Internal Stock",
          planned: Number(p.planned_quantity || p.planned || 0),
          produced: Number(p.produced_quantity || p.produced || 0),
          wastage: Number(p.wastage_quantity || p.wastage || 0),
          wastagePct: p.planned_quantity ? (Number(p.wastage_quantity || 0) / Number(p.planned_quantity)) * 100 : 0,
          assigned: p.assigned_to_name || "Production Line",
          status: p.status || "Completed",
        }));
        setOrders(liveOrders);
      }

      if (bList.length > 0) {
        const liveBoms: Row[] = bList.map((b: any) => {
          const lines = Array.isArray(b.lines) ? b.lines : [];
          const material = Math.round(lines.reduce((s: number, l: any) => s + (Number(l.quantity) * Number(l.unit_cost || 5)), 0));
          const output = Number(b.output_quantity) || 100;
          const labour = Number(b.labour_cost) || 200;
          return {
            id: b.code || `BOM-${b.id}`,
            product: b.item_name || b.name,
            output,
            material,
            labour,
            perUnit: Math.round(((material + labour) / output) * 100) / 100,
          };
        });
        setBomRows(liveBoms);
      }
    });
  };

  useEffect(() => {
    fetchManufacturing();
  }, []);

  const reports: Report[] = useMemo(() => [
    { key: "orders", label: "Production summary", cols: [{ key: "id", header: "Order" }, { key: "date", header: "Date" }, { key: "product", header: "Product" }, { key: "customer", header: "For" }, { key: "planned", header: "Planned", kind: "num", total: true }, { key: "produced", header: "Produced", kind: "num", total: true }, { key: "status", header: "Status", kind: "status" }], raw: orders, date: "iso", filters: ["status", "product"], search: ["id", "customer"], onGenerate: fetchManufacturing },
    { key: "product", label: "Output by product", cols: [{ key: "product", header: "Product" }, { key: "count", header: "Orders", kind: "num" }, { key: "planned", header: "Planned", kind: "num", total: true }, { key: "produced", header: "Produced", kind: "num", total: true }], raw: orders, date: "iso", aggregate: (r) => sortBy("produced")(groupBy(r, "product", ["planned", "produced"])), chart: { x: "product", y: "produced" }, onGenerate: fetchManufacturing },
    { key: "wastage", label: "Wastage", cols: [{ key: "id", header: "Order" }, { key: "product", header: "Product" }, { key: "planned", header: "Planned", kind: "num" }, { key: "wastage", header: "Wasted cards", kind: "num", total: true }, { key: "wastagePct", header: "Wastage %", kind: "pct" }], raw: orders.filter((r) => r["status"] === "Completed"), date: "iso", filters: ["product"], onGenerate: fetchManufacturing },
    { key: "bom", label: "BOM material cost", cols: [{ key: "id", header: "BOM" }, { key: "product", header: "Product" }, { key: "output", header: "Output qty", kind: "num" }, { key: "material", header: "Material cost", kind: "inr" }, { key: "labour", header: "Labour", kind: "inr" }, { key: "perUnit", header: "Cost / unit", kind: "inr" }], raw: bomRows, onGenerate: fetchManufacturing },
  ], [orders, bomRows]);

  return <ReportView title="Manufacturing reports" description="Production output, wastage and BOM costing." reports={reports} />;
}

interface AccountReportItem {
  code: string;
  name: string;
  type: string;
  current: number;
}

export function AccountingReports() {
  const [accList, setAccList] = useState<AccountReportItem[]>(() =>
    accounts.filter((a) => !a.group).map((a) => ({
      code: a.code,
      name: a.name,
      type: a.type,
      current: a.current,
    }))
  );

  const fetchAccounts = () => {
    api.get<any>("/finance/accounts/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        if (list.length > 0) {
          const live: AccountReportItem[] = list.map((a: any) => ({
            code: String(a.code || ""),
            name: String(a.name || ""),
            type: String(a.account_type || a.type || "Assets"),
            current: Math.abs(Number(a.current_balance || a.balance || 0)),
          }));
          setAccList(live);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const reports: Report[] = useMemo(() => [
    { key: "pl", label: "Profit & loss", cols: [{ key: "type", header: "Type" }, { key: "name", header: "Account" }, { key: "current", header: "Amount (FY to date)", kind: "inr" }], raw: accList.filter((a) => a.type === "Income" || a.type === "Expenses").map((a): Row => ({ type: a.type, name: a.name, current: a.current })), filters: ["type"], onGenerate: fetchAccounts },
    { key: "tb", label: "Trial balance", cols: [{ key: "code", header: "Code" }, { key: "name", header: "Account" }, { key: "debit", header: "Debit", kind: "inr", total: true }, { key: "credit", header: "Credit", kind: "inr", total: true }], raw: accList.map((a): Row => ({ code: a.code, name: a.name, type: a.type, debit: a.type === "Assets" || a.type === "Expenses" ? a.current : 0, credit: a.type === "Assets" || a.type === "Expenses" ? 0 : a.current })), filters: ["type"], search: ["name"], onGenerate: fetchAccounts },
    { key: "bs", label: "Balance summary", cols: [{ key: "type", header: "Group" }, { key: "count", header: "Accounts", kind: "num" }, { key: "current", header: "Balance", kind: "inr" }], raw: accList.filter((a) => ["Assets", "Liabilities", "Equity"].includes(a.type)).map((a): Row => ({ type: a.type, name: a.name, current: a.current })), aggregate: (r) => groupBy(r, "type", ["current"]), chart: { x: "type", y: "current" }, onGenerate: fetchAccounts },
  ], [accList]);

  return <ReportView title="Accounting reports" description="Profit & loss, trial balance and balance summary for FY 2026-27." reports={reports} />;
}

export function GstReports() {
  const [salesGst, setSalesGst] = useState<Row[]>(() => gstSales.map(gstRow));
  const [purchasesGst, setPurchasesGst] = useState<Row[]>(() => gstPurchases.map(gstRow));

  const fetchGst = () => {
    Promise.all([
      api.get<any>("/sales/invoices/").catch(() => null),
      api.get<any>("/purchases/bills/").catch(() => null),
    ]).then(([invRes, billRes]) => {
      const invList = Array.isArray(invRes) ? invRes : (invRes?.results ?? []);
      const billList = Array.isArray(billRes) ? billRes : (billRes?.results ?? []);

      if (invList.length > 0) {
        const liveSalesGst: Row[] = invList.map((v: any) => ({
          id: v.code || `INV-${v.id}`,
          iso: v.invoice_date || v.date,
          date: v.invoice_date || v.date,
          party: v.customer_name || "Customer",
          gstin: v.customer_gstin || "32AAAAA0000A1Z5",
          hsn: "4911",
          item: "Identity Cards & Printing",
          taxable: Math.round(Number(v.taxable_amount || v.total_amount || 0)),
          rate: "18%",
          cgst: Math.round(Number(v.cgst_amount || 0)),
          sgst: Math.round(Number(v.sgst_amount || 0)),
          igst: Math.round(Number(v.igst_amount || 0)),
          tax: Math.round(Number(v.tax_amount || 0)),
          status: v.status || "Paid",
        }));
        setSalesGst(liveSalesGst);
      }

      if (billList.length > 0) {
        const livePurchGst: Row[] = billList.map((b: any) => ({
          id: b.code || `BILL-${b.id}`,
          iso: b.bill_date || b.date,
          date: b.bill_date || b.date,
          party: b.supplier_name || "Supplier",
          gstin: b.supplier_gstin || "32BBBBB0000B1Z6",
          hsn: "3920",
          item: "PVC Sheet & Ribbons",
          taxable: Math.round(Number(b.taxable_amount || b.total_amount || 0)),
          rate: "18%",
          cgst: Math.round(Number(b.cgst_amount || 0)),
          sgst: Math.round(Number(b.sgst_amount || 0)),
          igst: Math.round(Number(b.igst_amount || 0)),
          tax: Math.round(Number(b.tax_amount || 0)),
          status: b.payment_status || b.status || "Paid",
        }));
        setPurchasesGst(livePurchGst);
      }
    });
  };

  useEffect(() => {
    fetchGst();
  }, []);

  const reports: Report[] = useMemo(() => [
    { key: "out", label: "Output GST (GSTR-1)", cols: gstCols, raw: salesGst, date: "iso", filters: ["status", "rate"], search: ["party", "gstin"], onGenerate: fetchGst },
    { key: "in", label: "Input GST (GSTR-2B)", cols: gstCols, raw: purchasesGst, date: "iso", filters: ["status", "rate"], search: ["party", "gstin"], onGenerate: fetchGst },
    { key: "hsn", label: "HSN summary", cols: [{ key: "hsn", header: "HSN/SAC" }, { key: "item", header: "Description" }, { key: "count", header: "Docs", kind: "num" }, { key: "taxable", header: "Taxable", kind: "inr", total: true }, { key: "tax", header: "Tax", kind: "inr", total: true }], raw: salesGst, date: "iso", aggregate: (r) => groupBy(r, "hsn", ["taxable", "tax"], (l, o) => (o["item"] = l[0]?.["item"] ?? "")), chart: { x: "item", y: "taxable" }, onGenerate: fetchGst },
  ], [salesGst, purchasesGst]);

  return <ReportView title="GST reports" description="Outward and inward supplies, and HSN summary." reports={reports} />;
}

export function EmployeeReports() {
  const [empData, setEmpData] = useState<Row[]>(empRows);

  const fetchEmployees = () => {
    Promise.all([
      api.get<any>("/hr/employees/").catch(() => null),
      api.get<any>("/hr/attendance/").catch(() => null),
    ]).then(([empRes, attRes]) => {
      const empList = Array.isArray(empRes) ? empRes : (empRes?.results ?? []);
      const attList = Array.isArray(attRes) ? attRes : (attRes?.results ?? []);
      if (empList.length > 0) {
        const liveRows: Row[] = empList.map((e: any) => {
          const empCode = e.code || `EMP-${e.id}`;
          const presentDays = attList.filter(
            (a: any) =>
              (a.employee_code === empCode || a.employee_name === e.name || String(a.employee) === String(e.id)) &&
              (a.status === "Present" || a.status === "Late")
          ).length;
          return {
            id: empCode,
            name: e.name,
            dept: e.department_name || e.department || "Staff",
            designation: e.designation_title || e.designation || "Staff",
            city: e.city || "Kozhikode",
            joined: e.joined_date || "",
            status: e.status || "Active",
            gross: Number(e.gross_salary) || 0,
            present: presentDays || 1,
          };
        });
        setEmpData(liveRows);
      }
    });
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const reports: Report[] = useMemo(() => [
    { key: "directory", label: "Employee directory", cols: [{ key: "id", header: "ID" }, { key: "name", header: "Name" }, { key: "dept", header: "Department" }, { key: "designation", header: "Designation" }, { key: "city", header: "City" }, { key: "joined", header: "Joined" }, { key: "status", header: "Status", kind: "status" }], raw: empData, filters: ["dept", "status"], search: ["name", "id"], onGenerate: fetchEmployees },
    { key: "headcount", label: "Headcount by department", cols: [{ key: "dept", header: "Department" }, { key: "count", header: "Employees", kind: "num", total: true }, { key: "gross", header: "Monthly gross", kind: "inr", total: true }], raw: empData, filters: ["status"], aggregate: (r) => sortBy("count")(groupBy(r, "dept", ["gross"])), chart: { x: "dept", y: "count" }, onGenerate: fetchEmployees },
    { key: "attendance", label: "Attendance summary", cols: [{ key: "name", header: "Employee" }, { key: "dept", header: "Department" }, { key: "present", header: "Days present", kind: "num" }], raw: empData.filter((e) => e["status"] !== "Resigned"), filters: ["dept"], search: ["name"], aggregate: sortBy("present"), onGenerate: fetchEmployees },
  ], [empData]);

  return <ReportView title="Employee reports" description="Directory, headcount and attendance." reports={reports} />;
}

export function PayrollReports() {
  const [payrollRows, setPayrollRows] = useState<Row[]>(() => slips);

  const fetchPayroll = () => {
    api.get<any>("/hr/payroll-slips/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        if (list.length > 0) {
          const live: Row[] = list.map((p: any) => ({
            id: p.code || `SLIP-${p.id}`,
            name: p.employee_name || "Staff",
            dept: p.department_name || "General",
            month: p.payroll_period || "Oct 2026",
            gross: Number(p.gross_salary || p.gross || 0),
            deductions: Number(p.total_deductions || p.deductions || 0),
            net: Number(p.net_salary || p.net || 0),
            pf: Number(p.provident_fund || p.pf || 0),
            esi: Number(p.employee_state_insurance || p.esi || 0),
            pt: Number(p.professional_tax || p.pt || 208),
            tds: Number(p.tax_deducted_at_source || p.tds || 0),
          }));
          setPayrollRows(live);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchPayroll();
  }, []);

  const reports: Report[] = useMemo(() => [
    { key: "month", label: "Payroll by month", cols: [{ key: "month", header: "Month" }, { key: "count", header: "Employees", kind: "num" }, { key: "gross", header: "Gross", kind: "inr", total: true }, { key: "deductions", header: "Deductions", kind: "inr", total: true }, { key: "net", header: "Net pay", kind: "inr", total: true }], raw: payrollRows, filters: ["dept"], aggregate: (r) => groupBy(r, "month", ["gross", "deductions", "net"]), chart: { x: "month", y: "net", type: "line" }, onGenerate: fetchPayroll },
    { key: "statutory", label: "PF / ESI / PT / TDS", cols: [{ key: "month", header: "Month" }, { key: "pf", header: "PF", kind: "inr", total: true }, { key: "esi", header: "ESI", kind: "inr", total: true }, { key: "pt", header: "Professional tax", kind: "inr", total: true }, { key: "tds", header: "TDS", kind: "inr", total: true }], raw: payrollRows, filters: ["dept"], aggregate: (r) => groupBy(r, "month", ["pf", "esi", "pt", "tds"]), onGenerate: fetchPayroll },
    { key: "dept", label: "Cost by department", cols: [{ key: "dept", header: "Department" }, { key: "gross", header: "Gross", kind: "inr", total: true }, { key: "net", header: "Net", kind: "inr", total: true }], raw: payrollRows, filters: ["month"], aggregate: (r) => sortBy("gross")(groupBy(r, "dept", ["gross", "net"])), chart: { x: "dept", y: "gross" }, onGenerate: fetchPayroll },
  ], [payrollRows]);

  return <ReportView title="Payroll reports" description="Monthly payroll, statutory deductions and department cost." reports={reports} />;
}

export function TravelReports() {
  const [tRows, setTRows] = useState<Row[]>(travelRows);

  const fetchTravels = () => {
    api.get<any>("/hr/travel-claims/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        if (list.length > 0) {
          const live: Row[] = list.map((t: any) => ({
            id: t.code || `TRV-${t.id}`,
            iso: t.claim_date || new Date().toISOString().slice(0, 10),
            date: t.claim_date ? new Date(t.claim_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—",
            employee: t.employee_name || (typeof t.employee === "object" ? t.employee?.name : t.employee) || "Salman",
            route: `${t.from_location} → ${t.to_location}`,
            purpose: t.purpose || "Field Visit",
            customer: t.customer || "Institution",
            km: Number(t.km) || 0,
            allowance: Number(t.allowance) || 0,
            status: t.status || "Submitted",
          }));
          setTRows(live);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchTravels();
  }, []);

  const reports: Report[] = useMemo(() => [
    { key: "trips", label: "Trip register", cols: [{ key: "id", header: "Trip" }, { key: "date", header: "Date" }, { key: "employee", header: "Employee" }, { key: "route", header: "Route" }, { key: "purpose", header: "Purpose" }, { key: "km", header: "Km", kind: "num", total: true }, { key: "allowance", header: "Allowance", kind: "inr", total: true }, { key: "status", header: "Status", kind: "status" }], raw: tRows, date: "iso", filters: ["employee", "purpose", "status"], search: ["route", "customer"], onGenerate: fetchTravels },
    { key: "employee", label: "Allowance by employee", cols: [{ key: "employee", header: "Employee" }, { key: "count", header: "Trips", kind: "num" }, { key: "km", header: "Km", kind: "num", total: true }, { key: "allowance", header: "Allowance", kind: "inr", total: true }], raw: tRows, date: "iso", aggregate: (r) => sortBy("allowance")(groupBy(r, "employee", ["km", "allowance"])), chart: { x: "employee", y: "allowance" }, onGenerate: fetchTravels },
    { key: "purpose", label: "Travel by purpose", cols: [{ key: "purpose", header: "Purpose" }, { key: "count", header: "Trips", kind: "num", total: true }, { key: "km", header: "Km", kind: "num", total: true }], raw: tRows, date: "iso", aggregate: (r) => sortBy("count")(groupBy(r, "purpose", ["km"])), chart: { x: "purpose", y: "count" }, onGenerate: fetchTravels },
  ], [tRows]);

  return <ReportView title="Travel reports" description="Trips, distance and travel allowance by employee and purpose." reports={reports} />;
}

export function ProfitabilityReports() {
  const [lines, setLines] = useState<Row[]>(salesLines);

  const fetchProfitability = () => {
    api.get<any>("/sales/invoices/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        if (list.length > 0) {
          const liveLines: Row[] = list.flatMap((v: any) => {
            const itemsList = Array.isArray(v.lines) ? v.lines : (Array.isArray(v.items) ? v.items : []);
            if (itemsList.length === 0) {
              const rev = Math.round(Number(v.taxable_amount || v.total_amount || 0));
              return [{
                iso: v.invoice_date || v.date,
                date: v.invoice_date || v.date,
                invoice: v.code || `INV-${v.id}`,
                customer: v.customer_name || "Customer",
                customerType: "Business",
                salesperson: v.salesperson || "Staff",
                product: "General Product",
                category: "ID cards",
                qty: 1,
                revenue: rev,
                tax: Math.round(Number(v.tax_amount || 0)),
                cost: Math.round(rev * 0.46),
                status: v.status || "Paid",
              }];
            }
            return itemsList.map((l: any) => {
              const category = catOf(l.item_code || l.code || "");
              const revenue = Math.round(Number(l.taxable_amount || l.line_total || 0));
              return {
                iso: v.invoice_date || v.date,
                date: v.invoice_date || v.date,
                invoice: v.code || `INV-${v.id}`,
                customer: v.customer_name || "Customer",
                customerType: "Business",
                salesperson: v.salesperson || "Staff",
                product: l.item_name || "Product",
                category,
                qty: Number(l.quantity) || 1,
                revenue,
                tax: Math.round(Number(l.tax_amount || 0)),
                cost: Math.round(revenue * (costRatio[category] || 0.46)),
                status: v.status || "Paid",
              };
            });
          });
          setLines(liveLines);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchProfitability();
  }, []);

  const reports: Report[] = useMemo(() => [
    { key: "product", label: "Product profitability", description: "Cost = material + direct labour estimate per category.", cols: profCols("product", "Product"), raw: lines, date: "iso", filters: ["product", "customer", "category"], aggregate: (r) => sortBy("profit")(groupBy(r, "product", ["revenue", "cost"], withMargin)), chart: { x: "product", y: "profit" }, onGenerate: fetchProfitability },
    { key: "customer", label: "Customer profitability", cols: profCols("customer", "Customer"), raw: lines, date: "iso", filters: ["customer", "product", "category"], search: ["customer"], aggregate: (r) => sortBy("profit")(groupBy(r, "customer", ["revenue", "cost"], withMargin)), chart: { x: "customer", y: "profit" }, onGenerate: fetchProfitability },
    { key: "category", label: "Category profitability", cols: profCols("category", "Category"), raw: lines, date: "iso", filters: ["customer", "customerType"], aggregate: (r) => sortBy("profit")(groupBy(r, "category", ["revenue", "cost"], withMargin)), chart: { x: "category", y: "profit" }, onGenerate: fetchProfitability },
  ], [lines]);

  return <ReportView title="Profitability" description="Revenue, cost, gross profit and margin by product, customer and category." reports={reports} />;
}

// ---------- Dashboard ----------
const cards = [
  { slug: "sales", label: "Sales", icon: ReceiptIndianRupee, count: 7 },
  { slug: "purchase", label: "Purchase", icon: ShoppingCart, count: purchaseReports.length },
  { slug: "inventory", label: "Inventory", icon: Boxes, count: inventoryReports.length },
  { slug: "manufacturing", label: "Manufacturing", icon: Factory, count: manufacturingReports.length },
  { slug: "accounting", label: "Accounting", icon: Calculator, count: accountingReports.length },
  { slug: "gst", label: "GST", icon: Landmark, count: gstReports.length },
  { slug: "customers", label: "Customers", icon: Building2, count: customerReports.length },
  { slug: "employees", label: "Employees", icon: Users, count: 3 },
  { slug: "payroll", label: "Payroll", icon: Wallet, count: payrollReports.length },
  { slug: "travel", label: "Travel", icon: Car, count: travelReports.length },
  { slug: "profitability", label: "Profitability", icon: TrendingUp, count: profitReports.length },
];

export function ReportsDashboard() {
  const [liveRevenue, setLiveRevenue] = useState<number>(0);
  const [liveCost, setLiveCost] = useState<number>(0);
  const [livePurchases, setLivePurchases] = useState<number>(0);
  const [liveStockVal, setLiveStockVal] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [invoiceCount, setInvoiceCount] = useState<number>(0);
  const [billCount, setBillCount] = useState<number>(0);
  const [categoryData, setCategoryData] = useState<{ category: string; revenue: number; cost: number; margin: number }[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ m: string; sales: number; purchase: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<any>("/sales/invoices/").catch(() => []),
      api.get<any>("/purchases/bills/").catch(() => []),
      api.get<any>("/catalog/valuation/").catch(() => []),
    ]).then(([invRes, billRes, valRes]) => {
      if (cancelled) return;
      const invList: any[] = Array.isArray(invRes) ? invRes : (invRes?.results ?? []);
      const billList: any[] = Array.isArray(billRes) ? billRes : (billRes?.results ?? []);
      const valList: any[] = Array.isArray(valRes) ? valRes : (valRes?.results ?? []);

      setInvoiceCount(invList.length);
      setBillCount(billList.length);

      // 1. Real revenue from live invoices
      const rev = invList.reduce((acc: number, v: any) => acc + Number(v.taxable_amount ?? v.total_amount ?? 0), 0);
      setLiveRevenue(rev);

      // 2. Real purchases from live supplier bills
      const pur = billList.reduce((acc: number, b: any) => acc + Number(b.taxable_amount ?? b.total_amount ?? 0), 0);
      setLivePurchases(pur);

      // 3. Real stock valuation and low stock alerts
      const sVal = valList.reduce((acc: number, item: any) => acc + Number(item.value ?? (Number(item.current_stock ?? item.stock ?? 0) * Number(item.unit_cost ?? item.purchase_price ?? 0))), 0);
      const low = valList.filter((item: any) => Number(item.stock ?? item.current_stock ?? 0) <= Number(item.reorder_level ?? item.min_stock_alert ?? 50)).length;
      setLiveStockVal(sVal);
      setLowStockCount(low);

      // 4. Real category revenue breakdown from actual invoice lines
      const catMap: Record<string, { revenue: number; cost: number }> = {};
      let totalLineCost = 0;

      for (const inv of invList) {
        const lines: any[] = inv.lines ?? [];
        for (const l of lines) {
          const cat = l.item_category || (l.item_code ? catOf(l.item_code) : (l.item_name || "General"));
          const lineRev = Number(l.taxable_amount ?? l.gross_amount ?? (Number(l.quantity || 0) * Number(l.unit_price || 0)));
          const ratio = costRatio[cat] ?? 0.45;
          const lineCost = Math.round(lineRev * ratio);
          totalLineCost += lineCost;

          if (!catMap[cat]) catMap[cat] = { revenue: 0, cost: 0 };
          catMap[cat]!.revenue += lineRev;
          catMap[cat]!.cost += lineCost;
        }
      }

      setLiveCost(totalLineCost);

      const catArr = Object.entries(catMap).map(([category, val]) => {
        const margin = val.revenue > 0 ? ((val.revenue - val.cost) / val.revenue) * 100 : 0;
        return { category, revenue: val.revenue, cost: val.cost, margin };
      }).sort((a, b) => b.revenue - a.revenue);
      setCategoryData(catArr);

      // 5. Real 3-month sales vs purchases
      const now = new Date();
      const mArr = [2, 1, 0].map((offset) => {
        const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        const isoPrefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const mLabel = d.toLocaleString("en-IN", { month: "short" });
        const s = invList.filter((r) => String(r.invoice_date || "").startsWith(isoPrefix)).reduce((acc, r) => acc + Number(r.taxable_amount ?? r.total_amount ?? 0), 0);
        const p = billList.filter((r) => String(r.bill_date || "").startsWith(isoPrefix)).reduce((acc, r) => acc + Number(r.taxable_amount ?? r.total_amount ?? 0), 0);
        return { m: mLabel, sales: s, purchase: p };
      });
      setMonthlyData(mArr);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const marginPct = liveRevenue > 0 ? (((liveRevenue - liveCost) / liveRevenue) * 100).toFixed(1) : "0.0";

  return (
    <>
      <SectionHeader title="Reports & analytics" description="Live financial and operations reporting connected to real Django backend records with printable letterheads and CSV/Excel exports." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Sales (taxable)" value={inr(liveRevenue)} hint={`${invoiceCount} live backend invoice${invoiceCount === 1 ? "" : "s"}`} />
        <KpiCard label="Gross profit" value={inr(liveRevenue - liveCost)} hint={`${marginPct}% margin`} tone="up" />
        <KpiCard label="Purchases" value={inr(livePurchases)} hint={`${billCount} live supplier bill${billCount === 1 ? "" : "s"}`} />
        <KpiCard label="Stock value" value={inr(liveStockVal)} hint={`${lowStockCount} items below minimum`} tone="down" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.slug} to="/reports/$section" params={{ section: c.slug }} className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent/50 hover:bg-muted/40">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><c.icon className="size-4" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{c.label} reports</span><span className="block text-xs text-muted-foreground">{c.count} reports</span></span>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Sales vs purchases" description="Last 3 months (Live transactions)" className="xl:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="m" {...axis} />
                <YAxis {...axis} tickFormatter={k} width={60} />
                <RTooltip contentStyle={tip} formatter={(v) => inr(Number(v))} />
                <Bar dataKey="sales" name="Sales" fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="purchase" name="Purchases" fill="var(--color-chart-3)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Revenue by category" description="From actual invoice lines">
          {categoryData.length > 0 ? (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} dataKey="revenue" nameKey="category" innerRadius={45} outerRadius={70} paddingAngle={2}>
                      {categoryData.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                    </Pie>
                    <RTooltip contentStyle={tip} formatter={(v) => inr(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1.5 text-sm">
                {categoryData.map((c, i) => (
                  <li key={c.category} className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: chartColors[i % chartColors.length] }} />
                    <span className="flex-1 truncate">{c.category}</span>
                    <span className="tabular text-muted-foreground">{c.margin.toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="flex h-44 flex-col items-center justify-center text-center text-xs text-muted-foreground">
              <p>{loading ? "Loading category breakdown..." : "No invoice items recorded yet."}</p>
            </div>
          )}
        </Panel>
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><BarChart3 className="size-3.5" /> All reports support date filtering, printable letterheads, and instant CSV / Excel exports.</p>
    </>
  );
}
