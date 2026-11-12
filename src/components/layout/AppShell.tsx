import { AppLink } from "@/components/erp/AppLink";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { activeNavPath, navGroups } from "@/components/erp/nav-items";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { notifIcon, notifStore, useNotifications } from "@/components/admin/center-sections";
import { company } from "@/config/company";
import { currentUser } from "@/lib/user";
import { CompanyLogo } from "@/components/erp/CompanyLogo";
import { MobileBottomNav, PwaBanners } from "@/components/layout/AppChrome";
import { canAccessModule, useCurrentRole } from "@/lib/access";
import { getStoredUser, getAccessToken, getRefreshToken, authApi, notificationsApi } from "@/lib/api";

function SidebarContent({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeTo = activeNavPath(pathname);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const role = useCurrentRole();

  const filteredNavGroups = useMemo(() => {
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => canAccessModule(role, item.to)),
      }))
      .filter((group) => group.items.length > 0);
  }, [role]);

  return (
    <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4" suppressHydrationWarning>
      {filteredNavGroups.map((group) => {
        const single = group.items.length === 1;
        const hasActive = group.items.some((i) => i.to === activeTo);
        const isOpen = collapsed || single || hasActive || !closed[group.group];
        return (
          <div key={group.group}>
            {collapsed ? (
              <div className="mx-2 mb-2 h-px bg-sidebar-border" />
            ) : single ? null : (
              <button
                onClick={() => setClosed((c) => ({ ...c, [group.group]: !c[group.group] }))}
                className="flex w-full items-center gap-2 px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45 hover:text-sidebar-foreground/70"
                aria-expanded={isOpen}
              >
                <span className="flex-1 text-left">{group.group}</span>
                <ChevronDown className={cn("size-3.5 transition-transform", !isOpen && "-rotate-90")} />
              </button>
            )}
            {isOpen ? (
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.to === activeTo;
                  const link = (
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                        collapsed && "justify-center px-0",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                  return (
                    <li key={item.to}>
                      {collapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{link}</TooltipTrigger>
                          <TooltipContent side="right">{item.label}</TooltipContent>
                        </Tooltip>
                      ) : (
                        link
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

function NotificationBell() {
  const list = useNotifications();
  const unread = list.filter((n) => !n.read);

  const handleItemClick = (id: string | number) => {
    notifStore.set(list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    notificationsApi.markRead(id, true).catch(() => {});
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications, ${unread.length} unread`}>
          <Bell className="size-4" />
          {unread.length ? <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground">{unread.length}</span> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">Notifications <span className="text-xs font-normal text-muted-foreground">{unread.length} unread</span></DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(unread.length ? unread : list).slice(0, 5).map((n) => {
          const I = notifIcon[n.cat] || Bell;
          return (
            <DropdownMenuItem key={n.id} asChild>
              <AppLink href={n.link} onClick={() => handleItemClick(n.id)} className="flex items-start gap-2.5">
                <I className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0"><span className="block truncate text-sm">{n.title}</span><span className="block truncate text-xs text-muted-foreground">{n.body} · {n.when}</span></span>
              </AppLink>
            </DropdownMenuItem>
          );
        })}
        {!list.length ? <p className="px-2 py-3 text-center text-xs text-muted-foreground">You're all caught up</p> : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/notifications" className="justify-center text-sm font-medium">View all notifications</Link></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
      <CompanyLogo tile className="size-8" />
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">
            {company.name}
          </p>
          <p className="truncate text-[11px] text-sidebar-foreground/55">
            {company.branch ? `${company.branch} · ` : ""}{company.fy}
          </p>
        </div>
      )}
    </div>
  );
}

export function AppShell({
  title,
  breadcrumbs = [],
  children,
}: {
  title: string;
  breadcrumbs?: string[];
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = useCurrentRole();

  const [displayName, setDisplayName] = useState(() => currentUser.name);
  const [displayEmail, setDisplayEmail] = useState(() => currentUser.email);
  const [displayInitials, setDisplayInitials] = useState(() => currentUser.initials);

  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = getAccessToken();
      const refresh = getRefreshToken();
      if (!token && !refresh) {
        navigate({ to: "/login" });
        return;
      }
    }
    const syncUser = () => {
      const stored = getStoredUser();
      if (stored?.name) {
        setDisplayName(stored.name);
        setDisplayEmail(stored.email);
        const inits = stored.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
        setDisplayInitials(inits || "U");
      }
    };
    syncUser();
    window.addEventListener("zs_auth_changed", syncUser);
    return () => window.removeEventListener("zs_auth_changed", syncUser);
  }, [navigate]);

  // Zero-flash render blocker: never paint protected ERP layout if unauthenticated
  if (typeof window !== "undefined") {
    const token = getAccessToken();
    const refresh = getRefreshToken();
    if (!token && !refresh) {
      return null;
    }
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex min-h-screen bg-surface">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar transition-[width] duration-200 lg:flex",
            collapsed ? "w-[68px]" : "w-64",
          )}
        >
          <Brand collapsed={collapsed} />
          <SidebarContent collapsed={collapsed} />
          <div className="border-t border-sidebar-border p-3">
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="flex w-full items-center justify-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <>
                  <PanelLeftClose className="size-4" /> Collapse
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Mobile sidebar */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-foreground/40"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-sidebar">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Brand collapsed={false} />
                </div>
                <button
                  className="absolute right-3 top-4 text-sidebar-foreground/70"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="size-4" />
                </button>
              </div>
              <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
          <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
            <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
              <button
                className="lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="size-5" />
              </button>

              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
                <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
                  {["Home", ...breadcrumbs].join("  /  ")}
                </p>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <GlobalSearch />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="hidden sm:inline-flex">
                      <Plus className="size-4" /> Quick action
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>Create new</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild><Link to="/sales/$section" params={{ section: "new-invoice" }}>Sales invoice</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to="/quotations/$section" params={{ section: "create" }}>Quotation</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to="/purchase/$section" params={{ section: "bills" }}>Purchase bill</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to="/manufacturing/$section" params={{ section: "orders" }}>Production order</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to="/documents">Upload document</Link></DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <NotificationBell />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left hover:bg-muted">
                        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground" suppressHydrationWarning>
                          {displayInitials}
                        </span>
                        <span className="hidden leading-tight sm:block">
                          <span className="block text-xs font-semibold" suppressHydrationWarning>{displayName}</span>
                          <span className="block text-[11px] text-muted-foreground" suppressHydrationWarning>
                            {role.name}
                          </span>
                        </span>
                        <ChevronDown className="size-3.5 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="font-normal">
                        <p className="text-sm font-semibold" suppressHydrationWarning>{displayName}</p>
                        <p className="text-xs text-muted-foreground" suppressHydrationWarning>{displayEmail}</p>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/profile">
                          <UserRound className="size-4" /> My profile
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/settings">Business settings</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          authApi.logout();
                        }}
                        asChild
                      >
                        <Link to="/login">
                          <LogOut className="size-4" /> Sign out
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-border px-4 py-1.5 sm:px-6 md:hidden">
              <GlobalSearch compact />
            </div>
            <PwaBanners />
          </header>

          <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-6 px-4 py-6 sm:px-6">
            {children}
          </main>

          <footer className="border-t border-border bg-background px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {company.name} · GSTIN {company.gstin}
              </span>
            </div>
          </footer>
        </div>
      </div>
      <MobileBottomNav onMore={() => setMobileOpen(true)} />
    </TooltipProvider>
  );
}
