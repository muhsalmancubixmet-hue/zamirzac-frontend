import type { ComponentType } from "react";
import type { Section } from "@/components/erp/ModuleLayout";
import * as P from "./purchase-sections";
import * as I from "./inventory-sections";
import * as F from "./manufacturing-sections";

type Sec = Section & { component: ComponentType; description: string };

export const purchaseSections: Sec[] = [
  { slug: "", label: "Dashboard", group: "Overview", component: P.PurchaseDashboard, description: "Purchases, payables, pending orders and top suppliers." },
  { slug: "suppliers", label: "Suppliers", group: "Masters", component: P.Suppliers, description: "Supplier directory with GST and outstanding details." },
  { slug: "orders", label: "Purchase Orders", group: "Buying", component: P.PurchaseOrders, description: "Purchase orders and receipt status." },
  { slug: "new-order", label: "New PO", group: "Buying", component: P.NewPurchaseOrder, description: "Create a purchase order." },
  { slug: "bills", label: "Purchase Bills", group: "Buying", component: P.PurchaseBills, description: "Supplier bills with review, confirmation and posting." },
  { slug: "new-bill", label: "Enter Bill", group: "Buying", component: P.NewBill, description: "Enter a purchase bill and post it to stock." },
  { slug: "ai-documents", label: "AI Bill Processing", group: "Buying", component: P.AiDocuments, description: "Upload a supplier bill, review extracted data and confirm." },
  { slug: "returns", label: "Purchase Returns", group: "Money", component: P.PurchaseReturns, description: "Returns to suppliers and debit notes." },
  { slug: "payments", label: "Supplier Payments", group: "Money", component: P.SupplierPayments, description: "Payments made to suppliers." },
  { slug: "attachments", label: "Attachments", group: "Files", component: P.PurchaseAttachments, description: "Supplier invoices, bill photos and delivery documents." },
];

export const inventorySections: Sec[] = [
  { slug: "", label: "Dashboard", group: "Overview", component: I.InventoryDashboard, description: "Stock value, alerts, movement and ageing." },
  { slug: "products", label: "Products", group: "Items", component: I.Products, description: "All products with pricing, tax and stock levels." },
  { slug: "raw-materials", label: "Raw Materials", group: "Items", component: I.RawMaterials, description: "Raw materials used in production." },
  { slug: "finished-goods", label: "Finished Goods", group: "Items", component: I.FinishedGoods, description: "Manufactured goods ready for sale." },
  { slug: "stock", label: "Stock Overview", group: "Stock", component: I.StockOverview, description: "Stock on hand by warehouse." },
  { slug: "movements", label: "Stock Movements", group: "Stock", component: I.StockMovements, description: "All stock in and out transactions." },
  { slug: "adjustments", label: "Adjustments", group: "Stock", component: I.StockAdjustments, description: "Stock corrections and write-offs." },
  { slug: "transfers", label: "Transfers", group: "Stock", component: I.StockTransfers, description: "Transfers between warehouses." },
  { slug: "alerts", label: "Stock Alerts", group: "Monitoring", component: I.StockAlerts, description: "Low, out-of-stock, overstock, dead and aged stock alerts." },
  { slug: "low-stock", label: "Low Stock", group: "Monitoring", component: I.LowStock, description: "Items below minimum stock." },
  { slug: "dead-stock", label: "Dead Stock", group: "Monitoring", component: I.DeadStock, description: "Items without movement for 60+ days." },
  { slug: "valuation", label: "Valuation", group: "Reports", component: I.StockValuation, description: "Stock valuation at average cost." },
  { slug: "analytics", label: "Product Analytics", group: "Reports", component: I.ProductAnalytics, description: "Sales, profit, margin and movement per product." },
];

export const manufacturingSections: Sec[] = [
  { slug: "", label: "Dashboard", group: "Overview", component: F.MfgDashboard, description: "Production status, output, wastage and shortages." },
  { slug: "finished-products", label: "Finished Products", group: "Setup", component: F.FinishedProducts, description: "Manufactured products with unit cost." },
  { slug: "raw-materials", label: "Raw Materials", group: "Setup", component: F.MfgRawMaterials, description: "Materials and where they are used." },
  { slug: "bom", label: "Bill of Materials", group: "Setup", component: F.BillOfMaterials, description: "Components required for each finished product." },
  { slug: "boms", label: "Bill of Materials", group: "Setup", component: F.BillOfMaterials, description: "Components required for each finished product." },
  { slug: "orders", label: "Production Orders", group: "Production", component: F.ProductionOrders, description: "Production orders from draft to completion." },
  { slug: "operations", label: "Operations", group: "Production", component: F.MfgOperations, description: "Shop floor operations, active batches, and execution stages." },
  { slug: "new-order", label: "New Order", group: "Production", component: F.NewProductionOrder, description: "Plan production with a material requirement preview." },
  { slug: "history", label: "History", group: "Production", component: F.ProductionHistory, description: "Completed and cancelled production records." },
];
