// Audit trail (mock). Later this is read from the Django audit API; logAudit() becomes a no-op
// because the server records actions itself.
import { useSyncExternalStore } from "react";
import { dayOffset } from "./finance";
import { currentUser } from "@/lib/user";

export type AuditRow = {
  id: string; user: string; action: string; module: string; record: string;
  when: string; iso: string; ip: string; device: string; description: string;
  prev?: string | undefined; next?: string | undefined;
};

const users = ["Anoop Krishnan", "Divya Menon", "Shabeer Ali", "Reshma Varghese", "Manoj P.", "Sajitha K.", "Vishnu Das", "Arjun Nair"];
const devices = ["Chrome · Windows 11", "Safari · iPhone 14", "Chrome · Android (PWA)", "Edge · Windows 10", "Chrome · Android"];
type T = [action: string, module: string, record: string, desc: string, prev?: string | undefined, next?: string | undefined];
const tpl: T[] = [
  ["Signed in", "Security", "Session", "Signed in with email & password"],
  ["Checked in", "Attendance", "ATT-0927", "Check-in at Calicut HQ · location verified", undefined, "09:07 · Verified"],
  ["Updated invoice", "Sales", "INV-2604", "Changed payment terms for St. Thomas HSS Thrissur", "Net 15", "Net 30"],
  ["Submitted attendance appeal", "Attendance", "APL-118", "Outside office radius (2.4 km) — client visit at Nirmala College", undefined, "Pending"],
  ["Approved purchase bill", "Purchase", "BILL-1841", "Bill from Sivakasi Card Materials approved for posting", "Under review", "Approved"],
  ["Adjusted stock", "Inventory", "RM-PVC-001", "Physical count correction — PVC sheets A4 760 micron", "1,240 sheets", "1,212 sheets"],
  ["Completed production", "Manufacturing", "PRD-409", "1,200 student ID cards completed; PVC & overlay consumed", "In production", "Completed"],
  ["Recorded payment", "Accounting", "RCPT-3312", "Receipt from Marian College Kuttikkanam", "Balance ₹1,54,261", "Balance ₹54,261"],
  ["Changed role permissions", "Users & Roles", "ROLE-3", "Sales Executive — Schools: Quotations Export enabled", "View, Create, Edit", "View, Create, Edit, Export"],
  ["Approved attendance appeal", "Attendance", "APL-116", "Appeal approved — field visit confirmed by manager", "Pending", "Approved"],
  ["Updated settings", "Settings", "Invoice numbering", "Sales invoice prefix changed", "INV-", "ZS/INV/26-27/"],
  ["Uploaded document", "Documents", "DOC-3398", "PO — Chinmaya Vidyalaya.pdf uploaded"],
  ["Checked out", "Attendance", "ATT-0926", "Check-out at Calicut HQ · location verified", undefined, "18:12 · Verified"],
  ["Deleted document", "Documents", "DOC-3371", "Duplicate artwork proof removed", "Archived", "Deleted"],
  ["Rejected attendance appeal", "Attendance", "APL-114", "Selfie did not match; no field-visit record", "Pending", "Rejected"],
  ["Updated quotation", "Quotations", "QT-1186", "Unit price for RFID cards revised", "₹62.00", "₹58.50"],
  ["Created user", "Users & Roles", "USR-119", "Invited new user as Store Keeper", undefined, "Invited"],
  ["Edited payment", "Purchase", "PAY-0712", "Payment mode corrected for Tirupur Lanyard Mills", "Cash", "NEFT"],
  ["Signed out", "Security", "Session", "Signed out"],
  ["Updated customer", "CRM", "CUS-014", "Credit limit changed — Nirmala College Muvattupuzha", "₹2,00,000", "₹3,00,000"],
];

let rows: AuditRow[] = []; const subs = new Set<() => void>();
export const auditStore = {
  get: () => rows,
  sub: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
};
let n = 0;
export function logAudit(e: Omit<AuditRow, "id" | "when" | "iso" | "ip" | "device" | "user"> & { user?: string }) {
  const now = new Date();
  const d = dayOffset(0);
  rows = [{ id: `AUD-${9601 + n++}`, user: e.user ?? currentUser.name, when: `${d.label}, ${now.toTimeString().slice(0, 5)}`, iso: d.iso, ip: "103.160.24.17", device: "This device", ...e }, ...rows];
  subs.forEach((f) => f());
}
export const useAudit = () => useSyncExternalStore(auditStore.sub, auditStore.get, auditStore.get);
