// HR, payroll, attendance, travel and communication data types and helpers.
// Initial data arrays start empty; populated by user actions or backend API.

import { dayOffset } from "./finance";

export const TODAY = "2026-09-27";

export const departments: { id: string; name: string; head: string; location: string; budget: number }[] = [];
export const designations: { id: string; title: string; dept: string; grade: string; band: [number, number] }[] = [];

export type Employee = { id: string; name: string; initials: string; gender: "Male" | "Female"; dept: string; designation: string; phone: string; email: string; joined: string; joinedIso: string; dob: string; dobIso: string; status: "Active" | "On Leave" | "Probation" | "Resigned"; city: string; address: string; blood: string; pan: string; uan: string; bank: string; account: string; basic: number; hra: number; conveyance: number; special: number; gross: number; manager: string; type: "Full-time" | "Contract"; vehicle: "Two-wheeler" | "Car" | "None" };

export const employees: Employee[] = [];
export const activeEmps: Employee[] = [];

const defaultEmp: Employee = {
  id: "EMP-01",
  name: "Staff Member",
  initials: "SM",
  gender: "Male",
  dept: "General",
  designation: "Staff",
  phone: "",
  email: "",
  joined: "2026-01-01",
  joinedIso: "2026-01-01",
  dob: "1995-01-01",
  dobIso: "1995-01-01",
  status: "Active",
  city: "Calicut",
  address: "",
  blood: "O+",
  pan: "",
  uan: "",
  bank: "",
  account: "",
  basic: 25000,
  hra: 10000,
  conveyance: 2500,
  special: 2500,
  gross: 40000,
  manager: "",
  type: "Full-time",
  vehicle: "Two-wheeler",
};

export const empById = (id: string): Employee =>
  employees.find((e) => e.id === id || e.name.toLowerCase() === (id || "").toLowerCase()) || {
    ...defaultEmp,
    id: id || "EMP-01",
    name: id || "Staff Member",
    initials: ((id || "SM").slice(0, 2)).toUpperCase(),
  };

// ---------- Attendance ----------
export type AttStatus = "Present" | "Absent" | "Late" | "Half Day" | "Leave";
export type AttRecord = { id: string; emp: string; iso: string; date: string; status: AttStatus; in: string; out: string; hours: number; location: string };
export const attendance: AttRecord[] = [];
export const attOf = (emp: string) => attendance.filter((a) => a.emp === emp);

export const leaveTypes = [
  { code: "CL", name: "Casual Leave", days: 12, carry: false, paid: true, color: "var(--color-chart-2)" },
  { code: "SL", name: "Sick Leave", days: 12, carry: true, paid: true, color: "var(--color-chart-4)" },
  { code: "EL", name: "Earned Leave", days: 15, carry: true, paid: true, color: "var(--color-chart-1)" },
  { code: "ML", name: "Maternity Leave", days: 182, carry: false, paid: true, color: "var(--color-chart-3)" },
  { code: "LOP", name: "Loss of Pay", days: 0, carry: false, paid: false, color: "var(--color-destructive)" },
  { code: "CO", name: "Compensatory Off", days: 6, carry: false, paid: true, color: "var(--color-chart-5)" },
];

export type Leave = { id: string; emp: string; type: string; from: string; to: string; fromIso: string; days: number; reason: string; status: "Requested" | "Approved" | "Rejected" | "Completed"; applied: string; approver: string };
export const leaves: Leave[] = [];

// ---------- Travel ----------
export type Place = { name: string; x: number; y: number; lat: number; lng: number };
export const places: Place[] = [
  { name: "Calicut HQ, Palarivattom", x: 52, y: 60, lat: 10.0063, lng: 76.3077 },
  { name: "Kalamassery unit", x: 55, y: 55, lat: 10.0537, lng: 76.3204 },
  { name: "Aluva", x: 58, y: 50, lat: 10.1076, lng: 76.3516 },
  { name: "Angamaly", x: 61, y: 45, lat: 10.1960, lng: 76.3860 },
  { name: "Thrissur Round", x: 55, y: 34, lat: 10.5276, lng: 76.2144 },
  { name: "Guruvayur", x: 49, y: 30, lat: 10.5946, lng: 76.0389 },
  { name: "Palakkad", x: 74, y: 28, lat: 10.7867, lng: 76.6548 },
  { name: "Kottayam", x: 63, y: 74, lat: 9.5916, lng: 76.5222 },
  { name: "Alappuzha", x: 50, y: 78, lat: 9.4981, lng: 76.3388 },
  { name: "Muvattupuzha", x: 68, y: 63, lat: 9.9744, lng: 76.5786 },
  { name: "Perumbavoor", x: 64, y: 54, lat: 10.1118, lng: 76.4746 },
  { name: "Kozhikode depot", x: 36, y: 12, lat: 11.2588, lng: 75.7804 },
  { name: "Malappuram", x: 46, y: 18, lat: 11.0510, lng: 76.0711 },
  { name: "Tripunithura", x: 56, y: 66, lat: 9.9482, lng: 76.3475 },
  { name: "Kakkanad Infopark", x: 58, y: 61, lat: 10.0159, lng: 76.3639 },
  { name: "Chalakudy", x: 58, y: 40, lat: 10.3070, lng: 76.3331 },
];
export const DEFAULT_RATE = { "Two-wheeler": 4.5, Car: 9, None: 0 } as const;
export const getTravelRates = (): { "Two-wheeler": number; Car: number; None: number } => {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("zs_travel_rates");
      if (stored) return JSON.parse(stored);
    } catch {}
  }
  return { ...DEFAULT_RATE };
};
export const RATE = DEFAULT_RATE;
export type Travel = { id: string; emp: string; iso: string; date: string; from: Place; to: Place; via: Place[]; start: string; end: string; km: number; gpsKm: number; rate: number; allowance: number; purpose: string; customer: string; status: "In progress" | "Submitted" | "Approved" | "Rejected" | "Paid"; vehicle: string; routeGeometry?: [number, number][] };
export const travels: Travel[] = [];
export const distanceBetween = (a: Place, b: Place) => Math.round(Math.hypot(a.x - b.x, (a.y - b.y) * 1.35) * 2.1 * 10) / 10;

