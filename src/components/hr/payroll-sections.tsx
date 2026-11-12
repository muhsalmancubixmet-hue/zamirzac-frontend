import { useEffect, useMemo, useState } from "react";
import { Check, Download, Eye, Printer, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { KpiCard, Panel, StatusBadge } from "@/components/erp/primitives";
import { DataTable, DetailGrid, FormGrid } from "@/components/erp/DataTable";
import { ExportButtons, SectionHeader } from "@/components/erp/ModuleLayout";
import { Steps } from "@/components/ops/common";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { inr } from "@/lib/format";
import { activeEmps, departments, empById, months, payrollRuns, salaryHistory, slipFor, type Run, type Slip } from "@/data/hr";
import { api } from "@/lib/api";
import { useLiveEmployees } from "./attendance-sections";
import { M, Person, axis, k, sum, tip } from "./common";
import { companyConfig as company } from "@/config/company";
import { CompanyLogo } from "@/components/erp/CompanyLogo";

const flow = ["Draft", "Review", "Approved", "Processed"] as const;
const runStatus = (s: Run["status"]) => (s === "Processed" ? "completed" : s === "Approved" ? "approved" : s === "Review" ? "under review" : "draft");

export function PayrollDashboard() {
  const { employees, getEmp } = useLiveEmployees();
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    api.get<any>("/hr/payroll-runs/")
      .then((res: any) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        if (list.length > 0) {
          const mapped: Run[] = list.map((r: any) => ({
            id: r.code || `PR-${r.id}`,
            month: r.month,
            status: r.status as Run["status"],
            employees: r.total_employees || 0,
            gross: Number(r.gross_amount) || 0,
            deductions: Number(r.deductions_amount) || 0,
            net: Number(r.net_amount) || 0,
            processed: r.processed_date || "—",
            by: r.processed_by || "Accounts Manager",
          }));
          setRuns(mapped);
        }
      })
      .catch(() => {});
  }, []);

  const curMonth = runs.at(-1)?.month || "October 2026";
  const cur: Run = runs.at(-1) ?? {
    id: "PR-OCT-2026",
    month: curMonth,
    status: "Draft",
    employees: employees.length,
    gross: 0,
    deductions: 0,
    net: 0,
    processed: "—",
    by: "Payroll Team",
  };

  const slips = employees.map((e) => slipFor(e, cur.month, 5));
  const deptNames = Array.from(new Set(employees.map((e) => e.dept).filter(Boolean)));
  const effectiveDepts = deptNames.length > 0 ? deptNames : departments.length > 0 ? departments.map((d) => d.name) : ["Operations", "Technology", "Administration"];
  const byDept = effectiveDepts.map((dName) => {
    const dSlips = slips.filter((s) => (getEmp(s.emp)?.dept || "General") === dName);
    return {
      name: dName.split(" ")[0] || dName,
      gross: sum(dSlips, (s) => s.gross),
      net: sum(dSlips, (s) => s.net),
    };
  });

  const chartData = runs.length > 0
    ? runs.map((r) => ({ m: r.month.slice(0, 3), gross: r.gross, net: r.net }))
    : months.slice(-6).map((m) => ({ m: m.slice(0, 3), gross: sum(slips, (s) => s.gross), net: sum(slips, (s) => s.net) }));

  const statusIdx = flow.indexOf(cur.status);

  return (
    <>
      <SectionHeader title="Payroll dashboard" description={`${cur.month} · ${employees.length} employees`} actions={<ExportButtons />} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiCard label="Gross payroll" value={inr(sum(slips, (s) => s.gross))} />
        <KpiCard label="Deductions" value={inr(sum(slips, (s) => s.deductions))} hint="PF, ESI, PT, TDS, advances" />
        <KpiCard label="Net payable" value={inr(sum(slips, (s) => s.net))} />
        <KpiCard label="Overtime" value={inr(sum(slips, (s) => s.overtime))} />
        <KpiCard label="Travel allowance" value={inr(sum(slips, (s) => s.ta))} />
        <KpiCard label="Status" value={cur.status} hint="Awaiting approval" tone="down" />
      </div>
      <Steps steps={[...flow]} current={statusIdx >= 0 ? statusIdx : 0} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Payroll trend" description="FY 2026-27"><div className="h-60"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid vertical={false} stroke="var(--color-border)" /><XAxis dataKey="m" {...axis} /><YAxis {...axis} tickFormatter={k} /><RTooltip contentStyle={tip} formatter={(v: number) => inr(v)} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="gross" name="Gross" fill="var(--color-chart-4)" radius={[3, 3, 0, 0]} /><Bar dataKey="net" name="Net" fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></Panel>
        <Panel title="Cost by department"><div className="h-60"><ResponsiveContainer width="100%" height="100%"><BarChart data={byDept} layout="vertical" margin={{ left: 20 }}><XAxis type="number" {...axis} tickFormatter={k} /><YAxis type="category" dataKey="name" {...axis} width={90} /><RTooltip contentStyle={tip} formatter={(v: number) => inr(v)} /><Bar dataKey="gross" name="Gross" fill="var(--color-chart-2)" radius={[0, 3, 3, 0]} /></BarChart></ResponsiveContainer></div></Panel>
      </div>
    </>
  );
}

