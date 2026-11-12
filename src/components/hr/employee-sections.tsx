import { useEffect, useState, useTransition } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Cake, CheckCircle2, Clock, Eye, Mail, Pencil, Phone, Plus, Send, Trash2, Trophy, Upload, UserPlus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { EmptyState, KpiCard, Panel, StatusBadge } from "@/components/erp/primitives";
import { DataTable, DetailGrid, FormGrid } from "@/components/erp/DataTable";
import { ExportButtons, SectionHeader } from "@/components/erp/ModuleLayout";
import { AttachmentPanel, Timeline } from "@/components/sales/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr } from "@/lib/format";
import type { Attachment } from "@/data/sales";
import type { Employee } from "@/data/hr";
import { api } from "@/lib/api";
import { logAudit } from "@/data/audit";
import { Avatar, M, Person, axis, sum, tip } from "./common";
import { companyConfig as company } from "@/config/company";

export interface DepartmentItem {
  id: string;
  name: string;
  head: string;
  location: string;
  budget: number;
}

export interface DesignationItem {
  id: string;
  title: string;
  dept: string;
  grade: string;
  band: [number, number];
}

export interface AttendanceItem {
  id: number;
  employee_code?: string;
  employee_name?: string;
  date: string;
  status: string;
  check_in: string;
  check_out: string;
  hours_worked?: number;
  location?: string;
}

export interface LeaveItem {
  id: number;
  code?: string;
  employee_code?: string;
  employee_name?: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  days: number;
  reason: string;
  status: string;
}

const mapBackendEmployee = (e: any): Employee => {
  const dt = e.joined_date || "2026-01-01";
  const dob = e.dob || "1995-01-01";
  const gross = Number(e.gross_salary ?? 0);
  const basic = Number(e.basic_salary ?? Math.round(gross * 0.5));
  const hra = Number(e.hra ?? Math.round(gross * 0.2));
  const conveyance = Number(e.conveyance ?? (gross > 0 ? 1600 : 0));
  const special = Number(e.special_allowance ?? Math.max(0, gross - basic - hra - conveyance));
  const initials = e.initials || (e.name ? e.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() : "EM");

  return {
    id: e.code || `EMP-${e.id}`,
    name: e.name || "Employee",
    initials,
    gender: (e.gender === "Female" ? "Female" : "Male") as "Male" | "Female",
    dept: e.department_name || "General",
    designation: e.designation_title || "Staff",
    phone: e.phone || "—",
    email: e.email || "—",
    joined: dt,
    joinedIso: dt,
    dob: dob,
    dobIso: dob,
    status: (e.status === "Resigned" ? "Resigned" : e.status === "On Leave" ? "On Leave" : e.status === "Probation" ? "Probation" : "Active") as Employee["status"],
    city: e.city || "Calicut",
    address: e.address || "Kerala, India",
    blood: e.blood_group || "O+",
    pan: e.pan || "—",
    uan: e.uan || "—",
    bank: e.bank_name || "State Bank of India",
    account: e.account_number || "—",
    basic,
    hra,
    conveyance,
    special,
    gross,
    manager: e.manager_name || "General Manager",
    type: (e.employment_type === "Contract" ? "Contract" : "Full-time") as Employee["type"],
    vehicle: (e.vehicle_type === "Car" ? "Car" : e.vehicle_type === "Two-wheeler" ? "Two-wheeler" : "None") as Employee["vehicle"],
  };
};

export const empDocs = (_e: Employee): Attachment[] => [];

/**
 * Shared hook to fetch live HR records from Django backend.
 */
