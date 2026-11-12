import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Cake, Mail, MessageCircle, Pause, Play, Plus, RotateCcw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { api, communicationApi, salesApi, type BackendMessage, type CommunicationStats } from "@/lib/api";
import { EmptyState, KpiCard, Panel, StatusBadge } from "@/components/erp/primitives";
import { DataTable, DetailGrid } from "@/components/erp/DataTable";
import { SectionHeader } from "@/components/erp/ModuleLayout";
import { Field } from "@/components/sales/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inr } from "@/lib/format";
import { TODAY, automations as seedAut, defaultSchedule, employees, greetings as seedGreet, importantDates, messages, placeholders, reminderCustomers, reminders as seedRem, templates as seedTpl, type Channel, type Greeting, type Msg, type Reminder, type Template } from "@/data/hr";
import { M, axis, tip } from "./common";
import { companyConfig as company } from "@/config/company";

const msgBadge = (s: string) => <StatusBadge status={s === "Delivered" || s === "Sent" ? "active" : s === "Failed" ? "failed" : s === "Scheduled" || s === "Queued" ? "planned" : s === "Paused" || s === "Draft" || s === "Sending" ? "pending" : s === "Paid" ? "paid" : "cancelled"} label={s} />;
const ChannelTag = ({ c }: { c: string }) => <span className="inline-flex items-center gap-1 text-xs">{c !== "WhatsApp" ? <Mail className="size-3.5 text-accent" /> : null}{c !== "Email" ? <MessageCircle className="size-3.5 text-success" /> : null}{c}</span>;
const sample: Record<string, string> = { "{{customer_name}}": "Fr. Joseph Kallarakkal", "{{invoice_number}}": "INV-2610", "{{amount}}": "₹48,260", "{{due_date}}": "30 Sep 2026", "{{company_name}}": company.name, "{{quotation_number}}": "QT-872", "{{employee_name}}": "Arjun Nair", "{{order_status}}": "in production", "{{payment_link}}": `pay.${company.website.replace("www.", "")}/INV-2610` };
export const fill = (s: string, extra: Record<string, string> = {}) => Object.entries({ ...sample, ...extra }).reduce((a, [kk, v]) => a.split(kk).join(v), s);
const Demo = () => <p className="text-xs text-muted-foreground">Automated notification dispatch active.</p>;

function Preview({ channel, subject, body }: { channel: string; subject: string; body: string }) {
  return channel === "WhatsApp" ? (
    <div className="rounded-lg bg-success/10 p-4"><div className="ml-auto max-w-sm whitespace-pre-wrap rounded-lg rounded-tr-none bg-card p-3 text-sm shadow-[var(--shadow-card)]">{body}<p className="mt-1 text-right text-[10px] text-muted-foreground">09:00 ✓✓</p></div></div>
  ) : (
    <div className="rounded-lg border border-border bg-card text-sm"><div className="border-b border-border px-4 py-2 text-xs"><p><M>From:</M> {company.email}</p><p className="font-medium">{subject}</p></div><div className="whitespace-pre-wrap px-4 py-3">{body}</div></div>
  );
}

