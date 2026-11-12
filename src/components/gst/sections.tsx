import { useEffect, useMemo, useState } from "react";
import { Download, FileCheck2, Loader2, Mail, Play } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { EmptyState, KpiCard, Panel, StatusBadge } from "@/components/erp/primitives";
import { DataTable, DetailGrid, FormGrid, type Column } from "@/components/erp/DataTable";
import { ExportButtons, ReportToolbar, SectionHeader } from "@/components/erp/ModuleLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr } from "@/lib/format";
import { companyConfig as company } from "@/config/company";
import { api } from "@/lib/api";
import { ExportPreferencesPanel, FinanceRecipientsPanel, historyStore } from "./gst-export";

export type GstLineItem = {
  hsn: string;
  item: string;
  quantity: number;
  rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
};

export type GstInvoice = {
  id: string;
  party: string;
  place: string;
  gstin: string;
  date: string;
  iso: string;
  hsn: string;
  item: string;
  taxable: number;
  rate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  status: string;
  lines?: GstLineItem[];
};

const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);
const lakh = (n: number) => `₹${(n / 100000).toFixed(1)}L`;
const tip = { borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 };
const Muted = ({ children }: { children: React.ReactNode }) => <span className="text-muted-foreground">{children}</span>;
export const taxOf = (r: GstInvoice) => r.cgst + r.sgst + r.igst;

