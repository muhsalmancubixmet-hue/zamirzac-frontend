import {
  LayoutDashboard,
  BookOpen,
  ReceiptIndianRupee,
  FileText,
  ShoppingCart,
  Boxes,
  Factory,
  Landmark,
  Users,
  Wallet,
  BarChart3,
  IdCard,
  Workflow,
  FolderClosed,
  Settings,
  CalendarCheck,
  Car,
  Bell,
  ShieldCheck,
  SlidersHorizontal,
  KeyRound,
  History,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; to: string; icon: LucideIcon };
export type NavGroup = { group: string; icon: LucideIcon; items: NavItem[] };

export const navGroups: NavGroup[] = [
  { group: "Overview", icon: LayoutDashboard, items: [{ label: "Dashboard", to: "/", icon: LayoutDashboard }] },
  {
    group: "Business",
    icon: ReceiptIndianRupee,
    items: [
      { label: "CRM", to: "/crm", icon: Users },
      { label: "Sales", to: "/sales", icon: ReceiptIndianRupee },
      { label: "Quotations", to: "/quotations", icon: FileText },
      { label: "Purchase", to: "/purchase", icon: ShoppingCart },
    ],
  },
  {
    group: "Inventory",
    icon: Boxes,
    items: [
      { label: "Inventory", to: "/inventory", icon: Boxes },
      { label: "Manufacturing", to: "/manufacturing", icon: Factory },
    ],
  },
  {
    group: "Finance",
    icon: BookOpen,
    items: [
      { label: "Accounting", to: "/accounting", icon: BookOpen },
      { label: "GST", to: "/gst", icon: Landmark },
      { label: "Payroll", to: "/payroll", icon: Wallet },
    ],
  },
  {
    group: "People",
    icon: IdCard,
    items: [
      { label: "Employees", to: "/employees", icon: IdCard },
      { label: "Attendance", to: "/attendance", icon: CalendarCheck },
      { label: "Travel", to: "/travel", icon: Car },
    ],
  },
  { group: "Reports", icon: BarChart3, items: [{ label: "Reports & Analytics", to: "/reports", icon: BarChart3 }] },
  {
    group: "Communication",
    icon: Workflow,
    items: [
      { label: "Automation", to: "/automation", icon: Workflow },
      { label: "Notifications", to: "/notifications", icon: Bell },
    ],
  },
  { group: "Documents", icon: FolderClosed, items: [{ label: "Documents", to: "/documents", icon: FolderClosed }] },
  {
    group: "Settings",
    icon: Settings,
    items: [
      { label: "Users & Roles", to: "/users", icon: ShieldCheck },
      { label: "Business Settings", to: "/settings", icon: Settings },
      { label: "System Settings", to: "/settings/system", icon: SlidersHorizontal },
      { label: "License", to: "/settings/license", icon: KeyRound },
      { label: "Audit Log", to: "/activity", icon: History },
    ],
  },
];

export const allNavItems: NavItem[] = navGroups.flatMap((g) => g.items);

/** Longest nav path that prefixes the current pathname, so nested pages keep their menu item active. */
export function activeNavPath(pathname: string): string {
  const matches = allNavItems.map((i) => i.to).filter((to) => (to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`)));
  return matches.sort((a, b) => b.length - a.length)[0] ?? "";
}