export function SalaryStructure() {
  const { employees } = useLiveEmployees();
  return (
    <>
      <SectionHeader title="Salary structure" description="Monthly earnings components per employee. Statutory: PF 12% of basic (capped ₹15,000), ESI 0.75% up to ₹21,000 gross, Kerala professional tax." actions={<ExportButtons />} />
      <DataTable rows={employees} getId={(e) => e.id} entity="salary structure" search={(e) => `${e.name} ${e.id}`} filters={[{ label: "Departments", get: (e) => e.dept }]} removeLabel={null}
        columns={[
          { key: "e", header: "Employee", sort: (e) => e.name, render: (e) => <Person e={e} sub={e.designation} /> },
          { key: "b", header: "Basic", align: "right", sort: (e) => e.basic, render: (e) => inr(e.basic) },
          { key: "h", header: "HRA", align: "right", render: (e) => inr(e.hra) },
          { key: "c", header: "Conveyance", align: "right", render: (e) => inr(e.conveyance) },
          { key: "s", header: "Special", align: "right", render: (e) => inr(e.special) },
          { key: "g", header: "Gross", align: "right", sort: (e) => e.gross, render: (e) => <b>{inr(e.gross)}</b> },
          { key: "pf", header: "Employer PF", align: "right", render: (e) => inr(Math.round(Math.min(e.basic, 15000) * 0.13)) },
        ]}
        form={(e) => <FormGrid fields={[{ label: "Basic (₹)", value: e?.basic, type: "number" }, { label: "HRA (₹)", value: e?.hra, type: "number" }, { label: "Conveyance (₹)", value: e?.conveyance, type: "number" }, { label: "Special allowance (₹)", value: e?.special, type: "number" }, { label: "PF applicable", value: "Yes", options: ["Yes", "No"] }, { label: "ESI applicable", value: e && e.gross <= 21000 ? "Yes" : "No", options: ["Yes", "No"] }]} />}
      />
    </>
  );
}

