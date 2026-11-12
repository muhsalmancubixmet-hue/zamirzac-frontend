import { useState, useEffect, useMemo } from "react";
import { Copy, KeyRound, Plus, Power, ShieldCheck, Trash2, History, Mail } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { KpiCard, Panel, StatusBadge } from "@/components/erp/primitives";
import { DataTable, DetailGrid, FormGrid } from "@/components/erp/DataTable";
import { SectionHeader } from "@/components/erp/ModuleLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field } from "@/components/sales/shared";
import { activityLog, appUsers, logins, permActions, permModules, type AppUser, type Matrix, type Role } from "@/data/admin";
import { departments } from "@/data/hr";
import { logAudit } from "@/data/audit";
import { rolesStore, useRolesList } from "@/lib/access";
import { api, ApiError } from "@/lib/api";

// Roles live in module state so Users and Roles pages share custom roles during the session.
const useRoles = () => [useRolesList(), rolesStore.set] as const;

const userBadge = (s: AppUser["status"]) => <StatusBadge status={s === "Active" ? "active" : s === "Invited" ? "sent" : "inactive"} label={s} />;

export function UsersPage() {
  const [rows, setRows] = useState(appUsers);
  const [roles] = useRoles();
  const [activity, setActivity] = useState<AppUser | null>(null);
  const [reset, setReset] = useState<AppUser | null>(null);

  useEffect(() => {
    api.get<{ results: any[] }>("/users/").then((res) => {
      if (res && res.results && res.results.length > 0) {
        const apiUsers: AppUser[] = res.results.map((u) => ({
          id: String(u.id),
          name: u.name,
          email: u.email,
          phone: u.phone || "—",
          role: u.role_name || "No Role",
          dept: u.department || "Management",
          status: u.status as AppUser["status"],
          lastLogin: u.last_login ? new Date(u.last_login).toLocaleDateString() : "Never",
          twoFactor: !!u.two_factor_enabled,
        }));
        setRows(apiUsers);
      }
    }).catch((err) => {
      console.debug("Backend users fetch deferred:", err);
    });
  }, []);

  const sendWelcomeEmail = async (u: AppUser) => {
    try {
      toast.loading(`Sending welcome email to ${u.email}...`, { id: `resend-${u.id}` });
      const res: any = await api.post(`/users/${u.id}/resend-welcome/`);
      toast.success(res?.message || `Welcome email with credentials sent to ${u.email}`, { id: `resend-${u.id}` });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send welcome email", { id: `resend-${u.id}` });
    }
  };

  const toggle = async (u: AppUser) => {
    const nextStatus = u.status === "Active" ? "Inactive" : "Active";
    try {
      if (/^\d+$/.test(u.id)) {
        await api.patch(`/users/${u.id}/`, { status: nextStatus });
      }
      setRows((r) => r.map((x) => x.id === u.id ? { ...x, status: nextStatus } : x));
      toast.success(`${u.name} ${nextStatus === "Active" ? "activated" : "deactivated"}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update user status");
    }
  };
  return (
    <>
      <SectionHeader title="Users" description="People who can sign in to the ERP, their role and status." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Users" value={String(rows.length)} hint="Licence allows 25" />
        <KpiCard label="Active" value={String(rows.filter((u) => u.status === "Active").length)} tone="up" hint="Can sign in" />
        <KpiCard label="Invited" value={String(rows.filter((u) => u.status === "Invited").length)} hint="Awaiting first login" />
        <KpiCard label="2-step verification" value={`${rows.length ? Math.round((rows.filter((u) => u.twoFactor).length / rows.length) * 100) : 0}%`} hint="Of all users" />
      </div>
      <DataTable
        rows={rows}
        getId={(u) => u.id}
        entity="user"
        createLabel="Add user"
        search={(u) => `${u.name} ${u.email} ${u.phone} ${u.role}`}
        searchPlaceholder="Search name, email or phone"
        filters={[{ label: "Role", get: (u) => u.role }, { label: "Department", get: (u) => u.dept }, { label: "Status", get: (u) => u.status }]}
        columns={[
          { key: "name", header: "Name", sort: (u) => u.name, render: (u) => <span className="flex items-center gap-2.5"><span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">{(u.name || "U").split(" ").map((p) => p[0]).join("").slice(0, 2)}</span><span><span className="block font-medium">{u.name}</span><span className="block text-xs text-muted-foreground">{u.email}</span></span></span> },
          { key: "phone", header: "Phone", render: (u) => u.phone },
          { key: "role", header: "Role", sort: (u) => u.role, render: (u) => u.role },
          { key: "dept", header: "Department", render: (u) => u.dept },
          { key: "last", header: "Last login", render: (u) => <span className="text-muted-foreground">{u.lastLogin}</span> },
          { key: "status", header: "Status", render: (u) => userBadge(u.status) },
        ]}
        detail={(u) => <DetailGrid items={[["Email", u.email], ["Phone", u.phone], ["Role", u.role], ["Department", u.dept], ["Last login", u.lastLogin], ["2-step verification", u.twoFactor ? "Enabled" : "Not enabled"], ["Status", userBadge(u.status)]]} />}
        form={(u) => {
          const deptOptions = departments.length > 0 ? departments.map((d) => d.name) : ["Management", "Sales", "Operations", "Finance", "HR", "Production", "IT"];
          const defaultDept = u?.dept ?? deptOptions[0] ?? "Management";
          const defaultRole = u?.role ?? roles[0]?.name ?? "Administrator";
          return (
            <FormGrid
              fields={[
                { label: "Full name", value: u?.name },
                { label: "Email", value: u?.email, type: "email" },
                { label: "Phone", value: u?.phone },
                { label: "Role", value: defaultRole, options: roles.map((r) => r.name) },
                { label: "Department", value: defaultDept, options: deptOptions },
                { label: "Status", value: u?.status ?? "Invited", options: ["Active", "Inactive", "Invited"] },
              ]}
            />
          );
        }}
        extraActions={[
          { label: "Send welcome email", icon: <Mail className="size-4" />, onClick: sendWelcomeEmail },
          { label: "Activate", icon: <Power className="size-4" />, onClick: toggle, show: (u) => u.status !== "Active" },
          { label: "Deactivate", icon: <Power className="size-4" />, onClick: toggle, show: (u) => u.status === "Active" },
          { label: "Reset password", icon: <KeyRound className="size-4" />, onClick: setReset },
          { label: "View activity", icon: <History className="size-4" />, onClick: setActivity },
        ]}
        onSave={async (data, item) => {
          if (!item) {
            const roleName = data["Role"] ?? roles[0]?.name ?? "Administrator";
            const payload = {
              name: data["Full name"],
              email: data["Email"],
              phone: data["Phone"] || "",
              role: roleName,
              department: data["Department"] || "Management",
              status: data["Status"] || "Invited",
            };
            try {
              const res: any = await api.post("/users/", payload);
              const newUser: AppUser = {
                id: String(res.id),
                name: res.name,
                email: res.email,
                phone: res.phone || "—",
                role: res.role_name || roleName,
                dept: res.department || "Management",
                status: res.status as AppUser["status"],
                lastLogin: "Never",
                twoFactor: false,
              };
              setRows((prev) => [newUser, ...prev]);
              if (res.email_status?.success) {
                toast.success(`User ${newUser.name} created & welcome email dispatched to ${newUser.email}!`);
              } else {
                toast.success(`User ${newUser.name} created`);
              }
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : "Failed to create user");
            }
          } else {
            const isNumeric = /^\d+$/.test(item.id);
            const roleName = data["Role"] ?? item.role;
            const payload = {
              name: data["Full name"] ?? item.name,
              email: data["Email"] ?? item.email,
              phone: data["Phone"] ?? item.phone,
              role: roleName,
              department: data["Department"] ?? item.dept,
              status: data["Status"] ?? item.status,
            };
            try {
              if (isNumeric) {
                await api.patch(`/users/${item.id}/`, payload);
              }
              setRows((prev) =>
                prev.map((u) =>
                  u.id === item.id
                    ? {
                        ...u,
                        name: payload.name,
                        email: payload.email,
                        phone: payload.phone || "—",
                        role: roleName,
                        dept: payload.department,
                        status: payload.status as AppUser["status"],
                      }
                    : u
                )
              );
              toast.success(`User ${payload.name} updated`);
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : "Failed to update user");
            }
          }
        }}
        onDelete={async (u) => {
          if (/^\d+$/.test(u.id)) {
            try {
              await api.delete(`/users/${u.id}/`);
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : "Failed to delete user");
              return false;
            }
          }
          setRows((prev) => prev.filter((x) => x.id !== u.id));
          return true;
        }}
      />
      <AlertDialog open={!!reset} onOpenChange={(o) => !o && setReset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Reset password for {reset?.name}?</AlertDialogTitle><AlertDialogDescription>A password reset link will be dispatched to {reset?.email}. Their active sessions will be terminated.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => {
            logAudit({ action: "Security", module: "Users", record: reset?.id || "", description: `Password reset dispatched to ${reset?.email}` });
            toast.success(`Reset link sent to ${reset?.email}`);
          }}>Send reset link</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={!!activity} onOpenChange={(o) => !o && setActivity(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Activity — {activity?.name}</DialogTitle><DialogDescription>Recent actions and sign-ins</DialogDescription></DialogHeader>
          <ul className="max-h-96 divide-y divide-border overflow-y-auto rounded-md border border-border text-sm">
            {[...activityLog.filter((a) => a.user === activity?.name).slice(0, 6).map((a) => ({ id: a.id, t: `${a.action} · ${a.record}`, s: a.description, w: a.when })), ...logins.filter((l) => l.user === activity?.name).slice(0, 4).map((l) => ({ id: l.id, t: `Sign-in ${l.result.toLowerCase()}`, s: `${l.device} · ${l.location} · ${l.ip}`, w: l.when }))].map((x) => (
              <li key={x.id} className="flex items-start justify-between gap-3 px-3 py-2.5"><span><span className="block font-medium">{x.t}</span><span className="block text-xs text-muted-foreground">{x.s}</span></span><span className="whitespace-nowrap text-xs text-muted-foreground">{x.w}</span></li>
            ))}
            <li className="px-3 py-2.5 text-xs text-muted-foreground">End of recent activity</li>
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const blank = (): Matrix =>
  Object.fromEntries(permModules.map((m) => [m, Object.fromEntries(permActions.map((a) => [a, false]))])) as Matrix;

export function normalizeMatrix(raw?: any): Matrix {
  const base = blank();
  if (!raw || typeof raw !== "object") return base;
  for (const mod of permModules) {
    if (raw[mod] && typeof raw[mod] === "object") {
      for (const act of permActions) {
        base[mod][act] = Boolean(raw[mod][act]);
      }
    }
  }
  return base;
}

const countOn = (m?: Matrix) => {
  const safe = normalizeMatrix(m);
  return permModules.reduce((s, mod) => s + permActions.filter((a) => safe[mod][a]).length, 0);
};

export function RolesPage() {
  const [roles, setRoles] = useRoles();
  const [editing, setEditing] = useState<Role | null>(null);
  const [removing, setRemoving] = useState<Role | null>(null);

  useEffect(() => {
    api.get<{ results: any[] }>("/roles/").then((res) => {
      if (res && res.results && res.results.length > 0) {
        const apiRoles: Role[] = res.results.map((r) => ({
          id: `ROLE-${r.id}`,
          name: r.name,
          description: r.description || "",
          system: !!r.is_system,
          matrix: normalizeMatrix(r.matrix),
          updated: r.updated_at ? new Date(r.updated_at).toLocaleDateString() : "Active",
        }));
        setRoles(apiRoles);
      }
    }).catch((err) => {
      console.debug("Backend roles fetch deferred:", err);
    });
  }, [setRoles]);

  const save = async (r: Role) => {
    const isApiId = /^ROLE-(\d+)$/.test(r.id);
    const numericId = isApiId ? r.id.replace("ROLE-", "") : null;
    try {
      if (numericId) {
        const updated = await api.patch<any>(`/roles/${numericId}/`, {
          name: r.name,
          description: r.description,
          matrix: r.matrix,
        });
        const updatedRole: Role = {
          ...r,
          name: updated.name,
          description: updated.description,
          matrix: normalizeMatrix(updated.matrix),
        };
        setRoles(roles.map((x) => (x.id === r.id ? updatedRole : x)));
      } else {
        const created = await api.post<any>("/roles/", {
          name: r.name,
          description: r.description,
          matrix: r.matrix,
        });
        const createdRole: Role = {
          id: `ROLE-${created.id}`,
          name: created.name,
          description: created.description,
          system: !!created.is_system,
          matrix: normalizeMatrix(created.matrix),
          updated: "Just now",
        };
        setRoles([...roles, createdRole]);
      }
      setEditing(null);
      toast.success(`Role “${r.name}” saved`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save role");
    }
  };

  const deleteRole = async (r: Role) => {
    const isApiId = /^ROLE-(\d+)$/.test(r.id);
    const numericId = isApiId ? r.id.replace("ROLE-", "") : null;
    try {
      if (numericId) {
        await api.delete(`/roles/${numericId}/`);
      }
      setRoles(roles.filter((x) => x.id !== r.id));
      toast.success("Role deleted");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete role");
    }
  };

  return (
    <>
      <SectionHeader title="Roles" description="Create custom roles for how your team actually works, then choose exactly what each role can do." actions={<Button size="sm" onClick={() => setEditing({ id: `ROLE-${Date.now()}`, name: "", description: "", system: false, matrix: blank(), updated: "27 Sep 2026" })}><Plus className="size-4" /> New custom role</Button>} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((r) => {
          const safeMatrix = normalizeMatrix(r.matrix);
          const users = appUsers.filter((u) => u.role === r.name).length;
          const viewable = permModules.filter((m) => safeMatrix[m]?.View);
          return (
            <div key={r.id} className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="truncate font-semibold">{r.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p></div>
                <StatusBadge status={r.system ? "info" : "active"} label={r.system ? "System" : "Custom"} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {viewable.slice(0, 6).map((m) => (
                  <span key={m} className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[11px]">{m}</span>
                ))}
                {viewable.length > 6 ? (
                  <span className="px-1 text-[11px] text-muted-foreground">+{viewable.length - 6}</span>
                ) : null}
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-muted-foreground">
                <span>{users} users · {countOn(safeMatrix)} permissions</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ ...r, id: `ROLE-${Date.now()}`, name: `${r.name} (copy)`, system: false, matrix: safeMatrix })} aria-label="Duplicate"><Copy className="size-4" /></Button>
                  {!r.system ? <Button size="sm" variant="ghost" onClick={() => setRemoving(r)} aria-label="Delete"><Trash2 className="size-4" /></Button> : null}
                  <Button size="sm" variant="outline" onClick={() => setEditing({ ...r, matrix: safeMatrix })}>{r.system ? "View" : "Edit"}</Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <RoleEditor role={editing} onClose={() => setEditing(null)} onSave={save} />
      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete role “{removing?.name}”?</AlertDialogTitle><AlertDialogDescription>Users with this role must be moved to another role first. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (removing) deleteRole(removing); setRemoving(null); }}>Delete role</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RoleEditor({ role, onClose, onSave }: { role: Role | null; onClose: () => void; onSave: (r: Role) => void }) {
  return (
    <Dialog open={!!role} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        {role ? <RoleEditorBody key={role.id} role={role} onClose={onClose} onSave={onSave} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function RoleEditorBody({ role, onClose, onSave }: { role: Role; onClose: () => void; onSave: (r: Role) => void }) {
  const [cur, setDraft] = useState<Role>(() => structuredClone(role));
  const ro = cur.system;
  return (
    <>
      <DialogHeader><DialogTitle>{ro ? cur.name : role.name ? `Edit role — ${role.name}` : "New custom role"}</DialogTitle><DialogDescription>{ro ? "System roles cannot be changed. Duplicate it to make a custom version." : "Tick what this role can do in each module."}</DialogDescription></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Role name" required><Input value={cur.name} disabled={ro} onChange={(e) => setDraft({ ...cur, name: e.target.value })} placeholder="e.g. Branch Manager — Kozhikode" /></Field>
        <Field label="Description"><Textarea rows={1} value={cur.description} disabled={ro} onChange={(e) => setDraft({ ...cur, description: e.target.value })} placeholder="What this role is for" /></Field>
      </div>
      <PermissionMatrix matrix={cur.matrix} readOnly={ro} onChange={(m) => setDraft({ ...cur, matrix: m })} />
      <DialogFooter><Button variant="outline" onClick={onClose}>{ro ? "Close" : "Cancel"}</Button>{!ro ? <Button onClick={() => { if (!cur.name.trim()) { toast.error("Give the role a name"); return; } onSave({ ...cur, updated: "27 Sep 2026" }); }}>Save role</Button> : null}</DialogFooter>
    </>
  );
}

export function PermissionMatrix({ matrix, onChange, readOnly }: { matrix: Matrix; onChange: (m: Matrix) => void; readOnly?: boolean }) {
  const safeMatrix = useMemo(() => normalizeMatrix(matrix), [matrix]);

  const set = (mod: string, act: string, v: boolean) => {
    const m = structuredClone(safeMatrix) as Matrix;
    const row = m[mod as keyof Matrix];
    row[act as keyof typeof row] = v;
    if (v && act !== "View") row.View = true;
    if (!v && act === "View") permActions.forEach((a) => (row[a] = false));
    onChange(m);
  };
  const setRow = (mod: string, v: boolean) => {
    const m = structuredClone(safeMatrix) as Matrix;
    permActions.forEach((a) => (m[mod as keyof Matrix][a] = v));
    onChange(m);
  };
  const setCol = (act: string, v: boolean) => {
    const m = structuredClone(safeMatrix) as Matrix;
    permModules.forEach((mod) => {
      m[mod][act as keyof Matrix[typeof mod]] = v;
      if (v) m[mod].View = true;
    });
    onChange(m);
  };

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-40">Module</TableHead>
            {permActions.map((a) => (
              <TableHead key={a} className="text-center">
                <span className="block">{a}</span>
                {!readOnly ? (
                  <button
                    type="button"
                    className="text-[10px] font-normal text-accent hover:underline"
                    onClick={() => setCol(a, !permModules.every((m) => safeMatrix[m]?.[a]))}
                  >
                    all
                  </button>
                ) : null}
              </TableHead>
            ))}
            <TableHead className="text-center">Full</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {permModules.map((mod) => {
            const row = safeMatrix[mod] || blank()[mod];
            const full = permActions.every((a) => row[a]);
            return (
              <TableRow key={mod} className={cn(!row.View && "text-muted-foreground")}>
                <TableCell className="font-medium">{mod}</TableCell>
                {permActions.map((a) => (
                  <TableCell key={a} className="text-center">
                    <Checkbox
                      aria-label={`${mod} ${a}`}
                      checked={Boolean(row[a])}
                      disabled={readOnly}
                      onCheckedChange={(v) => set(mod, a, !!v)}
                    />
                  </TableCell>
                ))}
                <TableCell className="text-center">
                  <Switch
                    aria-label={`${mod} full access`}
                    checked={full}
                    disabled={readOnly}
                    onCheckedChange={(v) => setRow(mod, v)}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
        Any action automatically includes View. Removing View removes all actions for that module.
      </p>
    </div>
  );
}

export function PermissionsPage() {
  const [roles, setRoles] = useRoles();
  const [sel, setSel] = useState<string>(() => roles[0]?.id || "ROLE-1");
  const [m, setM] = useState<Record<string, Matrix>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ results: any[] }>("/roles/").then((res) => {
      if (res && res.results && res.results.length > 0) {
        const apiRoles: Role[] = res.results.map((r) => ({
          id: `ROLE-${r.id}`,
          name: r.name,
          description: r.description || "",
          system: !!r.is_system,
          matrix: normalizeMatrix(r.matrix),
          updated: r.updated_at ? new Date(r.updated_at).toLocaleDateString() : "Active",
        }));
        setRoles(apiRoles);
      }
    }).catch(() => {});
  }, [setRoles]);

  useEffect(() => {
    if (roles.length > 0 && (!sel || !roles.some((r) => r.id === sel))) {
      const first = roles[0];
      if (first) setSel(first.id);
    }
  }, [roles, sel]);

  const role = roles.find((r) => r.id === sel) || roles[0] || {
    id: "ROLE-1",
    name: "Administrator",
    description: "System role",
    system: true,
    matrix: blank(),
    updated: "Active",
  };

  const currentMatrix = normalizeMatrix(m[role.id] ?? role.matrix);

  const save = async () => {
    setSaving(true);
    const isApiId = /^ROLE-(\d+)$/.test(role.id);
    const numericId = isApiId ? role.id.replace("ROLE-", "") : null;
    try {
      if (numericId) {
        await api.patch(`/roles/${numericId}/`, {
          matrix: currentMatrix,
        });
      }
      setRoles(roles.map((r) => (r.id === role.id ? { ...r, matrix: currentMatrix } : r)));
      logAudit({
        action: "Updated permissions",
        module: "Users",
        record: role.id,
        description: `Updated permission matrix for role ${role.name}`,
      });
      toast.success(`Permissions for “${role.name}” saved`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save permissions to server");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="Permissions"
        description="Compare and adjust module permissions for any role."
        actions={
          <>
            <Select value={sel} onValueChange={setSel}>
              <SelectTrigger className="h-9 w-64">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" disabled={role.system || saving} onClick={save}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      />
      <Panel title={role.name} description={role.system ? "System role — read only" : role.description}>
        <PermissionMatrix
          matrix={currentMatrix}
          readOnly={role.system}
          onChange={(x) => setM({ ...m, [role.id]: x })}
        />
      </Panel>
      <Panel title="Access overview" description="Which roles can view each module">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                {roles.map((r) => (
                  <TableHead key={r.id} className="text-center text-xs">
                    {r.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {permModules.map((mod) => (
                <TableRow key={mod}>
                  <TableCell className="font-medium">{mod}</TableCell>
                  {roles.map((r) => {
                    const rMat = normalizeMatrix(r.matrix);
                    const n = permActions.filter((a) => rMat[mod]?.[a]).length;
                    return (
                      <TableCell key={r.id} className="text-center text-xs">
                        {n === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : n === permActions.length ? (
                          <StatusBadge status="active" label="Full" />
                        ) : (
                          <span>
                            {n}/{permActions.length}
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </>
  );
}

export function LoginActivityPage() {
  return (
    <>
      <SectionHeader title="Login activity" description="Sign-in attempts with device and location (IP details are placeholders)." />
      <DataTable
        rows={logins}
        getId={(l) => l.id}
        entity="login"
        removeLabel={null}
        search={(l) => `${l.user} ${l.ip} ${l.device} ${l.location}`}
        date={(l) => l.iso}
        filters={[{ label: "Result", get: (l) => l.result }, { label: "Location", get: (l) => l.location }]}
        columns={[
          { key: "user", header: "User", sort: (l) => l.user, render: (l) => <span className="font-medium">{l.user}</span> },
          { key: "when", header: "Date / time", sort: (l) => l.iso, render: (l) => l.when },
          { key: "ip", header: "IP address", render: (l) => <span className="font-mono text-xs">{l.ip}</span> },
          { key: "device", header: "Device", render: (l) => l.device },
          { key: "loc", header: "Location", render: (l) => l.location },
          { key: "res", header: "Result", render: (l) => <StatusBadge status={l.result === "Success" ? "active" : "failed"} label={l.result} /> },
        ]}
      />
    </>
  );
}

export function SecurityPage() {
  const [s, setS] = useState({ twoFactor: true, strong: true, lock: true, sessions: false, ipAllow: false, deviceLicence: true });
  const rows: [keyof typeof s, string, string][] = [
    ["twoFactor", "Require 2-step verification", "Users confirm sign-in with a one-time code."],
    ["strong", "Strong passwords", "At least 10 characters with numbers and symbols; expire every 90 days."],
    ["lock", "Lock account after 5 failed attempts", "Unlocked by an administrator or after 30 minutes."],
    ["sessions", "Single active session per user", "Signing in elsewhere signs out the older session."],
    ["ipAllow", "Restrict access to office IPs", "Only Kalamassery, Kozhikode and Thrissur networks."],
    ["deviceLicence", "Require licensed USB device for protected features", "Accounting, payroll and export need the licence key connected."],
  ];
  return (
    <>
      <SectionHeader title="Security" description="Sign-in and session rules for all users." actions={<Button size="sm" onClick={() => {
        logAudit({ action: "Security", module: "Settings", record: "security-policy", description: "Updated global security policies" });
        toast.success("Security settings saved");
      }}><ShieldCheck className="size-4" /> Save</Button>} />
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Policies" className="xl:col-span-2" bodyClassName="p-0">
          <ul className="divide-y divide-border">{rows.map(([k, t, d]) => <li key={k} className="flex items-center justify-between gap-4 px-5 py-3.5"><span><span className="block text-sm font-medium">{t}</span><span className="block text-xs text-muted-foreground">{d}</span></span><Switch checked={s[k]} onCheckedChange={(v) => setS({ ...s, [k]: v })} aria-label={t} /></li>)}</ul>
        </Panel>
        <Panel title="Session">
          <div className="space-y-3">
            <Field label="Auto sign-out after inactivity"><Select defaultValue="30"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["15", "30", "60", "120"].map((m) => <SelectItem key={m} value={m}>{m} minutes</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Password expiry"><Select defaultValue="90"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["30", "60", "90", "180"].map((m) => <SelectItem key={m} value={m}>{m} days</SelectItem>)}</SelectContent></Select></Field>
            <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">{logins.filter((l) => l.result !== "Success").length} failed or locked sign-ins in the last 9 days.</div>
          </div>
        </Panel>
      </div>
    </>
  );
}
