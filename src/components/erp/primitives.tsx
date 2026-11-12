import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-lg border border-border bg-card shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

const ok = "bg-success/10 text-success border-success/25";
const warn = "bg-warning/15 text-warning-foreground border-warning/35";
const muted = "bg-muted text-muted-foreground border-border";
const bad = "bg-destructive/10 text-destructive border-destructive/25";
const statusStyles: Record<string, string> = {
  paid: ok, active: ok, posted: ok, cleared: ok, received: ok, reconciled: ok, filed: ok, matched: ok, completed: ok,
  pending: warn, unreconciled: warn, partial: warn,
  draft: muted, inactive: muted, void: muted,
  overdue: bad, bounced: bad, mismatch: bad, failed: bad,
  healthy: ok, approved: ok, confirmed: ok, "debit note issued": ok, accepted: ok,
  low: warn, "partially received": warn, "under review": warn, "in transit": warn, "in production": warn, medium: warn, overstock: warn,
  planned: "bg-accent/10 text-accent border-accent/25", sent: "bg-accent/10 text-accent border-accent/25",
  cancelled: muted, rejected: bad, dead: bad, "out of stock": bad, critical: bad, high: bad, shortage: bad,
  info: "bg-accent/10 text-accent border-accent/25",
};

export function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: "up" | "down" | undefined;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tabular text-foreground">{value}</p>
      {hint ? (
        <p
          className={cn(
            "mt-1 text-xs",
            tone === "up" ? "text-success" : tone === "down" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-destructive">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {onRetry ? (
        <button
          onClick={onRetry}
          className="mt-4 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const style = statusStyles[status.toLowerCase()] ?? statusStyles["info"];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        style,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label ?? status}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-strong px-6 py-12 text-center">
      <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Inbox className="size-5" />
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function TableLoading({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