export function MonthlyPayroll() {
  const { employees, getEmp } = useLiveEmployees();
  const [runs, setRuns] = useState<Run[]>(payrollRuns);
  const [month, setMonth] = useState("October 2026");
  const [confirm, setConfirm] = useState(false);
  const [slip, setSlip] = useState<Slip | null>(null);
  const [liveSlips, setLiveSlips] = useState<Slip[]>([]);
  const [calculating, setCalculating] = useState(false);

  const fetchRunsAndSlips = () => {
    Promise.allSettled([
      api.get<any>("/hr/payroll-runs/"),
      api.get<any>(`/hr/payroll-slips/?month=${encodeURIComponent(month)}`),
    ]).then(([runRes, slipRes]) => {
      if (runRes.status === "fulfilled") {
        const list = Array.isArray(runRes.value) ? runRes.value : (runRes.value?.results ?? []);
        if (list.length > 0) {
          const mapped: Run[] = list.map((r: any) => ({
            id: r.code || `PR-${r.id}`,
            month: r.month,
            status: r.status as Run["status"],
            employees: r.total_employees,
            gross: Number(r.gross_amount) || 0,
            deductions: Number(r.deductions_amount) || 0,
            net: Number(r.net_amount) || 0,
            processed: r.processed_date || "—",
            by: r.processed_by || "Accounts Manager",
          }));
          setRuns(mapped);
        }
      }
      if (slipRes.status === "fulfilled") {
        const list = Array.isArray(slipRes.value) ? slipRes.value : (slipRes.value?.results ?? []);
        const mapped: Slip[] = list.map((s: any) => ({
          id: s.code || `PS-${s.id}`,
          emp: s.employee_code || (s.employee?.code ?? String(s.employee)),
          month: s.month,
          days: s.working_days ?? 30,
          lop: s.lop_days ?? 0,
          basic: Number(s.basic) || 0,
          hra: Number(s.hra) || 0,
          conveyance: Number(s.conveyance) || 0,
          special: Number(s.special) || 0,
          overtime: Number(s.overtime) || 0,
          ta: Number(s.ta) || 0,
          adjust: Number(s.adjust) || 0,
          gross: Number(s.gross) || 0,
          pf: Number(s.pf) || 0,
          esi: Number(s.esi) || 0,
          pt: Number(s.pt) || 0,
          tds: Number(s.tds) || 0,
          advance: Number(s.advance) || 0,
          deductions: Number(s.deductions) || 0,
          net: Number(s.net) || 0,
          iso: new Date().toISOString().slice(0, 10),
        }));
        setLiveSlips(mapped);
      }
    });
  };

  useEffect(() => {
    fetchRunsAndSlips();
  }, [month]);

  const handleGeneratePayroll = async () => {
    setCalculating(true);
    try {
      const res = await api.post<any>("/hr/payroll-runs/generate_monthly/", { month });
      toast.success(`Payroll generated for ${month} (${res?.total_employees || 0} employees) with real Attendance & LOP sync`);
      fetchRunsAndSlips();
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate payroll");
    } finally {
      setCalculating(false);
    }
  };

  const fallbackRun: Run = { id: "", month, status: "Draft", employees: 0, gross: 0, deductions: 0, net: 0, processed: "—", by: "—" };
  const run = runs.find((r) => r.month === month) ?? runs[0] ?? fallbackRun;
  const slips: Slip[] = liveSlips.length > 0 ? liveSlips : employees.map((e) => slipFor(e, month, months.indexOf(month)));
  const idx = flow.indexOf(run.status);
  const next = flow[idx + 1];

  const advance = async () => {
    if (run?.id) {
      try {
        await api.post(`/hr/payroll-runs/${run.id}/advance_status/`);
      } catch (err) {
        console.warn("Could not advance payroll run status on backend:", err);
      }
    }
    setRuns((rs) => rs.map((r) => (r.month === month ? { ...r, status: next!, processed: next === "Processed" ? new Date().toISOString().slice(0, 10) : r.processed } : r)));
    toast.success(`${month} payroll moved to ${next}${next === "Processed" ? " — bank transfer file generated" : ""}`);
    setConfirm(false);
  };

  return (
    <>
      <SectionHeader title="Monthly payroll" description="Draft → Review → Approved → Processed" actions={<>
        <Select value={month} onValueChange={setMonth}><SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger><SelectContent>{months.concat(["October 2026"]).filter((v, i, a) => a.indexOf(v) === i).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
        <Button size="sm" variant="outline" onClick={handleGeneratePayroll} disabled={calculating}>
          <RotateCcw className={`size-4 mr-1.5 ${calculating ? "animate-spin" : ""}`} /> {calculating ? "Calculating..." : "Run / Recalculate Payroll"}
        </Button>
        <ExportButtons />
        {next ? <Button size="sm" onClick={() => setConfirm(true)}><Check className="size-4" /> {next === "Review" ? "Submit for review" : next === "Approved" ? "Approve payroll" : "Process payments"}</Button> : null}
      </>} />
      <Steps steps={[...flow]} current={run.status === "Processed" ? 4 : idx} />
      <div className="grid gap-3 sm:grid-cols-4">
        <KpiCard label="Employees" value={String(slips.length)} />
        <KpiCard label="Gross" value={inr(sum(slips, (s) => s.gross))} />
        <KpiCard label="Deductions" value={inr(sum(slips, (s) => s.deductions))} />
        <KpiCard label="Net pay" value={inr(sum(slips, (s) => s.net))} hint={run.status === "Processed" ? `Paid on ${run.processed}` : "Not yet paid"} />
      </div>
      <DataTable rows={slips} getId={(s) => s.id} entity="payroll line" search={(s) => `${getEmp(s.emp)?.name ?? s.emp} ${s.emp}`} filters={[{ label: "Departments", get: (s) => getEmp(s.emp)?.dept ?? "General" }]} removeLabel={null} pageSize={10}
        onRowClick={setSlip} extraActions={[{ label: "View payslip", icon: <Eye className="size-4" />, onClick: setSlip }]}
        columns={[
          { key: "e", header: "Employee", sort: (s) => getEmp(s.emp)?.name ?? s.emp, render: (s) => <Person e={getEmp(s.emp)} sub={`${s.days} paid days${s.lop ? ` · ${s.lop} LOP` : ""}`} /> },
          { key: "b", header: "Basic", align: "right", render: (s) => inr(s.basic) },
          { key: "al", header: "Allowances", align: "right", render: (s) => inr(s.hra + s.conveyance + s.special) },
          { key: "ot", header: "Overtime", align: "right", sort: (s) => s.overtime, render: (s) => (s.overtime ? inr(s.overtime) : <M>—</M>) },
          { key: "ta", header: "Travel", align: "right", sort: (s) => s.ta, render: (s) => (s.ta ? inr(s.ta) : <M>—</M>) },
          { key: "adj", header: "Adjust.", align: "right", render: (s) => (s.adjust ? inr(s.adjust) : <M>—</M>) },
          { key: "g", header: "Gross", align: "right", sort: (s) => s.gross, render: (s) => inr(s.gross) },
          { key: "d", header: "Deductions", align: "right", sort: (s) => s.deductions, render: (s) => <span className="text-destructive">{inr(s.deductions)}</span> },
          { key: "n", header: "Net", align: "right", sort: (s) => s.net, render: (s) => <b>{inr(s.net)}</b> },
        ]}
        footer={(r) => <tfoot className="border-t border-border bg-muted/40 font-semibold"><tr><td colSpan={6} className="p-3 text-right text-sm">Total ({r.length})</td><td className="p-3 text-right text-sm tabular">{inr(sum(r, (s) => s.gross))}</td><td className="p-3 text-right text-sm tabular">{inr(sum(r, (s) => s.deductions))}</td><td className="p-3 text-right text-sm tabular">{inr(sum(r, (s) => s.net))}</td><td /></tr></tfoot>}
      />
      <PayslipDialog slip={slip} onClose={() => setSlip(null)} />
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {month} payroll to {next}?</AlertDialogTitle>
            <AlertDialogDescription>The payroll will transition to {next} stage.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={advance}>Confirm</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function printPayslip(slip: Slip, e: any) {
  const earn: [string, number][] = [
    ["Basic", slip.basic],
    ["House rent allowance", slip.hra],
    ["Conveyance", slip.conveyance],
    ["Special allowance", slip.special],
    ["Overtime", slip.overtime],
    ["Travel allowance", slip.ta],
    ["Other adjustments", slip.adjust],
  ];
  const ded: [string, number][] = [
    ["Provident fund (12%)", slip.pf],
    ["ESI (0.75%)", slip.esi],
    ["Professional tax", slip.pt],
    ["Income tax (TDS)", slip.tds],
    ["Salary advance", slip.advance],
  ];

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    window.print();
    return;
  }
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Payslip_${slip.id}_${(e.name || "Employee").replace(/\\s+/g, "_")}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #111; line-height: 1.4; padding: 20px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #13213f; padding-bottom: 12px; margin-bottom: 16px; }
          .company-name { font-size: 20px; font-weight: bold; color: #13213f; }
          .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; font-size: 12px; background: #f8fafc; padding: 12px; border-radius: 6px; margin-bottom: 20px; }
          .meta-label { color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 600; }
          .meta-val { font-weight: 600; color: #0f172a; margin-top: 2px; }
          .tables-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
          th { text-align: left; background: #f1f5f9; color: #334155; font-size: 11px; text-transform: uppercase; font-weight: 600; }
          .num { text-align: right; }
          .subtotal { font-weight: bold; background: #f8fafc; }
          .net-box { margin-top: 24px; padding: 14px 20px; background: #13213f; color: #fff; font-size: 16px; font-weight: bold; display: flex; justify-content: space-between; border-radius: 6px; }
          .footer-note { margin-top: 24px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="company-name">${company.name}</div>
            <div style="font-size: 12px; color: #475569;">${company.location}</div>
            <div style="font-size: 12px; color: #475569;">GSTIN: ${company.gstin} · Phone: ${company.phone}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 18px; font-weight: bold; color: #13213f;">PAYSLIP</div>
            <div style="font-size: 13px; font-weight: 600; color: #475569;">${slip.month}</div>
            <div style="font-size: 11px; color: #64748b;">Ref: ${slip.id}</div>
          </div>
        </div>
        <div class="meta-grid">
          <div><div class="meta-label">Employee Name</div><div class="meta-val">${e.name || "—"}</div></div>
          <div><div class="meta-label">Employee ID</div><div class="meta-val">${e.id || slip.emp}</div></div>
          <div><div class="meta-label">Department</div><div class="meta-val">${e.dept || "General"}</div></div>
          <div><div class="meta-label">Designation</div><div class="meta-val">${e.designation || "Staff"}</div></div>
          <div><div class="meta-label">Paid Days / LOP</div><div class="meta-val">${slip.days} days / ${slip.lop} LOP</div></div>
          <div><div class="meta-label">Bank Account</div><div class="meta-val">${e.bank || "Bank"} - ${e.account || "—"}</div></div>
        </div>
        <div class="tables-grid">
          <div>
            <table>
              <thead><tr><th>Earnings</th><th class="num">Amount (₹)</th></tr></thead>
              <tbody>
                ${earn.filter(([, v]) => v).map(([l, v]) => `<tr><td>${l}</td><td class="num">${inr(v)}</td></tr>`).join("")}
                <tr class="subtotal"><td>Total Earnings</td><td class="num">${inr(slip.gross)}</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <table>
              <thead><tr><th>Deductions</th><th class="num">Amount (₹)</th></tr></thead>
              <tbody>
                ${ded.filter(([, v]) => v).map(([l, v]) => `<tr><td>${l}</td><td class="num">${inr(v)}</td></tr>`).join("")}
                <tr class="subtotal"><td>Total Deductions</td><td class="num">${inr(slip.deductions)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="net-box">
          <span>Net Take-Home Pay</span>
          <span>${inr(slip.net)}</span>
        </div>
        <div class="footer-note">
          This is a system-generated salary payslip for Zamirzac Solutions ERP. No physical signature is required.
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 300);
  toast.success(`Payslip ${slip.id} ready for printing / PDF save`);
}

export function PayslipDialog({ slip, onClose }: { slip: Slip | null; onClose: () => void }) {
  if (!slip) return null;
  const { getEmp } = useLiveEmployees();
  const e = getEmp(slip.emp);
  const earn: [string, number][] = [["Basic", slip.basic], ["House rent allowance", slip.hra], ["Conveyance", slip.conveyance], ["Special allowance", slip.special], ["Overtime", slip.overtime], ["Travel allowance", slip.ta], ["Other adjustments", slip.adjust]];
  const ded: [string, number][] = [["Provident fund (12%)", slip.pf], ["ESI (0.75%)", slip.esi], ["Professional tax", slip.pt], ["Income tax (TDS)", slip.tds], ["Salary advance", slip.advance]];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Payslip preview</DialogTitle><DialogDescription>{slip.id}</DialogDescription></DialogHeader>
        <div className="max-h-[65vh] overflow-auto rounded-md border border-border bg-card p-5 text-sm">
          <div className="flex items-start justify-between border-b border-border pb-3">
            <div className="flex items-start gap-3"><CompanyLogo className="h-12 w-12" /><div><p className="text-base font-semibold text-primary">{company.name}</p><p className="text-xs text-muted-foreground">{company.location}</p><p className="text-xs text-muted-foreground">GSTIN {company.gstin} · {company.phone} · {company.email}</p></div></div>
            <div className="text-right"><p className="font-semibold">Payslip</p><p className="text-xs text-muted-foreground">{slip.month}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 py-3 text-xs sm:grid-cols-3">
            {[["Employee", e.name], ["ID", e.id], ["Designation", e.designation], ["Department", e.dept], ["Paid days", `${slip.days} / 30`], ["LOP days", String(slip.lop)], ["Bank", e.bank], ["Account", e.account], ["UAN", e.uan]].map(([a, b]) => <div key={a}><M>{a}</M><p className="font-medium">{b}</p></div>)}
          </div>
          <div className="grid gap-4 border-t border-border pt-3 sm:grid-cols-2">
            {([["Earnings", earn, slip.gross], ["Deductions", ded, slip.deductions]] as const).map(([t, rows, total]) => (
              <div key={t}><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t}</p>
                <ul className="space-y-1">{rows.filter(([, v]) => v).map(([l, v]) => <li key={l} className="flex justify-between"><span>{l}</span><span className="tabular">{inr(v)}</span></li>)}</ul>
                <p className="mt-2 flex justify-between border-t border-border pt-1.5 font-semibold"><span>Total {t.toLowerCase()}</span><span className="tabular">{inr(total)}</span></p></div>))}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-md bg-primary px-4 py-3 text-primary-foreground"><span className="font-medium">Net pay</span><span className="text-lg font-semibold tabular">{inr(slip.net)}</span></div>
          <p className="mt-2 text-[11px] text-muted-foreground">Computer-generated payslip — no signature required. Demo values.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => printPayslip(slip, e)}><Printer className="size-4" /> Print / Save PDF</Button>
          <Button onClick={() => { toast.success(`Payslip emailed to ${e.email}`); onClose(); }}><Send className="size-4" /> Email to employee</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Payslips() {
  const [slip, setSlip] = useState<Slip | null>(null);
  const { getEmp } = useLiveEmployees();
  const [liveSlips, setLiveSlips] = useState<Slip[]>([]);

  useEffect(() => {
    api.get<any>("/hr/payroll-slips/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        if (list.length > 0) {
          const mapped: Slip[] = list.map((s: any) => ({
            id: s.code || `PS-${s.id}`,
            emp: s.employee_code || (s.employee?.code ?? String(s.employee)),
            month: s.month,
            days: s.working_days || 30,
            lop: s.lop_days || 0,
            basic: Number(s.basic) || 0,
            hra: Number(s.hra) || 0,
            conveyance: Number(s.conveyance) || 0,
            special: Number(s.special) || 0,
            overtime: Number(s.overtime) || 0,
            ta: Number(s.ta) || 0,
            adjust: Number(s.adjust) || 0,
            gross: Number(s.gross) || 0,
            pf: Number(s.pf) || 0,
            esi: Number(s.esi) || 0,
            pt: Number(s.pt) || 0,
            tds: Number(s.tds) || 0,
            advance: Number(s.advance) || 0,
            deductions: Number(s.deductions) || 0,
            net: Number(s.net) || 0,
            iso: s.month?.includes("Sep") ? "2026-09-30" : s.month?.includes("Oct") ? "2026-10-31" : "2026-08-31",
          }));
          setLiveSlips(mapped);
        }
      })
      .catch(() => {});
  }, []);

  const seedRows = useMemo(
    () => months.slice(-3).flatMap((m, i) => activeEmps.map((e) => ({ ...slipFor(e, m, i + 3), iso: `2026-${String(7 + i).padStart(2, "0")}-30` }))),
    []
  );

  const rows = useMemo(() => {
    if (liveSlips.length > 0) {
      const liveCodes = new Set(liveSlips.map((s) => s.id));
      return [...liveSlips, ...seedRows.filter((s) => !liveCodes.has(s.id))];
    }
    return seedRows;
  }, [liveSlips, seedRows]);

  return (
    <>
      <SectionHeader title="Payslips" description="Released payslips for the last three months." />
      <DataTable rows={rows} getId={(s) => s.id} entity="payslip" search={(s) => `${getEmp(s.emp)?.name ?? s.emp} ${s.id}`} date={(s) => s.iso} filters={[{ label: "Months", get: (s) => s.month }, { label: "Departments", get: (s) => getEmp(s.emp)?.dept ?? "General" }]} removeLabel={null} onRowClick={setSlip}
        extraActions={[
          { label: "Preview", icon: <Eye className="size-4" />, onClick: setSlip },
          {
            label: "Print / Save PDF",
            icon: <Printer className="size-4" />,
            onClick: (s) => {
              const e = getEmp(s.emp);
              printPayslip(s, e);
            },
          },
        ]}
        columns={[
          { key: "id", header: "Payslip", sort: (s) => s.id, render: (s) => <span className="font-mono text-xs">{s.id}</span> },
          { key: "m", header: "Month", sort: (s) => s.iso, render: (s) => s.month },
          { key: "e", header: "Employee", sort: (s) => getEmp(s.emp)?.name ?? s.emp, render: (s) => <Person e={getEmp(s.emp)} /> },
          { key: "g", header: "Gross", align: "right", render: (s) => inr(s.gross) },
          { key: "n", header: "Net", align: "right", sort: (s) => s.net, render: (s) => <b>{inr(s.net)}</b> },
          { key: "st", header: "Status", render: (s) => <StatusBadge status={s.month === "Sep 2026" ? "pending" : "paid"} label={s.month === "Sep 2026" ? "Draft" : "Released"} /> },
        ]} />
      <PayslipDialog slip={slip} onClose={() => setSlip(null)} />
    </>
  );
}

export function SalaryHistory() {
  const { getEmp } = useLiveEmployees();
  return (
    <>
      <SectionHeader title="Salary history" description="Increments, promotions and revisions." actions={<ExportButtons />} />
      <DataTable rows={salaryHistory} getId={(h) => h.id} entity="revision" search={(h) => `${getEmp(h.emp)?.name ?? h.emp} ${h.change}`} date={(h) => h.iso} filters={[{ label: "Changes", get: (h) => h.change }]} removeLabel={null}
        columns={[
          { key: "e", header: "Employee", sort: (h) => getEmp(h.emp)?.name ?? h.emp, render: (h) => <Person e={getEmp(h.emp)} /> },
          { key: "eff", header: "Effective", sort: (h) => h.iso, render: (h) => h.effective },
          { key: "c", header: "Change", render: (h) => h.change },
          { key: "o", header: "Previous gross", align: "right", render: (h) => inr(h.old) },
          { key: "n", header: "New gross", align: "right", sort: (h) => h.next, render: (h) => <b>{inr(h.next)}</b> },
          { key: "p", header: "Hike", align: "right", sort: (h) => h.next / (h.old || 1), render: (h) => <span className="text-success">+{(((h.next - h.old) / (h.old || 1)) * 100).toFixed(1)}%</span> },
          { key: "by", header: "Approved by", render: (h) => <M>{h.by}</M> },
        ]}
        detail={(h) => <DetailGrid items={[["Employee", getEmp(h.emp)?.name ?? h.emp], ["Effective", h.effective], ["Change", h.change], ["Previous", inr(h.old)], ["New", inr(h.next)], ["Approved by", h.by]]} />} />
    </>
  );
}

export function PayrollReports() {
  const { employees, getEmp } = useLiveEmployees();
  const [month, setMonth] = useState(() => months.at(-2) ?? months[0] ?? "October 2026");
  const slips = employees.map((e) => slipFor(e, month, months.indexOf(month)));
  const reports: [string, string, number][] = [["PF contribution (ECR)", "Employee + employer PF for EPFO upload", sum(slips, (s) => s.pf) * 2], ["ESI contribution", "Employee 0.75% + employer 3.25%", sum(slips, (s) => s.esi) * 5.33], ["Professional tax", "Kerala PT — payable to local body", sum(slips, (s) => s.pt)], ["TDS on salary (24Q)", "Income tax deducted", sum(slips, (s) => s.tds)], ["Bank transfer statement", "Net pay by bank", sum(slips, (s) => s.net)], ["Overtime & travel", "Variable pay summary", sum(slips, (s) => s.overtime + s.ta)]];
  return (
    <>
      <SectionHeader title="Payroll reports" description="Statutory and management reports." actions={<Select value={month} onValueChange={setMonth}><SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger><SelectContent>{months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{reports.map(([t, d, v]) => (
        <Panel key={t}><p className="font-semibold">{t}</p><p className="text-xs text-muted-foreground">{d}</p><p className="mt-3 text-xl font-semibold tabular">{inr(Math.round(v))}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => {
              const csv = `Report,Month,Amount\n"${t}","${month}",${Math.round(v)}\n`;
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${t.replace(/[^a-zA-Z0-9]/g, "_")}_${month}.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              toast.success(`Exported ${t}`);
            }}><Download className="size-4" /> CSV</Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="size-4" /> Print / PDF</Button>
          </div>
        </Panel>))}</div>
      <Panel title={`Department summary · ${month}`} bodyClassName="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="p-3 text-left font-medium">Department</th><th className="p-3 text-right font-medium">Employees</th><th className="p-3 text-right font-medium">Gross</th><th className="p-3 text-right font-medium">Deductions</th><th className="p-3 text-right font-medium">Net</th></tr></thead>
        <tbody className="divide-y divide-border">{departments.map((d) => { const s = slips.filter((x) => (getEmp(x.emp)?.dept || "General") === d.name); return <tr key={d.id}><td className="p-3">{d.name}</td><td className="p-3 text-right tabular">{s.length}</td><td className="p-3 text-right tabular">{inr(sum(s, (x) => x.gross))}</td><td className="p-3 text-right tabular">{inr(sum(s, (x) => x.deductions))}</td><td className="p-3 text-right font-medium tabular">{inr(sum(s, (x) => x.net))}</td></tr>; })}</tbody></table></div></Panel>
    </>
  );
}
