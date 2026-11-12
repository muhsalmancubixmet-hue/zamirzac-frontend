import type { ReactNode } from "react";
import { ShieldCheck, Landmark, LineChart } from "lucide-react";
import { company } from "@/config/company";
import { CompanyLogo } from "@/components/erp/CompanyLogo";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="hidden flex-col justify-between bg-sidebar p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <CompanyLogo tile className="size-10" />
          <div>
            <p className="text-sm font-semibold text-sidebar-accent-foreground">{company.name}</p>
            <p className="text-xs text-sidebar-foreground/60">Enterprise Resource Planning</p>
          </div>
        </div>

        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight text-sidebar-accent-foreground">
            One system for accounts, GST, inventory and payroll.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-sidebar-foreground/70">
            Built for Kerala businesses — GST-ready invoicing, multi-branch stock and statutory
            payroll in a single workspace.
          </p>
          <ul className="mt-8 space-y-4 text-sm text-sidebar-foreground/80">
            <li className="flex items-center gap-3">
              <Landmark className="size-4 text-sidebar-primary" /> GSTR-1 & GSTR-3B ready ledgers
            </li>
            <li className="flex items-center gap-3">
              <LineChart className="size-4 text-sidebar-primary" /> Live receivables and stock
              valuation
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck className="size-4 text-sidebar-primary" /> Role-based access with audit
              trail
            </li>
          </ul>
        </div>

        <p className="text-xs text-sidebar-foreground/45">
          © 2026 {company.location}
        </p>
      </aside>

      <main className="flex items-center justify-center bg-background px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <CompanyLogo className="h-11 w-11" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </div>
      </main>
    </div>
  );
}
