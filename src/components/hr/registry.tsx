import type { ComponentType } from "react";
import type { Section } from "@/components/erp/ModuleLayout";
import * as E from "./employee-sections";
import * as P from "./payroll-sections";
import * as A from "./attendance-sections";
import * as SA from "./self-attendance";
import * as T from "./travel-sections";
import * as C from "./automation-sections";

type Sec = Section & { component: ComponentType; description: string };

export const employeeSections: Sec[] = [
  { slug: "", label: "Dashboard", group: "Overview", component: E.EmployeeDashboard, description: "Headcount, attendance, birthdays and anniversaries." },
  { slug: "list", label: "Employees", group: "People", component: E.Employees, description: "All employees with department, designation and status.", aliases: ["view"] },
  { slug: "departments", label: "Departments", group: "Setup", component: E.Departments, description: "Departments, heads and salary cost." },
  { slug: "designations", label: "Designations", group: "Setup", component: E.Designations, description: "Job titles, grades and salary bands." },
  { slug: "documents", label: "Documents", group: "Files", component: E.EmployeeDocuments, description: "Employee ID proofs, certificates and letters." },
];
export const payrollSections: Sec[] = [
  { slug: "", label: "Dashboard", group: "Overview", component: P.PayrollDashboard, description: "Gross, deductions, net pay and payroll status." },
  { slug: "structure", label: "Salary Structure", group: "Setup", component: P.SalaryStructure, description: "Earnings components per employee." },
  { slug: "monthly", label: "Monthly Payroll", group: "Run", component: P.MonthlyPayroll, description: "Monthly payroll workflow from draft to processed." },
  { slug: "payslips", label: "Payslips", group: "Run", component: P.Payslips, description: "Employee payslips with preview." },
  { slug: "history", label: "Salary History", group: "Reports", component: P.SalaryHistory, description: "Salary revisions and increments." },
  { slug: "reports", label: "Reports", group: "Reports", component: P.PayrollReports, description: "PF, ESI, PT, TDS and bank statements." },
];
export const attendanceSections: Sec[] = [
  { slug: "", label: "Dashboard", group: "Overview", component: A.AttendanceDashboard, description: "Attendance summary, charts and monthly totals." },
  { slug: "mark", label: "Mark Attendance", group: "My attendance", component: SA.MarkAttendance, description: "Check in and check out from your phone with office location verification." },
  { slug: "my", label: "My History", group: "My attendance", component: SA.MyAttendance, description: "Your attendance history and monthly summary." },
  { slug: "appeals", label: "Appeals", group: "Review", requires: "Approve", component: SA.AttendanceAppeals, description: "Review attendance appeals submitted outside permitted office areas." },
  { slug: "locations", label: "Office Locations", group: "Review", requires: "Edit", component: SA.OfficeLocations, description: "Permitted office areas (geofences) for location-based attendance." },
  { slug: "daily", label: "Daily Attendance", group: "Attendance", requires: "Edit", component: A.DailyAttendance, description: "Check-ins and check-outs for a day." },
  { slug: "employee", label: "Employee Attendance", group: "Attendance", component: A.EmployeeAttendance, description: "Monthly attendance calendar per employee." },
  { slug: "leave", label: "Leave Requests", group: "Leave", component: A.LeaveRequests, description: "Leave applications and approvals." },
  { slug: "calendar", label: "Leave Calendar", group: "Leave", component: A.LeaveCalendar, description: "Who is on leave, by day." },
  { slug: "types", label: "Leave Types", group: "Leave", requires: "Edit", component: A.LeaveTypes, description: "Leave entitlements and rules." },
];
export const travelSections: Sec[] = [
  { slug: "", label: "Dashboard", group: "Overview", component: T.TravelDashboard, description: "Trips, distance and travel allowance." },
  { slug: "records", label: "Travel Records", group: "Travel", component: T.TravelRecords, description: "All trips with distance and allowance.", aliases: ["view"] },
  { slug: "start", label: "Start Travel", group: "Travel", component: T.StartTravel, description: "Simulated trip capture and allowance claim." },
  { slug: "allowance", label: "Travel Allowance", group: "Allowance", component: T.TravelAllowance, description: "Allowance claimed, approved and paid per employee." },
  { slug: "reports", label: "Reports", group: "Allowance", component: T.TravelReports, description: "Travel by purpose and destination." },
];
export const automationSections: Sec[] = [
  { slug: "", label: "Dashboard", group: "Overview", component: C.AutomationDashboard, description: "Scheduled, sent and failed messages and active automations." },
  { slug: "email", label: "Email", group: "Channels", component: C.EmailPage, description: "Outgoing email log and composer." },
  { slug: "whatsapp", label: "WhatsApp", group: "Channels", component: C.WhatsAppPage, description: "WhatsApp message log and composer." },
  { slug: "reminders", label: "Payment Reminders", group: "Automations", component: C.PaymentReminders, description: "Reminder schedules for unpaid invoices." },
  { slug: "greetings", label: "Greetings", group: "Automations", component: C.Greetings, description: "Birthday, anniversary and festival greetings." },
  { slug: "templates", label: "Message Templates", group: "Setup", component: C.MessageTemplates, description: "Reusable templates with placeholders." },
  { slug: "history", label: "History", group: "Setup", component: C.AutomationHistory, description: "Unified message history." },
];
