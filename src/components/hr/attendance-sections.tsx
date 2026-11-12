import { useEffect, useMemo, useState } from "react";
import { Camera, Check, ChevronLeft, ChevronRight, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { KpiCard, Panel, StatusBadge } from "@/components/erp/primitives";
import { DataTable, DetailGrid, FormGrid } from "@/components/erp/DataTable";
import { ExportButtons, SectionHeader } from "@/components/erp/ModuleLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { activeEmps, attendance as seedAttendance, empById, leaveTypes, leaves as seedLeaves, type AttStatus, type Employee, type Leave } from "@/data/hr";
import { api, getStoredUser } from "@/lib/api";
import { useCan } from "@/lib/access";
import { M, Person, axis, tip } from "./common";

const statuses: AttStatus[] = ["Present", "Late", "Half Day", "Leave", "Absent"];
const colors: Record<AttStatus, string> = {
  Present: "var(--color-success)",
  Late: "var(--color-warning)",
  "Half Day": "var(--color-chart-4)",
  Leave: "var(--color-chart-2)",
  Absent: "var(--color-destructive)",
};

const badge = (s: AttStatus) => (
  <StatusBadge
    status={s === "Present" ? "active" : s === "Late" || s === "Half Day" ? "pending" : s === "Absent" ? "overdue" : "info"}
    label={s}
  />
);

const leaveBadge = (s: Leave["status"]) => (
  <StatusBadge
    status={s === "Requested" ? "pending" : s === "Rejected" ? "rejected" : s === "Approved" ? "approved" : "completed"}
    label={s}
  />
);

export const getTodayIso = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export function useLiveEmployees() {
  const canViewEmployees = useCan("View", "Employees");
  const [employees, setEmployees] = useState<Employee[]>(() => {
    if (typeof window !== "undefined") {
      const user = getStoredUser();
      if (user && !canViewEmployees) {
        return [
          {
            id: (user as any).employee_code || `EMP-${user.id}`,
            name: user.name || "Self",
            initials: (user.name || "U").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
            gender: "Male",
            dept: "Production & Inventory",
            designation: user.role || "Staff",
            phone: "",
            email: user.email || "",
            joined: "",
            joinedIso: "",
            dob: "",
            dobIso: "",
            status: "Active",
            city: "Calicut",
            address: "",
            blood: "",
            pan: "",
            uan: "",
            bank: "",
            account: "",
            basic: 0,
            hra: 0,
            conveyance: 0,
            special: 0,
            gross: 0,
            manager: "",
            type: "Full-time",
            vehicle: "None",
          },
        ];
      }
    }
    return activeEmps;
  });

  useEffect(() => {
    if (!canViewEmployees) {
      const user = getStoredUser();
      if (user) {
        setEmployees([
          {
            id: (user as any).employee_code || `EMP-${user.id}`,
            name: user.name || "Self",
            initials: (user.name || "U").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
            gender: "Male",
            dept: "Production & Inventory",
            designation: user.role || "Staff",
            phone: "",
            email: user.email || "",
            joined: "",
            joinedIso: "",
            dob: "",
            dobIso: "",
            status: "Active",
            city: "Calicut",
            address: "",
            blood: "",
            pan: "",
            uan: "",
            bank: "",
            account: "",
            basic: 0,
            hra: 0,
            conveyance: 0,
            special: 0,
            gross: 0,
            manager: "",
            type: "Full-time",
            vehicle: "None",
          },
        ]);
      }
      return;
    }

    api.get<any>("/hr/employees/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        if (list.length > 0) {
          const mapped = list.map((e: any) => ({
            pk: e.id,
            id: e.code || `EMP-${e.id}`,
            name: e.name,
            initials: e.initials || e.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
            gender: (e.gender || "Male") as any,
            dept: e.department_name || e.department || "General",
            designation: e.designation_title || e.designation || "Staff",
            phone: e.phone || "",
            email: e.email || "",
            joined: e.joined_date || "",
            joinedIso: e.joined_date || "",
            dob: e.dob || "",
            dobIso: e.dob || "",
            status: e.status || "Active",
            city: e.city || "Kozhikode",
            address: e.address || "",
            blood: e.blood_group || "",
            pan: e.pan || "",
            uan: e.uan || "",
            bank: e.bank_name || "",
            account: e.account_number || "",
            basic: Number(e.basic_salary) || 0,
            hra: Number(e.hra) || 0,
            conveyance: Number(e.conveyance) || 0,
            special: Number(e.special_allowance) || 0,
            gross: Number(e.gross_salary) || 0,
            manager: e.manager_name || "",
            type: e.employment_type || "Full-time",
            vehicle: e.vehicle_type || "None",
          }));
          setEmployees(mapped);
        }
      })
      .catch(() => {});
  }, [canViewEmployees]);

  const getEmp = (idOrCode: string): Employee => {
    if (!idOrCode) return employees[0] ?? empById("EMP-01");
    const lower = idOrCode.toLowerCase();
    const found = employees.find(
      (e) => e.id === idOrCode || e.name === idOrCode || e.id.toLowerCase() === lower || e.name.toLowerCase() === lower
    );
    if (found) return found;
    return empById(idOrCode);
  };

  return { employees, getEmp };
}

