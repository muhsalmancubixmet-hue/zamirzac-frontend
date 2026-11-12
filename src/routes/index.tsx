import { AppLink } from "@/components/erp/AppLink";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Download, Plus, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Panel, StatusBadge } from "@/components/erp/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr } from "@/lib/format";
import { APP_TITLE } from "@/config/company";
import { CalendarCheck, ClipboardCheck, ReceiptText, UsersRound } from "lucide-react";
import { appealsStore, useStoreValue } from "@/data/self-attendance";
import { companyConfig as company } from "@/config/company";
import { DashboardAttendanceWidget } from "@/components/dashboard/AttendanceWidget";
import { useCan } from "@/lib/access";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `Dashboard — ${APP_TITLE}` },
      { name: "description", content: "Sales, purchases, receivables, payables, cash, bank and profit for Zamirzac Solutions in one ERP dashboard." },
      { property: "og:title", content: `Dashboard — ${APP_TITLE}` },
      { property: "og:description", content: "Sales, purchases, receivables, payables, cash, bank and profit in one ERP dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

type Period = "today" | "week" | "month" | "year" | "custom";
const periodLabel: Record<Period, string> = { today: "Today", week: "This week", month: "This month", year: "This year", custom: "Custom" };

interface DashboardSummary {
  period: string;
  totals: {
    sales: number;
    purchase: number;
    purchases?: number;
    receivables: number;
    payables: number;
    cash_balance: number;
    bank_balance: number;
    profit: number;
    net_profit?: number;
  };
  recent_sales: Array<{
    id: string;
    party: string;
    date: string;
    total: number;
    status: string;
  }>;
  recent_purchases: Array<{
    id: string;
    party: string;
    date: string;
    total: number;
    status: string;
  }>;
  low_stock: Array<{
    sku: string;
    item: string;
    qty: number;
    reorder: number;
    warehouse: string;
  }>;
  series: Array<{
    label: string;
    sales: number;
    purchase: number;
    revenue: number;
    expenses: number;
    profit: number;
    receivable: number;
    payable: number;
  }>;
  outstanding_invoices?: Array<{
    id: string;
    party: string;
    place: string;
    due: number;
    days: number;
  }>;
  recent_payments?: Array<{
    id: string;
    party: string;
    mode: string;
    amount: number;
    status: string;
  }>;
  activities?: Array<{
    who: string;
    what: string;
    when: string;
  }>;
}

const compact = (n: number) => (Math.abs(n) >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${Math.round(n / 1000)}k`);
const tip = { borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 };
const axis = { tickLine: false, axisLine: false, fontSize: 12 } as const;

function Dashboard() {
  const [period, setPeriod] = useState<Period>("month");
  const [liveData, setLiveData] = useState<DashboardSummary | null>(null);

  const canViewAccounting = useCan("View", "Accounting");
  const canViewSales = useCan("View", "Sales");
  const canViewInventory = useCan("View", "Inventory");
  const canViewFinance = canViewAccounting || canViewSales;

  useEffect(() => {
    let cancelled = false;
    api.get<DashboardSummary>("/dashboard/summary/", { period })
      .then((res) => {
        if (!cancelled && res) {
          setLiveData(res);
        }
      })
      .catch((err) => {
        console.debug("Dashboard summary live fetch fallback:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const data = (liveData?.series && liveData.series.length > 0) ? liveData.series : [];

  const totals = {
    sales: liveData?.totals?.sales ?? 0,
    purchase: liveData?.totals?.purchase ?? liveData?.totals?.purchases ?? 0,
    profit: liveData?.totals?.profit ?? liveData?.totals?.net_profit ?? 0,
  };

  const kpis = [
    { label: "Total Sales", value: totals.sales, delta: 0 },
    { label: "Total Purchases", value: totals.purchase, delta: 0 },
    { label: "Receivables", value: liveData?.totals?.receivables ?? 0, delta: 0, hint: "Customer balance" },
    { label: "Payables", value: liveData?.totals?.payables ?? 0, delta: 0, hint: "Supplier dues" },
    { label: "Cash Balance", value: liveData?.totals?.cash_balance ?? 0, delta: 0, hint: "Cash accounts" },
    { label: "Bank Balance", value: liveData?.totals?.bank_balance ?? 0, delta: 0, hint: "Bank accounts" },
    { label: "Net Profit", value: totals.profit, delta: 0 },
  ];

  return (
    <AppShell title="Dashboard" breadcrumbs={["Dashboard"]}>
      <PageHeader
        title="Business overview"
        description={`${company.name}, ${company.city} · Live operations · ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
        actions={
          canViewFinance ? (
            <>
              <Button variant="outline" size="sm" onClick={() => window.print()}><Download className="size-4" /> Download report</Button>
              <Button size="sm" asChild><Link to="/sales/$section" params={{ section: "new-invoice" }}><Plus className="size-4" /> New invoice</Link></Button>
            </>
          ) : (
            <Button size="sm" asChild><Link to="/attendance/$section" params={{ section: "mark" }}><CalendarCheck className="size-4" /> Mark attendance</Link></Button>
          )
        }
      />

      <MobileQuickActions />

      <DashboardAttendanceWidget />

      {canViewFinance && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup type="single" value={period} onValueChange={(v) => v && setPeriod(v as Period)} variant="outline" size="sm">
              {(Object.keys(periodLabel) as Period[]).map((p) => <ToggleGroupItem key={p} value={p} className="px-3">{periodLabel[p]}</ToggleGroupItem>)}
            </ToggleGroup>
            {period === "custom" ? (
              <div className="flex items-center gap-2">
                <Input type="date" defaultValue="2026-09-08" className="h-8 w-38" aria-label="From date" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="date" defaultValue="2026-09-27" className="h-8 w-38" aria-label="To date" />
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
            {kpis.map((k) => {
              const up = k.delta >= 0;
              return (
                <Panel key={k.label} bodyClassName="p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
                  <p className="mt-2 text-lg font-semibold tabular text-foreground">{inr(k.value)}</p>
                  <div className="mt-1.5 flex items-center justify-between text-xs">
                    <span className={up ? "inline-flex items-center gap-1 font-medium text-success" : "inline-flex items-center gap-1 font-medium text-destructive"}>
                      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}{Math.abs(k.delta)}%
                    </span>
                    <span className="text-muted-foreground">{k.hint ?? periodLabel[period]}</span>
                  </div>
                </Panel>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <ChartPanel title="Sales trend" description={periodLabel[period]} className="xl:col-span-2">
              <AreaChart data={data} margin={{ left: -8, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" {...axis} /><YAxis tickFormatter={compact} {...axis} />
                <RTooltip formatter={(v: number) => inr(v)} contentStyle={tip} />
                <Area type="monotone" dataKey="sales" name="Sales" stroke="var(--color-chart-2)" strokeWidth={2} fill="url(#salesFill)" />
              </AreaChart>
            </ChartPanel>
            <ChartPanel title="Purchase trend" description={periodLabel[period]}>
              <BarChart data={data} margin={{ left: -8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" {...axis} /><YAxis tickFormatter={compact} {...axis} />
                <RTooltip formatter={(v: number) => inr(v)} contentStyle={tip} />
                <Bar dataKey="purchase" name="Purchases" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartPanel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartPanel title="Revenue vs expenses">
              <LineChart data={data} margin={{ left: -8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" {...axis} /><YAxis tickFormatter={compact} {...axis} />
                <RTooltip formatter={(v: number) => inr(v)} contentStyle={tip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="expenses" name="Expenses" stroke="var(--color-chart-4)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartPanel>
            <ChartPanel title="Receivables vs payables">
              <BarChart data={data} margin={{ left: -8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" {...axis} /><YAxis tickFormatter={compact} {...axis} />
                <RTooltip formatter={(v: number) => inr(v)} contentStyle={tip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="receivable" name="Receivables" fill="var(--color-chart-2)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="payable" name="Payables" fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartPanel>
            <ChartPanel title="Profit">
              <BarChart data={data} margin={{ left: -8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" {...axis} /><YAxis tickFormatter={compact} {...axis} />
                <RTooltip formatter={(v: number) => inr(v)} contentStyle={tip} />
                <Bar dataKey="profit" name="Net profit" radius={[3, 3, 0, 0]}>
                  {data.map((d) => <Cell key={d.label} fill={d.profit >= 0 ? "var(--color-success)" : "var(--color-destructive)"} />)}
                </Bar>
              </BarChart>
            </ChartPanel>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <MiniTable title="Recent sales" link={<Link to="/sales/$section" params={{ section: "invoices" }}>View all</Link>}
              rows={(liveData?.recent_sales ?? []).map((r) => ({ id: r.id, a: r.party, b: r.date, amt: r.total, status: r.status }))} />
            <MiniTable title="Recent purchases" link={<Link to="/purchase/$section" params={{ section: "bills" }}>View all</Link>}
              rows={(liveData?.recent_purchases ?? []).map((r) => ({ id: r.id, a: r.party, b: r.date, amt: r.total, status: r.status }))} />
            <MiniTable title="Recent payments" link={<Link to="/accounting/$section" params={{ section: "payments" }}>View all</Link>}
              rows={(liveData?.recent_payments ?? []).map((p) => ({ id: p.id, a: p.party, b: p.mode, amt: p.amount, status: p.status }))} />
          </div>
        </>
      )}

      <div className={`grid gap-4 ${canViewFinance ? "xl:grid-cols-3" : "grid-cols-1 md:grid-cols-2"}`}>
        {canViewFinance && (
          <Panel title="Outstanding invoices" description="Receivables ageing">
            {(liveData?.outstanding_invoices ?? []).length > 0 ? (
              <ul className="divide-y divide-border">
                {(liveData?.outstanding_invoices ?? []).map((o) => (
                  <li key={o.id} className="flex items-center justify-between py-2.5 first:pt-0">
                    <div><p className="text-sm font-medium">{o.party}</p><p className="text-xs text-muted-foreground">{o.id} · {o.place}</p></div>
                    <div className="text-right">
                      <p className="tabular text-sm font-semibold">{inr(o.due)}</p>
                      <p className={o.days > 30 ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>{o.days} days overdue</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">No outstanding invoices due.</div>
            )}
          </Panel>
        )}
        {(canViewInventory || canViewFinance) && (
          <Panel title="Low-stock alerts" actions={<span className="inline-flex items-center gap-1.5 text-xs font-medium text-warning-foreground"><TriangleAlert className="size-4 text-warning" /> {(liveData?.low_stock ?? []).length} items</span>}>
            {(liveData?.low_stock ?? []).length > 0 ? (
              <ul className="space-y-3.5">
                {(liveData?.low_stock ?? []).map((s) => (
                  <li key={s.sku}>
                    <div className="flex items-center justify-between text-sm"><span className="font-medium">{s.item}</span><span className="tabular text-muted-foreground">{s.qty} / {s.reorder}</span></div>
                    <Progress value={s.reorder > 0 ? (s.qty / s.reorder) * 100 : 0} className="mt-1.5 h-1.5" />
                    <p className="mt-1 text-xs text-muted-foreground">{s.sku} · {s.warehouse}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">No low stock items. All inventory levels optimal.</div>
            )}
          </Panel>
        )}
        <Panel title="Activity" bodyClassName="p-0">
          <div className="border-b border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Live Audit Log</div>
          {(liveData?.activities ?? []).length > 0 ? (
            <ol className="space-y-3 px-4 py-3">
              {(liveData?.activities ?? []).map((a, i) => <Feed key={i} who={a.who} what={a.what} when={a.when} />)}
            </ol>
          ) : (
            <div className="py-6 text-center text-xs text-muted-foreground">No recent system activity recorded.</div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

function ChartPanel({ title, description, className, children }: { title: string; description?: string | undefined; className?: string | undefined; children: ReactNode }) {
  return (
    <Panel title={title} {...(description ? { description } : {})} {...(className ? { className } : {})}>
      <div className="h-60"><ResponsiveContainer width="100%" height="100%">{children as React.ReactElement}</ResponsiveContainer></div>
    </Panel>
  );
}

function MiniTable({ title, link, rows }: { title: string; link: ReactNode; rows: { id: string; a: string; b: string; amt: number; status: string }[] }) {
  return (
    <Panel title={title} bodyClassName="p-0" actions={<Button variant="ghost" size="sm" asChild>{link}</Button>}>
      <Table>
        <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell><div className="font-medium">{r.id}</div><div className="max-w-40 truncate text-xs text-muted-foreground">{r.a} · {r.b}</div></TableCell>
              <TableCell className="text-right tabular">{inr(r.amt)}</TableCell>
              <TableCell><StatusBadge status={r.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

function Feed({ who, what, when }: { who: string; what: string; when: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
      <div className="text-sm"><p><span className="font-medium">{who}</span> {what}</p><p className="text-xs text-muted-foreground">{when}</p></div>
    </li>
  );
}

function MobileQuickActions() {
  const pending = useStoreValue(appealsStore).filter((a) => a.status === "Pending").length;
  const tiles = [
    { href: "/attendance/mark", label: "Mark attendance", icon: CalendarCheck },
    { href: "/sales/new-invoice", label: "New invoice", icon: ReceiptText },
    { href: "/crm/customers", label: "Find customer", icon: UsersRound },
    { href: "/attendance/appeals", label: `Approvals${pending ? ` (${pending})` : ""}`, icon: ClipboardCheck },
  ];
  return (
    <div className="grid grid-cols-4 gap-2 md:hidden">
      {tiles.map((t) => (
        <AppLink key={t.href} href={t.href} className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-card p-2 text-center text-[11px] font-medium leading-tight active:bg-muted">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><t.icon className="size-5" /></span>
          {t.label}
        </AppLink>
      ))}
    </div>
  );
}
