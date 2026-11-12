import { cn } from "@/lib/utils";
import type { Employee } from "@/data/hr";

export const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);
export const tip = { borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 };
export const axis = { tickLine: false, axisLine: false, fontSize: 12 } as const;
export const k = (n: number) => (Math.abs(n) >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${Math.round(n / 1000)}k`);
export const M = ({ children }: { children: React.ReactNode }) => <span className="text-muted-foreground">{children}</span>;

const tones = ["bg-primary/10 text-primary", "bg-accent/10 text-accent", "bg-success/10 text-success", "bg-chart-4/15 text-foreground", "bg-warning/15 text-warning-foreground"];
export function Avatar({ e, size = "md" }: { e: Pick<Employee, "initials" | "id">; size?: "sm" | "md" | "lg" }) {
  const t = tones[Number(e.id.slice(-2)) % tones.length];
  return <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", t, size === "sm" ? "size-7 text-[11px]" : size === "lg" ? "size-16 text-xl" : "size-9 text-xs")} aria-hidden>{e.initials}</span>;
}
export function Person({ e, sub }: { e: Employee; sub?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar e={e} size="sm" />
      <div className="min-w-0"><p className="truncate font-medium">{e.name}</p><p className="truncate text-xs text-muted-foreground">{sub ?? e.id}</p></div>
    </div>
  );
}
