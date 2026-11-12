import { AppLink } from "@/components/erp/AppLink";
import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, CalendarCheck, Download, Home, Menu, ReceiptText, WifiOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/components/admin/center-sections";
import { canAccessModule, useCurrentRole } from "@/lib/access";
import { companyConfig as company } from "@/config/company";
import { CompanyLogo } from "@/components/erp/CompanyLogo";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Mobile bottom navigation — touch-friendly shortcuts to the most used mobile workflows. */
export function MobileBottomNav({ onMore }: { onMore: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const unread = useNotifications().filter((n) => !n.read).length;
  const role = useCurrentRole();
  const allItems = [
    { to: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
    { to: "/attendance/mark", label: "Attendance", icon: CalendarCheck, match: (p: string) => p.startsWith("/attendance") },
    { to: "/sales/invoices", label: "Sales", icon: ReceiptText, match: (p: string) => p.startsWith("/sales") || p.startsWith("/crm") },
    { to: "/notifications", label: "Alerts", icon: Bell, match: (p: string) => p.startsWith("/notifications"), badge: unread },
  ];
  const items = allItems.filter((i) => canAccessModule(role, i.to));
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid h-16 grid-cols-5">
        {items.map((i) => {
          const active = i.match(path);
          return (
            <li key={i.to}>
              <AppLink href={i.to} className={cn("relative flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-accent" : "text-muted-foreground")}>
                <i.icon className="size-5" />
                {i.label}
                {i.badge ? <span className="absolute right-[calc(50%-18px)] top-2 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] leading-4 text-destructive-foreground">{i.badge}</span> : null}
                {active ? <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-accent" /> : null}
              </AppLink>
            </li>
          );
        })}
        <li><button onClick={onMore} className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground"><Menu className="size-5" />More</button></li>
      </ul>
    </nav>
  );
}

/** Offline notice + "Install app" prompt (PWA). */
export function PwaBanners() {
  const [offline, setOffline] = useState(false);
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    setOffline(!navigator.onLine);
    const on = () => setOffline(false), off = () => setOffline(true);
    const bip = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); };
    window.addEventListener("online", on); window.addEventListener("offline", off); window.addEventListener("beforeinstallprompt", bip);
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    setIos(/iphone|ipad/i.test(navigator.userAgent) && !standalone);
    setDismissed(standalone || localStorage.getItem("zs-install-dismissed") === "1");
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); window.removeEventListener("beforeinstallprompt", bip); };
  }, []);
  const dismiss = () => { localStorage.setItem("zs-install-dismissed", "1"); setDismissed(true); };
  return (
    <>
      {offline ? (
        <div role="status" className="flex items-center gap-2 border-b border-warning/30 bg-warning/15 px-4 py-2 text-xs text-foreground sm:px-6">
          <WifiOff className="size-4 shrink-0" /> You're offline. Showing the last loaded data — actions like check-in will be sent when you're back online.
        </div>
      ) : null}
      {!dismissed && (evt || ios) ? (
        <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5 sm:px-6 md:hidden">
          <CompanyLogo className="size-8" />
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Install {company.name} ERP</p><p className="truncate text-xs text-muted-foreground">{ios ? "Tap Share → Add to Home Screen" : "Open like an app from your home screen"}</p></div>
          {evt ? <Button size="sm" onClick={async () => { await evt.prompt(); setEvt(null); dismiss(); }}><Download className="size-4" /> Install</Button> : null}
          <button aria-label="Dismiss" onClick={dismiss} className="p-1 text-muted-foreground"><X className="size-4" /></button>
        </div>
      ) : null}
    </>
  );
}


export { Link };
