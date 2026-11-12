import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, Play, Printer, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { EmptyState, StatusBadge } from "@/components/erp/primitives";
import { SectionHeader } from "@/components/erp/ModuleLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { company } from "@/config/company";
import { inr } from "@/lib/format";
import { axis, k, tip } from "@/components/ops/common";
import { CompanyLogo } from "@/components/erp/CompanyLogo";

export type Row = Record<string, string | number>;
export type Col = { key: string; header: string; kind?: "inr" | "num" | "pct" | "status" | "text"; total?: boolean };
export type Report = {
  key: string;
  label: string;
  description?: string;
  cols: Col[];
  /** Line-level rows; filters/date/search apply to these before aggregation. */
  raw: Row[];
  aggregate?: (rows: Row[]) => Row[];
  chart?: { x: string; y: string; type?: "bar" | "line" };
  date?: string;
  filters?: string[];
  search?: string[];
  onGenerate?: (filters: FilterState) => Promise<void> | void;
};

const fmt = (c: Col, v: string | number | undefined) => {
  if (v === undefined || v === "") return "—";
  if (c.kind === "inr") return inr(Number(v));
  if (c.kind === "num") return Number(v).toLocaleString("en-IN");
  if (c.kind === "pct") return `${Number(v).toFixed(1)}%`;
  if (c.kind === "status") return <StatusBadge status={String(v).toLowerCase()} label={String(v)} />;
  return String(v);
};

const labelOf = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());

export function groupBy(rows: Row[], key: string, sums: string[], extra?: (group: Row[], row: Row) => void): Row[] {
  const map = new Map<string, Row[]>();
  rows.forEach((r) => { const g = String(r[key]); map.set(g, [...(map.get(g) ?? []), r]); });
  return Array.from(map.entries()).map(([g, list]) => {
    const out: Row = { [key]: g, count: list.length };
    sums.forEach((s) => (out[s] = list.reduce((a, r) => a + Number(r[s] ?? 0), 0)));
    extra?.(list, out);
    return out;
  });
}

