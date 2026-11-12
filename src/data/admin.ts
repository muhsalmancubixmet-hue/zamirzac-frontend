// Admin, settings, roles and activity types.
// Initial data arrays start empty; populated by user actions or backend API.

export const permModules = ["Dashboard", "Accounting", "Sales", "Quotations", "Purchase", "Inventory", "Manufacturing", "GST", "CRM", "Payroll", "Reports", "Employees", "Attendance", "Automation", "Documents", "Settings"] as const;
export const permActions = ["View", "Create", "Edit", "Delete", "Approve", "Export"] as const;
export type PermModule = (typeof permModules)[number];
export type PermAction = (typeof permActions)[number];
export type Matrix = Record<PermModule, Record<PermAction, boolean>>;
const letter: Record<PermAction, string> = { View: "V", Create: "C", Edit: "E", Delete: "D", Approve: "A", Export: "X" };
const role = (spec: Partial<Record<PermModule, string>>): Matrix =>
  Object.fromEntries(permModules.map((m) => [m, Object.fromEntries(permActions.map((a) => [a, (spec[m] ?? "").includes(letter[a])]))])) as Matrix;
const all = Object.fromEntries(permModules.map((m) => [m, "VCEDAX"])) as Record<PermModule, string>;
export type Role = { id: string; name: string; description: string; system: boolean; matrix: Matrix; updated: string };

export const roles: Role[] = [
  { id: "ROLE-1", name: "Administrator", description: "Full administrative access to every module, user management, and system settings.", system: true, matrix: role(all), updated: "Active" },
  { id: "ROLE-2", name: "Accounts & Finance Manager", description: "Manages financial books, GST compliance, vendor bills, customer receipts, and payroll.", system: false, matrix: role({ Dashboard: "V", Accounting: "VCEDAX", GST: "VCEAX", Payroll: "VCEAX", Reports: "VX", Sales: "VX", Quotations: "V", Purchase: "VAX", Documents: "VCEX", Attendance: "VC" }), updated: "Active" },
  { id: "ROLE-3", name: "Sales & CRM Manager", description: "Handles school & enterprise customer accounts, leads, quotations, and sales invoices.", system: false, matrix: role({ Dashboard: "V", Sales: "VCEX", Quotations: "VCEAX", CRM: "VCEX", Inventory: "V", Reports: "VX", Documents: "VCX", Attendance: "VC" }), updated: "Active" },
  { id: "ROLE-4", name: "Production & Inventory Supervisor", description: "Supervises card printing, production lines, BOMs, raw material issues, and inventory stock.", system: false, matrix: role({ Dashboard: "V", Manufacturing: "VCEAX", Inventory: "VCEX", Purchase: "VC", Reports: "VX", Documents: "VC", Attendance: "VCA" }), updated: "Active" },
  { id: "ROLE-5", name: "HR & Payroll Officer", description: "Manages employee records, biometric/mobile attendance, leave requests, and payroll runs.", system: false, matrix: role({ Dashboard: "V", Employees: "VCEDX", Attendance: "VCEAX", Payroll: "VCEX", Automation: "VC", Documents: "VCEX", Reports: "VX" }), updated: "Active" },
  { id: "ROLE-6", name: "Store Keeper & Logistics", description: "Manages warehouse stock movements, inward receipts from vendors, and delivery dispatch.", system: false, matrix: role({ Dashboard: "V", Inventory: "VCE", Purchase: "VC", Manufacturing: "V", Documents: "VC", Attendance: "VC" }), updated: "Active" },
  { id: "ROLE-7", name: "General Staff", description: "Standard employee portal for clock-in/out attendance, leave requests, personal payslips, and company directory.", system: false, matrix: role({ Dashboard: "V", Attendance: "VC", Employees: "V", Payroll: "V", Documents: "VC" }), updated: "Active" },
];

export type DocCategory = "Customers" | "Suppliers" | "Sales" | "Purchases" | "Employees" | "Quotations" | "Products" | "Other";
export type DocType = "PDF" | "Image" | "Excel" | "Word" | "ZIP";
export type Doc = { id: string; name: string; type: DocType; category: DocCategory; record: string; related: string; by: string; date: string; iso: string; size: string; status: "Verified" | "Pending review" | "Archived" };
export const documents: Doc[] = [];

export type AppUser = { id: string; name: string; email: string; phone: string; role: string; dept: string; lastLogin: string; status: "Active" | "Inactive" | "Invited"; twoFactor: boolean };
export const appUsers: AppUser[] = [];

export type Login = { id: string; user: string; when: string; iso: string; ip: string; device: string; location: string; result: "Success" | "Failed" | "Locked" };
export const logins: Login[] = [];

export type NotifCat = "System" | "Low stock" | "Payment" | "Approval" | "Quotation" | "Purchase" | "Employee" | "Automation";
export type Notif = { id: string | number; cat: NotifCat; title: string; body: string; when: string; read: boolean; link: string };
export const notifications: Notif[] = [];

export type ActivityRow = { id: string; user: string; action: string; module: string; record: string; when: string; iso: string; ip: string; device: string; description: string };
export const activityLog: ActivityRow[] = [];

export type LicenseState = "connected" | "disconnected" | "expired" | "verify";
export const license = {
  key: "ZS-ERP-2026-KL-4F9A-71C2", type: "Enterprise — Perpetual with annual renewal", edition: "Multi-branch · 25 users",
  issued: "01 Apr 2026", validTill: "31 Mar 2027", lastVerified: "27 Sep 2026, 08:02",
  device: { name: "Zamirzac Secure USB Key", serial: "ZS-KEY-0192-7731", model: "HID secure token v3", firmware: "3.2.1", host: "ZS-ACCOUNTS-PC01 (Windows 11)", port: "USB 3.0 · Port 2" },
  features: ["Accounting & GST", "Sales & Quotations", "Purchase & Inventory", "Manufacturing", "Payroll", "Reports & Export", "Automation"],
};

export type SearchHit = { group: string; title: string; meta: string; to: string };
export const searchIndex: SearchHit[] = [];

export const rnd = () => Math.random();
