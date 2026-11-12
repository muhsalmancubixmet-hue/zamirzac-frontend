import type { ComponentType } from "react";
import type { Section } from "@/components/erp/ModuleLayout";
import * as R from "@/components/reports/report-sections";
import * as U from "./users-sections";
import * as S from "./settings-sections";

export type Sec = Section & { component: ComponentType; description: string };

export const reportSections: Sec[] = [
  { slug: "", label: "Dashboard", group: "Overview", component: R.ReportsDashboard, description: "Central reports dashboard with key figures and report categories." },
  { slug: "sales", label: "Sales", group: "Business", component: R.SalesReports, description: "Sales by date, product, customer, employee, category, payment status and returns." },
  { slug: "purchase", label: "Purchase", group: "Business", component: R.PurchaseReports, description: "Purchases by date, supplier and product, outstanding and returns." },
  { slug: "customers", label: "Customers", group: "Business", component: R.CustomerReports, description: "Customer outstanding, segments and districts." },
  { slug: "inventory", label: "Inventory", group: "Operations", component: R.InventoryReports, description: "Current stock, valuation, movement, low/dead stock, velocity and ageing." },
  { slug: "manufacturing", label: "Manufacturing", group: "Operations", component: R.ManufacturingReports, description: "Production output, wastage and BOM costing." },
  { slug: "accounting", label: "Accounting", group: "Finance", component: R.AccountingReports, description: "Profit & loss, trial balance and balance summary." },
  { slug: "gst", label: "GST", group: "Finance", component: R.GstReports, description: "Output GST, input GST and HSN summary." },
  { slug: "profitability", label: "Profitability", group: "Finance", component: R.ProfitabilityReports, description: "Product, customer and category profitability." },
  { slug: "employees", label: "Employees", group: "People", component: R.EmployeeReports, description: "Employee directory, headcount and attendance." },
  { slug: "payroll", label: "Payroll", group: "People", component: R.PayrollReports, description: "Payroll by month, statutory deductions and department cost." },
  { slug: "travel", label: "Travel", group: "People", component: R.TravelReports, description: "Trip register, allowance and purpose." },
];

export const userSections: Sec[] = [
  { slug: "", label: "Users", group: "Access", component: U.UsersPage, description: "ERP users, roles, departments and status." },
  { slug: "roles", label: "Roles", group: "Access", component: U.RolesPage, description: "Custom roles with permission matrix." },
  { slug: "permissions", label: "Permissions", group: "Access", component: U.PermissionsPage, description: "Module permissions per role." },
  { slug: "logins", label: "Login Activity", group: "Audit", component: U.LoginActivityPage, description: "Sign-in attempts with device and location." },
  { slug: "security", label: "Security", group: "Audit", component: U.SecurityPage, description: "Sign-in, password and session policies." },
];

export const settingSections: Sec[] = [
  { slug: "", label: "Business", group: "Business", component: S.BusinessSettings, description: "Company, address, GST, invoice, financial year and currency settings." },
  { slug: "sales", label: "Sales", group: "Modules", component: S.SalesSettings, description: "Invoice numbering, tax, pricing and payment terms." },
  { slug: "purchase", label: "Purchase", group: "Modules", component: S.PurchaseSettings, description: "Purchase numbering, terms and supplier rules." },
  { slug: "inventory", label: "Inventory", group: "Modules", component: S.InventorySettings, description: "Units, categories, minimum stock and alerts." },
  { slug: "manufacturing", label: "Manufacturing", group: "Modules", component: S.ManufacturingSettings, description: "Production, BOM and wastage settings." },
  { slug: "communication", label: "Communication", group: "System", component: S.CommunicationSettings, description: "Email, WhatsApp, templates and reminders." },
  { slug: "notifications", label: "Notifications", group: "System", component: S.NotificationSettings, description: "System, stock, payment and employee alerts." },
  { slug: "system", label: "System", group: "System", component: S.SystemSettings, description: "Regional, backup and branch settings." },
  { slug: "license", label: "License & Device", group: "System", component: S.LicenseSettings, description: "License status and USB security key." },
];