export function useLiveGstData() {
  const [sales, setSales] = useState<GstInvoice[]>([]);
  const [purchases, setPurchases] = useState<GstInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    Promise.allSettled([
      api.get<any>("/sales/invoices/"),
      api.get<any>("/purchases/bills/"),
    ]).then(([salesRes, billsRes]) => {
      if (salesRes.status === "fulfilled") {
        const list = Array.isArray(salesRes.value) ? salesRes.value : (salesRes.value?.results ?? []);
        const mapped: GstInvoice[] = list.map((inv: any) => {
          const dt = inv.invoice_date || inv.date || new Date().toISOString().slice(0, 10);
          const rawLines: any[] = Array.isArray(inv.lines) ? inv.lines : [];

          const parsedLines: GstLineItem[] = rawLines.map((l: any) => {
            const qty = Number(l.quantity ?? 1);
            const price = Number(l.unit_price ?? 0);
            const disc = Number(l.discount_amount ?? l.discount ?? 0);
            const lTaxable = Number(l.taxable_amount ?? (qty * price - disc));
            const lCgst = Number(l.cgst_amount ?? 0);
            const lSgst = Number(l.sgst_amount ?? 0);
            const lIgst = Number(l.igst_amount ?? 0);
            const lTax = lCgst + lSgst + lIgst || Number(l.tax_amount ?? 0);
            const lRate = l.tax_rate != null ? Number(l.tax_rate) : (lTaxable > 0 ? Math.round((lTax / lTaxable) * 100) : 18);
            const lTotal = Number(l.line_total ?? l.total_amount ?? (lTaxable + lTax));
            return {
              hsn: l.hsn_code || l.item_code || "3926",
              item: l.item_name || l.description || "Standard Goods",
              quantity: qty,
              rate: lRate,
              taxable: lTaxable,
              cgst: lCgst,
              sgst: lSgst,
              igst: lIgst,
              total: lTotal,
            };
          });

          const sumTaxable = parsedLines.reduce((acc, l) => acc + l.taxable, 0);
          const sumCgst = parsedLines.reduce((acc, l) => acc + l.cgst, 0);
          const sumSgst = parsedLines.reduce((acc, l) => acc + l.sgst, 0);
          const sumIgst = parsedLines.reduce((acc, l) => acc + l.igst, 0);
          const sumTotal = parsedLines.reduce((acc, l) => acc + l.total, 0);

          const taxable = parsedLines.length > 0 && sumTaxable > 0 ? sumTaxable : Number(inv.taxable_amount ?? 0);
          const cgst = parsedLines.length > 0 && (sumCgst > 0 || sumSgst > 0 || sumIgst > 0) ? sumCgst : Number(inv.cgst_amount ?? 0);
          const sgst = parsedLines.length > 0 && (sumCgst > 0 || sumSgst > 0 || sumIgst > 0) ? sumSgst : Number(inv.sgst_amount ?? 0);
          const igst = parsedLines.length > 0 && (sumCgst > 0 || sumSgst > 0 || sumIgst > 0) ? sumIgst : Number(inv.igst_amount ?? 0);
          const total = parsedLines.length > 0 && sumTotal > 0 ? sumTotal : Number(inv.total_amount ?? 0);
          const tax = cgst + sgst + igst || Number(inv.tax_amount ?? 0);

          const hsnList = Array.from(new Set(parsedLines.map((l) => l.hsn).filter(Boolean)));
          const hsnStr = hsnList.length > 0 ? hsnList.join(", ") : (inv.lines?.[0]?.hsn_code || inv.lines?.[0]?.item_code || "3926");
          const itemList = Array.from(new Set(parsedLines.map((l) => l.item).filter(Boolean)));
          const itemStr = itemList.length > 0 ? (itemList.length > 2 ? `${itemList.slice(0, 2).join(", ")} (+${itemList.length - 2} more)` : itemList.join(", ")) : "Standard Goods";
          const rate = taxable > 0 ? Math.round((tax / taxable) * 100) : (parsedLines[0]?.rate ?? 18);

          return {
            id: inv.code || `INV-${inv.id}`,
            party: inv.customer_name || "Customer",
            place: inv.customer_city || "Kerala (32)",
            gstin: inv.customer_gstin || "URP",
            date: dt,
            iso: dt,
            hsn: hsnStr,
            item: itemStr,
            taxable,
            rate,
            cgst,
            sgst,
            igst,
            total,
            status: inv.status === "Confirmed" ? "Filed" : (inv.status || "Draft"),
            lines: parsedLines,
          };
        });
        setSales(mapped);
      } else {
        setSales([]);
      }

      if (billsRes.status === "fulfilled") {
        const list = Array.isArray(billsRes.value) ? billsRes.value : (billsRes.value?.results ?? []);
        const mapped: GstInvoice[] = list.map((b: any) => {
          const dt = b.bill_date || b.date || new Date().toISOString().slice(0, 10);
          const rawLines: any[] = Array.isArray(b.lines) ? b.lines : [];

          const parsedLines: GstLineItem[] = rawLines.map((l: any) => {
            const qty = Number(l.quantity ?? 1);
            const price = Number(l.unit_price ?? 0);
            const disc = Number(l.discount_amount ?? l.discount ?? 0);
            const lTaxable = Number(l.taxable_amount ?? (qty * price - disc));
            const lCgst = Number(l.cgst_amount ?? 0);
            const lSgst = Number(l.sgst_amount ?? 0);
            const lIgst = Number(l.igst_amount ?? 0);
            const lTax = lCgst + lSgst + lIgst || Number(l.tax_amount ?? 0);
            const lRate = l.tax_rate != null ? Number(l.tax_rate) : (lTaxable > 0 ? Math.round((lTax / lTaxable) * 100) : 18);
            const lTotal = Number(l.line_total ?? l.total_amount ?? (lTaxable + lTax));
            return {
              hsn: l.hsn_code || "3920",
              item: l.item_name || l.description || "Raw Materials & Supplies",
              quantity: qty,
              rate: lRate,
              taxable: lTaxable,
              cgst: lCgst,
              sgst: lSgst,
              igst: lIgst,
              total: lTotal,
            };
          });

          const sumTaxable = parsedLines.reduce((acc, l) => acc + l.taxable, 0);
          const sumCgst = parsedLines.reduce((acc, l) => acc + l.cgst, 0);
          const sumSgst = parsedLines.reduce((acc, l) => acc + l.sgst, 0);
          const sumIgst = parsedLines.reduce((acc, l) => acc + l.igst, 0);
          const sumTotal = parsedLines.reduce((acc, l) => acc + l.total, 0);

          const taxable = parsedLines.length > 0 && sumTaxable > 0 ? sumTaxable : Number(b.taxable_amount ?? 0);
          const cgst = parsedLines.length > 0 && (sumCgst > 0 || sumSgst > 0 || sumIgst > 0) ? sumCgst : Number(b.cgst_amount ?? 0);
          const sgst = parsedLines.length > 0 && (sumCgst > 0 || sumSgst > 0 || sumIgst > 0) ? sumSgst : Number(b.sgst_amount ?? 0);
          const igst = parsedLines.length > 0 && (sumCgst > 0 || sumSgst > 0 || sumIgst > 0) ? sumIgst : Number(b.igst_amount ?? 0);
          const total = parsedLines.length > 0 && sumTotal > 0 ? sumTotal : Number(b.total_amount ?? 0);
          const tax = cgst + sgst + igst || Number(b.tax_amount ?? 0);

          const hsnList = Array.from(new Set(parsedLines.map((l) => l.hsn).filter(Boolean)));
          const hsnStr = hsnList.length > 0 ? hsnList.join(", ") : (b.lines?.[0]?.hsn_code || "3920");
          const itemList = Array.from(new Set(parsedLines.map((l) => l.item).filter(Boolean)));
          const itemStr = itemList.length > 0 ? (itemList.length > 2 ? `${itemList.slice(0, 2).join(", ")} (+${itemList.length - 2} more)` : itemList.join(", ")) : "Raw Materials & Supplies";
          const rate = taxable > 0 ? Math.round((tax / taxable) * 100) : (parsedLines[0]?.rate ?? 18);

          return {
            id: b.code || `BILL-${b.id}`,
            party: b.supplier_name || "Supplier",
            place: b.supplier_gstin?.startsWith("32") ? "Kerala (32)" : "Other state",
            gstin: b.supplier_gstin || "URP",
            date: dt,
            iso: dt,
            hsn: hsnStr,
            item: itemStr,
            taxable,
            rate,
            cgst,
            sgst,
            igst,
            total,
            status: b.supplier_gstin && b.supplier_gstin !== "URP" ? "Matched" : "Pending",
            lines: parsedLines,
          };
        });
        setPurchases(mapped);
      } else {
        setPurchases([]);
      }
      setLoading(false);
    }).catch(() => {
      setSales([]);
      setPurchases([]);
      setLoading(false);
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  return { sales, purchases, loading, refresh };
}

export function GstOverview() {
  const { sales, purchases } = useLiveGstData();

  const out = sum(sales, taxOf);
  const inp = sum(purchases, taxOf);
  const taxableSales = sum(sales, (x) => x.taxable);
  const taxablePurchases = sum(purchases, (x) => x.taxable);

  const rates = [0, 5, 12, 18, 28].map((r) => ({
    rate: `${r}%`,
    output: sum(sales.filter((x) => x.rate === r), taxOf),
    input: sum(purchases.filter((x) => x.rate === r), taxOf),
  }));

  const split = [
    { name: "CGST", value: sum(sales, (x) => x.cgst) },
    { name: "SGST", value: sum(sales, (x) => x.sgst) },
    { name: "IGST", value: sum(sales, (x) => x.igst) },
  ];
  const colors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)"];

  const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const monthlyData = months.map((m) => {
    const sMonth = sales.filter((s) => {
      const d = new Date(s.iso);
      return !isNaN(d.getTime()) && d.toLocaleString("en-US", { month: "short" }) === m;
    });
    const pMonth = purchases.filter((p) => {
      const d = new Date(p.iso);
      return !isNaN(d.getTime()) && d.toLocaleString("en-US", { month: "short" }) === m;
    });
    return {
      month: m,
      output: sum(sMonth, taxOf),
      input: sum(pMonth, taxOf),
    };
  });

  const gstReturns = [
    { form: "GSTR-1", desc: "Outward supplies — invoice-wise details", period: "Current FY", due: "11th of month", status: sales.length > 0 ? "Ready" : "Pending", count: `${sales.length} invoices` },
    { form: "GSTR-2B", desc: "Auto-drafted ITC statement", period: "Current FY", due: "14th of month", status: purchases.length > 0 ? "Matched" : "Draft", count: `${purchases.length} bills` },
    { form: "GSTR-3B", desc: "Summary return with tax payment", period: "Current FY", due: "20th of month", status: out > 0 ? "Pending" : "Draft", count: inr(Math.max(0, out - inp)) },
  ];

  return (
    <>
      <SectionHeader title="GST overview" description={`GSTIN ${company.gstin} · ${company.state} · Monthly filer · FY ${company.fy}`} actions={<ExportButtons />} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Output GST" value={inr(out)} hint={`${sales.length} outward invoice(s)`} />
        <KpiCard label="Input GST" value={inr(inp)} hint={`${purchases.length} inward bill(s)`} />
        <KpiCard label="Net GST payable" value={inr(Math.max(0, out - inp))} hint={out >= inp ? "Payable by 20th" : "ITC carry-forward"} tone={out > inp ? "down" : "up"} />
        <KpiCard label="Taxable sales" value={inr(taxableSales)} />
        <KpiCard label="Taxable purchases" value={inr(taxablePurchases)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Monthly GST trend" description={`Output vs input tax, FY ${company.fy}`} className="xl:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ left: -12, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={lakh} tickLine={false} axisLine={false} fontSize={12} />
                <RTooltip formatter={(v: number) => inr(v)} contentStyle={tip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="output" name="Output GST" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="input" name="Input GST" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Output tax split" description="CGST / SGST / IGST">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={split.some((x) => x.value > 0) ? split : [{ name: "Zero", value: 1 }]} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {split.map((_, i) => <Cell key={i} fill={colors[i]} />)}
                </Pie>
                <RTooltip formatter={(v: number) => inr(v)} contentStyle={tip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="GST by rate">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rates} margin={{ left: -12, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="rate" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={lakh} tickLine={false} axisLine={false} fontSize={12} />
                <RTooltip formatter={(v: number) => inr(v)} contentStyle={tip} />
                <Bar dataKey="output" name="Output" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="input" name="Input" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Return filing status" bodyClassName="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="hidden sm:table-cell">Due date</TableHead>
                <TableHead className="text-right">Activity / Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gstReturns.map((r) => (
                <TableRow key={r.form}>
                  <TableCell className="font-medium">{r.form}</TableCell>
                  <TableCell>{r.period}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{r.due}</TableCell>
                  <TableCell className="text-right tabular text-muted-foreground">{r.count}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </div>
    </>
  );
}

function gstColumns(partyLabel: string): Column<GstInvoice>[] {
  return [
    { key: "id", header: "Voucher", sort: (r) => r.id, render: (r) => <span className="font-medium">{r.id}</span> },
    { key: "party", header: partyLabel, sort: (r) => r.party, render: (r) => <div><div>{r.party}</div><div className="font-mono text-[11px] text-muted-foreground">{r.gstin}</div></div> },
    { key: "date", header: "Date", sort: (r) => r.iso, render: (r) => <Muted>{r.date}</Muted> },
    { key: "taxable", header: "Taxable", align: "right", sort: (r) => r.taxable, render: (r) => inr(r.taxable) },
    { key: "rate", header: "Rate", align: "right", className: "hidden md:table-cell", render: (r) => <Muted>{r.rate}%</Muted> },
    { key: "cgst", header: "CGST", align: "right", className: "hidden lg:table-cell", render: (r) => (r.cgst ? inr(r.cgst) : "—") },
    { key: "sgst", header: "SGST", align: "right", className: "hidden lg:table-cell", render: (r) => (r.sgst ? inr(r.sgst) : "—") },
    { key: "igst", header: "IGST", align: "right", className: "hidden lg:table-cell", render: (r) => (r.igst ? inr(r.igst) : "—") },
    { key: "total", header: "Total", align: "right", sort: (r) => r.total, render: (r) => <span className="font-medium">{inr(r.total)}</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];
}

const gstDetail = (r: GstInvoice) => (
  <DetailGrid items={[
    ["Party", `${r.party}, ${r.place}`],
    ["GSTIN", r.gstin],
    ["Invoice date", r.date],
    ["HSN/SAC", `${r.hsn} · ${r.item}`],
    ["Taxable value", inr(r.taxable)],
    ["GST rate", `${r.rate}%`],
    ["CGST", inr(r.cgst)],
    ["SGST", inr(r.sgst)],
    ["IGST", inr(r.igst)],
    ["Invoice total", inr(r.total)],
    ["Supply type", r.igst ? "Interstate" : "Intra-state (Kerala)"],
    ["Status", <StatusBadge key="s" status={r.status} />],
  ]} />
);

const gstForm = (r: GstInvoice | null) => (
  <FormGrid fields={[
    { label: "Party", value: r?.party, wide: true },
    { label: "GSTIN", value: r?.gstin },
    { label: "Invoice date", value: r?.iso ?? new Date().toISOString().slice(0, 10), type: "date" },
    { label: "HSN/SAC", value: r?.hsn },
    { label: "GST rate", value: r ? `${r.rate}%` : "18%", options: ["0%", "5%", "12%", "18%", "28%"] },
    { label: "Taxable value (₹)", value: r?.taxable, type: "number" },
    { label: "Place of supply", value: r?.place || "Kerala (32)", options: ["Kerala (32)", "Tamil Nadu (33)", "Karnataka (29)", "Other state"] },
  ]} />
);

function GstTable({ rows, partyLabel, title, description }: { rows: GstInvoice[]; partyLabel: string; title: string; description: string }) {
  return (
    <>
      <SectionHeader title={title} description={description} actions={<ExportButtons />} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Taxable value" value={inr(sum(rows, (r) => r.taxable))} />
        <KpiCard label="CGST" value={inr(sum(rows, (r) => r.cgst))} />
        <KpiCard label="SGST" value={inr(sum(rows, (r) => r.sgst))} />
        <KpiCard label="IGST" value={inr(sum(rows, (r) => r.igst))} />
        <KpiCard label="Total tax" value={inr(sum(rows, taxOf))} />
      </div>
      <DataTable
        rows={rows}
        getId={(r) => r.id}
        entity="voucher"
        columns={gstColumns(partyLabel)}
        search={(r) => `${r.id} ${r.party} ${r.gstin} ${r.hsn}`}
        searchPlaceholder="Search invoice, party or GSTIN"
        filters={[{ label: "Rates", get: (r) => `${r.rate}%` }, { label: "Status", get: (r) => r.status }]}
        detail={gstDetail}
        form={gstForm}
        footer={(rs) => (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Total ({rs.length} records)</TableCell>
              <TableCell className="text-right tabular">{inr(sum(rs, (r) => r.taxable))}</TableCell>
              <TableCell className="hidden md:table-cell" />
              <TableCell className="hidden text-right tabular lg:table-cell">{inr(sum(rs, (r) => r.cgst))}</TableCell>
              <TableCell className="hidden text-right tabular lg:table-cell">{inr(sum(rs, (r) => r.sgst))}</TableCell>
              <TableCell className="hidden text-right tabular lg:table-cell">{inr(sum(rs, (r) => r.igst))}</TableCell>
              <TableCell className="text-right tabular">{inr(sum(rs, (r) => r.total))}</TableCell>
              <TableCell colSpan={2} />
            </TableRow>
          </TableFooter>
        )}
      />
    </>
  );
}

export function SalesGst() {
  const { sales } = useLiveGstData();
  return <GstTable rows={sales} partyLabel="Customer" title="Sales GST" description="Outward supplies with CGST/SGST for Kerala and IGST for interstate customers from live invoices." />;
}

export function PurchaseGst() {
  const { purchases } = useLiveGstData();
  return <GstTable rows={purchases} partyLabel="Supplier" title="Purchase GST" description="Inward supplies matched against supplier bills and GSTR-2B filings." />;
}

function TaxLedger({ kind }: { kind: "input" | "output" }) {
  const { sales, purchases } = useLiveGstData();
  const rows = kind === "input" ? purchases : sales;
  const heads = ["CGST", "SGST", "IGST"] as const;
  const val = (h: (typeof heads)[number], rs: GstInvoice[]) => sum(rs, (r) => (h === "CGST" ? r.cgst : h === "SGST" ? r.sgst : r.igst));
  const eligible = kind === "input" ? rows.filter((r) => r.status !== "Mismatch" && r.gstin !== "URP") : rows;

  return (
    <>
      <SectionHeader
        title={kind === "input" ? "Input tax" : "Output tax"}
        description={kind === "input" ? "Input tax credit available from live purchases, with ineligible/unregistered ITC held back." : "Tax collected on live outward sales supplies, by tax head."}
      />
      <ReportToolbar />
      <div className="grid gap-4 sm:grid-cols-3">
        {heads.map((h) => (
          <KpiCard
            key={h}
            label={h}
            value={inr(val(h, eligible))}
            hint={kind === "input" && val(h, rows) !== val(h, eligible) ? `${inr(val(h, rows) - val(h, eligible))} on hold` : undefined}
            tone="down"
          />
        ))}
      </div>
      <Panel title="Tax by rate" bodyClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rate</TableHead>
              <TableHead className="text-right">Invoices</TableHead>
              <TableHead className="text-right">Taxable</TableHead>
              {heads.map((h) => <TableHead key={h} className="text-right">{h}</TableHead>)}
              <TableHead className="text-right">Total tax</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[0, 5, 12, 18, 28].map((rate) => {
              const rs = eligible.filter((r) => r.rate === rate);
              return (
                <TableRow key={rate}>
                  <TableCell className="font-medium">{rate}%</TableCell>
                  <TableCell className="text-right tabular">{rs.length}</TableCell>
                  <TableCell className="text-right tabular">{inr(sum(rs, (r) => r.taxable))}</TableCell>
                  {heads.map((h) => <TableCell key={h} className="text-right tabular">{inr(val(h, rs))}</TableCell>)}
                  <TableCell className="text-right tabular font-medium">{inr(sum(rs, taxOf))}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total</TableCell>
              <TableCell className="text-right tabular">{eligible.length}</TableCell>
              <TableCell className="text-right tabular">{inr(sum(eligible, (r) => r.taxable))}</TableCell>
              {heads.map((h) => <TableCell key={h} className="text-right tabular">{inr(val(h, eligible))}</TableCell>)}
              <TableCell className="text-right tabular">{inr(sum(eligible, taxOf))}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Panel>
      {kind === "input" ? (
        <Panel title="ITC on hold / Unregistered" description="Supplier bills pending GSTIN verification or reconciliation" bodyClassName="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.filter((r) => r.status === "Mismatch" || r.gstin === "URP").length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                    No ineligible ITC or mismatched invoices on hold.
                  </TableCell>
                </TableRow>
              ) : (
                rows.filter((r) => r.status === "Mismatch" || r.gstin === "URP").map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.id}</TableCell>
                    <TableCell>{r.party}</TableCell>
                    <TableCell className="text-right tabular">{inr(taxOf(r))}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Panel>
      ) : null}
    </>
  );
}

export const InputTax = () => <TaxLedger kind="input" />;
export const OutputTax = () => <TaxLedger kind="output" />;

export function HsnSummary() {
  const { sales } = useLiveGstData();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const map = new Map<string, { code: string; desc: string; uqc: string; rate: number; count: number; taxable: number; cgst: number; sgst: number; igst: number }>();
    sales.forEach((s) => {
      if (s.lines && s.lines.length > 0) {
        s.lines.forEach((l) => {
          const code = l.hsn || "3926";
          const existing = map.get(code) || {
            code,
            desc: l.item || "Standard Product Supplies",
            uqc: "NOS",
            rate: l.rate,
            count: 0,
            taxable: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
          };
          existing.count += 1;
          existing.taxable += l.taxable;
          existing.cgst += l.cgst;
          existing.sgst += l.sgst;
          existing.igst += l.igst;
          map.set(code, existing);
        });
      } else {
        const code = s.hsn || "3926";
        const existing = map.get(code) || {
          code,
          desc: s.item || "Standard Product Supplies",
          uqc: "NOS",
          rate: s.rate,
          count: 0,
          taxable: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
        };
        existing.count += 1;
        existing.taxable += s.taxable;
        existing.cgst += s.cgst;
        existing.sgst += s.sgst;
        existing.igst += s.igst;
        map.set(code, existing);
      }
    });
    return Array.from(map.values()).filter((r) => `${r.code} ${r.desc}`.toLowerCase().includes(q.toLowerCase()));
  }, [sales, q]);

  return (
    <>
      <SectionHeader title="HSN / SAC summary" description="Outward supplies summarised by HSN and SAC code for GSTR-1 Table 12." />
      <ReportToolbar onSearch={setQ} />
      <Panel bodyClassName="p-0">
        {rows.length === 0 ? (
          <div className="p-8">
            <EmptyState title="No HSN data found" description="No sales invoices with HSN details found in the system." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>HSN/SAC</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>UQC</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead className="text-right">Taxable</TableHead>
                  <TableHead className="text-right">CGST</TableHead>
                  <TableHead className="text-right">SGST</TableHead>
                  <TableHead className="text-right">IGST</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="font-mono text-xs font-medium">{r.code}</TableCell>
                    <TableCell>{r.desc}</TableCell>
                    <TableCell className="text-muted-foreground">{r.uqc}</TableCell>
                    <TableCell className="text-right tabular">{r.rate}%</TableCell>
                    <TableCell className="text-right tabular">{r.count}</TableCell>
                    <TableCell className="text-right tabular">{inr(r.taxable)}</TableCell>
                    <TableCell className="text-right tabular">{inr(r.cgst)}</TableCell>
                    <TableCell className="text-right tabular">{inr(r.sgst)}</TableCell>
                    <TableCell className="text-right tabular">{inr(r.igst)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4}>Total</TableCell>
                  <TableCell className="text-right tabular">{sum(rows, (r) => r.count)}</TableCell>
                  <TableCell className="text-right tabular">{inr(sum(rows, (r) => r.taxable))}</TableCell>
                  <TableCell className="text-right tabular">{inr(sum(rows, (r) => r.cgst))}</TableCell>
                  <TableCell className="text-right tabular">{inr(sum(rows, (r) => r.sgst))}</TableCell>
                  <TableCell className="text-right tabular">{inr(sum(rows, (r) => r.igst))}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </Panel>
    </>
  );
}

const reportTypes = [
  { id: "gstr1", name: "GSTR-1", desc: "Outward supplies — B2B, B2C, credit notes, HSN" },
  { id: "gstr2", name: "GSTR-2 / Purchase reconciliation", desc: "Match purchase register with GSTR-2B" },
  { id: "gstr3b", name: "GSTR-3B", desc: "Summary of outward, ITC and tax payable" },
  { id: "summary", name: "GST summary", desc: "Period summary by tax head and rate" },
  { id: "hsn", name: "HSN/SAC report", desc: "HSN-wise quantity and value" },
];

export function GstReports() {
  const { sales, purchases } = useLiveGstData();
  const [period, setPeriod] = useState("all");
  const [state, setState] = useState<Record<string, "idle" | "loading" | "ready">>({
    gstr1: "ready",
    gstr2: "ready",
    gstr3b: "ready",
    summary: "ready",
    hsn: "ready",
  });
  const [preview, setPreview] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [emailRecipient, setEmailRecipient] = useState("finance@example.com");

  const filteredSales = useMemo(() => {
    if (period === "all") return sales;
    return sales.filter((s) => s.iso.startsWith(period));
  }, [sales, period]);

  const filteredPurchases = useMemo(() => {
    if (period === "all") return purchases;
    return purchases.filter((p) => p.iso.startsWith(period));
  }, [purchases, period]);

  const out = sum(filteredSales, taxOf);
  const inp = sum(filteredPurchases.filter((r) => r.status !== "Mismatch" && r.gstin !== "URP"), taxOf);

  const generate = (id: string) => {
    setState((s) => ({ ...s, [id]: "loading" }));
    setTimeout(() => {
      setState((s) => ({ ...s, [id]: "ready" }));
      toast.success(`${reportTypes.find((r) => r.id === id)?.name} generated successfully`);
    }, 400);
  };

  const handleExportCsv = (id: string) => {
    let csv = "";
    const filename = `${id.toUpperCase()}_${period === "all" ? "Live" : period}.csv`;
    if (id === "gstr1" || id === "summary") {
      csv = "Invoice,Party,GSTIN,Date,Taxable,CGST,SGST,IGST,Total\r\n" +
        filteredSales.map((s) => `"${s.id}","${s.party}","${s.gstin}","${s.date}",${s.taxable},${s.cgst},${s.sgst},${s.igst},${s.total}`).join("\r\n");
    } else if (id === "gstr2") {
      csv = "Bill,Supplier,GSTIN,Date,Taxable,CGST,SGST,IGST,Total\r\n" +
        filteredPurchases.map((b) => `"${b.id}","${b.party}","${b.gstin}","${b.date}",${b.taxable},${b.cgst},${b.sgst},${b.igst},${b.total}`).join("\r\n");
    } else {
      csv = "Particulars,Taxable,CGST,SGST,IGST,Net\r\n" +
        `"Outward taxable supplies",${sum(filteredSales, (x) => x.taxable)},${sum(filteredSales, (x) => x.cgst)},${sum(filteredSales, (x) => x.sgst)},${sum(filteredSales, (x) => x.igst)},${out}\r\n` +
        `"Eligible Input Tax Credit",${sum(filteredPurchases, (x) => x.taxable)},${sum(filteredPurchases, (x) => x.cgst)},${sum(filteredPurchases, (x) => x.sgst)},${sum(filteredPurchases, (x) => x.igst)},${inp}\r\n` +
        `"Net Tax Payable",0,0,0,0,${Math.max(0, out - inp)}`;
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${filename} exported`);
  };

  const rep = reportTypes.find((r) => r.id === preview);

  return (
    <>
      <SectionHeader title="GST reports" description="Prepare return data from live transactions for filing and audit review." />
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <span className="text-sm text-muted-foreground">Return period</span>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Available Records</SelectItem>
            <SelectItem value="2026-10">October 2026</SelectItem>
            <SelectItem value="2026-09">September 2026</SelectItem>
            <SelectItem value="2026-08">August 2026</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reportTypes.map((r) => {
          const st = state[r.id] ?? "idle";
          return (
            <Panel key={r.id} bodyClassName="flex h-full flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{r.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.desc}</p>
                </div>
                {st === "ready" ? <StatusBadge status="Completed" /> : <StatusBadge status="Draft" />}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 pt-2">
                <Button size="sm" onClick={() => generate(r.id)} disabled={st === "loading"}>
                  {st === "loading" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} {st === "ready" ? "Regenerate" : "Generate"}
                </Button>
                <Button size="sm" variant="outline" disabled={st !== "ready"} onClick={() => setPreview(r.id)}>
                  <FileCheck2 className="size-4" /> Preview
                </Button>
                <Button size="sm" variant="outline" disabled={st !== "ready"} onClick={() => handleExportCsv(r.id)}>
                  <Download className="size-4" /> Export
                </Button>
                <Button size="sm" variant="ghost" disabled={st !== "ready"} onClick={() => setEmail(r.name)}>
                  <Mail className="size-4" /> Email
                </Button>
              </div>
            </Panel>
          );
        })}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{rep?.name} preview</DialogTitle>
            <DialogDescription>{company.name} · GSTIN {company.gstin} · Period: {period === "all" ? "Live Data" : period}</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Particulars</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">CGST</TableHead>
                <TableHead className="text-right">SGST</TableHead>
                <TableHead className="text-right">IGST</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Outward taxable supplies ({filteredSales.length} invoices)</TableCell>
                <TableCell className="text-right tabular">{inr(sum(filteredSales, (x) => x.taxable))}</TableCell>
                <TableCell className="text-right tabular">{inr(sum(filteredSales, (x) => x.cgst))}</TableCell>
                <TableCell className="text-right tabular">{inr(sum(filteredSales, (x) => x.sgst))}</TableCell>
                <TableCell className="text-right tabular">{inr(sum(filteredSales, (x) => x.igst))}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Eligible Input Tax Credit ({filteredPurchases.length} bills)</TableCell>
                <TableCell className="text-right tabular">{inr(sum(filteredPurchases, (x) => x.taxable))}</TableCell>
                <TableCell className="text-right tabular">{inr(sum(filteredPurchases, (x) => x.cgst))}</TableCell>
                <TableCell className="text-right tabular">{inr(sum(filteredPurchases, (x) => x.sgst))}</TableCell>
                <TableCell className="text-right tabular">{inr(sum(filteredPurchases, (x) => x.igst))}</TableCell>
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4}>Net tax payable (Output − Input)</TableCell>
                <TableCell className="text-right tabular font-bold">{inr(Math.max(0, out - inp))}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          <DialogFooter>
            {rep && (
              <Button onClick={() => handleExportCsv(rep.id)}>
                <Download className="mr-2 size-4" /> Download Report
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!email} onOpenChange={(o) => !o && setEmail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email {email}</DialogTitle>
            <DialogDescription>Send the generated report to your accountant or auditor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Recipient Email</label>
              <input
                type="email"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Subject</label>
              <input
                type="text"
                readOnly
                value={`${email} — ${company.name} — ${period}`}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-muted-foreground"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmail(null)}>Cancel</Button>
            <Button onClick={() => {
              historyStore.set((h) => [
                {
                  id: `GX-${Date.now().toString().slice(-4)}`,
                  file: `${email?.replace(/\s+/g, "-")}_${period}.xlsx`,
                  report: email || "GST Report",
                  period,
                  fy: company.fy,
                  rows: filteredSales.length + filteredPurchases.length,
                  size: "24 KB",
                  recipients: [emailRecipient],
                  status: "Sent",
                  by: "Current User",
                  at: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
                },
                ...h,
              ]);
              toast.success(`Report ${email} dispatched to ${emailRecipient}`);
              setEmail(null);
            }}>
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function GstSettings() {
  const [preferences, setPreferences] = useState(() => {
    try {
      const s = localStorage.getItem("gst_preferences");
      return s ? JSON.parse(s) : {
        einvoice: true,
        ewaybill: true,
        rcm: false,
        roundoff: true,
      };
    } catch {
      return { einvoice: true, ewaybill: true, rcm: false, roundoff: true };
    }
  });

  const toggle = (key: string, val: boolean) => {
    const updated = { ...preferences, [key]: val };
    setPreferences(updated);
    try {
      localStorage.setItem("gst_preferences", JSON.stringify(updated));
    } catch {}
    toast.success("Preference updated");
  };

  const handleSaveAll = () => {
    try {
      localStorage.setItem("gst_preferences", JSON.stringify(preferences));
    } catch {}
    toast.success("GST settings saved successfully");
  };

  return (
    <>
      <SectionHeader title="GST settings" description="Registration details, tax rates and invoice preferences." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Registration">
          <FormGrid fields={[
            { label: "Legal name", value: company.legalName, wide: true },
            { label: "GSTIN", value: company.gstin },
            { label: "State", value: `${company.state} (${company.stateCode})`, options: [`${company.state} (${company.stateCode})`] },
            { label: "Registration type", value: "Regular", options: ["Regular", "Composition"] },
            { label: "Filing frequency", value: "Monthly", options: ["Monthly", "Quarterly (QRMP)"] },
            { label: "Principal place of business", value: company.location, wide: true },
          ]} />
        </Panel>
        <Panel title="Invoice preferences" bodyClassName="space-y-4 p-4 sm:p-5">
          {[
            { key: "einvoice", label: "Generate e-invoice (IRN) automatically" },
            { key: "ewaybill", label: "Generate e-way bill above ₹50,000" },
            { key: "rcm", label: "Apply reverse charge where applicable" },
            { key: "roundoff", label: "Round off tax to nearest rupee" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between gap-4 text-sm">
              <span>{label}</span>
              <Switch checked={Boolean(preferences[key])} onCheckedChange={(c) => toggle(key, c)} />
            </label>
          ))}
        </Panel>
      </div>
      <Panel title="Tax rates" bodyClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rate</TableHead>
              <TableHead className="text-right">CGST</TableHead>
              <TableHead className="text-right">SGST</TableHead>
              <TableHead className="text-right">IGST</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[0, 5, 12, 18, 28].map((r) => (
              <TableRow key={r}>
                <TableCell className="font-medium">GST {r}%</TableCell>
                <TableCell className="text-right tabular">{r / 2}%</TableCell>
                <TableCell className="text-right tabular">{r / 2}%</TableCell>
                <TableCell className="text-right tabular">{r}%</TableCell>
                <TableCell><StatusBadge status="Active" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
      <FinanceRecipientsPanel />
      <ExportPreferencesPanel />
      <div className={cn("flex justify-end")}>
        <Button onClick={handleSaveAll}>Save settings</Button>
      </div>
    </>
  );
}