// ---------- Payroll ----------
export const PT = 208; // Kerala professional tax (monthly equivalent, half-yearly slab ₹1,250)
export type Slip = { id: string; emp: string; month: string; iso: string; days: number; lop: number; basic: number; hra: number; conveyance: number; special: number; overtime: number; ta: number; adjust: number; pf: number; esi: number; pt: number; tds: number; advance: number; gross: number; deductions: number; net: number };
export const months = ["Apr 2026", "May 2026", "Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026"];
export type Run = { id: string; month: string; status: "Draft" | "Review" | "Approved" | "Processed"; employees: number; gross: number; deductions: number; net: number; processed: string; by: string };
export const payrollRuns: Run[] = [];
export const salaryHistory: any[] = [];

export const slipFor = (e: Employee, month: string, _seed = 0): Slip => {
  const basic = e.basic, hra = e.hra, special = e.special, conveyance = e.conveyance;
  const gross = basic + hra + conveyance + special;
  const pf = Math.round(Math.min(basic, 15000) * 0.12), esi = gross <= 21000 ? Math.ceil(gross * 0.0075) : 0, pt = gross > 20000 ? PT : 0;
  const tds = gross > 75000 ? Math.round((gross - 62500) * 0.1) : 0;
  const deductions = pf + esi + pt + tds;
  const monthIdx = months.indexOf(month);
  const iso = monthIdx >= 0 ? `2026-${String(monthIdx + 4).padStart(2, "0")}-01` : "2026-04-01";
  return { id: `PS-${month.replace(" ", "")}-${e.id.slice(4)}`, emp: e.id, month, iso, days: 30, lop: 0, basic, hra, conveyance, special, overtime: 0, ta: 0, adjust: 0, pf, esi, pt, tds, advance: 0, gross, deductions, net: gross - deductions };
};