export function useLiveHrData() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [designations, setDesignations] = useState<DesignationItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceItem[]>([]);
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = () => {
    setLoading(true);
    Promise.allSettled([
      api.get<any>("/hr/employees/"),
      api.get<any>("/hr/departments/"),
      api.get<any>("/hr/designations/"),
      api.get<any>("/hr/attendance/"),
      api.get<any>("/hr/leaves/"),
    ]).then(([empRes, deptRes, desigRes, attRes, leaveRes]) => {
      if (empRes.status === "fulfilled") {
        const list = Array.isArray(empRes.value) ? empRes.value : (empRes.value?.results ?? []);
        setEmployees(list.map(mapBackendEmployee));
      }
      if (deptRes.status === "fulfilled") {
        const list = Array.isArray(deptRes.value) ? deptRes.value : (deptRes.value?.results ?? []);
        setDepartments(list.map((d: any) => ({
          id: d.code || `D${d.id}`,
          name: d.name,
          head: d.head || "Unassigned",
          location: d.location || "Calicut HQ",
          budget: Number(d.budget ?? 0),
        })));
      }
      if (desigRes.status === "fulfilled") {
        const list = Array.isArray(desigRes.value) ? desigRes.value : (desigRes.value?.results ?? []);
        setDesignations(list.map((dg: any) => ({
          id: dg.code || `G${dg.id}`,
          title: dg.title,
          dept: dg.department_name || "General",
          grade: dg.grade || "E1",
          band: [Number(dg.min_salary ?? 20000), Number(dg.max_salary ?? 40000)],
        })));
      }
      if (attRes.status === "fulfilled") {
        const list = Array.isArray(attRes.value) ? attRes.value : (attRes.value?.results ?? []);
        setAttendance(list);
      }
      if (leaveRes.status === "fulfilled") {
        const list = Array.isArray(leaveRes.value) ? leaveRes.value : (leaveRes.value?.results ?? []);
        setLeaves(list);
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchAll();
  }, []);

  return { employees, departments, designations, attendance, leaves, loading, refetch: fetchAll };
}

export function EmployeeDashboard() {
  const { employees, departments, attendance, leaves, loading } = useLiveHrData();
  const todayStr = new Date().toISOString().slice(0, 10);

  const active = employees.filter((e) => e.status === "Active" || e.status === "Probation");
  const probation = employees.filter((e) => e.status === "Probation");
  const onLeave = leaves.filter((l) => l.status === "Approved" && l.from_date <= todayStr && l.to_date >= todayStr).length ||
    attendance.filter((a) => a.date === todayStr && a.status === "Leave").length;

  const todayPunches = attendance.filter((a) => a.date === todayStr);
  const present = todayPunches.filter((a) => ["Present", "Late", "Half Day"].includes(a.status)).length;
  const attendanceRatio = employees.length > 0 ? Math.round((present / employees.length) * 100) : 100;

  // Headcount by live department
  const byDept = departments.map((d) => ({
    name: d.name.length > 12 ? d.name.split(" ")[0] : d.name,
    v: employees.filter((e) => e.dept.toLowerCase() === d.name.toLowerCase()).length,
  }));

  // Birthdays in next 45 days
  const now = new Date();
  const currentMonthDay = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const bdays = active
    .filter((e) => e.dobIso && e.dobIso.length >= 10)
    .map((e) => {
      const bMonthDay = e.dobIso.slice(5);
      const bYear = bMonthDay >= currentMonthDay ? now.getFullYear() : now.getFullYear() + 1;
      const bDate = new Date(`${bYear}-${bMonthDay}`);
      const diffDays = Math.round((bDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { e, d: diffDays };
    })
    .filter((x) => x.d >= 0 && x.d <= 45)
    .sort((a, b) => a.d - b.d);

  // Joining Anniversaries
  const annivs = active
    .filter((e) => e.joinedIso && e.joinedIso.length >= 4)
    .map((e) => {
      const jMonthDay = e.joinedIso.slice(5);
      const jYear = jMonthDay >= currentMonthDay ? now.getFullYear() : now.getFullYear() + 1;
      const jDate = new Date(`${jYear}-${jMonthDay}`);
      const diffDays = Math.round((jDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const yrs = now.getFullYear() - Number(e.joinedIso.slice(0, 4));
      return { e, d: diffDays, yrs: Math.max(1, yrs) };
    })
    .filter((x) => x.d >= 0 && x.d <= 60)
    .sort((a, b) => a.d - b.d);

  // Recent activity from real records
  const activity = [
    ...leaves.slice(0, 3).map((l) => [l.from_date || "Recent", `Leave ${l.status.toLowerCase()} for ${l.employee_name || "Employee"} (${l.leave_type || "Leave"})`]),
    ...attendance.slice(0, 3).map((a) => [a.date || "Today", `Attendance punch: ${a.employee_name || "Staff"} marked ${a.status} (${a.check_in || "09:00"})`]),
  ];

  return (
    <>
      <SectionHeader
        title="Employee dashboard"
        description={`${company.name} · Staff headcount, active workforce and team directory`}
        actions={
          <Button size="sm" asChild>
            <Link to="/employees/$section" params={{ section: "list" }}>
              <UserPlus className="size-4" /> Add employee
            </Link>
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiCard label="Total employees" value={String(employees.length)} hint="Active in database" />
        <KpiCard label="Active" value={String(active.length)} />
        <KpiCard label="On leave today" value={String(onLeave)} />
        <KpiCard
          label="Attendance today"
          value={employees.length > 0 ? `${present}/${employees.length}` : "0/0"}
          hint={`${attendanceRatio}% present`}
          tone="up"
        />
        <KpiCard
          label="Monthly payroll"
          value={inr(sum(active, (e) => e.gross))}
          hint="Gross salary commitment"
        />
        <KpiCard label="Probation" value={String(probation.length)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Headcount by department" className="xl:col-span-2">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDept}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" {...axis} />
                <YAxis {...axis} allowDecimals={false} />
                <RTooltip contentStyle={tip} />
                <Bar dataKey="v" name="Employees" fill="var(--color-chart-2)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Recent activity" bodyClassName="p-0">
          {activity.length ? (
            <ul className="divide-y divide-border">
              {activity.map(([w, t], idx) => (
                <li key={idx} className="px-4 py-2.5 text-sm">
                  <p>{t}</p>
                  <p className="text-xs text-muted-foreground">{w}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-6">
              <EmptyState title="No recent activity" description="Attendance punches and leave requests will appear here." />
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Upcoming birthdays" bodyClassName="p-0">
          {bdays.length ? (
            <ul className="divide-y divide-border">
              {bdays.slice(0, 6).map(({ e, d }) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <Person e={e} sub={e.designation} />
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <Cake className="size-3.5 text-accent" />
                    {d === 0 ? <b className="text-accent">Today</b> : `in ${d} days`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4">
              <EmptyState title="No birthdays soon" description="Upcoming employee birthdays will be highlighted here." />
            </div>
          )}
        </Panel>

        <Panel title="Joining anniversaries" bodyClassName="p-0">
          {annivs.length ? (
            <ul className="divide-y divide-border">
              {annivs.slice(0, 6).map(({ e, d, yrs }) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <Person e={e} sub={`Joined ${e.joined}`} />
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <Trophy className="size-3.5 text-warning" />
                    {yrs} yrs · {d === 0 ? "today" : `in ${d} days`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4">
              <EmptyState title="No anniversaries soon" description="Employee work anniversaries will appear here." />
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

export function Employees() {
  const nav = useNavigate();
  const { employees, departments, designations, loading, refetch } = useLiveHrData();
  const [rows, setRows] = useState<Employee[]>([]);
  const [previewEmp, setPreviewEmp] = useState<Employee | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    setRows(employees);
  }, [employees]);

  return (
    <>
      <SectionHeader
        title="Employees"
        description="All registered staff members across departments and company branches."
        actions={<ExportButtons />}
      />
      <DataTable
        rows={rows}
        getId={(e) => e.id}
        entity="employee"
        createLabel="Add employee"
        search={(e) => `${e.name} ${e.id} ${e.phone} ${e.email} ${e.dept} ${e.designation}`}
        searchPlaceholder="Search name, ID, phone, department"
        filters={[
          { label: "Departments", get: (e) => e.dept },
          { label: "Statuses", get: (e) => e.status },
          { label: "Types", get: (e) => e.type },
        ]}
        date={(e) => e.joinedIso}
        removeLabel={null}
        onRowClick={(e) => nav({ to: "/employees/view/$id", params: { id: e.id } })}
        extraActions={[
          {
            label: "Open profile",
            onClick: (e) => nav({ to: "/employees/view/$id", params: { id: e.id } }),
          },
          {
            label: "Resend Welcome Email",
            show: (e) => !!e.email && e.email.includes("@"),
            onClick: async (e) => {
              try {
                const res: any = await api.post(`/hr/employees/${e.id}/resend-welcome/`, {});
                toast.success(res?.message || `Welcome email dispatched to ${e.email}`);
              } catch (err: any) {
                toast.error(err?.message || "Failed to resend welcome email");
              }
            },
          },
          {
            label: "Preview Welcome Email",
            show: (e) => !!e.email && e.email.includes("@"),
            onClick: (e) => setPreviewEmp(e),
          },
          {
            label: "Archive",
            show: (e) => e.status !== "Resigned",
            onClick: async (e) => {
              try {
                await api.patch(`/hr/employees/${e.id}/`, { status: "Resigned" });
                setRows((prev) => prev.map((x) => (x.id === e.id ? { ...x, status: "Resigned" } : x)));
                toast.success(`${e.name} archived as Resigned & login access revoked`);
                refetch();
              } catch (err: any) {
                toast.error(err?.message || "Failed to archive employee");
              }
            },
          },
          {
            label: "Delete",
            className: "text-destructive hover:text-destructive",
            onClick: async (e) => {
              if (!window.confirm(`Are you sure you want to permanently delete employee ${e.name} (${e.id}) and all associated credentials?`)) {
                return;
              }
              try {
                await api.delete(`/hr/employees/${e.id}/`);
                setRows((prev) => prev.filter((x) => x.id !== e.id));
                toast.success(`${e.name} permanently deleted`);
                refetch();
              } catch (err: any) {
                toast.error(err?.message || "Failed to delete employee");
              }
            },
          },
        ]}
        columns={[
          { key: "name", header: "Employee", sort: (e) => e.name, render: (e) => <Person e={e} /> },
          { key: "dept", header: "Department", sort: (e) => e.dept, render: (e) => e.dept },
          { key: "des", header: "Designation", sort: (e) => e.designation, render: (e) => e.designation },
          { key: "phone", header: "Phone", render: (e) => e.phone },
          { key: "email", header: "Email", render: (e) => <M>{e.email}</M> },
          { key: "joined", header: "Joined", sort: (e) => e.joinedIso, render: (e) => e.joined },
          {
            key: "st",
            header: "Status",
            render: (e) => (
              <StatusBadge
                status={e.status === "On Leave" ? "pending" : e.status === "Probation" ? "info" : e.status === "Resigned" ? "inactive" : "active"}
                label={e.status}
              />
            ),
          },
        ]}
        form={(e) => (
          <FormGrid
            fields={[
              { label: "Full name", value: e?.name, wide: true, required: true },
              {
                label: "Department",
                value: e?.dept,
                options: departments.length ? departments.map((d) => d.name) : ["Production", "Sales & Marketing", "Accounts & Finance", "HR & Admin"],
              },
              {
                label: "Designation",
                value: e?.designation,
                options: designations.length ? designations.map((d) => d.title) : ["General Manager", "Accounts Manager", "Sales Executive", "Production Supervisor"],
              },
              { label: "Phone", value: e?.phone },
              { label: "Email", value: e?.email, type: "email" },
              { label: "Joining date", value: e?.joinedIso ?? new Date().toISOString().slice(0, 10), type: "date" },
              { label: "Date of birth", value: e?.dobIso ?? "1995-01-01", type: "date" },
              { label: "Monthly gross (₹)", value: e?.gross ?? 30000, type: "number" },
              { label: "Employment type", value: e?.type ?? "Full-time", options: ["Full-time", "Contract"] },
              { label: "Address", value: e?.address, wide: true },
            ]}
          />
        )}
        onSave={async (data, item) => {
          if (!item) {
            const payload = {
              name: data["Full name"],
              department_name: data["Department"],
              designation_title: data["Designation"],
              phone: data["Phone"] || "",
              email: data["Email"] || "",
              joined_date: data["Joining date"] || new Date().toISOString().slice(0, 10),
              dob: data["Date of birth"] || "1995-01-01",
              gross_salary: Number(data["Monthly gross (₹)"]) || 0,
              basic_salary: Math.round((Number(data["Monthly gross (₹)"]) || 0) * 0.5),
              employment_type: data["Employment type"] || "Full-time",
              address: data["Address"] || "",
              status: "Active",
            };
            try {
              const res: any = await api.post("/hr/employees/", payload);
              const mapped = mapBackendEmployee(res);
              setRows((prev) => [mapped, ...prev]);
              if (payload.email) {
                toast.success(`Employee ${mapped.name} created & welcome credentials email sent to ${payload.email}`);
              } else {
                toast.success(`Employee ${mapped.name} created (${mapped.id})`);
              }
              refetch();
            } catch (err: any) {
              toast.error(err?.message || "Failed to create employee");
            }
          } else {
            try {
              const payload: Record<string, any> = {
                name: data["Full name"] ?? item.name,
                phone: data["Phone"] ?? item.phone,
                email: data["Email"] ?? item.email,
                address: data["Address"] ?? item.address,
              };
              if (data["Monthly gross (₹)"]) {
                payload["gross_salary"] = Number(data["Monthly gross (₹)"]);
                payload["basic_salary"] = Math.round(Number(data["Monthly gross (₹)"]) * 0.5);
              }
              await api.patch(`/hr/employees/${item.id}/`, payload);
              setRows((prev) =>
                prev.map((e) =>
                  e.id === item.id
                    ? {
                        ...e,
                        name: data["Full name"] ?? e.name,
                        phone: data["Phone"] ?? e.phone,
                        email: data["Email"] ?? e.email,
                        address: data["Address"] ?? e.address,
                        gross: data["Monthly gross (₹)"] ? Number(data["Monthly gross (₹)"]) : e.gross,
                      }
                    : e
                )
              );
              toast.success(`Employee ${item.name} updated`);
              refetch();
            } catch (err: any) {
              toast.error(err?.message || "Failed to update employee");
            }
          }
        }}
      />

      {/* Welcome Email Template Preview Modal */}
      <Dialog open={!!previewEmp} onOpenChange={(open) => !open && setPreviewEmp(null)}>
        <DialogContent className="max-w-xl p-0 overflow-hidden bg-slate-100 dark:bg-slate-900 border-border">
          {previewEmp && (
            <div className="flex flex-col">
              <DialogHeader className="p-4 bg-background border-b border-border">
                <DialogTitle className="text-base font-semibold flex items-center justify-between">
                  <span>Welcome Email Preview</span>
                  <span className="text-xs font-normal text-muted-foreground">To: {previewEmp.email}</span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  This responsive template is automatically sent to new staff with their login credentials.
                </DialogDescription>
              </DialogHeader>

              {/* Email Content Box */}
              <div className="p-4 sm:p-6 overflow-y-auto max-h-[75vh]">
                <div className="max-w-[480px] mx-auto bg-card rounded-xl border border-border shadow-md overflow-hidden text-foreground">
                  {/* Banner with project deep navy color theme */}
                  <div className="bg-gradient-to-r from-[#13213f] to-[#1e293b] p-6 text-center text-white">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      {company.name.toUpperCase()}
                    </div>
                    <h2 className="text-xl font-bold tracking-tight text-white">
                      Welcome to {company.name}
                    </h2>
                  </div>

                  {/* Body */}
                  <div className="p-6 space-y-4 text-sm text-slate-700 dark:text-slate-300">
                    <p className="font-semibold text-base text-slate-900 dark:text-white">
                      Hello {previewEmp.name},
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Welcome to our company! An administrator has created a new account for you on the <strong>{company.name}</strong> ERP platform.
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      You can securely log in to your dashboard by clicking the button below:
                    </p>

                    {/* Primary CTA Button */}
                    <div className="text-center py-2">
                      <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-6 py-2.5 text-xs rounded-md shadow-sm">
                        <Link to="/login" search={{ email: previewEmp.email }}>
                          Log In to Dashboard
                        </Link>
                      </Button>
                    </div>

                    {/* Credentials Box */}
                    <div className="bg-muted/50 border border-border rounded-lg p-3.5 space-y-1.5 text-xs">
                      <div>
                        <strong className="text-foreground">Email:</strong>{" "}
                        <span className="text-primary underline ml-1">{previewEmp.email}</span>
                      </div>
                      <div>
                        <strong className="text-foreground">Password:</strong>{" "}
                        <code className="bg-muted px-2 py-0.5 rounded font-mono text-[11px] text-foreground border border-border ml-1">
                          !jzX#GNzHod3R%hA (auto-generated)
                        </code>
                      </div>
                    </div>

                    {/* Dashed Separator */}
                    <div className="border-t border-dashed border-border my-4" />

                    {/* Revoke section */}
                    <p className="text-[11px] text-muted-foreground text-center">
                      If you did not expect this or believe it was a mistake, please revoke this registration instantly:
                    </p>
                    <div className="text-center pt-1 pb-2">
                      <Button variant="destructive" size="sm" className="text-xs px-4 py-1.5 h-8">
                        It's Not Me - Revoke
                      </Button>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="bg-muted/40 border-t border-border p-4 text-center text-[11px] text-muted-foreground space-y-1">
                    <div>© 2026 {company.name}. All rights reserved.</div>
                    <div>Need help? Contact support@zamirzac.com | Visit ERP Dashboard</div>
                    <div className="text-[10px] text-muted-foreground/70">
                      This is an automated transactional message. Please do not reply directly.
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="p-3 bg-background border-t border-border flex sm:justify-between items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPreviewEmp(null)}>
                  Close Preview
                </Button>
                <Button
                  size="sm"
                  disabled={sendingEmail}
                  onClick={async () => {
                    setSendingEmail(true);
                    try {
                      const res: any = await api.post(`/hr/employees/${previewEmp.id}/resend-welcome/`, {});
                      toast.success(res?.message || `Welcome email sent to ${previewEmp.email}`);
                      setPreviewEmp(null);
                    } catch (err: any) {
                      toast.error(err?.message || "Failed to send email");
                    } finally {
                      setSendingEmail(false);
                    }
                  }}
                >
                  <Send className="size-3.5 mr-1.5" /> Send Email Now
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function Departments() {
  const { departments, employees, refetch } = useLiveHrData();
  const [deptList, setDeptList] = useState<DepartmentItem[]>([]);

  useEffect(() => {
    setDeptList(departments);
  }, [departments]);

  const rows = deptList.map((d) => {
    const deptEmps = employees.filter((e) => e.dept.toLowerCase() === d.name.toLowerCase() && e.status !== "Resigned");
    const count = deptEmps.length;
    const cost = sum(deptEmps, (e) => e.gross);
    return { ...d, count, cost };
  });

  return (
    <>
      <SectionHeader
        title="Departments"
        description="Department heads, live headcount and monthly salary expenditure."
      />
      <DataTable
        rows={rows}
        getId={(d) => d.id}
        entity="department"
        createLabel="New department"
        search={(d) => `${d.name} ${d.head} ${d.location}`}
        filters={[{ label: "Locations", get: (d) => d.location }]}
        columns={[
          { key: "name", header: "Department", sort: (d) => d.name, render: (d) => <span className="font-medium">{d.name}</span> },
          { key: "head", header: "Head", render: (d) => d.head },
          { key: "loc", header: "Location", render: (d) => d.location },
          { key: "count", header: "Employees", align: "right", sort: (d) => d.count, render: (d) => d.count },
          { key: "cost", header: "Monthly cost", align: "right", sort: (d) => d.cost, render: (d) => inr(d.cost) },
          {
            key: "bud",
            header: "Budget",
            align: "right",
            render: (d) => <span className={d.cost > d.budget ? "text-destructive font-medium" : ""}>{inr(d.budget)}</span>,
          },
        ]}
        detail={(d) => (
          <DetailGrid
            items={[
              ["Department", d.name],
              ["Head", d.head],
              ["Location", d.location],
              ["Active staff", d.count],
              ["Monthly cost", inr(d.cost)],
              ["Budget", inr(d.budget)],
            ]}
          />
        )}
        form={(d) => (
          <FormGrid
            fields={[
              { label: "Name", value: d?.name, wide: true, required: true },
              { label: "Head", value: d?.head, options: employees.map((e) => e.name) },
              { label: "Location", value: d?.location ?? "Calicut HQ" },
              { label: "Monthly budget (₹)", value: d?.budget ?? 300000, type: "number" },
            ]}
          />
        )}
        onSave={async (data, item) => {
          if (!item) {
            try {
              const res: any = await api.post("/hr/departments/", {
                name: data["Name"],
                head: data["Head"] || "Unassigned",
                location: data["Location"] || "Calicut HQ",
                budget: Number(data["Monthly budget (₹)"]) || 0,
              });
              setDeptList((prev) => [
                ...prev,
                {
                  id: res.code || `D${res.id}`,
                  name: res.name,
                  head: res.head || "Unassigned",
                  location: res.location || "Calicut HQ",
                  budget: Number(res.budget ?? 0),
                },
              ]);
              toast.success(`Department ${data["Name"]} created`);
              refetch();
            } catch (err: any) {
              toast.error(err?.message || "Failed to create department");
            }
          } else {
            try {
              await api.patch(`/hr/departments/${item.id}/`, {
                name: data["Name"] ?? item.name,
                head: data["Head"] ?? item.head,
                location: data["Location"] ?? item.location,
                budget: data["Monthly budget (₹)"] ? Number(data["Monthly budget (₹)"]) : item.budget,
              });
              setDeptList((prev) =>
                prev.map((d) =>
                  d.id === item.id
                    ? {
                        ...d,
                        name: data["Name"] ?? d.name,
                        head: data["Head"] ?? d.head,
                        location: data["Location"] ?? d.location,
                        budget: data["Monthly budget (₹)"] ? Number(data["Monthly budget (₹)"]) : d.budget,
                      }
                    : d
                )
              );
              toast.success(`Department ${item.name} updated`);
              refetch();
            } catch (err: any) {
              toast.error(err?.message || "Failed to update department");
            }
          }
        }}
      />
    </>
  );
}

export function Designations() {
  const { designations, departments, employees, refetch } = useLiveHrData();
  const [desigList, setDesigList] = useState<DesignationItem[]>([]);

  useEffect(() => {
    setDesigList(designations);
  }, [designations]);

  const rows = desigList.map((d) => {
    const count = employees.filter((e) => e.designation.toLowerCase() === d.title.toLowerCase() && e.status !== "Resigned").length;
    return { ...d, count };
  });

  return (
    <>
      <SectionHeader
        title="Designations"
        description="Official job designations, salary bands and employee counts."
      />
      <DataTable
        rows={rows}
        getId={(d) => d.id}
        entity="designation"
        createLabel="New designation"
        search={(d) => `${d.title} ${d.dept} ${d.grade}`}
        filters={[{ label: "Departments", get: (d) => d.dept }]}
        columns={[
          { key: "t", header: "Designation", sort: (d) => d.title, render: (d) => <span className="font-medium">{d.title}</span> },
          { key: "dept", header: "Department", render: (d) => d.dept },
          { key: "g", header: "Grade", render: (d) => d.grade },
          {
            key: "band",
            header: "Salary band",
            align: "right",
            sort: (d) => d.band[0],
            render: (d) => `${inr(d.band[0])} – ${inr(d.band[1])}`,
          },
          { key: "n", header: "Employees", align: "right", render: (d) => d.count },
        ]}
        form={(d) => (
          <FormGrid
            fields={[
              { label: "Title", value: d?.title, wide: true, required: true },
              {
                label: "Department",
                value: d?.dept,
                options: departments.length ? departments.map((x) => x.name) : ["Production", "Sales & Marketing", "Accounts & Finance", "HR & Admin"],
              },
              { label: "Grade", value: d?.grade ?? "E1", options: ["E1", "E2", "E3", "M1", "M2", "M3", "S1", "W1"] },
              { label: "Band minimum (₹)", value: d?.band?.[0] ?? 20000, type: "number" },
              { label: "Band maximum (₹)", value: d?.band?.[1] ?? 50000, type: "number" },
            ]}
          />
        )}
        onSave={async (data, item) => {
          if (!item) {
            try {
              const res: any = await api.post("/hr/designations/", {
                title: data["Title"],
                department_name: data["Department"],
                grade: data["Grade"] || "E1",
                min_salary: Number(data["Band minimum (₹)"]) || 20000,
                max_salary: Number(data["Band maximum (₹)"]) || 50000,
              });
              setDesigList((prev) => [
                ...prev,
                {
                  id: res.code || `G${res.id}`,
                  title: res.title,
                  dept: res.department_name || data["Department"],
                  grade: res.grade || "E1",
                  band: [Number(res.min_salary ?? 20000), Number(res.max_salary ?? 50000)],
                },
              ]);
              toast.success(`Designation ${data["Title"]} created`);
              refetch();
            } catch (err: any) {
              toast.error(err?.message || "Failed to create designation");
            }
          } else {
            try {
              await api.patch(`/hr/designations/${item.id}/`, {
                title: data["Title"] ?? item.title,
                grade: data["Grade"] ?? item.grade,
                min_salary: data["Band minimum (₹)"] ? Number(data["Band minimum (₹)"]) : item.band[0],
                max_salary: data["Band maximum (₹)"] ? Number(data["Band maximum (₹)"]) : item.band[1],
              });
              setDesigList((prev) =>
                prev.map((d) =>
                  d.id === item.id
                    ? {
                        ...d,
                        title: data["Title"] ?? d.title,
                        grade: data["Grade"] ?? d.grade,
                        band: [
                          data["Band minimum (₹)"] ? Number(data["Band minimum (₹)"]) : d.band[0],
                          data["Band maximum (₹)"] ? Number(data["Band maximum (₹)"]) : d.band[1],
                        ],
                      }
                    : d
                )
              );
              toast.success(`Designation ${item.title} updated`);
              refetch();
            } catch (err: any) {
              toast.error(err?.message || "Failed to update designation");
            }
          }
        }}
      />
    </>
  );
}

export function EmployeeDocuments() {
  const [docs, setDocs] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchDocs = () => {
    api.get<any>("/documents/?category=Employees")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const mapped: Attachment[] = list.map((d: any) => ({
          id: String(d.id),
          name: d.name,
          type: (d.type || "PDF") as Attachment["type"],
          size: d.size || "1.0 MB",
          uploaded: d.date || "Recent",
          by: d.by || "HR & Admin",
          record: d.record || "—",
          category: d.category || "Employees",
          customer: d.related || "Staff",
          fileUrl: d.file || undefined,
        }));
        setDocs(mapped);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleUpload = async (files: FileList) => {
    if (!files.length) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", file.name);
        formData.append("category", "Employees");
        formData.append("record", "HR-ALL");
        formData.append("related", "Company Staff");
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        const fileType = ext === "pdf" ? "PDF" : ["jpg", "jpeg", "png", "webp"].includes(ext) ? "Image" : ["xls", "xlsx", "csv"].includes(ext) ? "Excel" : ext === "zip" ? "ZIP" : "Word";
        formData.append("type", fileType);
        await api.post("/documents/", formData);
      }
      toast.success(`${files.length} document(s) uploaded successfully`);
      fetchDocs();
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      await api.delete(`/documents/${docId}/`);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      toast.success("Document removed");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete document");
    }
  };

  return (
    <>
      <SectionHeader
        title="Employee documents"
        description="ID proofs, certificates, offer letters, passbooks and compliance documents."
      />
      <AttachmentPanel items={docs} title="Company staff document repository" onUpload={handleUpload} onDelete={handleDelete} uploading={uploading} />
    </>
  );
}

export function EmployeeDetail({ id }: { id: string }) {
  const [e, setE] = useState<Employee | null>(null);
  const [empAttendance, setEmpAttendance] = useState<AttendanceItem[]>([]);
  const [empLeaves, setEmpLeaves] = useState<LeaveItem[]>([]);
  const [empDocsList, setEmpDocsList] = useState<Attachment[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [customTimeline, setCustomTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Departments and Designations options
  const [deptList, setDeptList] = useState<string[]>(["Management", "Sales", "Operations", "Finance", "HR", "Production", "IT"]);
  const [desigList, setDesigList] = useState<string[]>(["Manager", "Supervisor", "Executive", "Staff", "Officer", "Lead"]);

  // Edit Modals State
  const [openOverviewModal, setOpenOverviewModal] = useState(false);
  const [overviewForm, setOverviewForm] = useState({
    name: "",
    gender: "Male" as "Male" | "Female" | "Other",
    dob: "",
    blood: "",
    pan: "",
    phone: "",
    email: "",
    city: "",
    address: "",
    dept: "Management",
    designation: "Executive",
    manager: "",
    joined: "",
    type: "Full-time" as "Full-time" | "Contract",
    vehicle: "None" as "Two-wheeler" | "Car" | "None",
    status: "Active" as "Active" | "On Leave" | "Probation" | "Resigned",
  });

  const [openSalaryModal, setOpenSalaryModal] = useState(false);
  const [salaryForm, setSalaryForm] = useState({
    basic: 0,
    hra: 0,
    conveyance: 0,
    special: 0,
    bank: "",
    account: "",
    uan: "",
  });

  const [openAttendanceModal, setOpenAttendanceModal] = useState(false);
  const [editingAttId, setEditingAttId] = useState<number | null>(null);
  const [attForm, setAttForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    status: "Present",
    check_in: "09:30",
    check_out: "18:30",
    location: "Calicut HQ",
  });

  const [openLeaveModal, setOpenLeaveModal] = useState(false);
  const [editingLeaveId, setEditingLeaveId] = useState<number | null>(null);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: "Casual Leave",
    from_date: new Date().toISOString().slice(0, 10),
    to_date: new Date().toISOString().slice(0, 10),
    days: 1,
    reason: "",
    status: "Requested",
  });

  const [openTimelineModal, setOpenTimelineModal] = useState(false);
  const [timelineForm, setTimelineForm] = useState({
    kind: "Note",
    when: new Date().toISOString().slice(0, 10),
    text: "",
  });

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.get<any>(`/hr/employees/${id}/`),
      api.get<any>(`/hr/attendance/?employee=${id}`),
      api.get<any>(`/hr/leaves/?employee=${id}`),
      api.get<any>("/hr/departments/"),
      api.get<any>("/hr/designations/"),
    ]).then(([empRes, attRes, leaveRes, deptRes, desigRes]) => {
      if (empRes.status === "fulfilled" && empRes.value) {
        setE(mapBackendEmployee(empRes.value));
      }
      if (attRes.status === "fulfilled") {
        const list = Array.isArray(attRes.value) ? attRes.value : (attRes.value?.results ?? []);
        setEmpAttendance(list);
      }
      if (leaveRes.status === "fulfilled") {
        const list = Array.isArray(leaveRes.value) ? leaveRes.value : (leaveRes.value?.results ?? []);
        setEmpLeaves(list);
      }
      if (deptRes.status === "fulfilled") {
        const list = Array.isArray(deptRes.value) ? deptRes.value : (deptRes.value?.results ?? []);
        if (list.length > 0) setDeptList(list.map((d: any) => d.name));
      }
      if (desigRes.status === "fulfilled") {
        const list = Array.isArray(desigRes.value) ? desigRes.value : (desigRes.value?.results ?? []);
        if (list.length > 0) setDesigList(list.map((dg: any) => dg.title));
      }
      fetchEmployeeDocs();
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [id]);

  const fetchEmployeeDocs = () => {
    api.get<any>(`/documents/?category=Employees&record=${id}`)
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const mapped: Attachment[] = list.map((d: any) => ({
          id: String(d.id),
          name: d.name,
          type: (d.type || "PDF") as Attachment["type"],
          size: d.size || "1.0 MB",
          uploaded: d.date || "Recent",
          by: d.by || "HR & Admin",
          record: d.record || id,
          category: d.category || "Employees",
          customer: e?.name || id,
          fileUrl: d.file || undefined,
        }));
        setEmpDocsList(mapped);
      })
      .catch(() => {});
  };

  const handleUploadDoc = async (files: FileList) => {
    if (!files.length) return;
    setUploadingDoc(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", file.name);
        formData.append("category", "Employees");
        formData.append("record", id);
        formData.append("related", e?.name || id);
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        const fileType = ext === "pdf" ? "PDF" : ["jpg", "jpeg", "png", "webp"].includes(ext) ? "Image" : ["xls", "xlsx", "csv"].includes(ext) ? "Excel" : ext === "zip" ? "ZIP" : "Word";
        formData.append("type", fileType);
        await api.post("/documents/", formData);
      }
      toast.success(`${files.length} document(s) uploaded successfully`);
      fetchEmployeeDocs();
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload document");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      await api.delete(`/documents/${docId}/`);
      setEmpDocsList((prev) => prev.filter((d) => d.id !== docId));
      toast.success("Document removed");
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove document");
    }
  };

  if (loading && !e) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading employee profile from server...
      </div>
    );
  }

  if (!e) {
    return (
      <EmptyState
        title="Employee not found"
        description={`No employee with ID ${id} was found in the database.`}
        action={
          <Button asChild variant="outline">
            <Link to="/employees/$section" params={{ section: "list" }}>
              Back to employees
            </Link>
          </Button>
        }
      />
    );
  }

  // Action handlers
  const openEditOverview = () => {
    setOverviewForm({
      name: e.name,
      gender: e.gender,
      dob: e.dob || "",
      blood: e.blood || "",
      pan: e.pan || "",
      phone: e.phone || "",
      email: e.email || "",
      city: e.city || "",
      address: e.address || "",
      dept: e.dept || "Management",
      designation: e.designation || "Executive",
      manager: e.manager || "",
      joined: e.joined || "",
      type: e.type,
      vehicle: e.vehicle,
      status: e.status,
    });
    setOpenOverviewModal(true);
  };

  const handleSaveOverview = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
        name: overviewForm.name,
        gender: overviewForm.gender,
        blood_group: overviewForm.blood,
        pan: overviewForm.pan,
        phone: overviewForm.phone,
        email: overviewForm.email,
        city: overviewForm.city,
        address: overviewForm.address,
        department: overviewForm.dept,
        designation: overviewForm.designation,
        manager_name: overviewForm.manager,
        employment_type: overviewForm.type,
        vehicle_type: overviewForm.vehicle,
        status: overviewForm.status,
      };
      if (overviewForm.dob) payload.dob = overviewForm.dob;
      if (overviewForm.joined) payload.joined_date = overviewForm.joined;

      const res = await api.patch<any>(`/hr/employees/${e.id}/`, payload);
      setE(mapBackendEmployee(res));
      setOpenOverviewModal(false);
      toast.success("Employee profile updated successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update employee profile");
    } finally {
      setSaving(false);
    }
  };

  const openEditSalary = () => {
    setSalaryForm({
      basic: e.basic || 0,
      hra: e.hra || 0,
      conveyance: e.conveyance || 0,
      special: e.special || 0,
      bank: e.bank || "",
      account: e.account || "",
      uan: e.uan || "",
    });
    setOpenSalaryModal(true);
  };

  const handleSaveSalary = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSaving(true);
    const calculatedGross = Number(salaryForm.basic || 0) + Number(salaryForm.hra || 0) + Number(salaryForm.conveyance || 0) + Number(salaryForm.special || 0);
    try {
      const res = await api.patch<any>(`/hr/employees/${e.id}/`, {
        basic_salary: salaryForm.basic,
        hra: salaryForm.hra,
        conveyance: salaryForm.conveyance,
        special_allowance: salaryForm.special,
        gross_salary: calculatedGross,
        bank_name: salaryForm.bank,
        account_number: salaryForm.account,
        uan: salaryForm.uan,
      });
      setE(mapBackendEmployee(res));
      setOpenSalaryModal(false);
      toast.success("Salary structure updated successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update salary");
    } finally {
      setSaving(false);
    }
  };

  const openAddAttendance = () => {
    setEditingAttId(null);
    setAttForm({
      date: new Date().toISOString().slice(0, 10),
      status: "Present",
      check_in: "09:30",
      check_out: "18:30",
      location: "Calicut HQ",
    });
    setOpenAttendanceModal(true);
  };

  const openEditAttendance = (a: AttendanceItem) => {
    setEditingAttId(a.id);
    setAttForm({
      date: a.date,
      status: a.status,
      check_in: a.check_in || "09:30",
      check_out: a.check_out || "18:30",
      location: a.location || "Calicut HQ",
    });
    setOpenAttendanceModal(true);
  };

  const handleSaveAttendance = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSaving(true);
    try {
      if (editingAttId) {
        const res = await api.patch<any>(`/hr/attendance/${editingAttId}/`, {
          date: attForm.date,
          status: attForm.status,
          check_in: attForm.check_in,
          check_out: attForm.check_out,
          location: attForm.location,
        });
        setEmpAttendance((prev) => prev.map((item) => (item.id === editingAttId ? { ...item, ...res } : item)));
        toast.success("Attendance record updated");
      } else {
        const res = await api.post<any>("/hr/attendance/", {
          employee: e.id,
          date: attForm.date,
          status: attForm.status,
          check_in: attForm.check_in,
          check_out: attForm.check_out,
          location: attForm.location,
        });
        setEmpAttendance((prev) => [res, ...prev]);
        toast.success("Attendance record logged");
      }
      setOpenAttendanceModal(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save attendance record");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAttendance = async (attId: number) => {
    if (!confirm("Are you sure you want to remove this attendance record?")) return;
    try {
      await api.delete(`/hr/attendance/${attId}/`);
      setEmpAttendance((prev) => prev.filter((item) => item.id !== attId));
      toast.success("Attendance record removed");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete attendance record");
    }
  };

  const openAddLeave = () => {
    setEditingLeaveId(null);
    const today = new Date().toISOString().slice(0, 10);
    setLeaveForm({
      leave_type: "Casual Leave",
      from_date: today,
      to_date: today,
      days: 1,
      reason: "",
      status: "Approved",
    });
    setOpenLeaveModal(true);
  };

  const openEditLeave = (l: LeaveItem) => {
    setEditingLeaveId(l.id);
    setLeaveForm({
      leave_type: l.leave_type,
      from_date: l.from_date,
      to_date: l.to_date,
      days: l.days,
      reason: l.reason || "",
      status: l.status,
    });
    setOpenLeaveModal(true);
  };

  const handleSaveLeave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSaving(true);
    try {
      if (editingLeaveId) {
        const res = await api.patch<any>(`/hr/leaves/${editingLeaveId}/`, {
          leave_type: leaveForm.leave_type,
          from_date: leaveForm.from_date,
          to_date: leaveForm.to_date,
          days: Number(leaveForm.days || 1),
          reason: leaveForm.reason,
          status: leaveForm.status,
        });
        setEmpLeaves((prev) => prev.map((item) => (item.id === editingLeaveId ? { ...item, ...res } : item)));
        toast.success("Leave request updated");
      } else {
        const res = await api.post<any>("/hr/leaves/", {
          employee: e.id,
          leave_type: leaveForm.leave_type,
          from_date: leaveForm.from_date,
          to_date: leaveForm.to_date,
          days: Number(leaveForm.days || 1),
          reason: leaveForm.reason,
          status: leaveForm.status,
        });
        setEmpLeaves((prev) => [res, ...prev]);
        toast.success("Leave request created");
      }
      setOpenLeaveModal(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save leave request");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLeaveStatus = async (leaveId: number, newStatus: string) => {
    try {
      const res = await api.patch<any>(`/hr/leaves/${leaveId}/`, { status: newStatus });
      setEmpLeaves((prev) => prev.map((item) => (item.id === leaveId ? { ...item, status: res.status ?? newStatus } : item)));
      toast.success(`Leave request marked as ${newStatus}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update leave status");
    }
  };

  const handleAddTimelineNote = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!timelineForm.text.trim()) return;
    const newEntry = {
      id: `T-${Date.now()}`,
      kind: timelineForm.kind,
      when: timelineForm.when,
      text: timelineForm.text,
      by: "HR & Management",
    };
    setCustomTimeline((prev) => [newEntry, ...prev]);
    setTimelineForm({ kind: "Note", when: new Date().toISOString().slice(0, 10), text: "" });
    setOpenTimelineModal(false);
    toast.success("Timeline entry added");
  };

  const presentDays = empAttendance.filter((a) => ["Present", "Late"].includes(a.status)).length;
  const lateDays = empAttendance.filter((a) => a.status === "Late").length;
  const leaveDays = empLeaves.reduce((acc, l) => acc + (l.status === "Approved" ? Number(l.days ?? 1) : 0), 0);

  // Real-time Attendance & Leave LOP Impact calculation
  const absentCount = empAttendance.filter((a) => a.status === "Absent").length;
  const halfDayCount = empAttendance.filter((a) => a.status === "Half Day").length;
  const lopLeaveDays = empLeaves
    .filter((l) => l.status === "Approved" && (l.leave_type === "LOP" || l.leave_type === "Loss of Pay"))
    .reduce((acc, l) => acc + Number(l.days || 1), 0);
  const totalLopDays = absentCount + (halfDayCount * 0.5) + lopLeaveDays;
  const paidDaysCount = Math.max(0, 30 - totalLopDays);
  const perDayRate = e?.gross ? Math.round(e.gross / 30) : 0;
  const estimatedLopDeduction = Math.round(perDayRate * totalLopDays);
  const estimatedEarnedGross = Math.max(0, (e?.gross || 0) - estimatedLopDeduction);
  const earnedBasic = Math.round((e?.basic || 0) * (paidDaysCount / 30));
  const estimatedPf = Math.round(Math.min(earnedBasic, 15000) * 0.12);
  const estimatedEsi = (estimatedEarnedGross > 0 && (e?.gross || 0) <= 21000) ? Math.round(estimatedEarnedGross * 0.0075) : 0;
  const estimatedPt = ((e?.gross || 0) > 20000 && estimatedEarnedGross > 10000) ? 208 : 0;
  const totalEstDeductions = estimatedPf + estimatedEsi + estimatedPt;
  const estimatedNetPayout = Math.max(0, estimatedEarnedGross - totalEstDeductions);

  const timeline = [
    ...customTimeline,
    ...empLeaves.map((l) => ({
      id: `L-${l.id}`,
      kind: "Leave",
      when: l.from_date,
      text: `${l.leave_type || "Leave"} application: ${l.from_date} → ${l.to_date} · Status: ${l.status}`,
      by: e.name,
    })),
    ...empAttendance.slice(0, 5).map((a) => ({
      id: `A-${a.id}`,
      kind: "Attendance",
      when: a.date,
      text: `Punched ${a.status} at ${a.check_in || "09:00"} (${a.location || "Calicut HQ"})`,
      by: e.name,
    })),
    {
      id: "join",
      kind: "Joined",
      when: e.joined,
      text: `Joined ${company.name} as ${e.designation} in ${e.dept}`,
      by: "HR & Admin",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/employees/$section" params={{ section: "list" }}>
            <ArrowLeft className="size-4" /> All employees
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={openEditOverview} className="gap-1.5 shadow-sm">
          <Pencil className="size-3.5 text-primary" /> Edit Profile
        </Button>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center">
        <Avatar e={e} size="lg" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{e.name}</h1>
            <StatusBadge status={e.status === "Active" ? "active" : e.status === "Probation" ? "info" : e.status === "Resigned" ? "inactive" : "pending"} label={e.status} />
          </div>
          <p className="text-sm text-muted-foreground">{e.designation} · {e.dept} · {e.id}</p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5 text-muted-foreground" />{e.phone || "No phone"}</span>
            <span className="inline-flex items-center gap-1.5"><Mail className="size-3.5 text-muted-foreground" />{e.email || "No email"}</span>
          </div>
        </div>
        <div className="flex sm:self-start">
          <Button variant="outline" size="sm" onClick={openEditOverview} className="gap-1.5">
            <Pencil className="size-3.5" /> Edit details
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Monthly gross" value={inr(e.gross)} hint="Total monthly remuneration" />
        <KpiCard label="Present records" value={`${presentDays} days`} hint={`${lateDays} late check-in(s)`} />
        <KpiCard label="Approved leave (days)" value={`${leaveDays} days`} />
        <KpiCard label="Joining date" value={e.joined} hint="Recorded on file" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap justify-start">
          {["overview", "salary", "attendance", "leave", "documents", "timeline"].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>
          ))}
        </TabsList>

        {/* 1. OVERVIEW TAB */}
        <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-3">
          <Panel
            title="Personal"
            actions={
              <Button variant="ghost" size="sm" onClick={openEditOverview} className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Pencil className="size-3" /> Edit
              </Button>
            }
          >
            <DetailGrid
              items={[
                ["Gender", e.gender],
                ["Date of birth", e.dob || "—"],
                ["Blood group", e.blood || "—"],
                ["PAN", e.pan || "—"],
              ]}
            />
          </Panel>
          <Panel
            title="Contact"
            actions={
              <Button variant="ghost" size="sm" onClick={openEditOverview} className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Pencil className="size-3" /> Edit
              </Button>
            }
          >
            <DetailGrid
              items={[
                ["Phone", e.phone || "—"],
                ["Email", e.email || "—"],
                ["City", e.city || "—"],
                ["Address", e.address || "—"],
              ]}
            />
          </Panel>
          <Panel
            title="Employment"
            actions={
              <Button variant="ghost" size="sm" onClick={openEditOverview} className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Pencil className="size-3" /> Edit
              </Button>
            }
          >
            <DetailGrid
              items={[
                ["Department", e.dept || "—"],
                ["Designation", e.designation || "—"],
                ["Reports to", e.manager || "—"],
                ["Joined", e.joined || "—"],
                ["Type", e.type],
                ["Vehicle", e.vehicle],
              ]}
            />
          </Panel>
        </TabsContent>

        {/* 2. SALARY TAB */}
        <TabsContent value="salary" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Salary structure (monthly)"
              actions={
                <Button variant="outline" size="sm" onClick={openEditSalary} className="h-7 gap-1.5 text-xs">
                  <Pencil className="size-3" /> Edit Salary Structure
                </Button>
              }
            >
              <DetailGrid
                items={[
                  ["Basic", inr(e.basic)],
                  ["HRA", inr(e.hra)],
                  ["Conveyance", inr(e.conveyance)],
                  ["Special allowance", inr(e.special)],
                  ["Gross", inr(e.gross)],
                  ["Annual CTC", inr(e.gross * 12 + Math.round(Math.min(e.basic, 15000) * 0.13) * 12)],
                  ["Bank", e.bank ? `${e.bank} · ${e.account}` : "—"],
                  ["UAN", e.uan || "—"],
                ]}
              />
            </Panel>
            <Panel title="Salary & Bank details" bodyClassName="p-4 text-sm text-muted-foreground">
              <p>Payroll deductions and contributions (PF 12%, ESI 0.75%, Professional Tax) are calculated during the monthly payroll run based on the gross structure and actual attendance/leaves.</p>
              <div className="mt-4 rounded-md border border-border/60 bg-muted/30 p-3">
                <p className="font-medium text-foreground">Direct Bank Transfer</p>
                <p className="mt-1 text-xs">Bank: {e.bank || "Not configured"}</p>
                <p className="text-xs">Account: {e.account || "Not configured"}</p>
                <p className="text-xs">UAN / PF: {e.uan || "Not configured"}</p>
              </div>
            </Panel>
          </div>

          <Panel
            title="Attendance & Leave Payout Impact (Current Month)"
            description="Automatic monthly pro-rating based on daily attendance punches & approved leave applications"
            bodyClassName="p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                <span className="text-xs text-muted-foreground uppercase font-medium">Standard Month</span>
                <p className="text-lg font-semibold mt-1">30 Days</p>
                <p className="text-xs text-muted-foreground mt-0.5">Statutory base period</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                <span className="text-xs text-muted-foreground uppercase font-medium">Paid Days</span>
                <p className="text-lg font-semibold text-success mt-1">{paidDaysCount} Days</p>
                <p className="text-xs text-muted-foreground mt-0.5">{presentDays} present punches</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                <span className="text-xs text-muted-foreground uppercase font-medium">Unpaid / LOP Days</span>
                <p className={`text-lg font-semibold mt-1 ${totalLopDays > 0 ? "text-destructive" : "text-foreground"}`}>
                  {totalLopDays} Days
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {absentCount > 0 ? `${absentCount} absent` : ""}{halfDayCount > 0 ? ` · ${halfDayCount} half-day` : ""}{lopLeaveDays > 0 ? ` · ${lopLeaveDays} LOP leave` : (totalLopDays === 0 ? "Zero penalties" : "")}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                <span className="text-xs text-muted-foreground uppercase font-medium">Estimated Net Payout</span>
                <p className="text-lg font-bold text-primary mt-1">{inr(estimatedNetPayout)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {estimatedLopDeduction > 0 ? `LOP deduction: -${inr(estimatedLopDeduction)}` : "Full month payout"}
                </p>
              </div>
            </div>
            {totalLopDays > 0 ? (
              <div className="mt-3 rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive flex items-center justify-between">
                <span>⚠️ {totalLopDays} day(s) of Loss of Pay (LOP) detected. Per-day salary rate is {inr(perDayRate)}, reducing gross remuneration by {inr(estimatedLopDeduction)}.</span>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                ✓ Perfect attendance standing. No Loss of Pay (LOP) deductions will be applied in the monthly payroll run.
              </p>
            )}
          </Panel>
        </TabsContent>

        {/* 3. ATTENDANCE TAB */}
        <TabsContent value="attendance" className="mt-4">
          <Panel
            title="Recent Attendance Records"
            bodyClassName="p-0"
            actions={
              <Button variant="outline" size="sm" onClick={openAddAttendance} className="h-7 gap-1.5 text-xs">
                <Plus className="size-3.5" /> Record Attendance
              </Button>
            }
          >
            {empAttendance.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="p-3 text-left font-medium">Date</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-left font-medium">Check-in</th>
                      <th className="p-3 text-left font-medium">Check-out</th>
                      <th className="p-3 text-left font-medium">Location</th>
                      <th className="p-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {empAttendance.map((a) => (
                      <tr key={a.id} className="hover:bg-muted/30">
                        <td className="p-3 font-medium">{a.date}</td>
                        <td className="p-3">
                          <StatusBadge status={a.status === "Present" ? "active" : a.status === "Late" ? "pending" : "inactive"} label={a.status} />
                        </td>
                        <td className="p-3">{a.check_in || "—"}</td>
                        <td className="p-3">{a.check_out || "—"}</td>
                        <td className="p-3 text-xs text-muted-foreground">{a.location || "Office"}</td>
                        <td className="p-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditAttendance(a)} title="Edit attendance">
                              <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteAttendance(a.id)} title="Delete record">
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6">
                <EmptyState title="No attendance records" description="No daily check-ins recorded for this employee yet." action={<Button size="sm" variant="outline" onClick={openAddAttendance}><Plus className="size-3.5 mr-1" /> Add Record</Button>} />
              </div>
            )}
          </Panel>
        </TabsContent>

        {/* 4. LEAVE TAB */}
        <TabsContent value="leave" className="mt-4">
          <Panel
            title="Leave requests"
            bodyClassName="p-0"
            actions={
              <Button variant="outline" size="sm" onClick={openAddLeave} className="h-7 gap-1.5 text-xs">
                <Plus className="size-3.5" /> Record Leave
              </Button>
            }
          >
            {empLeaves.length ? (
              <ul className="divide-y divide-border">
                {empLeaves.map((l) => (
                  <li key={l.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3 text-sm">
                    <div>
                      <p className="font-medium">{l.leave_type} · {l.from_date} → {l.to_date} ({l.days}d)</p>
                      <p className="text-xs text-muted-foreground">{l.reason || "Personal leave application"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={l.status === "Approved" ? "approved" : l.status === "Rejected" ? "rejected" : "pending"} label={l.status} />
                      {l.status !== "Approved" && (
                        <Button variant="outline" size="sm" className="h-7 text-xs text-success border-success/30 hover:bg-success/10" onClick={() => handleUpdateLeaveStatus(l.id, "Approved")}>
                          <CheckCircle2 className="size-3 mr-1" /> Approve
                        </Button>
                      )}
                      {l.status !== "Rejected" && (
                        <Button variant="outline" size="sm" className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleUpdateLeaveStatus(l.id, "Rejected")}>
                          <XCircle className="size-3 mr-1" /> Reject
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditLeave(l)}>
                        <Pencil className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-6">
                <EmptyState title="No leave requests" description="No leave applications submitted for this employee." action={<Button size="sm" variant="outline" onClick={openAddLeave}><Plus className="size-3.5 mr-1" /> Apply Leave</Button>} />
              </div>
            )}
          </Panel>
        </TabsContent>

        {/* 5. DOCUMENTS TAB */}
        <TabsContent value="documents" className="mt-4">
          <AttachmentPanel
            items={empDocsList}
            title={`Uploaded Documents (${empDocsList.length})`}
            onUpload={handleUploadDoc}
            onDelete={handleDeleteDoc}
            uploading={uploadingDoc}
          />
        </TabsContent>

        {/* 6. TIMELINE TAB */}
        <TabsContent value="timeline" className="mt-4">
          <Panel
            title="Activity timeline"
            actions={
              <Button variant="outline" size="sm" onClick={() => setOpenTimelineModal(true)} className="h-7 gap-1.5 text-xs">
                <Plus className="size-3.5" /> Add Note / Event
              </Button>
            }
          >
            <Timeline items={timeline} />
          </Panel>
        </TabsContent>
      </Tabs>

      {/* OVERVIEW EDIT DIALOG */}
      <Dialog open={openOverviewModal} onOpenChange={setOpenOverviewModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee Profile</DialogTitle>
            <DialogDescription>Update personal, contact, and employment information for {e.name}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveOverview} className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Full Name</Label>
                <Input required value={overviewForm.name} onChange={(ev) => setOverviewForm({ ...overviewForm, name: ev.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={overviewForm.status} onValueChange={(val: any) => setOverviewForm({ ...overviewForm, status: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Active", "On Leave", "Probation", "Resigned"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Gender</Label>
                <Select value={overviewForm.gender} onValueChange={(val: any) => setOverviewForm({ ...overviewForm, gender: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Male", "Female", "Other"].map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={overviewForm.phone} onChange={(ev) => setOverviewForm({ ...overviewForm, phone: ev.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={overviewForm.email} onChange={(ev) => setOverviewForm({ ...overviewForm, email: ev.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Department</Label>
                <Select value={overviewForm.dept} onValueChange={(val) => setOverviewForm({ ...overviewForm, dept: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {deptList.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Designation</Label>
                <Select value={overviewForm.designation} onValueChange={(val) => setOverviewForm({ ...overviewForm, designation: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {desigList.map((dg) => (
                      <SelectItem key={dg} value={dg}>{dg}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Reporting Manager</Label>
                <Input value={overviewForm.manager} onChange={(ev) => setOverviewForm({ ...overviewForm, manager: ev.target.value })} placeholder="Manager name" />
              </div>
              <div className="space-y-1">
                <Label>Date of Birth</Label>
                <Input type="date" value={overviewForm.dob} onChange={(ev) => setOverviewForm({ ...overviewForm, dob: ev.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Blood Group</Label>
                <Input value={overviewForm.blood} onChange={(ev) => setOverviewForm({ ...overviewForm, blood: ev.target.value })} placeholder="e.g. O+ve" />
              </div>
              <div className="space-y-1">
                <Label>PAN</Label>
                <Input value={overviewForm.pan} onChange={(ev) => setOverviewForm({ ...overviewForm, pan: ev.target.value })} placeholder="e.g. ABCDE1234F" />
              </div>
              <div className="space-y-1">
                <Label>City</Label>
                <Input value={overviewForm.city} onChange={(ev) => setOverviewForm({ ...overviewForm, city: ev.target.value })} placeholder="Calicut" />
              </div>
              <div className="space-y-1">
                <Label>Joined Date</Label>
                <Input type="date" value={overviewForm.joined} onChange={(ev) => setOverviewForm({ ...overviewForm, joined: ev.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Employment Type</Label>
                <Select value={overviewForm.type} onValueChange={(val: any) => setOverviewForm({ ...overviewForm, type: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full-time">Full-time</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Vehicle Type</Label>
                <Select value={overviewForm.vehicle} onValueChange={(val: any) => setOverviewForm({ ...overviewForm, vehicle: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Two-wheeler">Two-wheeler</SelectItem>
                    <SelectItem value="Car">Car</SelectItem>
                    <SelectItem value="None">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Address</Label>
                <Textarea value={overviewForm.address} onChange={(ev) => setOverviewForm({ ...overviewForm, address: ev.target.value })} rows={2} />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpenOverviewModal(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* SALARY EDIT DIALOG */}
      <Dialog open={openSalaryModal} onOpenChange={setOpenSalaryModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Salary & Bank Structure</DialogTitle>
            <DialogDescription>Configure monthly remuneration breakdown and disbursement account details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveSalary} className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Basic Salary (₹)</Label>
                <Input type="number" min="0" value={salaryForm.basic} onChange={(ev) => setSalaryForm({ ...salaryForm, basic: Number(ev.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>HRA (₹)</Label>
                <Input type="number" min="0" value={salaryForm.hra} onChange={(ev) => setSalaryForm({ ...salaryForm, hra: Number(ev.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Conveyance Allowance (₹)</Label>
                <Input type="number" min="0" value={salaryForm.conveyance} onChange={(ev) => setSalaryForm({ ...salaryForm, conveyance: Number(ev.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Special Allowance (₹)</Label>
                <Input type="number" min="0" value={salaryForm.special} onChange={(ev) => setSalaryForm({ ...salaryForm, special: Number(ev.target.value) })} />
              </div>
              <div className="space-y-1 sm:col-span-2 rounded-md bg-muted/40 p-2.5">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-muted-foreground">Calculated Monthly Gross:</span>
                  <span className="font-semibold text-primary">{inr(Number(salaryForm.basic || 0) + Number(salaryForm.hra || 0) + Number(salaryForm.conveyance || 0) + Number(salaryForm.special || 0))}</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Bank Name</Label>
                <Input value={salaryForm.bank} onChange={(ev) => setSalaryForm({ ...salaryForm, bank: ev.target.value })} placeholder="e.g. HDFC Bank" />
              </div>
              <div className="space-y-1">
                <Label>Account Number</Label>
                <Input value={salaryForm.account} onChange={(ev) => setSalaryForm({ ...salaryForm, account: ev.target.value })} placeholder="Account number" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>UAN / PF Number</Label>
                <Input value={salaryForm.uan} onChange={(ev) => setSalaryForm({ ...salaryForm, uan: ev.target.value })} placeholder="Universal Account Number" />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpenSalaryModal(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Salary"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ATTENDANCE DIALOG */}
      <Dialog open={openAttendanceModal} onOpenChange={setOpenAttendanceModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAttId ? "Edit Attendance Record" : "Record Daily Attendance"}</DialogTitle>
            <DialogDescription>Specify status and clock-in/out timestamps for {e.name}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveAttendance} className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" required value={attForm.date} onChange={(ev) => setAttForm({ ...attForm, date: ev.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={attForm.status} onValueChange={(val) => setAttForm({ ...attForm, status: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Present", "Late", "Half Day", "Leave", "Absent"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Check-in Time</Label>
                <Input type="time" value={attForm.check_in} onChange={(ev) => setAttForm({ ...attForm, check_in: ev.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Check-out Time</Label>
                <Input type="time" value={attForm.check_out} onChange={(ev) => setAttForm({ ...attForm, check_out: ev.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Location / Remarks</Label>
              <Input value={attForm.location} onChange={(ev) => setAttForm({ ...attForm, location: ev.target.value })} placeholder="Calicut HQ" />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpenAttendanceModal(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : editingAttId ? "Update Record" : "Save Record"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* LEAVE DIALOG */}
      <Dialog open={openLeaveModal} onOpenChange={setOpenLeaveModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLeaveId ? "Edit Leave Request" : "Record Leave Request"}</DialogTitle>
            <DialogDescription>Submit or adjust leave duration and category for {e.name}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveLeave} className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Leave Type</Label>
              <Select value={leaveForm.leave_type} onValueChange={(val) => setLeaveForm({ ...leaveForm, leave_type: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Casual Leave", "Sick Leave", "Earned Leave", "Loss of Pay", "Compensatory Off", "Maternity Leave"].map((lt) => (
                    <SelectItem key={lt} value={lt}>{lt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>From Date</Label>
                <Input type="date" required value={leaveForm.from_date} onChange={(ev) => setLeaveForm({ ...leaveForm, from_date: ev.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>To Date</Label>
                <Input type="date" required value={leaveForm.to_date} onChange={(ev) => setLeaveForm({ ...leaveForm, to_date: ev.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Days</Label>
                <Input type="number" min="0.5" step="0.5" required value={leaveForm.days} onChange={(ev) => setLeaveForm({ ...leaveForm, days: Number(ev.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={leaveForm.status} onValueChange={(val) => setLeaveForm({ ...leaveForm, status: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Requested", "Approved", "Rejected", "Completed"].map((st) => (
                      <SelectItem key={st} value={st}>{st}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Textarea value={leaveForm.reason} onChange={(ev) => setLeaveForm({ ...leaveForm, reason: ev.target.value })} placeholder="Reason for leave" rows={2} />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpenLeaveModal(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : editingLeaveId ? "Update Request" : "Submit Leave"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* TIMELINE DIALOG */}
      <Dialog open={openTimelineModal} onOpenChange={setOpenTimelineModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Timeline Note or Event</DialogTitle>
            <DialogDescription>Record a milestone, appraisal, role transition, or performance note.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddTimelineNote} className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Event Type</Label>
              <Select value={timelineForm.kind} onValueChange={(val) => setTimelineForm({ ...timelineForm, kind: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Note", "Milestone", "Appraisal", "Promotion", "Warning", "Commendation"].map((k) => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" required value={timelineForm.when} onChange={(ev) => setTimelineForm({ ...timelineForm, when: ev.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Description / Note</Label>
              <Textarea required value={timelineForm.text} onChange={(ev) => setTimelineForm({ ...timelineForm, text: ev.target.value })} placeholder="Enter activity details, feedback, or milestone information" rows={3} />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpenTimelineModal(false)}>Cancel</Button>
              <Button type="submit">Add to Timeline</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