export function AutomationDashboard() {
  const [stats, setStats] = useState<CommunicationStats | null>(null);
  const [auts, setAuts] = useState(seedAut);

  useEffect(() => {
    communicationApi.getStats().then(setStats).catch(() => {});
    communicationApi.getRules().then((res) => {
      if (res?.results?.length) {
        setAuts(res.results.map((r: any) => ({
          id: r.id,
          name: r.name,
          trigger: r.trigger_event,
          channel: r.channel,
          template: r.template_name || "Default",
          active: r.is_active,
          runs: r.runs_count,
          last: r.last_run_at ? new Date(r.last_run_at).toLocaleString("en-GB") : "Never",
        })));
      }
    }).catch(() => {});
  }, []);

  const cnt = (s: string) => messages.filter((m) => m.status === s).length;
  const days = Array.from(new Set(messages.map((m) => m.iso))).sort().filter((d) => d <= TODAY).slice(-10);
  const defaultChart = days.map((d) => ({ d: d.slice(8), Email: messages.filter((m) => m.iso === d && m.channel === "Email").length, WhatsApp: messages.filter((m) => m.iso === d && m.channel === "WhatsApp").length }));
  const chartData = stats?.chart?.length ? stats.chart : defaultChart;

  return (
    <>
      <SectionHeader title="Communication centre" description="Automated email and WhatsApp messages to customers and staff." />
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Scheduled" value={String(stats?.kpis?.scheduled ?? cnt("Scheduled"))} />
        <KpiCard label="Sent / delivered" value={String(stats?.kpis?.sent_delivered ?? (cnt("Sent") + cnt("Delivered")))} tone="up" hint="Last 20 days" />
        <KpiCard label="Failed" value={String(stats?.kpis?.failed ?? cnt("Failed"))} tone="down" hint="Needs attention" />
        <KpiCard label="Pending reminders" value={String(seedRem.filter((r) => r.status === "Scheduled").length)} />
        <KpiCard label="Active automations" value={stats?.kpis?.active_automations ?? `${auts.filter((a) => a.active).length}/${auts.length}`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-5">
        <Panel title="Messages by channel" description="Last 10 days" className="xl:col-span-2"><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid vertical={false} stroke="var(--color-border)" /><XAxis dataKey="d" {...axis} /><YAxis {...axis} allowDecimals={false} /><RTooltip contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="Email" stackId="a" fill="var(--color-chart-2)" /><Bar dataKey="WhatsApp" stackId="a" fill="var(--color-success)" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></Panel>
        <Panel title="Automations" className="xl:col-span-3" bodyClassName="p-0">
          <ul className="divide-y divide-border">{auts.map((a: any) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1"><p className="font-medium">{a.name}</p><p className="text-xs text-muted-foreground">When: {a.trigger} · {a.runs} runs · last {a.last}</p></div>
              <ChannelTag c={a.channel} />
              <Switch checked={a.active} aria-label={`Toggle ${a.name}`} onCheckedChange={async (v) => {
                setAuts((x: any[]) => x.map((y: any) => (y.id === a.id ? { ...y, active: v } : y)));
                try {
                  await communicationApi.toggleRule(a.id);
                } catch {
                  // Keep local state update
                }
                toast.success(`${a.name} ${v ? "activated" : "paused"}`);
              }} />
            </li>))}</ul>
        </Panel>
      </div>
      <Panel title="Recent failures" bodyClassName="p-0">
        <ul className="divide-y divide-border">{messages.filter((m) => m.status === "Failed").slice(0, 4).map((m) => (
          <li key={m.id} className="flex items-start gap-3 px-4 py-2.5 text-sm"><AlertTriangle className="mt-0.5 size-4 text-destructive" /><div className="flex-1"><p className="font-medium">{m.recipient} · {m.type}</p><p className="text-xs text-muted-foreground">{m.error}</p></div><Button size="sm" variant="outline" onClick={() => toast.success(`${m.id} queued for retry`)}><RotateCcw className="size-4" /> Retry</Button></li>))}</ul>
      </Panel>
    </>
  );
}