export function useLiveLeaveTypes() {
  const [types, setTypes] = useState(leaveTypes);

  const fetchTypes = () => {
    api.get<any>("/hr/leave-types/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        if (list.length > 0) {
          const mapped = list.map((t: any) => ({
            code: t.code,
            name: t.name,
            days: Number(t.days_per_year) || 0,
            carry: Boolean(t.carry_forward),
            paid: Boolean(t.is_paid),
            color: t.color || "#3b82f6",
          }));
          setTypes(mapped);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  return { types, refetch: fetchTypes };
}

export function AttendanceDashboard() {
  const { employees, getEmp } = useLiveEmployees();
  const [records, setRecords] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem("zs_cached_attendance_records");
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  const [leaves, setLeaves] = useState<Leave[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem("zs_cached_attendance_leaves");
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  const todayIso = useMemo(() => getTodayIso(), []);

  useEffect(() => {
    Promise.all([
      api.get<any>("/hr/attendance/").catch(() => null),
      api.get<any>("/hr/leaves/").catch(() => null),
    ]).then(([attRes, leaveRes]) => {
      if (attRes) {
        const list = Array.isArray(attRes) ? attRes : (attRes?.results ?? []);
        const mapped = list.map((a: any) => ({
          id: String(a.id),
          emp: a.employee_code || a.employee?.code || String(a.employee),
          iso: a.date,
          date: a.date,
          status: a.status as AttStatus,
          in: a.check_in || "—",
          out: a.check_out || "—",
          hours: Number(a.hours_worked) || 0,
          location: a.location || "Calicut HQ",
          selfie: a.selfie || null,
        }));
        setRecords(mapped);
        try {
          sessionStorage.setItem("zs_cached_attendance_records", JSON.stringify(mapped));
        } catch {}
      }
      if (leaveRes) {
        const list = Array.isArray(leaveRes) ? leaveRes : (leaveRes?.results ?? []);
        const mapped: Leave[] = list.map((l: any) => ({
          id: l.code || `LV-${l.id}`,
          emp: l.employee_code,
          type: l.leave_type,
          from: l.from_date,
          to: l.to_date,
          fromIso: l.from_date,
          days: Number(l.days) || 1,
          reason: l.reason || "",
          status: l.status as Leave["status"],
          applied: l.applied_date,
          approver: l.approver_name || "Manager",
        }));
        setLeaves(mapped);
        try {
          sessionStorage.setItem("zs_cached_attendance_leaves", JSON.stringify(mapped));
        } catch {}
      }
    });
  }, []);

  const currentMonthPrefix = todayIso.slice(0, 7);
  const days = Array.from(new Set(records.map((a) => a.iso))).sort().slice(-14);
  const daily = days.map((d) => ({
    d: d.slice(5),
    ...Object.fromEntries(statuses.map((s) => [s, records.filter((a) => a.iso === d && a.status === s).length])),
  }));
  const todayRecords = records.filter((a) => a.iso === todayIso);
  const mix = statuses.map((s) => ({
    name: s,
    value: records.filter((a) => a.iso.startsWith(currentMonthPrefix) && a.status === s).length,
  }));

  const monthLabel = new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });
  const todayLabel = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <>
      <SectionHeader title="Attendance dashboard" description={`${todayLabel} · live biometric and mobile check-ins`} actions={<ExportButtons />} />
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {statuses.map((s) => (
          <KpiCard key={s} label={s} value={String(todayRecords.filter((a) => a.status === s).length)} hint="Today" />
        ))}
        <KpiCard
          label="Pending leave"
          value={String(leaves.filter((l) => l.status === "Requested").length)}
          hint="Awaiting approval"
          tone="down"
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Daily attendance" description="Recent recorded days" className="xl:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="d" {...axis} />
                <YAxis {...axis} />
                <RTooltip contentStyle={tip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {statuses.map((s) => (
                  <Bar key={s} dataKey={s} stackId="a" fill={colors[s]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title={`${monthLabel} mix`}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={mix} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>
                  {mix.map((m) => (
                    <Cell key={m.name} fill={colors[m.name as AttStatus]} />
                  ))}
                </Pie>
                <RTooltip contentStyle={tip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <MonthlySummary employees={employees} records={records} currentMonthPrefix={currentMonthPrefix} monthLabel={monthLabel} />
    </>
  );
}

function MonthlySummary({
  employees,
  records,
  currentMonthPrefix,
  monthLabel,
}: {
  employees: Employee[];
  records: Array<{ emp: string; iso: string; status: AttStatus; hours: number }>;
  currentMonthPrefix: string;
  monthLabel: string;
}) {
  const rows = employees.map((e) => {
    const a = records.filter((x) => (x.emp === e.id || x.emp === e.name) && x.iso.startsWith(currentMonthPrefix));
    return {
      e,
      ...Object.fromEntries(statuses.map((s) => [s, a.filter((x) => x.status === s).length])) as Record<AttStatus, number>,
      total: a.length,
      hours: a.reduce((s, x) => s + x.hours, 0),
    };
  });

  return (
    <DataTable
      rows={rows}
      getId={(r) => r.e.id}
      entity="employee"
      search={(r) => r.e.name}
      filters={[{ label: "Departments", get: (r) => r.e.dept }]}
      removeLabel={null}
      columns={[
        { key: "e", header: `Employee · ${monthLabel}`, sort: (r) => r.e.name, render: (r) => <Person e={r.e} sub={r.e.dept} /> },
        ...statuses.map((s) => ({
          key: s,
          header: s,
          align: "right" as const,
          sort: (r: (typeof rows)[number]) => r[s],
          render: (r: (typeof rows)[number]) => <span className={cn(s === "Absent" && r[s] > 1 && "font-medium text-destructive")}>{r[s]}</span>,
        })),
        {
          key: "pct",
          header: "Attendance",
          align: "right",
          sort: (r) => (r.Present + r.Late) / Math.max(1, r.total),
          render: (r) => `${Math.round(((r.Present + r.Late + r["Half Day"] * 0.5) / Math.max(1, r.total)) * 100)}%`,
        },
        { key: "h", header: "Hours", align: "right", render: (r) => r.hours.toFixed(1) },
      ]}
    />
  );
}

export function DailyAttendance() {
  const todayIso = useMemo(() => getTodayIso(), []);
  const [date, setDate] = useState(todayIso);
  const [rows, setRows] = useState<any[]>([]);
  const [viewingSelfie, setViewingSelfie] = useState<any | null>(null);
  const { getEmp } = useLiveEmployees();

  useEffect(() => {
    api.get<any>("/hr/attendance/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const mapped = list.map((a: any) => ({
          id: String(a.id),
          emp: a.employee_code || a.employee?.code || String(a.employee),
          employee_name: a.employee_name || a.employee?.name,
          iso: a.date,
          date: a.date,
          status: a.status as AttStatus,
          in: a.check_in || "—",
          out: a.check_out || "—",
          hours: Number(a.hours_worked) || 0,
          location: a.location || "Calicut HQ",
          selfie: a.selfie || null,
          latitude: a.latitude,
          longitude: a.longitude,
        }));
        setRows(mapped);
      })
      .catch(() => {});
  }, []);

  const day = rows.filter((a) => a.iso === date);

  return (
    <>
      <SectionHeader
        title="Daily attendance"
        description="Check-in and check-out for the selected day. Correct entries from the row menu."
        actions={
          <>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" aria-label="Date" />
            <ExportButtons />
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-5">
        {statuses.map((s) => (
          <KpiCard key={s} label={s} value={String(day.filter((a) => a.status === s).length)} />
        ))}
      </div>
      <DataTable
        rows={day}
        getId={(a) => a.id}
        entity="attendance entry"
        search={(a) => `${getEmp(a.emp)?.name ?? a.employee_name ?? a.emp} ${a.location}`}
        filters={[{ label: "Statuses", get: (a) => a.status }, { label: "Locations", get: (a) => a.location }]}
        removeLabel={null}
        extraActions={statuses.map((s) => ({
          label: `Mark ${s}`,
          show: (a: (typeof day)[number]) => a.status !== s,
          onClick: async (a: (typeof day)[number]) => {
            try {
              if (a.id && !isNaN(Number(a.id))) {
                await api.patch(`/hr/attendance/${a.id}/`, { status: s });
              }
              setRows((rs) => rs.map((x) => (x.id === a.id ? { ...x, status: s } : x)));
              const empName = getEmp(a.emp)?.name ?? a.employee_name ?? a.emp;
              toast.success(`${empName} marked ${s}`);
            } catch (err: any) {
              toast.error(err?.message || "Failed to update attendance status");
            }
          },
        }))}
        columns={[
          {
            key: "e",
            header: "Employee",
            sort: (a) => getEmp(a.emp)?.name ?? a.emp,
            render: (a) => {
              const emp = getEmp(a.emp);
              if (a.employee_name && emp.name === a.emp) {
                emp.name = a.employee_name;
              }
              return <Person e={emp} sub={emp.dept ?? "Staff"} />;
            },
          },
          {
            key: "selfie",
            header: "Selfie",
            align: "center",
            render: (a) => {
              const selfieSrc = a.selfie
                ? (a.selfie.startsWith("http") || a.selfie.startsWith("data:") ? a.selfie : `http://127.0.0.1:8000${a.selfie}`)
                : null;
              return selfieSrc ? (
                <button
                  type="button"
                  onClick={() => setViewingSelfie({ ...a, selfieSrc })}
                  className="group relative flex size-9 items-center justify-center overflow-hidden rounded-full border border-border shadow-xs hover:border-primary transition-all cursor-pointer"
                  title="Click to view full punch selfie"
                >
                  <img
                    src={selfieSrc}
                    alt="Punch selfie"
                    className="size-full object-cover group-hover:scale-110 transition-transform"
                  />
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              );
            },
          },
          {
            key: "in",
            header: "Check-in",
            sort: (a) => a.in,
            render: (a) => <span className={cn("tabular", a.status === "Late" && "text-warning-foreground font-medium")}>{a.in}</span>,
          },
          { key: "out", header: "Check-out", render: (a) => <span className="tabular">{a.out}</span> },
          { key: "h", header: "Hours", align: "right", sort: (a) => a.hours, render: (a) => (a.hours ? a.hours.toFixed(2) : <M>—</M>) },
          { key: "loc", header: "Location", render: (a) => <M>{a.location}</M> },
          { key: "st", header: "Status", sort: (a) => a.status, render: (a) => badge(a.status) },
        ]}
      />

      <Dialog open={!!viewingSelfie} onOpenChange={(o) => !o && setViewingSelfie(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              {viewingSelfie ? (getEmp(viewingSelfie.emp)?.name ?? viewingSelfie.employee_name ?? viewingSelfie.emp) : "Employee Selfie"} — Check-in Verification
            </DialogTitle>
            <DialogDescription>
              {viewingSelfie?.date} · {viewingSelfie?.in} · {viewingSelfie?.location}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-md border border-border bg-black">
            {viewingSelfie?.selfieSrc ? (
              <img
                src={viewingSelfie.selfieSrc}
                alt="Punch Selfie"
                className="w-full max-h-[70vh] object-contain"
              />
            ) : null}
          </div>
          {viewingSelfie?.latitude && viewingSelfie?.longitude ? (
            <div className="rounded-md border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <MapPin className="size-3.5 text-success" /> Verified GPS Coordinates:
              </p>
              <p className="mt-0.5">{viewingSelfie.latitude}° N, {viewingSelfie.longitude}° E</p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingSelfie(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EmployeeAttendance() {
  const { employees } = useLiveEmployees();
  const [emp, setEmp] = useState("");
  const [allRecs, setAllRecs] = useState<any[]>([]);
  const todayIso = useMemo(() => getTodayIso(), []);
  const [monthStr, setMonthStr] = useState(todayIso.slice(0, 7)); // e.g. "2026-10"
  const [viewingSelfie, setViewingSelfie] = useState<any | null>(null);

  useEffect(() => {
    if (employees.length > 0 && !emp) {
      const user = getStoredUser();
      const currentEmp = employees.find(
        (e) => (user?.email && e.email && e.email.toLowerCase() === user.email.toLowerCase()) ||
               (user?.name && e.name && e.name.toLowerCase() === user.name.toLowerCase())
      );
      setEmp(currentEmp ? currentEmp.id : (employees[0]?.id ?? ""));
    }
  }, [employees, emp]);

  useEffect(() => {
    api.get<any>("/hr/attendance/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const mapped = list.map((a: any) => ({
          id: String(a.id),
          emp: a.employee_code || a.employee?.code || String(a.employee),
          employee_name: a.employee_name || a.employee?.name,
          iso: a.date,
          date: a.date,
          status: a.status as AttStatus,
          in: a.check_in || "—",
          out: a.check_out || "—",
          hours: Number(a.hours_worked) || 0,
          location: a.location || "Calicut HQ",
          selfie: a.selfie || null,
        }));
        setAllRecs(mapped);
      })
      .catch(() => {});
  }, []);

  const selectedEmployee = employees.find((e) => e.id === emp || e.name === emp);
  const recs = allRecs.filter((a) => {
    const matchesEmp =
      a.emp === emp ||
      a.employee_name === emp ||
      (selectedEmployee && (a.emp === selectedEmployee.id || a.employee_name === selectedEmployee.name));
    return matchesEmp && a.iso.startsWith(monthStr);
  });
  const map = Object.fromEntries(recs.map((a) => [a.iso, a]));

  const parts = monthStr.split("-").map(Number);
  const yearNum = parts[0] ?? new Date().getFullYear();
  const monthNum = parts[1] ?? (new Date().getMonth() + 1);
  const firstDay = new Date(yearNum, monthNum - 1, 1).getDay();
  const totalDays = new Date(yearNum, monthNum, 0).getDate();
  const cells = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => `${monthStr}-${String(i + 1).padStart(2, "0")}`),
  ];

  const monthDisplay = new Date(yearNum, monthNum - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });

  return (
    <>
      <SectionHeader
        title="Employee attendance"
        description="Monthly calendar for one employee."
        actions={
          <div className="flex items-center gap-2">
            <Input
              type="month"
              value={monthStr}
              onChange={(e) => e.target.value && setMonthStr(e.target.value)}
              className="h-9 w-40"
              aria-label="Select month"
            />
            <Select value={emp} onValueChange={setEmp}>
              <SelectTrigger className="h-9 w-60">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} ({e.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
      <div className="grid gap-3 sm:grid-cols-5">
        {statuses.map((s) => (
          <KpiCard key={s} label={s} value={String(recs.filter((a) => a.status === s).length)} hint={monthDisplay} />
        ))}
      </div>
      <Panel title={monthDisplay}>
        <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <p key={d} className="pb-1 font-medium text-muted-foreground">
              {d}
            </p>
          ))}
          {cells.map((iso, i) => {
            const a = iso ? map[iso] : null;
            return (
              <div
                key={i}
                className={cn(
                  "min-h-16 rounded-md border p-1.5 text-left",
                  !iso && "border-transparent",
                  iso && !a && "border-border bg-muted/40"
                )}
                style={
                  a
                    ? {
                        borderColor: `color-mix(in oklab, ${colors[(a.status as AttStatus) || "Present"] ?? "var(--primary)"} 45%, transparent)`,
                        background: `color-mix(in oklab, ${colors[(a.status as AttStatus) || "Present"] ?? "var(--primary)"} 12%, transparent)`,
                      }
                    : undefined
                }
              >
                {iso ? (
                  <>
                    <p className="font-semibold tabular">{Number(iso.slice(8))}</p>
                    <p className="truncate text-[11px]">{a ? a.status : iso > todayIso ? "" : "Holiday / Off"}</p>
                    {a && a.in !== "—" ? (
                      <p className="text-[10px] text-muted-foreground tabular">
                        {a.in}–{a.out}
                      </p>
                    ) : null}
                    {a?.selfie ? (
                      <button
                        type="button"
                        onClick={() => setViewingSelfie(a)}
                        className="mt-1 flex items-center gap-1 text-[10px] text-primary hover:underline cursor-pointer"
                        title="View punch selfie"
                      >
                        <Camera className="size-3" /> Photo
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>

      <Dialog open={!!viewingSelfie} onOpenChange={(o) => !o && setViewingSelfie(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{selectedEmployee?.name || viewingSelfie?.emp} — Check-in Selfie</DialogTitle>
            <DialogDescription>
              {viewingSelfie?.date} · {viewingSelfie?.in} · {viewingSelfie?.location}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-md border border-border bg-black">
            {viewingSelfie?.selfie ? (
              <img
                src={viewingSelfie.selfie.startsWith("http") || viewingSelfie.selfie.startsWith("data:") ? viewingSelfie.selfie : `http://127.0.0.1:8000${viewingSelfie.selfie}`}
                alt="Punch Selfie"
                className="w-full max-h-[70vh] object-contain"
              />
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingSelfie(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function LeaveRequests() {
  const [rows, setRows] = useState<Leave[]>([]);
  const [act, setAct] = useState<{ l: Leave; to: Leave["status"] } | null>(null);
  const { employees, getEmp } = useLiveEmployees();
  const { types } = useLiveLeaveTypes();
  const canApprove = useCan("Approve", "Attendance");

  useEffect(() => {
    api.get<any>("/hr/leaves/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const mapped: Leave[] = list.map((l: any) => ({
          id: l.code || `LV-${l.id}`,
          emp: l.employee_code || (l.employee?.code ?? String(l.employee)),
          type: l.leave_type,
          from: l.from_date,
          to: l.to_date,
          fromIso: l.from_date,
          days: Number(l.days) || 1,
          reason: l.reason || "",
          status: l.status as Leave["status"],
          applied: l.applied_date,
          approver: l.approver_name || "Manager",
        }));
        setRows(mapped);
      })
      .catch(() => {});
  }, []);

  const bal = (empId: string, code: string) =>
    (types.find((t) => t.code === code)?.days ?? 0) -
    rows.filter((l) => l.emp === empId && l.type === code && l.status !== "Rejected").reduce((s, l) => s + l.days, 0);

  return (
    <>
      <SectionHeader title="Leave requests" description="Requested → Approved / Rejected → Completed" />
      <div className="grid gap-3 sm:grid-cols-4">
        {(["Requested", "Approved", "Rejected", "Completed"] as const).map((s) => (
          <KpiCard key={s} label={s} value={String(rows.filter((l) => l.status === s).length)} />
        ))}
      </div>
      <DataTable
        rows={rows}
        getId={(l) => l.id}
        entity="leave request"
        createLabel="Apply leave"
        search={(l) => `${getEmp(l.emp)?.name ?? l.emp} ${l.reason} ${l.id}`}
        date={(l) => l.fromIso}
        removeLabel={null}
        filters={[{ label: "Statuses", get: (l) => l.status }, { label: "Leave types", get: (l) => l.type }]}
        extraActions={[
          { label: "Approve", icon: <Check className="size-4" />, show: (l) => canApprove && l.status === "Requested", onClick: (l) => setAct({ l, to: "Approved" }) },
          { label: "Reject", icon: <X className="size-4" />, show: (l) => canApprove && l.status === "Requested", onClick: (l) => setAct({ l, to: "Rejected" }) },
          { label: "Mark completed", show: (l) => canApprove && l.status === "Approved", onClick: (l) => setAct({ l, to: "Completed" }) },
        ]}
        columns={[
          {
            key: "e",
            header: "Employee",
            sort: (l) => getEmp(l.emp)?.name ?? l.emp,
            render: (l) => <Person e={getEmp(l.emp)} sub={l.id} />,
          },
          { key: "t", header: "Type", render: (l) => l.type },
          { key: "d", header: "Dates", sort: (l) => l.fromIso, render: (l) => `${l.from} → ${l.to}` },
          { key: "n", header: "Days", align: "right", render: (l) => l.days },
          { key: "r", header: "Reason", render: (l) => <M>{l.reason}</M> },
          { key: "b", header: "Balance", align: "right", render: (l) => (l.type === "LOP" ? <M>—</M> : `${bal(l.emp, l.type)} left`) },
          { key: "st", header: "Status", sort: (l) => l.status, render: (l) => leaveBadge(l.status) },
        ]}
        detail={(l) => (
          <DetailGrid
            items={[
              ["Employee", getEmp(l.emp)?.name ?? l.emp],
              ["Leave type", types.find((t) => t.code === l.type)?.name ?? l.type],
              ["From", l.from],
              ["To", l.to],
              ["Days", l.days],
              ["Reason", l.reason],
              ["Applied", l.applied],
              ["Approver", l.approver],
              ["Status", l.status],
            ]}
          />
        )}
        form={(l) => {
          const user = getStoredUser();
          const selfEmp = employees.find((e) => e.name === user?.name || (user?.email && e.email === user.email)) || employees[0];
          const availableTypes = types.length > 0 ? types.map((t) => t.code) : ["CL", "SL", "EL", "ML", "LOP", "CO"];
          return (
            <FormGrid
              fields={[
                {
                  label: "Employee",
                  value: l ? (getEmp(l.emp)?.name ?? l.emp) : (canApprove ? (employees[0]?.name ?? "") : (selfEmp?.name ?? user?.name ?? "")),
                  options: canApprove ? employees.map((e) => e.name) : [selfEmp?.name ?? user?.name ?? "Self"],
                  wide: true,
                },
                { label: "Leave type", value: l?.type || "CL", options: availableTypes },
                { label: "Days", value: l?.days ?? 1, type: "number" },
                { label: "From", value: l?.fromIso || getTodayIso(), type: "date" },
                { label: "To", value: l?.to || l?.fromIso || getTodayIso(), type: "date" },
                { label: "Reason", value: l?.reason ?? "", wide: true },
              ]}
            />
          );
        }}
        onSave={async (data, item) => {
          if (!item) {
            const user = getStoredUser();
            const empName = data["Employee"];
            const matchedEmp = employees.find((e) => e.name === empName) ||
              employees.find((e) => e.name === user?.name || (user?.email && e.email === user.email)) ||
              employees[0];
            const empIdValue = (matchedEmp as any)?.pk || (matchedEmp?.id && !isNaN(Number(matchedEmp.id)) ? Number(matchedEmp.id) : undefined) || matchedEmp?.id || empName;
            const payload = {
              employee: empIdValue || undefined,
              leave_type: data["Leave type"] || "CL",
              days: Number(data["Days"]) || 1,
              from_date: data["From"] || getTodayIso(),
              to_date: data["To"] || data["From"] || getTodayIso(),
              reason: data["Reason"] || "",
              status: "Requested",
            };
            try {
              const res: any = await api.post("/hr/leaves/", payload);
              const mapped: Leave = {
                id: res.code || `LV-${res.id}`,
                emp: res.employee_code || matchedEmp?.id || "EMP-01",
                type: res.leave_type || "CL",
                from: res.from_date,
                to: res.to_date,
                fromIso: res.from_date,
                days: Number(res.days) || 1,
                reason: res.reason || "",
                status: res.status as Leave["status"],
                applied: res.applied_date || getTodayIso(),
                approver: res.approver_name || "Manager",
              };
              setRows((prev) => [mapped, ...prev]);
              toast.success(`Leave request ${mapped.id} submitted`);
            } catch (err: any) {
              toast.error(err?.message || "Failed to submit leave request");
            }
          }
        }}
      />
      <AlertDialog open={!!act} onOpenChange={(o) => !o && setAct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {act?.to === "Approved" ? "Approve" : act?.to === "Rejected" ? "Reject" : "Complete"} {act?.l.id}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {act ? `${getEmp(act.l.emp)?.name ?? act.l.emp} · ${act.l.type} · ${act.l.from} → ${act.l.to} (${act.l.days} day${act.l.days > 1 ? "s" : ""}).` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={act?.to === "Rejected" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
              onClick={async () => {
                if (act) {
                  try {
                    if (act.to === "Approved") {
                      await api.post(`/hr/leaves/${act.l.id}/approve/`);
                    } else if (act.to === "Rejected") {
                      await api.post(`/hr/leaves/${act.l.id}/reject/`);
                    } else if (act.to === "Completed") {
                      await api.post(`/hr/leaves/${act.l.id}/complete/`);
                    }
                    setRows((rs) => rs.map((x) => (x.id === act.l.id ? { ...x, status: act.to } : x)));
                    toast.success(`${act.l.id} ${act.to.toLowerCase()}`);
                  } catch (err: any) {
                    toast.error(err?.message || `Failed to update ${act.l.id}`);
                  }
                }
                setAct(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function LeaveCalendar() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [allLeaves, setAllLeaves] = useState<Leave[]>([]);
  const { getEmp } = useLiveEmployees();
  const { types } = useLiveLeaveTypes();
  const todayIso = useMemo(() => getTodayIso(), []);

  useEffect(() => {
    api.get<any>("/hr/leaves/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const mapped: Leave[] = list.map((l: any) => ({
          id: l.code || `LV-${l.id}`,
          emp: l.employee_code || (l.employee?.code ?? String(l.employee)),
          type: l.leave_type,
          from: l.from_date,
          to: l.to_date,
          fromIso: l.from_date,
          days: Number(l.days) || 1,
          reason: l.reason || "",
          status: l.status as Leave["status"],
          applied: l.applied_date,
          approver: l.approver_name || "Manager",
        }));
        setAllLeaves(mapped);
      })
      .catch(() => {});
  }, []);

  const first = new Date(year, month - 1, 1).getDay();
  const n = new Date(year, month, 0).getDate();
  const iso = (d: number) => `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const on = (d: string) =>
    allLeaves
      .filter((l) => l.status !== "Rejected")
      .filter((l) => {
        const from = l.fromIso || l.from;
        const to = l.to || l.fromIso || l.from;
        return d >= from && d <= to;
      });

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  return (
    <>
      <SectionHeader
        title="Leave calendar"
        description="Approved and requested leave by day."
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="size-8" aria-label="Previous month" onClick={prevMonth}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="w-32 text-center text-sm font-medium">
              {new Date(year, month - 1).toLocaleString("en-IN", { month: "long" })} {year}
            </span>
            <Button variant="outline" size="icon" className="size-8" aria-label="Next month" onClick={nextMonth}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />
      <Panel>
        <div className="grid grid-cols-7 gap-1.5 text-xs">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <p key={d} className="pb-1 text-center font-medium text-muted-foreground">
              {d}
            </p>
          ))}
          {Array.from({ length: first }, (_, i) => (
            <div key={`b${i}`} />
          ))}
          {Array.from({ length: n }, (_, i) => {
            const d = iso(i + 1);
            const ls = on(d);
            return (
              <div key={d} className={cn("min-h-20 rounded-md border border-border p-1.5", d === todayIso && "border-accent ring-1 ring-accent")}>
                <p className="font-semibold tabular">{i + 1}</p>
                {ls.slice(0, 3).map((l) => {
                  const emp = getEmp(l.emp);
                  const colorObj = types.find((t) => t.code === l.type);
                  const color = colorObj?.color || "#3b82f6";
                  return (
                    <p
                      key={l.id}
                      className="mt-0.5 truncate rounded px-1 py-0.5 text-[10px]"
                      style={{ background: `color-mix(in oklab, ${color} 18%, transparent)` }}
                    >
                      {emp.name.split(" ")[0]} · {l.type}
                      {l.status === "Requested" ? " ?" : ""}
                    </p>
                  );
                })}
                {ls.length > 3 ? <p className="text-[10px] text-muted-foreground">+{ls.length - 3} more</p> : null}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          {types.map((t) => (
            <span key={t.code} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: t.color }} />
              {t.name}
            </span>
          ))}
          <M>"?" = awaiting approval</M>
        </div>
      </Panel>
    </>
  );
}

export function LeaveTypes() {
  const [leaves, setLeaves] = useState<Leave[]>(seedLeaves);
  const { types, refetch } = useLiveLeaveTypes();

  useEffect(() => {
    api.get<any>("/hr/leaves/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        if (list.length > 0) {
          setLeaves(list);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <SectionHeader title="Leave types" description="Annual entitlement and carry-forward rules." />
      <DataTable
        rows={types}
        getId={(t) => t.code}
        entity="leave type"
        createLabel="New leave type"
        search={(t) => `${t.code} ${t.name}`}
        removeLabel={null}
        filters={[{ label: "Paid", get: (t) => (t.paid ? "Paid" : "Unpaid") }]}
        onSave={async (data, item) => {
          const payload = {
            code: data["Code"] || "",
            name: data["Name"] || "",
            days_per_year: Number(data["Days per year"]) || 0,
            carry_forward: data["Carry forward"] === "Yes",
            is_paid: data["Paid"] === "Yes",
          };
          try {
            if (item) {
              await api.patch(`/hr/leave-types/${item.code}/`, payload);
              toast.success(`Updated ${item.code}`);
            } else {
              await api.post("/hr/leave-types/", payload);
              toast.success(`Created leave type ${payload.code}`);
            }
            refetch();
          } catch (err: any) {
            toast.error(err?.message || "Failed to save leave type");
          }
        }}
        columns={[
          {
            key: "c",
            header: "Code",
            render: (t) => (
              <span className="inline-flex items-center gap-2">
                <span className="size-2.5 rounded-sm" style={{ background: t.color }} />
                <b>{t.code}</b>
              </span>
            ),
          },
          { key: "n", header: "Leave type", sort: (t) => t.name, render: (t) => t.name },
          { key: "d", header: "Days / year", align: "right", sort: (t) => t.days, render: (t) => (t.days ? t.days : <M>—</M>) },
          { key: "cf", header: "Carry forward", render: (t) => (t.carry ? "Yes" : "No") },
          { key: "p", header: "Paid", render: (t) => <StatusBadge status={t.paid ? "active" : "inactive"} label={t.paid ? "Paid" : "Unpaid"} /> },
          {
            key: "u",
            header: "Used (FY)",
            align: "right",
            render: (t) => leaves.filter((l: any) => (l.type === t.code || l.leave_type === t.code) && l.status !== "Rejected").reduce((s, l: any) => s + (Number(l.days) || 1), 0),
          },
        ]}
        form={(t) => (
          <FormGrid
            fields={[
              { label: "Code", value: t?.code },
              { label: "Name", value: t?.name },
              { label: "Days per year", value: t?.days, type: "number" },
              { label: "Carry forward", value: t ? (t.carry ? "Yes" : "No") : "No", options: ["Yes", "No"] },
              { label: "Paid", value: t ? (t.paid ? "Yes" : "No") : "Yes", options: ["Yes", "No"] },
            ]}
          />
        )}
      />
    </>
  );
}
