import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { roles as seedRoles, type PermAction, type PermModule, type Role, type Matrix } from "@/data/admin";
import { getStoredUser } from "./api";

function store<T>(initial: T) {
  let v = initial; const subs = new Set<() => void>();
  return {
    get: () => v,
    set: (n: T) => { v = n; subs.forEach((f) => f()); },
    sub: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
  };
}

export const guestRole: Role = {
  id: "ROLE-GUEST",
  name: "Guest",
  description: "Unauthenticated guest with no access",
  system: false,
  matrix: {} as Matrix,
  updated: "None",
};

function getInitialRoleData() {
  const user = typeof window !== "undefined" ? getStoredUser() : null;
  if (user && user.role && user.matrix && Object.keys(user.matrix).length > 0) {
    const apiRole: Role = {
      id: `ROLE-API-${user.role_id ?? 1}`,
      name: user.role,
      description: "Active authenticated session role from backend API",
      system: user.is_superuser,
      matrix: user.matrix as unknown as Matrix,
      updated: "Current Session",
    };
    return {
      roles: [apiRole, ...seedRoles.filter((r) => r.name !== user.role)],
      activeId: apiRole.id,
    };
  }
  return {
    roles: [guestRole, ...seedRoles],
    activeId: guestRole.id,
  };
}

const initialData = getInitialRoleData();
export const rolesStore = store<Role[]>(initialData.roles);
export const currentRoleStore = store<string>(initialData.activeId);

if (typeof window !== "undefined") {
  window.addEventListener("zs_auth_changed", () => {
    const fresh = getInitialRoleData();
    rolesStore.set(fresh.roles);
    currentRoleStore.set(fresh.activeId);
  });
}

export const useRolesList = () => useSyncExternalStore(rolesStore.sub, rolesStore.get, rolesStore.get);
export const useCurrentRoleId = () => useSyncExternalStore(currentRoleStore.sub, currentRoleStore.get, currentRoleStore.get);
export function useCurrentRole(): Role {
  const list = useRolesList();
  const id = useCurrentRoleId();
  const user = typeof window !== "undefined" ? getStoredUser() : null;

  // 1. Try matching by exact ID
  let found = list.find((r) => r.id === id);

  // 2. If roles list was replaced from API and IDs shifted, match by current user's role name
  if (!found && user?.role) {
    found = list.find((r) => r.name.toLowerCase() === user.role.toLowerCase());
  }

  // 3. If user is a superuser, ensure Administrator or system role is maintained
  if (!found && user?.is_superuser) {
    found = list.find((r) => r.name === "Administrator" || r.system);
  }

  return found ?? list[0] ?? seedRoles[0]!;
}

const baseToModule: Record<string, PermModule> = {
  "/accounting": "Accounting",
  "/gst": "GST",
  "/sales": "Sales",
  "/quotations": "Quotations",
  "/crm": "CRM",
  "/purchase": "Purchase",
  "/inventory": "Inventory",
  "/manufacturing": "Manufacturing",
  "/employees": "Employees",
  "/attendance": "Attendance",
  "/travel": "Employees",
  "/payroll": "Payroll",
  "/automation": "Automation",
  "/reports": "Reports",
  "/users": "Settings",
  "/settings": "Settings",
  "/settings/system": "Settings",
  "/settings/license": "Settings",
  "/activity": "Settings",
  "/documents": "Documents",
};

export const moduleForBase = (base: string): PermModule | null => {
  if (baseToModule[base]) return baseToModule[base] ?? null;
  const matched = Object.keys(baseToModule).find((k) => base.startsWith(k));
  return matched ? (baseToModule[matched] ?? null) : null;
};

export function canAccessModule(role: Role, path: string): boolean {
  if (!role || role.id === "ROLE-GUEST" || role.name === "Guest") return false;
  if (path === "/" || path === "/notifications") return true;
  if (role.system || role.name === "Administrator") return true;
  const mod = moduleForBase(path);
  if (!mod) return true;
  return !!role.matrix[mod]?.View;
}

const ModuleCtx = createContext<PermModule | null>(null);
export const PermModuleProvider = ({ module, children }: { module: PermModule | null; children: ReactNode }) => <ModuleCtx.Provider value={module}>{children}</ModuleCtx.Provider>;

/** True when the current role may perform `action` in `module` (defaults to the surrounding module page). */
export function useCan(action: PermAction, module?: PermModule): boolean {
  const ctx = useContext(ModuleCtx);
  const role = useCurrentRole();
  if (!role || role.id === "ROLE-GUEST" || role.name === "Guest") return false;
  const m = module ?? ctx;
  if (!m) return true;
  if (role.system || role.name === "Administrator") return true;
  return !!role.matrix[m]?.[action];
}

export function NoAccess({ module }: { module: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-destructive/40 bg-card px-6 py-16 text-center shadow-sm">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Lock className="size-6" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-foreground">Access Restricted — 403</h3>
      <p className="mt-1.5 max-w-sm text-xs text-muted-foreground">
        Your current role does not have permission to view the <strong className="text-foreground">{module}</strong> module.
        Please contact your system administrator if you require access.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow transition hover:bg-primary/90"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