// ---------- Communication & automation ----------
export type Channel = "Email" | "WhatsApp";
export type MsgStatus = "Scheduled" | "Sent" | "Delivered" | "Failed" | "Cancelled";
export const placeholders = ["{{customer_name}}", "{{invoice_number}}", "{{amount}}", "{{due_date}}", "{{company_name}}", "{{quotation_number}}", "{{employee_name}}", "{{order_status}}", "{{payment_link}}"];
export type Template = { id: string; name: string; category: string; channel: Channel | "Both"; subject: string; body: string; updated: string; uses: number; active: boolean };
export const templates: Template[] = [
  { id: "TPL-01", name: "Invoice delivery", category: "Invoicing", channel: "Both", subject: "Invoice {{invoice_number}} from {{company_name}}", body: "Dear {{customer_name}},\n\nPlease find attached invoice {{invoice_number}} for {{amount}} due on {{due_date}}.\n\nThank you for your business!", updated: "14 Aug 2026", uses: 412, active: true },
  { id: "TPL-02", name: "Payment reminder (friendly)", category: "Payment reminders", channel: "Both", subject: "Upcoming invoice payment reminder — {{invoice_number}}", body: "Dear {{customer_name}},\n\nFriendly reminder that invoice {{invoice_number}} of {{amount}} is due on {{due_date}}.\n\nPayment link: {{payment_link}}", updated: "01 Sep 2026", uses: 285, active: true },
  { id: "TPL-03", name: "Payment due today", category: "Payment reminders", channel: "Both", subject: "Payment due today — invoice {{invoice_number}}", body: "Dear {{customer_name}},\n\nInvoice {{invoice_number}} for {{amount}} is due today.\n\nPayment link: {{payment_link}}", updated: "01 Sep 2026", uses: 120, active: true },
  { id: "TPL-04", name: "Overdue payment notice", category: "Payment reminders", channel: "Both", subject: "Overdue notice — invoice {{invoice_number}}", body: "Dear {{customer_name}},\n\nInvoice {{invoice_number}} for {{amount}} is overdue. Please settle at the earliest.\n\nPayment link: {{payment_link}}", updated: "28 Aug 2026", uses: 68, active: true },
  { id: "TPL-05", name: "Quotation follow-up", category: "Sales", channel: "Email", subject: "Regarding quotation {{quotation_number}}", body: "Dear {{customer_name}},\n\nFollowing up on our quotation {{quotation_number}}. Let us know if you need any clarification.\n\nRegards,\n{{company_name}}", updated: "12 Aug 2026", uses: 36, active: true },
  { id: "TPL-06", name: "Payment received", category: "Invoicing", channel: "WhatsApp", subject: "Payment received", body: "Dear {{customer_name}},\n\nWe have received your payment of {{amount}} against {{invoice_number}}. Thank you!\n\n{{company_name}}", updated: "20 Sep 2026", uses: 355, active: true },
  { id: "TPL-07", name: "Order in production", category: "Orders", channel: "WhatsApp", subject: "Order update", body: "Dear {{customer_name}},\n\nYour order has entered production. We will notify you once dispatched.\n\n{{company_name}}", updated: "05 Sep 2026", uses: 88, active: true },
  { id: "TPL-08", name: "Dispatch notification", category: "Orders", channel: "WhatsApp", subject: "Order dispatched", body: "Dear {{customer_name}},\n\nYour order has been dispatched. Track details with our delivery executive.\n\n{{company_name}}", updated: "18 Sep 2026", uses: 97, active: true },
  { id: "TPL-09", name: "Festival greetings", category: "Greeting", channel: "Both", subject: "Warm festival wishes from {{company_name}}", body: "Dear {{customer_name}},\n\nWishing you and your family a joyful festival season filled with prosperity!\n\nWarm regards,\n{{company_name}}", updated: "25 Sep 2026", uses: 0, active: true },
  { id: "TPL-10", name: "Birthday greetings", category: "Greeting", channel: "Both", subject: "Happy birthday from {{company_name}}", body: "Dear {{customer_name}},\n\nWishing you a very happy birthday and a wonderful year ahead!\n\nWarm regards,\n{{company_name}}", updated: "15 Jul 2026", uses: 99, active: true },
  { id: "TPL-11", name: "Employee birthday", category: "Greeting", channel: "Both", subject: "Happy birthday {{employee_name}}!", body: "Dear {{employee_name}},\n\nHappy birthday from everyone at {{company_name}}! Wishing you joy, health, and success.", updated: "15 Jul 2026", uses: 24, active: true },
  { id: "TPL-12", name: "Work anniversary", category: "Greeting", channel: "Email", subject: "Happy work anniversary", body: "Dear {{employee_name}},\n\nCongratulations on another year with {{company_name}}. Thank you for your dedication!", updated: "10 Jul 2026", uses: 19, active: true },
];

export const reminderCustomers: [string, string][] = [];
export type Reminder = { id: string; customer: string; contact: string; invoice: string; amount: number; dueIso: string; due: string; next: string; stage: string; channel: Channel | "Both"; status: "Scheduled" | "Paused" | "Sent" | "Failed" | "Paid"; schedule: "Default" | "Custom"; sent: number };
export const reminders: Reminder[] = [];
export const defaultSchedule = [
  { when: "before", days: 7, channel: "Email", template: "TPL-02" }, { when: "before", days: 2, channel: "WhatsApp", template: "TPL-02" },
  { when: "on", days: 0, channel: "Both", template: "TPL-03" }, { when: "after", days: 3, channel: "WhatsApp", template: "TPL-04" },
  { when: "after", days: 7, channel: "Email", template: "TPL-04" }, { when: "after", days: 15, channel: "Both", template: "TPL-04" },
];

export type Msg = { id: string; at: string; iso: string; recipient: string; to: string; type: string; channel: Channel; trigger: string; status: MsgStatus; doc: string; error?: string };
export const messages: Msg[] = [];

export type Automation = { id: string; name: string; trigger: string; channel: Channel | "Both"; template: string; active: boolean; runs: number; last: string };
export const automations: Automation[] = [];

export type Greeting = { id: string; name: string; kind: "Customer" | "Employee"; type: "Birthday" | "Work anniversary" | "Wedding anniversary" | "Festival" | "Business anniversary"; iso: string; date: string; channel: Channel | "Both"; template: string; time: string; status: "Scheduled" | "Sent" | "Draft" };
export const greetings: Greeting[] = [];
export const importantDates: { iso: string; label: string }[] = [
  { iso: "2026-10-02", label: "Gandhi Jayanti — office closed" },
  { iso: "2026-10-20", label: "Deepavali greetings" },
  { iso: "2026-11-01", label: "Kerala Piravi" },
  { iso: "2026-10-15", label: "Q2 GSTR-1 due (quarterly filers)" },
  { iso: "2026-12-25", label: "Christmas" },
];