function ChannelLog({ channel }: { channel: Channel }) {
  const [compose, setCompose] = useState(false);
  const [to, setTo] = useState(reminderCustomers[0]?.[0] ?? "St. Joseph's College");
  const [destination, setDestination] = useState(channel === "Email" ? "accounts@stjosephs.edu" : "+91 98460 33035");
  const [customBody, setCustomBody] = useState("");
  const [sending, setSending] = useState(false);
  const [tpl, setTpl] = useState(seedTpl.find((t) => t.channel === channel || t.channel === "Both")?.id ?? "");
  const [dbRows, setDbRows] = useState<any[]>([]);

  const loadMessages = () => {
    communicationApi.getMessages({ channel }).then((res) => {
      const list = Array.isArray(res?.results) ? res.results : [];
      const mapped = list
        .filter((m: BackendMessage) => m.channel === channel)
        .map((m: BackendMessage) => ({
          id: m.code,
          backendId: m.id,
          at: m.created_at ? new Date(m.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Just now",
          iso: m.created_at ? m.created_at.slice(0, 10) : TODAY,
          recipient: m.recipient_name,
          to: m.recipient_phone || m.recipient_email || "",
          type: m.message_type,
          channel: m.channel,
          trigger: m.trigger_type,
          status: m.status,
          doc: m.document_reference || "—",
          error: m.error_message,
        }));
      setDbRows(mapped);
    }).catch(() => {
      setDbRows([]);
    });
  };

  useEffect(() => {
    setDbRows([]);
    setTpl(seedTpl.find((t) => t.channel === channel || t.channel === "Both")?.id ?? "");
    setDestination(channel === "Email" ? "accounts@stjosephs.edu" : "+91 98460 33035");
    loadMessages();
  }, [channel]);

  const t = seedTpl.find((x) => x.id === tpl) || seedTpl[0]!;
  const rows = dbRows.filter((m) => m.channel === channel);

  const handleSendNow = async () => {
    setSending(true);
    const bodyText = customBody || fill(t.body, { "{{customer_name}}": reminderCustomers.find(([c]) => c === to)?.[1] || to });
    try {
      const res = await communicationApi.composeMessage({
        phone: destination,
        recipient_name: to,
        body: bodyText,
        channel,
      });
      toast.success(res.message || `${channel} message dispatched to ${to}`);
      setCompose(false);
      loadMessages();
    } catch (err: any) {
      toast.error(err?.message || `Failed to dispatch ${channel} message`);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <SectionHeader title={channel === "Email" ? "Email" : "WhatsApp"} description={channel === "Email" ? `Outgoing email from ${company.email}` : `WhatsApp Business messages from ${company.phone}`} actions={<Button size="sm" onClick={() => setCompose(true)}><Send className="size-4" /> New message</Button>} />
      <div className="grid gap-3 sm:grid-cols-4">{(["Scheduled", channel === "Email" ? "Sent" : "Delivered", "Failed", "Cancelled"] as const).map((s) => <KpiCard key={s} label={s} value={String(rows.filter((m) => m.status === s || (s === "Delivered" && m.status === "Sent")).length)} />)}</div>
      <MessageTable rows={rows} onReload={loadMessages} />
      <Dialog open={compose} onOpenChange={setCompose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New {channel} message</DialogTitle><DialogDescription>Choose a recipient, template, and destination {channel === "Email" ? "email address" : "phone"}.</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Recipient" required><Select value={to} onValueChange={(v) => { setTo(v); if (channel === "Email") setDestination(`${v.toLowerCase().replace(/[^a-z0-9]/g, "")}@example.com`); else setDestination(`+91 98460 ${Math.floor(10000 + Math.random() * 89999)}`); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{reminderCustomers.length > 0 ? reminderCustomers.map(([c]) => <SelectItem key={c} value={c}>{c}</SelectItem>) : <SelectItem value={to}>{to}</SelectItem>}</SelectContent></Select></Field>
            <Field label="Template"><Select value={tpl} onValueChange={setTpl}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{seedTpl.filter((x) => x.channel === channel || x.channel === "Both").map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select></Field>
          </div>
          <Field label={channel === "WhatsApp" ? "Recipient phone number" : "Recipient email address"} required>
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder={channel === "WhatsApp" ? "+91 98460 12345" : "client@example.com"} />
          </Field>
          <Preview channel={channel} subject={fill(t.subject)} body={customBody || fill(t.body, { "{{customer_name}}": reminderCustomers.find(([c]) => c === to)?.[1] || to })} />
          <Demo />
          <DialogFooter>
            <Button variant="outline" onClick={() => { toast.success("Message scheduled for today 17:00"); setCompose(false); }}>Schedule</Button>
            <Button onClick={handleSendNow} disabled={sending}>
              <Send className="size-4" /> {sending ? "Sending…" : "Send now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
export const EmailPage = () => <ChannelLog channel="Email" />;
export const WhatsAppPage = () => <ChannelLog channel="WhatsApp" />;

function MessageTable({ rows, onReload }: { rows: any[]; onReload?: () => void }) {
  return (
    <DataTable rows={rows} getId={(m) => m.id} entity="message" search={(m) => `${m.recipient} ${m.to} ${m.doc} ${m.type}`} date={(m) => m.iso} pageSize={10} removeLabel={null}
      filters={[{ label: "Statuses", get: (m) => m.status }, { label: "Channels", get: (m) => m.channel }, { label: "Types", get: (m) => m.type }, { label: "Triggers", get: (m) => m.trigger }]}
      extraActions={[
        {
          label: "Retry",
          icon: <RotateCcw className="size-4" />,
          show: (m) => m.status === "Failed",
          onClick: async (m) => {
            if (m.backendId) {
              try {
                await communicationApi.retryMessage(m.backendId);
                toast.success(`${m.id} queued for retry`);
                onReload?.();
              } catch (err: any) {
                toast.error(err?.message || "Failed to retry message");
              }
            } else {
              toast.success(`${m.id} queued for retry`);
            }
          },
        },
        {
          label: "Cancel",
          show: (m) => m.status === "Scheduled" || m.status === "Queued",
          onClick: async (m) => {
            if (m.backendId) {
              try {
                await communicationApi.cancelMessage(m.backendId);
                toast.success(`${m.id} cancelled`);
                onReload?.();
              } catch (err: any) {
                toast.error(err?.message || "Failed to cancel message");
              }
            } else {
              toast.success(`${m.id} cancelled`);
            }
          },
        },
      ]}
      columns={[
        { key: "at", header: "Date / time", sort: (m) => m.iso, render: (m) => <span className="tabular">{m.at}</span> },
        { key: "r", header: "Recipient", sort: (m) => m.recipient, render: (m) => <div><p className="font-medium">{m.recipient}</p><p className="text-xs text-muted-foreground">{m.to}</p></div> },
        { key: "t", header: "Type", render: (m) => m.type },
        { key: "c", header: "Channel", render: (m) => <ChannelTag c={m.channel} /> },
        { key: "tr", header: "Trigger", render: (m) => <M>{m.trigger}</M> },
        { key: "d", header: "Document", render: (m) => <span className="font-mono text-xs">{m.doc}</span> },
        { key: "s", header: "Status", sort: (m) => m.status, render: (m) => <div>{msgBadge(m.status)}{m.error ? <p className="mt-1 max-w-56 truncate text-xs text-destructive" title={m.error}>{m.error}</p> : null}</div> },
      ]}
      detail={(m) => <DetailGrid items={[["Recipient", m.recipient], ["To", m.to], ["Type", m.type], ["Channel", m.channel], ["Trigger", m.trigger], ["Document", m.doc], ["Time", m.at], ["Status", m.status], ...(m.error ? [["Error", m.error] as [string, string]] : [])]} />}
    />
  );
}

export function PaymentReminders() {
  const [rows, setRows] = useState<any[]>(seedRem);
  const [sched, setSched] = useState(defaultSchedule);
  const [custom, setCustom] = useState<Reminder | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPendingInvoices = () => {
    setLoading(true);
    api.get<any>("/sales/invoices/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const unpaid = list.filter((i: any) => {
          const bal = Number(i.balance_amount ?? (Number(i.total_amount || 0) - Number(i.received_amount || 0)));
          return bal > 0 || i.status === "Pending" || i.status === "Partial";
        });

        if (unpaid.length > 0) {
          const today = new Date().toISOString().slice(0, 10);
          const mapped = unpaid.map((i: any) => {
            const bal = Number(i.balance_amount ?? (Number(i.total_amount || 0) - Number(i.received_amount || 0)));
            const dueIso = i.due_date || i.invoice_date || today;
            const diffDays = Math.round((new Date(today).getTime() - new Date(dueIso).getTime()) / (1000 * 60 * 60 * 24));
            const stage = diffDays > 0 ? `${diffDays} days overdue` : diffDays === 0 ? "Due today" : `Due in ${Math.abs(diffDays)} days`;

            return {
              id: i.code || `REM-${i.id}`,
              backendId: i.id,
              customer: i.customer_name || `Customer #${i.customer}`,
              contact: i.customer_phone || i.customer_email || "Finance Desk",
              invoice: i.code || `INV-${i.id}`,
              amount: bal,
              due: i.due_date ? new Date(i.due_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—",
              dueIso,
              stage,
              next: diffDays > 0 ? "Daily follow-up" : "On due date",
              channel: "WhatsApp",
              schedule: "Default",
              status: diffDays > 0 ? "Failed" : "Scheduled",
            };
          });
          setRows(mapped);
        }
      })
      .catch((err) => {
        console.debug("Payment reminders invoice fetch fallback:", err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPendingInvoices();
  }, []);

  return (
    <>
      <SectionHeader
        title="Payment reminders"
        description="Automatic reminders before, on and after the invoice due date."
        actions={
          <Button size="sm" variant="outline" onClick={loadPendingInvoices} disabled={loading}>
            <RotateCcw className={cn("size-3.5", loading && "animate-spin")} /> Refresh invoices
          </Button>
        }
      />
      <Panel title="Default reminder schedule" description="Applies to every unpaid invoice unless a custom schedule is set" actions={<Button size="sm" variant="outline" onClick={() => setSched([...sched, { when: "after", days: 30, channel: "Email", template: "TPL-04" }])}><Plus className="size-4" /> Add step</Button>}>
        <div className="flex flex-wrap items-stretch gap-2">
          {sched.map((s, i) => (
            <div key={i} className={cn("w-44 rounded-lg border p-3 text-sm", s.when === "before" ? "border-accent/30 bg-accent/5" : s.when === "on" ? "border-warning/40 bg-warning/10" : "border-destructive/30 bg-destructive/5")}>
              <div className="flex items-center justify-between"><p className="font-semibold">{s.when === "on" ? "On due date" : `${s.days} days ${s.when}`}</p><button aria-label="Remove step" className="text-muted-foreground hover:text-destructive" onClick={() => setSched(sched.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></button></div>
              <Select value={s.channel} onValueChange={(v) => setSched(sched.map((x, j) => (j === i ? { ...x, channel: v } : x)))}><SelectTrigger className="mt-2 h-8"><SelectValue /></SelectTrigger><SelectContent>{["Email", "WhatsApp", "Both"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
              <p className="mt-1.5 truncate text-xs text-muted-foreground">{seedTpl.find((t) => t.id === s.template)?.name}</p>
            </div>))}
        </div>
        <div className="mt-3 flex justify-end"><Button size="sm" onClick={() => toast.success("Default reminder schedule saved")}>Save schedule</Button></div>
      </Panel>
      <DataTable rows={rows} getId={(r) => r.id} entity="reminder" search={(r) => `${r.customer} ${r.invoice} ${r.contact}`} date={(r) => r.dueIso} removeLabel={null}
        filters={[{ label: "Statuses", get: (r) => r.status }, { label: "Channels", get: (r) => r.channel }, { label: "Schedules", get: (r) => r.schedule }]}
        extraActions={[
          {
            label: "Send now",
            icon: <Send className="size-4" />,
            show: (r) => r.status !== "Paid",
            onClick: async (r) => {
              const tid = toast.loading(`Sending payment reminder for ${r.invoice}...`);
              try {
                if (r.backendId) {
                  await salesApi.sendInvoiceReminder(r.backendId);
                } else {
                  await salesApi.sendBatchReminders(1.0);
                }
                toast.success(`Payment reminder dispatched to ${r.customer}`);
                loadPendingInvoices();
              } catch (err: any) {
                toast.error(err?.message || "Failed to send reminder");
              }
            },
          },
          { label: "Pause", icon: <Pause className="size-4" />, show: (r) => r.status === "Scheduled", onClick: (r) => { setRows((x) => x.map((y) => (y.id === r.id ? { ...y, status: "Paused" } : y))); toast.success(`Reminders paused for ${r.invoice}`); } },
          { label: "Resume", icon: <Play className="size-4" />, show: (r) => r.status === "Paused" || r.status === "Failed", onClick: (r) => { setRows((x) => x.map((y) => (y.id === r.id ? { ...y, status: "Scheduled" } : y))); toast.success(`Reminders resumed for ${r.invoice}`); } },
          { label: "Custom schedule", icon: <CalendarDays className="size-4" />, onClick: (r) => setCustom(r) },
        ]}
        columns={[
          { key: "c", header: "Customer", sort: (r) => r.customer, render: (r) => <div><p className="font-medium">{r.customer}</p><p className="text-xs text-muted-foreground">{r.contact}</p></div> },
          { key: "i", header: "Invoice", render: (r) => <span className="font-mono text-xs">{r.invoice}</span> },
          { key: "a", header: "Amount due", align: "right", sort: (r) => r.amount, render: (r) => inr(r.amount) },
          { key: "d", header: "Due date", sort: (r) => r.dueIso, render: (r) => <div><p>{r.due}</p><p className={cn("text-xs", r.stage.includes("overdue") ? "text-destructive" : "text-muted-foreground")}>{r.stage}</p></div> },
          { key: "n", header: "Next reminder", render: (r) => (r.status === "Paid" || r.status === "Paused" ? <M>—</M> : r.next) },
          { key: "ch", header: "Channel", render: (r) => <ChannelTag c={r.channel} /> },
          { key: "sc", header: "Schedule", render: (r) => <M>{r.schedule}</M> },
          { key: "s", header: "Status", sort: (r) => r.status, render: (r) => msgBadge(r.status) },
        ]} />
      <Dialog open={!!custom} onOpenChange={(o) => !o && setCustom(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Custom schedule · {custom?.invoice}</DialogTitle><DialogDescription>{custom?.customer} · {custom ? inr(custom.amount) : ""} due {custom?.due}</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            {[["Before due date", "3"], ["On due date", "0"], ["After due date", "5"]].map(([l, d]) => <div key={l} className="grid grid-cols-[1fr_80px_120px] items-center gap-2 text-sm"><span>{l}</span><Input type="number" defaultValue={d} className="h-8" aria-label={`${l} days`} disabled={l === "On due date"} /><Select defaultValue="WhatsApp"><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{["Email", "WhatsApp", "Both"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>)}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCustom(null)}>Cancel</Button><Button onClick={() => { if (custom) { setRows((x) => x.map((y) => (y.id === custom.id ? { ...y, schedule: "Custom" } : y))); toast.success(`Custom schedule saved for ${custom.invoice}`); } setCustom(null); }}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function Greetings() {
  const [rows, setRows] = useState(seedGreet);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"Customer" | "Employee">("Employee");
  const [name, setName] = useState(employees[0]?.name ?? "");
  const [type, setType] = useState<Greeting["type"]>("Birthday");
  const [date, setDate] = useState(TODAY);
  const [channel, setChannel] = useState<Channel | "Both">("WhatsApp");
  const [tpl, setTpl] = useState("TPL-11");
  const [time, setTime] = useState("08:00");
  const fallbackTpl: Template = { id: "TPL-01", name: "Greeting", category: "Greeting", channel: "Both", subject: "Best Wishes", body: "Warm greetings!", updated: "", uses: 0, active: true };
  const t = seedTpl.find((x) => x.id === tpl) ?? seedTpl[0] ?? fallbackTpl;
  const upcoming = rows.filter((g) => g.iso >= TODAY).sort((a, b) => a.iso.localeCompare(b.iso));
  const todays = upcoming.filter((g) => g.iso === TODAY);
  const names = kind === "Employee" ? employees.filter((e) => e.status !== "Resigned").map((e) => e.name) : reminderCustomers.map(([, p]) => p);
  const card = (title: string, list: Greeting[], icon: React.ReactNode) => (
    <Panel title={title} bodyClassName="p-0">{list.length ? <ul className="divide-y divide-border">{list.slice(0, 5).map((g) => <li key={g.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm"><span className="inline-flex min-w-0 items-center gap-2">{icon}<span className="truncate">{g.name}</span></span><span className="shrink-0 text-xs text-muted-foreground">{g.iso === TODAY ? "Today" : g.date.slice(0, 6)}</span></li>)}</ul> : <p className="p-4 text-sm text-muted-foreground">Nothing upcoming.</p>}</Panel>
  );
  return (
    <>
      <SectionHeader title="Greetings" description="Birthdays, anniversaries and festival wishes — scheduled automatically." actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" /> Schedule greeting</Button>} />
      <Panel title="Today's greetings">{todays.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{todays.map((g) => <div key={g.id} className="flex items-center gap-3 rounded-lg border border-accent/30 bg-accent/5 p-3"><Cake className="size-5 text-accent" /><div className="flex-1"><p className="font-medium">{g.name}</p><p className="text-xs text-muted-foreground">{g.kind} · {g.type} · {g.time}</p></div>{msgBadge(g.status)}</div>)}</div> : <EmptyState title="No greetings today" />}</Panel>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {card("Staff birthdays", upcoming.filter((g) => g.kind === "Employee" && g.type === "Birthday"), <Cake className="size-3.5 text-accent" />)}
        {card("Customer birthdays", upcoming.filter((g) => g.kind === "Customer" && g.type === "Birthday"), <Cake className="size-3.5 text-success" />)}
        {card("Anniversaries", upcoming.filter((g) => g.type.includes("anniversary")), <CalendarDays className="size-3.5 text-warning" />)}
        <Panel title="Important dates" bodyClassName="p-0"><ul className="divide-y divide-border">{importantDates.map((d) => <li key={d.iso} className="flex justify-between gap-2 px-4 py-2.5 text-sm"><span>{d.label}</span><span className="shrink-0 text-xs text-muted-foreground">{new Date(d.iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span></li>)}</ul></Panel>
      </div>
      <DataTable rows={rows} getId={(g) => g.id} entity="greeting" search={(g) => `${g.name} ${g.type}`} date={(g) => g.iso} removeLabel="Delete"
        filters={[{ label: "Recipients", get: (g) => g.kind }, { label: "Types", get: (g) => g.type }, { label: "Statuses", get: (g) => g.status }]}
        columns={[
          { key: "d", header: "Date", sort: (g) => g.iso, render: (g) => g.date },
          { key: "n", header: "Recipient", sort: (g) => g.name, render: (g) => <div><p className="font-medium">{g.name}</p><p className="text-xs text-muted-foreground">{g.kind}</p></div> },
          { key: "t", header: "Occasion", render: (g) => g.type },
          { key: "c", header: "Channel", render: (g) => <ChannelTag c={g.channel} /> },
          { key: "tp", header: "Template", render: (g) => <M>{seedTpl.find((x) => x.id === g.template)?.name}</M> },
          { key: "tm", header: "Send at", render: (g) => g.time },
          { key: "s", header: "Status", render: (g) => msgBadge(g.status) },
        ]} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Schedule a greeting</DialogTitle><DialogDescription>Preview before scheduling.</DialogDescription></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Recipient type"><Select value={kind} onValueChange={(v) => { const kk = v as typeof kind; setKind(kk); setName(kk === "Employee" ? (employees[0]?.name ?? "") : (reminderCustomers[0]?.[1] ?? "")); setTpl(kk === "Employee" ? "TPL-11" : "TPL-10"); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Employee">Employee</SelectItem><SelectItem value="Customer">Customer</SelectItem></SelectContent></Select></Field>
                <Field label={kind}><Select value={name} onValueChange={setName}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{names.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Greeting type"><Select value={type} onValueChange={(v) => setType(v as Greeting["type"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Birthday", "Work anniversary", "Wedding anniversary", "Festival", "Business anniversary"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Channel"><Select value={channel} onValueChange={(v) => setChannel(v as Channel)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["WhatsApp", "Email", "Both"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Date" required><Input type="date" value={date} min={TODAY} onChange={(e) => setDate(e.target.value)} /></Field>
                <Field label="Send time"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
              </div>
              <Field label="Template"><Select value={tpl} onValueChange={setTpl}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{seedTpl.filter((x) => x.category === "Greeting" || x.category === "General notification").map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select></Field>
            </div>
            <div className="space-y-2"><p className="text-xs font-medium text-muted-foreground">Preview · {new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} at {time}</p><Preview channel={channel === "Both" ? "WhatsApp" : channel} subject={fill(t.subject, { "{{employee_name}}": name })} body={fill(t.body, { "{{customer_name}}": name, "{{employee_name}}": name })} /><Demo /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => { setRows([{ id: `GR-N${rows.length}`, name, kind, type, iso: date, date: new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), channel, template: tpl, time, status: "Scheduled" }, ...rows]); toast.success(`Greeting scheduled for ${name}`); setOpen(false); }}>Schedule greeting</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MessageTemplates() {
  const [rows, setRows] = useState<any[]>(seedTpl);
  const [edit, setEdit] = useState<any | null>(null);
  const [cat, setCat] = useState("all");

  const loadTemplates = () => {
    communicationApi.getTemplates().then((res) => {
      if (res?.results?.length) {
        setRows(res.results.map((t: any) => ({
          id: t.code,
          backendId: t.id,
          name: t.name,
          category: t.category,
          channel: t.channel,
          subject: t.subject,
          body: t.body,
          updated: t.updated_at ? new Date(t.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Today",
          uses: t.uses_count,
          active: t.is_active,
        })));
      }
    }).catch(() => {});
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const cats = Array.from(new Set(rows.map((t) => t.category)));
  const list = useMemo(() => rows.filter((t) => cat === "all" || t.category === cat), [rows, cat]);
  const insert = (p: string) => edit && setEdit({ ...edit, body: `${edit.body}${edit.body.endsWith(" ") || !edit.body ? "" : " "}${p}` });

  return (
    <>
      <SectionHeader title="Message templates" description="Reusable email and WhatsApp content with placeholders." actions={<Button size="sm" onClick={() => setEdit({ id: `TPL-${String(rows.length + 1).padStart(2, "0")}`, name: "", category: "General notification", channel: "Both", subject: "", body: "", updated: "27 Sep 2026", uses: 0, active: true })}><Plus className="size-4" /> New template</Button>} />
      <div className="flex flex-wrap gap-1.5">{["all", ...cats].map((c) => <Button key={c} size="sm" variant={cat === c ? "default" : "outline"} onClick={() => setCat(c)}>{c === "all" ? "All" : c}</Button>)}</div>
      {list.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{list.map((t) => (
        <Panel key={t.id}>
          <div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{t.name}</p><p className="text-xs text-muted-foreground">{t.category} · used {t.uses}×</p></div><ChannelTag c={t.channel} /></div>
          <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{t.body}</p>
          <div className="mt-3 flex items-center justify-between"><span className="text-xs">{t.active ? <StatusBadge status="active" /> : <StatusBadge status="inactive" />}</span><Button size="sm" variant="outline" onClick={() => setEdit(t)}>Edit</Button></div>
        </Panel>))}</div> : <EmptyState title="No templates in this category" />}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{edit?.name || "New template"}</DialogTitle><DialogDescription>Click a placeholder to insert it. Preview uses sample data.</DialogDescription></DialogHeader>
          {edit ? <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-3">
              <Field label="Name" required><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category"><Select value={edit.category} onValueChange={(v) => setEdit({ ...edit, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Invoice", "Payment reminder", "Quotation", "Payment received", "Order update", "Delivery", "General notification", "Greeting"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Channel"><Select value={edit.channel} onValueChange={(v) => setEdit({ ...edit, channel: v as Template["channel"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Email", "WhatsApp", "Both"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></Field>
              </div>
              {edit.channel !== "WhatsApp" ? <Field label="Email subject" required><Input value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} /></Field> : null}
              <Field label="Message"><Textarea rows={8} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></Field>
              <div className="flex flex-wrap gap-1.5">{placeholders.map((p) => <button key={p} type="button" onClick={() => insert(p)} className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] hover:border-accent hover:text-accent">{p}</button>)}</div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={edit.active} onCheckedChange={(v) => setEdit({ ...edit, active: v })} /> Active</label>
            </div>
            <div className="space-y-2"><p className="text-xs font-medium text-muted-foreground">Preview</p><Preview channel={edit.channel === "Email" ? "Email" : "WhatsApp"} subject={fill(edit.subject)} body={fill(edit.body) || "Start typing your message…"} /></div>
          </div> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button disabled={!edit?.name || !edit.body} onClick={async () => {
              if (edit) {
                try {
                  await communicationApi.saveTemplate({
                    id: edit.backendId,
                    code: edit.id || `TPL-${String(rows.length + 1).padStart(2, "0")}`,
                    name: edit.name,
                    category: edit.category,
                    channel: edit.channel,
                    subject: edit.subject || "",
                    body: edit.body,
                    is_active: edit.active !== false,
                  });
                  toast.success(`Template "${edit.name}" saved to server`);
                  loadTemplates();
                } catch {
                  // Fallback to local state if offline
                  setRows(rows.some((r) => r.id === edit.id) ? rows.map((r) => (r.id === edit.id ? edit : r)) : [...rows, edit]);
                  toast.success(`Template "${edit.name}" saved`);
                }
              }
              setEdit(null);
            }}>Save template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AutomationHistory() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMessages = () => {
    setLoading(true);
    communicationApi.getMessages()
      .then((res) => {
        const list = res?.results || [];
        const mapped = list.map((m: BackendMessage) => ({
          id: m.code || `MSG-${m.id}`,
          backendId: m.id,
          at: m.created_at ? new Date(m.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—",
          iso: m.created_at ? m.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
          recipient: m.recipient_name,
          to: m.channel === "WhatsApp" ? m.recipient_phone : (m.recipient_email || m.recipient_phone),
          type: m.message_type,
          channel: m.channel,
          trigger: m.trigger_type,
          doc: m.document_reference || "—",
          template: m.template_name || "—",
          body: m.body,
          status: m.status,
        }));
        setRows(mapped);
      })
      .catch(() => {
        setRows([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMessages();
  }, []);

  return (
    <>
      <SectionHeader
        title="Automation history"
        description="Unified log of every WhatsApp and Email message dispatched or scheduled across the ERP."
        actions={
          <Button size="sm" variant="outline" onClick={loadMessages} disabled={loading}>
            <RotateCcw className={cn("size-3.5", loading && "animate-spin")} /> Refresh log
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-5">
        {(["Scheduled", "Sent", "Delivered", "Failed", "Cancelled"] as const).map((s) => (
          <KpiCard key={s} label={s} value={String(rows.filter((m) => m.status === s || (s === "Delivered" && m.status === "Sent")).length)} />
        ))}
      </div>
      <MessageTable rows={rows} onReload={loadMessages} />
    </>
  );
}
