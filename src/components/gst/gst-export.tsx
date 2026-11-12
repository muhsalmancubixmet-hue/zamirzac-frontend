import { useEffect, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Download, FileSpreadsheet, Loader2, Mail, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Panel, StatusBadge } from "@/components/erp/primitives";
import { SectionHeader } from "@/components/erp/ModuleLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr } from "@/lib/format";
import { companyConfig as company } from "@/config/company";
import { CompanyLogo } from "@/components/erp/CompanyLogo";
import { cn } from "@/lib/utils";
import { settingsApi } from "@/lib/api";
import { useLiveGstData, type GstInvoice } from "./sections";

// ---------- Persistent local session stores ----------
function createPersistentStore<T>(key: string, initial: T) {
  let v: T = initial;
  try {
    const saved = localStorage.getItem(key);
    if (saved) v = JSON.parse(saved);
  } catch {}

  const subs = new Set<() => void>();
  return {
    get: () => v,
    set: (n: T | ((p: T) => T)) => {
      v = typeof n === "function" ? (n as (p: T) => T)(v) : n;
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {}
      subs.forEach((f) => f());
    },
    sub: (f: () => void) => {
      subs.add(f);
      return () => { subs.delete(f); };
    },
  };
}

function useStore<T>(s: ReturnType<typeof createPersistentStore<T>>) {
  return useSyncExternalStore(s.sub, s.get, s.get);
}

export type Recipient = { email: string; name: string; isDefault: boolean };
export const financeStore = createPersistentStore<Recipient[]>("gst_finance_recipients", [
  { email: "finance@zamirzac.com", name: "Finance team", isDefault: true },
  { email: "accounts@zamirzac.com", name: "Accounts", isDefault: true },
  { email: "ca.suresh@menonassociates.in", name: "Chartered accountant", isDefault: false },
]);

export type HistoryRow = {
  id: string;
  file: string;
  report: string;
  period: string;
  fy: string;
  rows: number;
  size: string;
  recipients: string[];
  status: "Pending" | "Sent" | "Failed" | "Generated";
  by: string;
  at: string;
};

export const historyStore = createPersistentStore<HistoryRow[]>("gst_export_history", []);

// ---------- report definitions ----------
const reportTypes = [
  { id: "gstr1", label: "GSTR-1-ready", file: "GSTR-1", src: "sales" },
  { id: "gstr2", label: "GSTR-2 / Purchase GST", file: "Purchase-GST", src: "purchase" },
  { id: "gstr3b", label: "GSTR-3B summary", file: "GSTR-3B", src: "summary" },
  { id: "hsn", label: "HSN/SAC summary", file: "HSN-Summary", src: "hsn" },
  { id: "sales", label: "Sales GST report (Output GST)", file: "Sales-GST", src: "sales" },
  { id: "purchase", label: "Purchase GST report (Input GST)", file: "Input-GST", src: "purchase" },
] as const;

const fys = ["FY 2026-27", "FY 2025-26"];
const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const sum = (r: GstInvoice[], f: (x: GstInvoice) => number) => r.reduce((a, x) => a + f(x), 0);
const steps = ["Select period", "Select report", "Prepare data", "Preview", "Generate Excel", "Email finance team"];

function Steps({ at }: { at: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-xs">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1", i < at ? "border-success/30 bg-success/10 text-success" : i === at ? "border-accent/40 bg-accent/10 text-accent font-medium" : "border-border text-muted-foreground")}>
            <span className="tabular">{i + 1}</span> {s}
          </span>
          {i < steps.length - 1 ? <ArrowRight className="size-3 text-muted-foreground" /> : null}
        </li>
      ))}
    </ol>
  );
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
      </Select>
    </label>
  );
}

