import { useState, type ReactNode } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Download, FileSpreadsheet, FileText, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import { NoAccess, PermModuleProvider, moduleForBase, useCan, useCurrentRole } from "@/lib/access";
import type { PermAction } from "@/data/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type Section = { slug: string; label: string; group: string; aliases?: string[]; requires?: PermAction };
export type ModuleBase = "/accounting" | "/gst" | "/sales" | "/quotations" | "/crm" | "/purchase" | "/inventory" | "/manufacturing" | "/employees" | "/payroll" | "/attendance" | "/travel" | "/automation" | "/reports" | "/users" | "/settings";

export function ModuleLayout({ title, base, sections }: { title: string; base: ModuleBase; sections: Section[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const role = useCurrentRole();
  const mod = moduleForBase(base);

  const canAccessSection = (s: Section) => {
    if (role.system || role.name === "Administrator") return true;
    if (!mod) return true;
    const req = s.requires ?? "View";
    return !!role.matrix[mod]?.[req];
  };

  const visibleSections = sections.filter(canAccessSection);
  const slug = pathname.replace(base, "").replace(/^\//, "").split("/")[0] ?? "";
  const fallbackSection: Section = { slug: "", label: title, group: "General" };
  const active = sections.find((s) => s.slug === slug || s.aliases?.includes(slug)) ?? sections[0] ?? fallbackSection;
  const isCurrentPermitted = canAccessSection(active);
  const groups = Array.from(new Set(visibleSections.map((s) => s.group)));

  return (
    <AppShell title={title} breadcrumbs={[title, active?.label || title]}>
      <div className="flex flex-col gap-5 2xl:flex-row">
        <nav aria-label={`${title} sections`} className="min-w-0 2xl:w-52 2xl:shrink-0">
          <div className="flex gap-1 overflow-x-auto pb-1 2xl:sticky 2xl:top-20 2xl:flex-col 2xl:gap-4 2xl:overflow-visible">
            {groups.map((g) => (
              <div key={g} className="flex gap-1 2xl:flex-col">
                <p className="hidden px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground 2xl:block">{g}</p>
                {visibleSections.filter((s) => s.group === g).map((s) => (
                  <SectionLink key={s.slug} base={base} slug={s.slug} active={s.slug === active.slug}>
                    {s.label}
                  </SectionLink>
                ))}
              </div>
            ))}
          </div>
        </nav>
        <div className="min-w-0 flex-1 space-y-5">
          <PermModuleProvider module={mod}>
            <Guard title={title} activeLabel={active.label} permitted={isCurrentPermitted}><Outlet /></Guard>
          </PermModuleProvider>
        </div>
      </div>
    </AppShell>
  );
}

function Guard({ title, activeLabel, permitted, children }: { title: string; activeLabel: string; permitted: boolean; children: ReactNode }) {
  const canView = useCan("View");
  if (!canView) return <NoAccess module={title} />;
  if (!permitted) return <NoAccess module={`${title} — ${activeLabel}`} />;
  return <>{children}</>;
}

export function ReportToolbar({
  onSearch,
  accountOptions,
  account,
  onAccount,
  extra,
}: {
  onSearch?: (q: string) => void;
  accountOptions?: string[];
  account?: string | undefined;
  onAccount?: (v: string) => void;
  extra?: ReactNode;
}) {
  const [period, setPeriod] = useState("month");
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3 print:hidden">
      <Select value={period} onValueChange={setPeriod}>
        <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="month">Sep 2026</SelectItem>
          <SelectItem value="quarter">Q2 (Jul–Sep)</SelectItem>
          <SelectItem value="fy">FY 2026-27 to date</SelectItem>
          <SelectItem value="custom">Custom range</SelectItem>
        </SelectContent>
      </Select>
      {period === "custom" ? (
        <>
          <Input type="date" defaultValue="2026-09-01" className="h-9 w-40" aria-label="From date" />
          <Input type="date" defaultValue="2026-09-27" className="h-9 w-40" aria-label="To date" />
        </>
      ) : null}
      {accountOptions && onAccount ? (
        <Select value={account ?? ""} onValueChange={onAccount}>
          <SelectTrigger className="h-9 w-60"><SelectValue /></SelectTrigger>
          <SelectContent>{accountOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      ) : null}
      {onSearch ? (
        <div className="relative min-w-44 flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input onChange={(e) => onSearch(e.target.value)} placeholder="Search entries" className="h-9 pl-8" />
        </div>
      ) : <div className="flex-1" />}
      {extra}
      <ExportButtons />
    </div>
  );
}

export function ExportButtons() {
  const canExport = useCan("Export");
  if (!canExport) return <Button variant="outline" size="sm" disabled title="Your role cannot export from this module"><Download className="size-4" /> Export locked</Button>;

  const exportTableToCsv = () => {
    const table = document.querySelector("table");
    if (!table) {
      toast.error("No data table found on this page to export");
      return;
    }
    const rows = Array.from(table.querySelectorAll("tr"));
    const csvLines = rows.map((tr) => {
      const cells = Array.from(tr.querySelectorAll("th, td"));
      return cells.map((td) => `"${(td.textContent || "").trim().replace(/"/g, '""')}"`).join(",");
    });
    const blob = new Blob([csvLines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Table exported to CSV/Excel");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm"><Download className="size-4" /> Export</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => window.print()}><FileText className="size-4" /> PDF</DropdownMenuItem>
          <DropdownMenuItem onClick={exportTableToCsv}><FileSpreadsheet className="size-4" /> Excel (.csv)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
    </>
  );
}

export function SectionHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div> : null}
    </div>
  );
}

function SectionLink({ base, slug, active, children }: { base: ModuleBase; slug: string; active: boolean; children: ReactNode }) {
  const className = cn(
    "whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors",
    active ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
  const p = { section: slug };
  if (!slug) {
    switch (base) {
      case "/accounting": return <Link to="/accounting" className={className}>{children}</Link>;
      case "/gst": return <Link to="/gst" className={className}>{children}</Link>;
      case "/sales": return <Link to="/sales" className={className}>{children}</Link>;
      case "/quotations": return <Link to="/quotations" className={className}>{children}</Link>;
      case "/purchase": return <Link to="/purchase" className={className}>{children}</Link>;
      case "/inventory": return <Link to="/inventory" className={className}>{children}</Link>;
      case "/manufacturing": return <Link to="/manufacturing" className={className}>{children}</Link>;
      case "/employees": return <Link to="/employees" className={className}>{children}</Link>;
      case "/payroll": return <Link to="/payroll" className={className}>{children}</Link>;
      case "/attendance": return <Link to="/attendance" className={className}>{children}</Link>;
      case "/travel": return <Link to="/travel" className={className}>{children}</Link>;
      case "/automation": return <Link to="/automation" className={className}>{children}</Link>;
      case "/reports": return <Link to="/reports" className={className}>{children}</Link>;
      case "/users": return <Link to="/users" className={className}>{children}</Link>;
      case "/settings": return <Link to="/settings" className={className}>{children}</Link>;
      default: return <Link to="/crm" className={className}>{children}</Link>;
    }
  }
  switch (base) {
    case "/accounting": return <Link to="/accounting/$section" params={p} className={className}>{children}</Link>;
    case "/gst": return <Link to="/gst/$section" params={p} className={className}>{children}</Link>;
    case "/sales": return <Link to="/sales/$section" params={p} className={className}>{children}</Link>;
    case "/quotations": return <Link to="/quotations/$section" params={p} className={className}>{children}</Link>;
    case "/purchase": return <Link to="/purchase/$section" params={p} className={className}>{children}</Link>;
    case "/inventory": return <Link to="/inventory/$section" params={p} className={className}>{children}</Link>;
    case "/manufacturing": return <Link to="/manufacturing/$section" params={p} className={className}>{children}</Link>;
    case "/employees": return <Link to="/employees/$section" params={p} className={className}>{children}</Link>;
    case "/payroll": return <Link to="/payroll/$section" params={p} className={className}>{children}</Link>;
    case "/attendance": return <Link to="/attendance/$section" params={p} className={className}>{children}</Link>;
    case "/travel": return <Link to="/travel/$section" params={p} className={className}>{children}</Link>;
    case "/automation": return <Link to="/automation/$section" params={p} className={className}>{children}</Link>;
    case "/reports": return <Link to="/reports/$section" params={p} className={className}>{children}</Link>;
    case "/users": return <Link to="/users/$section" params={p} className={className}>{children}</Link>;
    case "/settings": return <Link to="/settings/$section" params={p} className={className}>{children}</Link>;
    default: return <Link to="/crm/$section" params={p} className={className}>{children}</Link>;
  }
}