export function ReportView({ title, description, reports }: { title: string; description: string; reports: Report[] }) {
  const [active, setActive] = useState(reports[0]?.key ?? "");
  const rep = reports.find((r) => r.key === active) ?? reports[0];
  if (!rep) {
    return (
      <>
        <SectionHeader title={title} description={description} />
        <p className="p-4 text-sm text-muted-foreground">No reports available.</p>
      </>
    );
  }
  return (
    <>
      <SectionHeader title={title} description={description} />
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1 print:hidden">
        {reports.map((r) => (
          <button key={r.key} onClick={() => setActive(r.key)} className={cn("whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors", r.key === active ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
            {r.label}
          </button>
        ))}
      </div>
      <ReportRunner key={rep.key} category={title} report={rep} />
    </>
  );
}

export const getTodayIso = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const getFiscalYearStartIso = () => {
  const d = new Date();
  const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${year}-04-01`;
};

type FilterState = { from: string; to: string; q: string; f: Record<string, string> };
const getInitialFilter = (): FilterState => ({
  from: getFiscalYearStartIso(),
  to: getTodayIso(),
  q: "",
  f: {},
});

function ReportRunner({ category, report }: { category: string; report: Report }) {
  const [draft, setDraft] = useState<FilterState>(getInitialFilter);
  const [applied, setApplied] = useState<FilterState>(getInitialFilter);
  const [loading, setLoading] = useState(false);
  const [stamp, setStamp] = useState(() =>
    new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
  );

  const options = useMemo(() => Object.fromEntries((report.filters ?? []).map((f) => [f, Array.from(new Set(report.raw.map((r) => String(r[f])))).sort()])), [report]);

  const rows = useMemo(() => {
    let out = report.raw;
    if (report.date) out = out.filter((r) => String(r[report.date!]) >= applied.from && String(r[report.date!]) <= applied.to);
    Object.entries(applied.f).forEach(([k2, v]) => { if (v && v !== "all") out = out.filter((r) => String(r[k2]) === v); });
    if (applied.q && report.search) out = out.filter((r) => report.search!.some((s) => String(r[s]).toLowerCase().includes(applied.q.toLowerCase())));
    return report.aggregate ? report.aggregate(out) : out;
  }, [report, applied]);

  const generate = async () => {
    setLoading(true);
    try {
      if (report.onGenerate) {
        await report.onGenerate(draft);
      }
      setApplied(draft);
      setStamp(
        new Date().toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      toast.success(`${report.label} generated`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    const init = getInitialFilter();
    setDraft(init);
    setApplied(init);
    toast("Filters reset");
  };

  const chartData = report.chart ? rows.slice(0, 14).map((r) => ({ x: (String(r[report.chart!.x] ?? "")).split(/[,—(]/)[0]?.trim().slice(0, 18) || "", y: Number(r[report.chart!.y] ?? 0) })) : [];

  const exportCsv = (format: "csv" | "excel") => {
    if (!rows.length) {
      toast.error("No report rows to export");
      return;
    }
    const cols = report.cols;
    const headerRow = cols.map((c) => `"${(c.header || c.key).replace(/"/g, '""')}"`).join(",");
    const dataRows = rows.map((r) =>
      cols
        .map((c) => {
          const val = r[c.key];
          return `"${String(val ?? "").replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const content = "\uFEFF" + [headerRow, ...dataRows].join("\r\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.label.toLowerCase().replace(/[^a-z0-9]/g, "_")}.${format === "excel" ? "csv" : "csv"}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${report.label} exported successfully`);
  };

  return (
    <>
      <div className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end print:hidden">
        {report.date ? (
          <>
            <label className="space-y-1 text-xs text-muted-foreground">From<Input type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className="h-9 lg:w-40" /></label>
            <label className="space-y-1 text-xs text-muted-foreground">To<Input type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className="h-9 lg:w-40" /></label>
          </>
        ) : null}
        {(report.filters ?? []).map((f) => (
          <label key={f} className="space-y-1 text-xs text-muted-foreground">{labelOf(f)}
            <Select value={draft.f[f] ?? "all"} onValueChange={(v) => setDraft({ ...draft, f: { ...draft.f, [f]: v } })}>
              <SelectTrigger className="h-9 lg:w-48"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem>{options[f]!.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </label>
        ))}
        {report.search ? (
          <label className="space-y-1 text-xs text-muted-foreground lg:min-w-48 lg:flex-1">Search
            <div className="relative"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2" /><Input value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} placeholder="Search" className="h-9 pl-8" /></div>
          </label>
        ) : <div className="hidden lg:block lg:flex-1" />}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button size="sm" onClick={generate} disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Generate</Button>
          <Button size="sm" variant="outline" onClick={reset}><RotateCcw className="size-4" /> Reset</Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" variant="outline"><FileSpreadsheet className="size-4" /> Export</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportCsv("excel")}><FileSpreadsheet className="size-4" /> Excel (.csv)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportCsv("csv")}><FileText className="size-4" /> CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Download className="size-4" /> Download PDF</Button>
        </div>
      </div>

      <article className={cn("rounded-lg border border-border bg-card shadow-[var(--shadow-card)] transition-opacity", loading && "opacity-50")}>
        <header className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3"><CompanyLogo className="h-10 w-10" /><div>
            <p className="text-sm font-semibold">{company.name}</p>
            <p className="text-xs text-muted-foreground">{company.location} · GSTIN {company.gstin} · {company.email}</p>
          </div></div>
          <div className="sm:text-right">
            <p className="text-base font-semibold">{report.label}</p>
            <p className="text-xs text-muted-foreground">{category}{report.date ? ` · ${applied.from} to ${applied.to}` : ""} · Generated {stamp}</p>
          </div>
        </header>
        {report.description ? <p className="border-b border-border px-5 py-2 text-xs text-muted-foreground">{report.description}</p> : null}
        {rows.length === 0 ? (
          <div className="p-5"><EmptyState title="No data for these filters" description="Widen the date range or clear filters, then generate again." /></div>
        ) : (
          <>
            {report.chart ? (
              <div className="h-56 border-b border-border px-3 py-4 print:hidden">
                <ResponsiveContainer width="100%" height="100%">
                  {report.chart.type === "line" ? (
                    <LineChart data={chartData}><CartesianGrid vertical={false} stroke="var(--color-border)" /><XAxis dataKey="x" {...axis} /><YAxis {...axis} tickFormatter={k} width={60} /><RTooltip contentStyle={tip} formatter={(v) => inr(Number(v))} /><Line dataKey="y" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} /></LineChart>
                  ) : (
                    <BarChart data={chartData}><CartesianGrid vertical={false} stroke="var(--color-border)" /><XAxis dataKey="x" {...axis} interval={0} angle={-20} textAnchor="end" height={50} /><YAxis {...axis} width={60} tickFormatter={(v) => (Number(v) > 1000 ? k(Number(v)) : String(v))} /><RTooltip contentStyle={tip} /><Bar dataKey="y" fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} /></BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>{report.cols.map((c) => <TableHead key={c.key} className={cn(c.kind && c.kind !== "text" && c.kind !== "status" && "text-right")}>{c.header}</TableHead>)}</TableRow></TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>{report.cols.map((c) => <TableCell key={c.key} className={cn("whitespace-nowrap", c.kind && c.kind !== "text" && c.kind !== "status" && "text-right tabular")}>{fmt(c, r[c.key])}</TableCell>)}</TableRow>
                  ))}
                </TableBody>
                {report.cols.some((c) => c.total) ? (
                  <TableFooter><TableRow>{report.cols.map((c, i) => <TableCell key={c.key} className={cn("font-semibold", c.total && "text-right tabular")}>{c.total ? fmt(c, rows.reduce((a, r) => a + Number(r[c.key] ?? 0), 0)) : i === 0 ? `Total (${rows.length})` : ""}</TableCell>)}</TableRow></TableFooter>
                ) : null}
              </Table>
            </div>
          </>
        )}
        <footer className="border-t border-border px-5 py-2 text-[11px] text-muted-foreground">Computer-generated report · page 1 of 1</footer>
      </article>
    </>
  );
}
