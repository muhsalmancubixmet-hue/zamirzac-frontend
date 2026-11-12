import type { ComponentType } from "react";
import type { Section } from "@/components/erp/ModuleLayout";
import * as G from "./sections";
import { GstExport, GstEmailHistory } from "./gst-export";

export const gstSections: (Section & { component: ComponentType; description: string })[] = [
  { slug: "", label: "GST Overview", group: "Overview", component: G.GstOverview, description: "Output GST, input GST, net payable and monthly GST trend." },
  { slug: "sales-gst", label: "Sales GST", group: "Transactions", component: G.SalesGst, description: "Outward supplies with CGST, SGST and IGST." },
  { slug: "purchase-gst", label: "Purchase GST", group: "Transactions", component: G.PurchaseGst, description: "Inward supplies with GST and matching status." },
  { slug: "input-tax", label: "Input Tax", group: "Tax", component: G.InputTax, description: "Input tax credit by tax head and rate." },
  { slug: "output-tax", label: "Output Tax", group: "Tax", component: G.OutputTax, description: "Output tax by tax head and rate." },
  { slug: "hsn-summary", label: "HSN/SAC Summary", group: "Tax", component: G.HsnSummary, description: "HSN and SAC-wise summary of outward supplies." },
  { slug: "reports", label: "GST Reports", group: "Returns", component: G.GstReports, description: "Prepare GSTR-1, GSTR-3B, purchase reconciliation and HSN reports." },
  { slug: "export", label: "GST Excel & Email", group: "Returns", component: GstExport, description: "Prepare GST-ready Excel files and email them to the finance team." },
  { slug: "email-history", label: "Export & Email History", group: "Returns", component: GstEmailHistory, description: "Generated GST files and email delivery status." },
  { slug: "settings", label: "GST Settings", group: "Returns", component: G.GstSettings, description: "GST registration, tax rates and invoice preferences." },
];
