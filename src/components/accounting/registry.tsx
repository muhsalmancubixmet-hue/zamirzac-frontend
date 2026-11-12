import type { ComponentType } from "react";
import type { Section } from "@/components/erp/ModuleLayout";
import * as A from "./sections";

export const accountingSections: (Section & { component: ComponentType; description: string })[] = [
  { slug: "", label: "Accounts Overview", group: "Overview", component: A.AccountsOverview, description: "Cash, bank, receivables, payables and profit at a glance." },
  { slug: "chart-of-accounts", label: "Chart of Accounts", group: "Setup", component: A.ChartOfAccounts, description: "Account hierarchy across assets, liabilities, equity, income and expenses." },
  { slug: "journal-entries", label: "Journal Entries", group: "Transactions", component: A.JournalEntries, description: "Double-entry journal vouchers with debit and credit lines." },
  { slug: "cash-bank", label: "Cash & Bank", group: "Transactions", component: A.CashBank, description: "Cash and bank accounts, transactions, transfers and reconciliation." },
  { slug: "receipts", label: "Receipts", group: "Transactions", component: A.Receipts, description: "Customer receipts by NEFT, UPI, cheque and cash." },
  { slug: "payments", label: "Payments", group: "Transactions", component: A.Payments, description: "Supplier, expense, salary and tax payments." },
  { slug: "payment-batches", label: "Payment Batches", group: "Transactions", component: A.PaymentBatches, description: "Maker-checker bulk supplier payment batches and banking portal exports." },
  { slug: "expenses", label: "Expenses", group: "Transactions", component: A.Expenses, description: "Operating expenses with GST input." },
  { slug: "income", label: "Income", group: "Transactions", component: A.IncomePage, description: "Sales and other income." },
  { slug: "customer-ledger", label: "Customer Ledger", group: "Ledgers", component: A.CustomerLedger, description: "Customer-wise invoices, receipts and balances." },
  { slug: "supplier-ledger", label: "Supplier Ledger", group: "Ledgers", component: A.SupplierLedger, description: "Supplier-wise bills, payments and balances." },
  { slug: "general-ledger", label: "General Ledger", group: "Ledgers", component: A.GeneralLedger, description: "Account-wise transaction history." },
  { slug: "trial-balance", label: "Trial Balance", group: "Reports", component: A.TrialBalance, description: "Debit and credit balances of all ledgers." },
  { slug: "profit-loss", label: "Profit & Loss", group: "Reports", component: A.ProfitLoss, description: "Revenue, cost, gross profit, expenses and net profit." },
  { slug: "balance-sheet", label: "Balance Sheet", group: "Reports", component: A.BalanceSheet, description: "Assets, liabilities and equity." },
  { slug: "cash-flow", label: "Cash Flow", group: "Reports", component: A.CashFlowPage, description: "Operating, investing and financing cash flows." },
  { slug: "day-book", label: "Day Book", group: "Reports", component: A.DayBook, description: "Chronological list of all vouchers." },
];
