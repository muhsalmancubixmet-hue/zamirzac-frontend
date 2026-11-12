import type { ComponentType } from "react";
import type { Section } from "@/components/erp/ModuleLayout";
import * as S from "./sales-sections";
import * as Q from "./quote-sections";
import * as C from "./crm-sections";

type Sec = Section & { component: ComponentType; description: string };

export const salesSections: Sec[] = [
  { slug: "", label: "Sales Overview", group: "Overview", component: S.SalesOverview, description: "Today's and monthly sales, outstanding, top customers and products." },
  { slug: "invoices", label: "Sales Invoices", group: "Invoicing", component: S.SalesInvoices, description: "GST tax invoices raised to customers.", aliases: ["invoice"] },
  { slug: "new-invoice", label: "New Invoice", group: "Invoicing", component: S.NewInvoice, description: "Create a sales invoice with editable selling prices." },
  { slug: "orders", label: "Sales Orders", group: "Invoicing", component: S.SalesOrders, description: "Confirmed customer orders." },
  { slug: "payments", label: "Customer Payments", group: "Money", component: S.CustomerPayments, description: "Payments received against invoices." },
  { slug: "returns", label: "Sales Returns", group: "Money", component: S.SalesReturns, description: "Goods returned by customers." },
  { slug: "credit-notes", label: "Credit Notes", group: "Money", component: S.CreditNotes, description: "Credit notes issued to customers." },
  { slug: "attachments", label: "Sales Attachments", group: "Files", component: S.SalesAttachments, description: "Order letters, ID-card files, approvals and delivery proofs." },
];

export const quotationSections: Sec[] = [
  { slug: "", label: "Dashboard", group: "Overview", component: Q.QuoteDashboard, description: "Quotation pipeline, win rate and accepted quotations." },
  { slug: "list", label: "All Quotations", group: "Quotations", component: Q.QuoteList, description: "All quotations with status and conversion.", aliases: ["view"] },
  { slug: "create", label: "Create Quotation", group: "Quotations", component: Q.QuoteCreate, description: "Prepare a new quotation." },
  { slug: "templates", label: "Templates", group: "Quotations", component: Q.QuoteTemplates, description: "Reusable quotation templates." },
];

export const crmSections: Sec[] = [
  { slug: "", label: "CRM Dashboard", group: "Overview", component: C.CrmDashboard, description: "Customers, leads, follow-ups and recent activity." },
  { slug: "customers", label: "Customers", group: "Customers", component: C.Customers, description: "All customers with contact, GST and outstanding details.", aliases: ["customer"] },
  { slug: "groups", label: "Customer Groups", group: "Customers", component: C.CustomerGroups, description: "Customer groups, price lists and terms." },
  { slug: "leads", label: "Leads", group: "Pipeline", component: C.Leads, description: "Lead pipeline from enquiry to conversion." },
  { slug: "follow-ups", label: "Follow-ups", group: "Pipeline", component: C.FollowUps, description: "Upcoming and overdue follow-ups." },
  { slug: "activities", label: "Activities", group: "Pipeline", component: C.Activities, description: "Calls, messages, quotations, sales and payments." },
];