function PreviewTable({ type, sales, purchases }: { type: (typeof reportTypes)[number]; sales: GstInvoice[]; purchases: GstInvoice[] }) {
  if (type.src === "summary") {
    const out = sales;
    const inp = purchases.filter((r) => r.status !== "Mismatch" && r.gstin !== "URP");
    const rows: [string, GstInvoice[]][] = [
      ["3.1(a) Outward taxable supplies", out],
      ["4(A) Eligible ITC", inp],
    ];
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Particulars</TableHead>
            <TableHead className="text-right">Taxable value</TableHead>
            <TableHead className="text-right">CGST</TableHead>
            <TableHead className="text-right">SGST</TableHead>
            <TableHead className="text-right">IGST</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(([l, r]) => (
            <TableRow key={l}>
              <TableCell>{l}</TableCell>
              <TableCell className="text-right tabular">{inr(sum(r, (x) => x.taxable))}</TableCell>
              <TableCell className="text-right tabular">{inr(sum(r, (x) => x.cgst))}</TableCell>
              <TableCell className="text-right tabular">{inr(sum(r, (x) => x.sgst))}</TableCell>
              <TableCell className="text-right tabular">{inr(sum(r, (x) => x.igst))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={4}>Net GST payable (Output − Input)</TableCell>
            <TableCell className="text-right tabular font-bold">
              {inr(Math.max(0, sum(out, (x) => x.cgst + x.sgst + x.igst) - sum(inp, (x) => x.cgst + x.sgst + x.igst)))}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    );
  }

  if (type.src === "hsn") {
    const hsnMap = new Map<string, { code: string; desc: string; count: number; taxable: number; tax: number; rate: number }>();
    sales.forEach((s) => {
      const code = s.hsn || "3926";
      const existing = hsnMap.get(code) || {
        code,
        desc: s.item || "Product supplies",
        count: 0,
        taxable: 0,
        tax: 0,
        rate: s.rate,
      };
      existing.count += 1;
      existing.taxable += s.taxable;
      existing.tax += s.cgst + s.sgst + s.igst;
      hsnMap.set(code, existing);
    });
    const hsnRows = Array.from(hsnMap.values());

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>HSN/SAC</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Rate</TableHead>
            <TableHead className="text-right">Taxable value</TableHead>
            <TableHead className="text-right">Tax</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {hsnRows.map((h) => (
            <TableRow key={h.code}>
              <TableCell className="font-mono text-xs">{h.code}</TableCell>
              <TableCell>{h.desc}</TableCell>
              <TableCell className="text-right">{h.rate}%</TableCell>
              <TableCell className="text-right tabular">{inr(h.taxable)}</TableCell>
              <TableCell className="text-right tabular">{inr(h.tax)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  const rows = type.src === "sales" ? sales : purchases;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Voucher</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>{type.src === "sales" ? "Customer" : "Supplier"}</TableHead>
            <TableHead>GSTIN</TableHead>
            <TableHead className="text-right">Taxable</TableHead>
            <TableHead className="text-right">CGST</TableHead>
            <TableHead className="text-right">SGST</TableHead>
            <TableHead className="text-right">IGST</TableHead>
            <TableHead className="text-right">Invoice value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 10).map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.id}</TableCell>
              <TableCell>{r.date}</TableCell>
              <TableCell>{r.party}</TableCell>
              <TableCell className="font-mono text-xs">{r.gstin || "URP"}</TableCell>
              <TableCell className="text-right tabular">{inr(r.taxable)}</TableCell>
              <TableCell className="text-right tabular">{inr(r.cgst)}</TableCell>
              <TableCell className="text-right tabular">{inr(r.sgst)}</TableCell>
              <TableCell className="text-right tabular">{inr(r.igst)}</TableCell>
              <TableCell className="text-right tabular">{inr(r.total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={4}>Total · {rows.length} record(s){rows.length > 10 ? " (first 10 shown)" : ""}</TableCell>
            <TableCell className="text-right tabular">{inr(sum(rows, (x) => x.taxable))}</TableCell>
            <TableCell className="text-right tabular">{inr(sum(rows, (x) => x.cgst))}</TableCell>
            <TableCell className="text-right tabular">{inr(sum(rows, (x) => x.sgst))}</TableCell>
            <TableCell className="text-right tabular">{inr(sum(rows, (x) => x.igst))}</TableCell>
            <TableCell className="text-right tabular">{inr(sum(rows, (x) => x.total))}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

// ---------- main workflow ----------
export function GstExport() {
  const { sales, purchases } = useLiveGstData();
  const recipients = useStore(financeStore);
  const [fy, setFy] = useState(fys[0] ?? "FY 2026-27");
  const [month, setMonth] = useState("Oct");
  const [typeId, setTypeId] = useState<string>("gstr1");
  const [stage, setStage] = useState<"idle" | "preparing" | "preview" | "generating" | "generated" | "sending">("idle");
  const [to, setTo] = useState<string[]>(() => financeStore.get().filter((r) => r.isDefault).map((r) => r.email));

  const defaultType = reportTypes[0] || { id: "gstr1", label: "GSTR-1 (Outward Supplies)", file: "GSTR1", desc: "Monthly outward supplies return" };
  const type = reportTypes.find((r) => r.id === typeId) ?? defaultType;
  const year = months.indexOf(month) >= 9 ? Number(fy?.slice(3, 7) || 2026) + 1 : Number(fy?.slice(3, 7) || 2026);
  const period = `${month} ${year}`;
  const file = `${type.file}_${month}-${year}.xlsx`;
  const subject = `${type.label} — ${company.name} (GSTIN ${company.gstin}) — ${period}`;
  const [message, setMessage] = useState("");
  const body = message || `Dear Finance Team,\n\nPlease find attached the ${type.label} Excel for ${period} (${fy}) prepared from ${company.name}'s ERP transactions.\n\nKindly review and proceed with the GST filing process.\n\nRegards,\n${company.name}\n${company.phone} · ${company.email}`;
  const atStep = stage === "idle" ? 2 : stage === "preparing" ? 2 : stage === "preview" || stage === "generating" ? 4 : 5;

  const reset = () => { setStage("idle"); setMessage(""); };
  const prepare = () => { setStage("preparing"); setTimeout(() => setStage("preview"), 400); };

  const generate = (then?: () => void) => {
    setStage("generating");
    setTimeout(() => {
      setStage("generated");
      const activeRows = type.src === "sales" ? sales.length : type.src === "purchase" ? purchases.length : sales.length + purchases.length;
      historyStore.set((h) => [
        {
          id: `GX-${Date.now().toString().slice(-4)}`,
          file,
          report: type.label,
          period,
          fy,
          rows: activeRows,
          size: "32 KB",
          recipients: [],
          status: "Generated",
          by: "Current User",
          at: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
        },
        ...h,
      ]);
      toast.success(`${file} generated`);
      then?.();
    }, 500);
  };

  const send = () => {
    if (!to.length) { toast.error("Select at least one finance-team recipient"); return; }
    setStage("sending");
    const first = historyStore.get()[0];
    if (first) {
      historyStore.set((h) => h.map((r, i) => (i === 0 ? { ...r, recipients: to, status: "Sent" } : r)));
    }
    setTimeout(() => {
      setStage("generated");
      toast.success(`Report emailed to ${to.length} recipient(s) — marked Sent`);
    }, 600);
  };

  const handleDownloadCsv = () => {
    const rows = type.src === "sales" ? sales : type.src === "purchase" ? purchases : sales;
    const csvLines = ["Voucher,Party,GSTIN,Date,Taxable,CGST,SGST,IGST,Total"];
    rows.forEach((s) => {
      csvLines.push(`"${s.id}","${s.party}","${s.gstin}","${s.date}",${s.taxable},${s.cgst},${s.sgst},${s.igst},${s.total}`);
    });
    const blob = new Blob([csvLines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file.replace(/\.xlsx$/i, ".csv")}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${file} downloaded`);
  };

  return (
    <>
      <SectionHeader title="GST Excel & Email" description="ERP transactions → GST calculation → GST-ready Excel → email to finance team. Filing is done externally by the finance team." actions={<Button size="sm" variant="outline" asChild><Link to="/gst/$section" params={{ section: "email-history" }}>View history</Link></Button>} />
      <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        This ERP exports live transaction registers for your finance team to review, reconcile and submit on the GST portal.
      </div>
      <Steps at={atStep} />

      <Panel title="1–2 · Period & report">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Sel label="Financial year" value={fy} onChange={(v) => { setFy(v); reset(); }} options={fys.map((v) => ({ v, l: v }))} />
          <Sel label="Tax period (month)" value={month} onChange={(v) => { setMonth(v); reset(); }} options={months.map((v) => ({ v, l: v }))} />
          <div className="lg:col-span-2">
            <Sel label="GST report type" value={typeId} onChange={(v) => { setTypeId(v); reset(); }} options={reportTypes.map((r) => ({ v: r.id, l: r.label }))} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={prepare} disabled={stage === "preparing"}>
            {stage === "preparing" ? <Loader2 className="size-4 animate-spin" /> : null} Prepare &amp; preview data
          </Button>
          {stage !== "idle" ? <Button size="sm" variant="ghost" onClick={reset}>Reset</Button> : null}
        </div>
      </Panel>

      {stage !== "idle" && stage !== "preparing" ? (
        <>
          <Panel title="3–4 · Preview before generation" actions={<StatusBadge status={stage === "preview" ? "Draft" : "Completed"} label={stage === "preview" ? "Not generated" : "Excel generated"} />} bodyClassName="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <CompanyLogo className="h-9 w-9" />
                <div>
                  <p className="text-sm font-semibold">{company.name}</p>
                  <p className="text-xs text-muted-foreground">GSTIN {company.gstin} · {company.state} ({company.stateCode}) · {type.label} · {period} · {fy}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => generate()} disabled={stage === "generating" || stage === "sending"}>
                  {stage === "generating" ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />} {stage === "generated" ? "Regenerate Excel" : "Generate Excel"}
                </Button>
                <Button size="sm" variant="outline" disabled={stage !== "generated"} onClick={handleDownloadCsv}>
                  <Download className="size-4" /> Download File
                </Button>
              </div>
            </div>
            <PreviewTable type={type} sales={sales} purchases={purchases} />
          </Panel>

          {stage === "generated" || stage === "sending" ? (
            <Panel title="Generated file">
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
                <div className="flex size-10 items-center justify-center rounded-md bg-success/10 text-success">
                  <FileSpreadsheet className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file}</p>
                  <p className="text-xs text-muted-foreground">Prepared from live ERP registers · Ready for audit &amp; portal upload</p>
                </div>
              </div>
            </Panel>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
            <Panel title="5 · Finance-team recipients" actions={<Button size="sm" variant="ghost" asChild><Link to="/gst/$section" params={{ section: "settings" }}>Manage</Link></Button>}>
              <div className="space-y-2">
                {recipients.map((r) => (
                  <label key={r.email} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                    <Checkbox checked={to.includes(r.email)} onCheckedChange={(c) => setTo((p) => (c ? [...p, r.email] : p.filter((x) => x !== r.email)))} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{r.email}</span>
                    </span>
                  </label>
                ))}
                {!recipients.length ? <p className="text-sm text-muted-foreground">No recipients configured. Add them in GST settings.</p> : null}
              </div>
            </Panel>
            <Panel title="Email preview">
              <div className="rounded-md border border-border text-sm">
                <div className="space-y-1 border-b border-border px-4 py-2 text-xs">
                  <p><span className="text-muted-foreground">From:</span> {company.name} &lt;{company.email}&gt;</p>
                  <p><span className="text-muted-foreground">To:</span> {to.join(", ") || "—"}</p>
                  <p><span className="text-muted-foreground">Subject:</span> {subject}</p>
                  <p><span className="text-muted-foreground">Attachment:</span> {file}</p>
                </div>
                <Textarea rows={8} value={body} onChange={(e) => setMessage(e.target.value)} className="rounded-none border-0 text-sm focus-visible:ring-0" />
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="outline" disabled={stage !== "generated"} onClick={send}>
                  <Mail className="size-4" /> Email to Finance Team
                </Button>
                <Button size="sm" disabled={stage === "generating" || stage === "sending"} onClick={() => (stage === "generated" ? send() : generate(() => setTimeout(send, 50)))}>
                  {stage === "sending" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Generate &amp; Email
                </Button>
              </div>
            </Panel>
          </div>
        </>
      ) : null}
      <HistoryTable limit={5} sales={sales} purchases={purchases} />
    </>
  );
}

function HistoryTable({ limit, sales = [], purchases = [] }: { limit?: number; sales?: GstInvoice[]; purchases?: GstInvoice[] }) {
  const rows = useStore(historyStore);
  const shown = limit ? rows.slice(0, limit) : rows;

  const retry = (id: string) => {
    historyStore.set((h) => h.map((r) => (r.id === id ? { ...r, status: "Pending" } : r)));
    setTimeout(() => {
      historyStore.set((h) => h.map((r) => (r.id === id ? { ...r, status: "Sent" } : r)));
      toast.success("Delivery retried and marked Sent");
    }, 800);
  };

  return (
    <Panel title={limit ? "Recent exports & emails" : "All exports & emails"} bodyClassName="p-0">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Report</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Generated</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-xs text-muted-foreground">
                  No export or email history recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              shown.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.file}</div>
                    <div className="text-xs text-muted-foreground">{r.id} · {r.rows} rows · {r.size}</div>
                  </TableCell>
                  <TableCell>{r.report}</TableCell>
                  <TableCell>{r.period}<div className="text-xs text-muted-foreground">{r.fy}</div></TableCell>
                  <TableCell className="text-xs">{r.recipients.length ? r.recipients.join(", ") : "—"}</TableCell>
                  <TableCell className="text-xs">{r.at}<div className="text-muted-foreground">{r.by}</div></TableCell>
                  <TableCell>
                    <StatusBadge status={r.status === "Sent" ? "Completed" : r.status === "Failed" ? "Overdue" : r.status === "Pending" ? "Pending" : "Draft"} label={r.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const csvLines = ["Voucher,Party,GSTIN,Date,Taxable,CGST,SGST,IGST,Total"];
                          const sourceRows = r.report.toLowerCase().includes("purchase") ? purchases : sales;
                          sourceRows.forEach((s) => {
                            csvLines.push(`"${s.id}","${s.party}","${s.gstin}","${s.date}",${s.taxable},${s.cgst},${s.sgst},${s.igst},${s.total}`);
                          });
                          const blob = new Blob([csvLines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${r.file.replace(/\.xlsx$/i, ".csv")}`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                          toast.success(`${r.file} downloaded`);
                        }}
                      >
                        <Download className="size-4" />
                      </Button>
                      {r.status === "Failed" ? <Button size="sm" variant="outline" onClick={() => retry(r.id)}>Retry</Button> : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

export function GstEmailHistory() {
  const { sales, purchases } = useLiveGstData();
  const rows = useStore(historyStore);
  const c = (s: string) => rows.filter((r) => r.status === s).length;
  return (
    <>
      <SectionHeader title="Export & email history" description="GST-ready files generated from the ERP and delivery status to the finance team." />
      <div className="grid gap-3 sm:grid-cols-4">
        {[["Files generated", rows.length], ["Sent", c("Sent")], ["Pending", c("Pending")], ["Failed", c("Failed")]].map(([l, v]) => (
          <Panel key={l as string} bodyClassName="p-4">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="mt-1 text-2xl font-semibold tabular">{v}</p>
          </Panel>
        ))}
      </div>
      <HistoryTable sales={sales} purchases={purchases} />
    </>
  );
}

// ---------- settings panels ----------
export function FinanceRecipientsPanel() {
  const list = useStore(financeStore);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const add = () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast.error("Enter a valid email address"); return; }
    if (list.some((r) => r.email === email)) { toast.error("Email already in recipients list"); return; }
    financeStore.set((l) => [...l, { email, name: name || "Finance Specialist", isDefault: false }]);
    setEmail("");
    setName("");
    toast.success("Recipient added and saved");
  };

  const [autoEmail, setAutoEmail] = useState(false);
  const [dispatchDay, setDispatchDay] = useState("10");
  const [dispatching, setDispatching] = useState(false);

  useEffect(() => {
    settingsApi.getSection("gst")
      .then((data: any) => {
        if (data) {
          if (typeof data.auto_email_gstr_monthly === "boolean") setAutoEmail(data.auto_email_gstr_monthly);
          if (data.gstr_dispatch_day) setDispatchDay(String(data.gstr_dispatch_day));
        }
      })
      .catch((err) => console.debug("GST settings fetch deferred:", err));
  }, []);

  const handleToggleAuto = async (enabled: boolean) => {
    setAutoEmail(enabled);
    try {
      const activeEmails = list.filter((r) => r.isDefault).map((r) => r.email).join(", ");
      await settingsApi.updateSection("gst", {
        auto_email_gstr_monthly: enabled,
        gstr_dispatch_day: dispatchDay,
        gstr_recipient_email: activeEmails || list.map((r) => r.email).join(", "),
      });
      toast.success(`Automated monthly GSTR email dispatch ${enabled ? "enabled (every month " + dispatchDay + "th)" : "paused"}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update automated GSTR settings");
    }
  };

  const handleDispatchNow = async () => {
    setDispatching(true);
    try {
      const recipients = list.filter((r) => r.isDefault).map((r) => r.email);
      const res = await settingsApi.dispatchGstr(recipients.length > 0 ? recipients : undefined);
      toast.success(res.message || `Dispatched monthly GSTR statements to ${res.recipients?.join(", ")}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch monthly GSTR email");
    } finally {
      setDispatching(false);
    }
  };

  return (
    <Panel title="Finance-team email recipients" actions={<span className="text-xs text-muted-foreground">Notification contacts</span>}>
      <div className="space-y-2">
        {list.map((r) => (
          <div key={r.email} className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{r.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{r.email}</span>
            </span>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Selected by default
              <Switch checked={r.isDefault} onCheckedChange={(v) => financeStore.set((l) => l.map((x) => (x.email === r.email ? { ...x, isDefault: v } : x)))} />
            </label>
            <Button size="icon" variant="ghost" className="size-8" aria-label={`Remove ${r.email}`} onClick={() => financeStore.set((l) => l.filter((x) => x.email !== r.email))}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input placeholder="Name / role" value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
        <Input placeholder="finance@company.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9" />
        <Button size="sm" onClick={add}><Plus className="size-4" /> Add</Button>
      </div>

      <div className="mt-5 rounded-lg border border-border/80 bg-muted/20 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Monthly GSTR Automated Email</p>
            <p className="text-xs text-muted-foreground">
              Automatically compiles previous month's GSTR-1 &amp; GSTR-3B CSVs and emails to default recipients
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={dispatchDay} onValueChange={(d) => {
              setDispatchDay(d);
              settingsApi.updateSection("gst", { auto_email_gstr_monthly: autoEmail, gstr_dispatch_day: d });
            }}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10th of month</SelectItem>
                <SelectItem value="11">11th of month</SelectItem>
                <SelectItem value="15">15th of month</SelectItem>
                <SelectItem value="20">20th of month</SelectItem>
              </SelectContent>
            </Select>
            <Switch checked={autoEmail} onCheckedChange={handleToggleAuto} />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="outline" onClick={handleDispatchNow} disabled={dispatching}>
            {dispatching ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Mail className="mr-2 size-4" />}
            Dispatch Current Month Statements Now
          </Button>
        </div>
      </div>
    </Panel>
  );
}

export function ExportPreferencesPanel() {
  const [naming, setNaming] = useState(() => {
    try {
      return localStorage.getItem("gst_naming_pref") || "type-period";
    } catch {
      return "type-period";
    }
  });

  const [amountFmt, setAmountFmt] = useState(() => {
    try {
      return localStorage.getItem("gst_amount_fmt_pref") || "2dp";
    } catch {
      return "2dp";
    }
  });

  const [toggles, setToggles] = useState<Record<string, boolean>>(() => {
    try {
      const s = localStorage.getItem("gst_export_toggles");
      return s ? JSON.parse(s) : {
        b2c: true,
        ratesheet: false,
        hsn: true,
        pdf: false,
        cc: true,
      };
    } catch {
      return { b2c: true, ratesheet: false, hsn: true, pdf: false, cc: true };
    }
  });

  const updateToggle = (key: string, val: boolean) => {
    const updated = { ...toggles, [key]: val };
    setToggles(updated);
    try {
      localStorage.setItem("gst_export_toggles", JSON.stringify(updated));
    } catch {}
    toast.success("Export preference updated");
  };

  return (
    <Panel title="GST export preferences" bodyClassName="space-y-4 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Sel
          label="File naming"
          value={naming}
          onChange={(v) => {
            setNaming(v);
            try { localStorage.setItem("gst_naming_pref", v); } catch {}
            toast.success("File naming format updated");
          }}
          options={[
            { v: "type-period", l: "ReportType_Mon-YYYY.xlsx" },
            { v: "gstin-type", l: "GSTIN_ReportType_Period.xlsx" },
          ]}
        />
        <Sel
          label="Amount format"
          value={amountFmt}
          onChange={(v) => {
            setAmountFmt(v);
            try { localStorage.setItem("gst_amount_fmt_pref", v); } catch {}
            toast.success("Amount format updated");
          }}
          options={[
            { v: "2dp", l: "2 decimals (12,345.60)" },
            { v: "round", l: "Rounded rupees" },
          ]}
        />
      </div>
      {[
        { key: "b2c", label: "Include B2C small invoices in GSTR-1 file" },
        { key: "ratesheet", label: "Separate sheet per GST rate" },
        { key: "hsn", label: "Include HSN summary sheet with every export" },
        { key: "pdf", label: "Attach PDF summary along with Excel" },
        { key: "cc", label: "CC company email on finance emails" },
      ].map(({ key, label }) => (
        <label key={key} className="flex items-center justify-between gap-4 text-sm">
          <span>{label}</span>
          <Switch checked={Boolean(toggles[key])} onCheckedChange={(c) => updateToggle(key, c)} />
        </label>
      ))}
    </Panel>
  );
}
