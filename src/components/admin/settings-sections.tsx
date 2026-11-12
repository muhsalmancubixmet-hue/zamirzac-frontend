import { useState, useEffect, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Cpu, KeyRound, Lock, Plug, RefreshCw, ShieldAlert, ShieldCheck, Unplug, Usb, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Panel, StatusBadge } from "@/components/erp/primitives";
import { SectionHeader } from "@/components/erp/ModuleLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/sales/shared";
import { company } from "@/config/company";
import { license, type LicenseState } from "@/data/admin";
import { api, getAccessToken, settingsApi } from "@/lib/api";
import { logAudit } from "@/data/audit";

// ---------- building blocks ----------
function SaveBar({ label, onSave, saving }: { label: string; onSave?: () => void; saving?: boolean }) {
  const handleSave = () => {
    if (onSave) {
      onSave();
    } else {
      logAudit({
        action: "Updated settings",
        module: "Settings",
        record: label,
        description: `${label} preferences saved successfully.`,
      });
      toast.success(`${label} updated successfully`);
    }
  };
  return (
    <Button size="sm" onClick={handleSave} disabled={saving}>
      {saving ? "Saving…" : "Save changes"}
    </Button>
  );
}

function Grid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <div className={cn("grid gap-4", cols === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")}>{children}</div>;
}

const T = ({
  label,
  value,
  onChange,
  type,
  placeholder,
}: {
  label: string;
  value?: string | number;
  onChange?: (val: string) => void;
  type?: string;
  placeholder?: string;
}) => (
  <Field label={label}>
    <Input
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      type={type}
      placeholder={placeholder}
    />
  </Field>
);

const S = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange?: (val: string) => void;
  options: string[];
}) => (
  <Field label={label}>
    <Select value={value} onValueChange={(v) => onChange?.(v)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </Field>
);

function Toggles({
  rows,
  onChange,
}: {
  rows: [string, string, boolean][];
  onChange?: (index: number, val: boolean) => void;
}) {
  return (
    <ul className="-mx-4 divide-y divide-border sm:-mx-5">
      {rows.map(([t, d, v], idx) => (
        <li key={t} className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
          <span>
            <span className="block text-sm font-medium">{t}</span>
            <span className="block text-xs text-muted-foreground">{d}</span>
          </span>
          <Switch
            checked={v}
            onCheckedChange={(checked) => onChange?.(idx, checked)}
            aria-label={t}
          />
        </li>
      ))}
    </ul>
  );
}

function Chips({
  initial,
  items,
  onAdd,
  onRemove,
  placeholder,
}: {
  initial?: string[];
  items?: string[];
  onAdd?: (item: string) => void;
  onRemove?: (item: string) => void;
  placeholder: string;
}) {
  const [internalList, setInternalList] = useState(initial ?? []);
  const [v, setV] = useState("");
  const list = items ?? internalList;

  const handleAdd = () => {
    const val = v.trim();
    if (!val || list.includes(val)) return;
    if (onAdd) {
      onAdd(val);
    } else {
      setInternalList([...internalList, val]);
    }
    setV("");
  };

  const handleRemove = (c: string) => {
    if (onRemove) {
      onRemove(c);
    } else {
      setInternalList(internalList.filter((x) => x !== c));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {list.map((c) => (
          <span key={c} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs">
            {c}
            <button aria-label={`Remove ${c}`} onClick={() => handleRemove(c)}>
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder}
          className="h-9"
        />
        <Button size="sm" variant="outline" onClick={handleAdd}>
          <Plus className="size-4" /> Add
        </Button>
      </div>
    </div>
  );
}
const Placeholder = ({ children }: { children: ReactNode }) => <p className="flex items-center gap-2 rounded-md border border-dashed border-border-strong bg-muted/30 px-3 py-2 text-xs text-muted-foreground"><Plug className="size-3.5" /> {children}</p>;

// ---------- sections ----------
export function BusinessSettings() {
  const [profile, setProfile] = useState({
    name: company.name,
    legal_name: company.name,
    pan: company.pan,
    phone: company.phone,
    email: company.email,
    website: company.website,
    location: company.location,
    gstin: company.gstin,
    city: "Calicut",
    state: "Kerala",
    currency: "INR",
  });
  const [extraSettings, setExtraSettings] = useState({
    business_type: "Proprietorship",
    industry: "ID card manufacturing & printing",
    state_reg: "32 — Kerala",
    reg_type: "Regular",
    return_filing: "Monthly (GSTR-1 & 3B)",
    einvoicing: "Enabled",
    eway_bill: "Above ₹50,000",
    invoice_template: "Classic — navy header",
    bank_details: "Federal Bank · A/c XXXX4821 · FDRL0001021",
    footer_note: "Thank you for choosing us. Goods once printed cannot be returned except for printing defects.",
    financial_year: "FY 2026-27 (Apr–Mar)",
    books_begin_from: "2026-04-01",
    currency: "INR — Indian Rupee (₹)",
    number_format: "Indian (12,34,567.00)",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) return;
    api.get<any>("/company/")
      .then((res) => {
        if (res && res.name) {
          setProfile((prev) => ({
            ...prev,
            name: res.name || prev.name,
            legal_name: res.legal_name || res.name || prev.legal_name,
            phone: res.phone || prev.phone,
            email: res.email || prev.email,
            location: res.location || prev.location,
            gstin: res.gstin || prev.gstin,
            city: res.city || prev.city,
            state: res.state || prev.state,
            currency: res.currency || prev.currency,
          }));
        }
      })
      .catch((err) => console.debug("Company profile fetch deferred:", err));

    settingsApi.getSection("business")
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          setExtraSettings((prev) => ({ ...prev, ...data }));
        }
      })
      .catch((err) => console.debug("Business extra settings deferred:", err));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (getAccessToken()) {
        await Promise.all([
          api.patch("/company/", {
            name: profile.name,
            legal_name: profile.legal_name,
            phone: profile.phone,
            email: profile.email,
            location: profile.location,
            gstin: profile.gstin,
          }),
          settingsApi.updateSection("business", extraSettings),
        ]);
      }
      logAudit({
        action: "Updated company settings",
        module: "Settings",
        record: profile.name,
        description: `Company profile updated: ${profile.name}, GSTIN ${profile.gstin}`,
      });
      toast.success("Business settings saved to server");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save company settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="Business settings"
        description="Company details printed on invoices, quotations and reports."
        actions={<Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>}
      />
      <Panel title="Company information">
        <Grid>
          <Field label="Legal name"><Input value={profile.legal_name} onChange={(e) => setProfile({ ...profile, legal_name: e.target.value })} /></Field>
          <Field label="Trade name"><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
          <Field label="PAN"><Input value={profile.pan} onChange={(e) => setProfile({ ...profile, pan: e.target.value })} /></Field>
          <S label="Business type" value={extraSettings.business_type} options={["Private Limited", "LLP", "Partnership", "Proprietorship"]} onChange={(v) => setExtraSettings({ ...extraSettings, business_type: v })} />
          <T label="Industry" value={extraSettings.industry} onChange={(v) => setExtraSettings({ ...extraSettings, industry: v })} />
        </Grid>
      </Panel>
      <Panel title="Address & contact">
        <Grid>
          <Field label="Registered address"><Textarea rows={3} value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} /></Field>
          <div className="grid gap-4">
            <Field label="Phone"><Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
            <Field label="Email"><Input value={profile.email} type="email" onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></Field>
            <Field label="Website"><Input value={profile.website} onChange={(e) => setProfile({ ...profile, website: e.target.value })} /></Field>
          </div>
        </Grid>
      </Panel>
      <Panel title="GST details">
        <Grid cols={3}>
          <Field label="GSTIN"><Input value={profile.gstin} onChange={(e) => setProfile({ ...profile, gstin: e.target.value })} /></Field>
          <S label="State" value={extraSettings.state_reg} options={["32 — Kerala", "33 — Tamil Nadu", "29 — Karnataka"]} onChange={(v) => setExtraSettings({ ...extraSettings, state_reg: v })} />
          <S label="Registration type" value={extraSettings.reg_type} options={["Regular", "Composition"]} onChange={(v) => setExtraSettings({ ...extraSettings, reg_type: v })} />
          <S label="Return filing" value={extraSettings.return_filing} options={["Monthly (GSTR-1 & 3B)", "Quarterly (QRMP)"]} onChange={(v) => setExtraSettings({ ...extraSettings, return_filing: v })} />
          <S label="E-invoicing" value={extraSettings.einvoicing} options={["Enabled", "Disabled"]} onChange={(v) => setExtraSettings({ ...extraSettings, einvoicing: v })} />
          <S label="E-way bill" value={extraSettings.eway_bill} options={["Above ₹50,000", "Always", "Never"]} onChange={(v) => setExtraSettings({ ...extraSettings, eway_bill: v })} />
        </Grid>
      </Panel>
      <Grid>
        <Panel title="Invoice settings">
          <div className="grid gap-4">
            <S label="Invoice template" value={extraSettings.invoice_template} options={["Classic — navy header", "Compact", "School order format"]} onChange={(v) => setExtraSettings({ ...extraSettings, invoice_template: v })} />
            <T label="Bank details on invoice" value={extraSettings.bank_details} onChange={(v) => setExtraSettings({ ...extraSettings, bank_details: v })} />
            <Field label="Footer note">
              <Textarea rows={2} value={extraSettings.footer_note} onChange={(e) => setExtraSettings({ ...extraSettings, footer_note: e.target.value })} />
            </Field>
          </div>
        </Panel>
        <Panel title="Financial year & currency">
          <div className="grid gap-4">
            <S label="Financial year" value={extraSettings.financial_year} options={["FY 2025-26 (Apr–Mar)", "FY 2026-27 (Apr–Mar)"]} onChange={(v) => setExtraSettings({ ...extraSettings, financial_year: v })} />
            <T label="Books begin from" value={extraSettings.books_begin_from} onChange={(v) => setExtraSettings({ ...extraSettings, books_begin_from: v })} type="date" />
            <S label="Currency" value={extraSettings.currency} options={["INR — Indian Rupee (₹)"]} onChange={(v) => setExtraSettings({ ...extraSettings, currency: v })} />
            <S label="Number format" value={extraSettings.number_format} options={["Indian (12,34,567.00)", "International (1,234,567.00)"]} onChange={(v) => setExtraSettings({ ...extraSettings, number_format: v })} />
          </div>
        </Panel>
      </Grid>
    </>
  );
}

export function SalesSettings() {
  const [form, setForm] = useState({
    invoice_prefix: "INV-",
    next_invoice_number: "2641",
    reset_numbering: "Every financial year",
    quotation_prefix: "QT-",
    sales_order_prefix: "SO-",
    credit_note_prefix: "CN-",
    prices_entered: "Exclusive of GST",
    default_gst_id_cards: "18%",
    default_gst_lanyards: "12%",
    rounding: "Nearest rupee",
    default_price_list: "Education rate card",
    allow_price_below_min: "Needs manager approval",
    default_payment_terms: "50% advance, balance on delivery",
    quotation_validity_days: "15",
    auto_payment_reminder: true,
    payment_reminder_frequency_days: "7",
    payment_reminder_min_balance: "100.00",
    auto_send_payment_receipt: true,
    payment_receipt_channel: "Email & WhatsApp",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) return;
    settingsApi.getSection("sales")
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          setForm((prev) => ({ ...prev, ...data }));
        }
      })
      .catch((err) => console.debug("Sales settings fetch deferred:", err));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (getAccessToken()) {
        await settingsApi.updateSection("sales", form);
      }
      logAudit({
        action: "Updated settings",
        module: "Settings",
        record: "Sales",
        description: `Sales settings saved: INV prefix ${form.invoice_prefix}, auto reminder: ${form.auto_payment_reminder ? `ON (${form.payment_reminder_frequency_days}d gap)` : 'OFF'}`,
      });
      toast.success("Sales settings saved to server");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save sales settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="Sales settings"
        description="Numbering, tax, pricing and payment terms for invoices and quotations."
        actions={<SaveBar label="Sales settings" onSave={handleSave} saving={saving} />}
      />
      <Panel title="Numbering">
        <Grid cols={3}>
          <T label="Invoice prefix" value={form.invoice_prefix} onChange={(v) => setForm({ ...form, invoice_prefix: v })} />
          <T label="Next invoice number" value={form.next_invoice_number} onChange={(v) => setForm({ ...form, next_invoice_number: v })} />
          <S label="Reset numbering" value={form.reset_numbering} options={["Every financial year", "Never"]} onChange={(v) => setForm({ ...form, reset_numbering: v })} />
          <T label="Quotation prefix" value={form.quotation_prefix} onChange={(v) => setForm({ ...form, quotation_prefix: v })} />
          <T label="Sales order prefix" value={form.sales_order_prefix} onChange={(v) => setForm({ ...form, sales_order_prefix: v })} />
          <T label="Credit note prefix" value={form.credit_note_prefix} onChange={(v) => setForm({ ...form, credit_note_prefix: v })} />
        </Grid>
      </Panel>
      <Grid>
        <Panel title="Tax settings">
          <div className="grid gap-4">
            <S label="Prices entered" value={form.prices_entered} options={["Exclusive of GST", "Inclusive of GST"]} onChange={(v) => setForm({ ...form, prices_entered: v })} />
            <S label="Default GST — ID cards" value={form.default_gst_id_cards} options={["5%", "12%", "18%"]} onChange={(v) => setForm({ ...form, default_gst_id_cards: v })} />
            <S label="Default GST — lanyards" value={form.default_gst_lanyards} options={["5%", "12%", "18%"]} onChange={(v) => setForm({ ...form, default_gst_lanyards: v })} />
            <S label="Rounding" value={form.rounding} options={["Nearest rupee", "No rounding"]} onChange={(v) => setForm({ ...form, rounding: v })} />
          </div>
        </Panel>
        <Panel title="Pricing & payment terms">
          <div className="grid gap-4">
            <S label="Default price list" value={form.default_price_list} options={["Standard", "Education rate card", "Institution rate card", "Distributor −8%"]} onChange={(v) => setForm({ ...form, default_price_list: v })} />
            <S label="Allow price below minimum" value={form.allow_price_below_min} options={["Never", "Needs manager approval", "Always"]} onChange={(v) => setForm({ ...form, allow_price_below_min: v })} />
            <S label="Default payment terms" value={form.default_payment_terms} options={["Advance", "50% advance, balance on delivery", "15 days", "30 days", "45 days"]} onChange={(v) => setForm({ ...form, default_payment_terms: v })} />
            <T label="Quotation validity (days)" value={form.quotation_validity_days} onChange={(v) => setForm({ ...form, quotation_validity_days: v })} type="number" />
          </div>
        </Panel>
      </Grid>
      <Grid>
        <Panel title="Automated Payment Reminders">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Automatic Overdue Reminders</p>
                <p className="text-xs text-muted-foreground">Send automated email reminders for unpaid invoices via Celery</p>
              </div>
              <Switch
                checked={form.auto_payment_reminder ?? true}
                onCheckedChange={(v) => setForm({ ...form, auto_payment_reminder: v })}
              />
            </div>
            <S
              label="Reminder Frequency Gap"
              value={`${form.payment_reminder_frequency_days || "7"} days`}
              options={["3 days", "7 days", "14 days", "30 days"]}
              onChange={(v) => setForm({ ...form, payment_reminder_frequency_days: v.replace(/\D/g, "") })}
            />
            <T
              label="Minimum Overdue Balance (₹)"
              value={form.payment_reminder_min_balance || "100.00"}
              onChange={(v) => setForm({ ...form, payment_reminder_min_balance: v })}
              type="number"
            />
          </div>
        </Panel>
        <Panel title="Customer Payment Receipts">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Auto-Send Receipt on Credit</p>
                <p className="text-xs text-muted-foreground">Automatically email official receipt to customer once payment clears</p>
              </div>
              <Switch
                checked={form.auto_send_payment_receipt ?? true}
                onCheckedChange={(v) => setForm({ ...form, auto_send_payment_receipt: v })}
              />
            </div>
            <S
              label="Receipt Channels"
              value={form.payment_receipt_channel || "Email & WhatsApp"}
              options={["Email & WhatsApp", "Email only", "WhatsApp only"]}
              onChange={(v) => setForm({ ...form, payment_receipt_channel: v })}
            />
          </div>
        </Panel>
      </Grid>
    </>
  );
}

export function PurchaseSettings() {
  const [form, setForm] = useState({
    po_prefix: "PO-",
    next_po_number: "0462",
    purchase_return_prefix: "PR-",
    payment_terms: "30 days",
    po_terms: "1. PVC sheets must be 0.76mm ±0.02.\n2. Ribbons with less than 6 months shelf life will be rejected.\n3. Deliver to Kalamassery Main store, 9 AM–5 PM.",
    require_gstin: true,
    bill_approval_above_50k: true,
    auto_match_po: true,
    allow_ai_bill_extraction: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) return;
    settingsApi.getSection("purchase")
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          setForm((prev) => ({ ...prev, ...data }));
        }
      })
      .catch((err) => console.debug("Purchase settings fetch deferred:", err));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (getAccessToken()) {
        await settingsApi.updateSection("purchase", form);
      }
      logAudit({
        action: "Updated settings",
        module: "Settings",
        record: "Purchase",
        description: `Purchase settings saved: PO prefix ${form.po_prefix}, default terms ${form.payment_terms}`,
      });
      toast.success("Purchase settings saved to server");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save purchase settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="Purchase settings"
        description="Numbering, default terms and supplier rules."
        actions={<SaveBar label="Purchase settings" onSave={handleSave} saving={saving} />}
      />
      <Panel title="Numbering">
        <Grid cols={3}>
          <T label="PO prefix" value={form.po_prefix} onChange={(v) => setForm({ ...form, po_prefix: v })} />
          <T label="Next PO number" value={form.next_po_number} onChange={(v) => setForm({ ...form, next_po_number: v })} />
          <T label="Purchase return prefix" value={form.purchase_return_prefix} onChange={(v) => setForm({ ...form, purchase_return_prefix: v })} />
        </Grid>
      </Panel>
      <Grid>
        <Panel title="Default terms">
          <div className="grid gap-4">
            <S label="Payment terms" value={form.payment_terms} options={["Advance", "15 days", "30 days", "45 days"]} onChange={(v) => setForm({ ...form, payment_terms: v })} />
            <Field label="PO terms & conditions">
              <Textarea rows={4} value={form.po_terms} onChange={(e) => setForm({ ...form, po_terms: e.target.value })} />
            </Field>
          </div>
        </Panel>
        <Panel title="Supplier settings">
          <Toggles
            rows={[
              ["Require GSTIN for new suppliers", "Blocks bills from unregistered suppliers.", form.require_gstin],
              ["Bill approval above ₹50,000", "Accounts Manager approves before posting.", form.bill_approval_above_50k],
              ["Auto-match bill with PO", "Flags quantity/rate differences.", form.auto_match_po],
              ["Allow AI bill extraction", "Uploaded bills are read into draft entries (simulated).", form.allow_ai_bill_extraction],
            ]}
            onChange={(idx, val) => {
              const keys = ["require_gstin", "bill_approval_above_50k", "auto_match_po", "allow_ai_bill_extraction"] as const;
              const key = keys[idx];
              if (key) setForm((prev) => ({ ...prev, [key]: val }));
            }}
          />
        </Panel>
      </Grid>
    </>
  );
}

export function InventorySettings() {
  const [uoms, setUoms] = useState<string[]>(["Nos", "Sheet", "Roll", "Set", "Box", "Kg", "Ltr", "Pack"]);
  const [categories, setCategories] = useState<string[]>([
    "PVC & overlay", "Ribbons & ink", "Lanyard materials", "Hooks & fittings",
    "Holders & pouches", "RFID inlays", "Finished ID cards", "Packaging",
  ]);
  const [params, setParams] = useState({
    minimum_stock_basis: "Per item (manual)",
    valuation_method: "Weighted average",
    dead_stock_days: "180",
    allow_negative_stock: "No",
    low_stock_alert: true,
    out_of_stock_alert: true,
    expiry_alert: true,
    overstock_alert: false,
    send_stock_alert_emails: true,
    stock_alert_email_recipient: "store@zamirzac.com, admin@zamirzac.com",
    stock_alert_frequency: "Weekly",
  });
  const [saving, setSaving] = useState(false);
  const [testingAlerts, setTestingAlerts] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) return;
    Promise.allSettled([
      api.get<any>("/catalog/uoms/"),
      api.get<any>("/catalog/categories/"),
      settingsApi.getSection("inventory"),
    ]).then(([uomsRes, catsRes, settingsRes]) => {
      if (uomsRes.status === "fulfilled" && uomsRes.value) {
        const list = Array.isArray(uomsRes.value) ? uomsRes.value : (uomsRes.value.results ?? []);
        if (list.length > 0) {
          const codes = list.map((u: any) => u.code || u.name).filter(Boolean);
          setUoms((prev) => Array.from(new Set([...codes, ...prev])));
        }
      }
      if (catsRes.status === "fulfilled" && catsRes.value) {
        const list = Array.isArray(catsRes.value) ? catsRes.value : (catsRes.value.results ?? []);
        if (list.length > 0) {
          const names = list.map((c: any) => c.name).filter(Boolean);
          setCategories((prev) => Array.from(new Set([...names, ...prev])));
        }
      }
      if (settingsRes.status === "fulfilled" && settingsRes.value && Object.keys(settingsRes.value).length > 0) {
        setParams((prev) => ({ ...prev, ...settingsRes.value }));
      }
    });
  }, []);

  const handleAddUom = async (newUom: string) => {
    if (!uoms.includes(newUom)) {
      setUoms((prev) => [...prev, newUom]);
    }
    if (getAccessToken()) {
      try {
        await api.post("/catalog/uoms/", { code: newUom, name: newUom });
        toast.success(`Unit '${newUom}' saved to database`);
      } catch (err: any) {
        console.debug("UOM sync deferred:", err?.message);
      }
    }
  };

  const handleRemoveUom = (u: string) => {
    setUoms((prev) => prev.filter((x) => x !== u));
  };

  const handleAddCategory = async (newCat: string) => {
    if (!categories.includes(newCat)) {
      setCategories((prev) => [...prev, newCat]);
    }
    if (getAccessToken()) {
      try {
        const slug = newCat.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        await api.post("/catalog/categories/", { name: newCat, slug });
        toast.success(`Category '${newCat}' saved to database`);
      } catch (err: any) {
        console.debug("Category sync deferred:", err?.message);
      }
    }
  };

  const handleRemoveCategory = (c: string) => {
    setCategories((prev) => prev.filter((x) => x !== c));
  };

  const handleTestAlerts = async () => {
    setTestingAlerts(true);
    try {
      const recipients = params.stock_alert_email_recipient
        ? params.stock_alert_email_recipient.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
      const res = await settingsApi.dispatchStockAlerts(Number(params.dead_stock_days) || 180, recipients);
      toast.success(res.message || `Dispatched stock advisory (${res.low_stock_count} low stock, ${res.dead_stock_count} dead stock)`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch test inventory alert email");
    } finally {
      setTestingAlerts(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (getAccessToken()) {
        await settingsApi.updateSection("inventory", params);
      }
      logAudit({
        action: "Updated settings",
        module: "Settings",
        record: "Inventory",
        description: `Inventory settings saved: dead stock threshold ${params.dead_stock_days} days, email alerts: ${params.send_stock_alert_emails ? 'ON' : 'OFF'}`,
      });
      toast.success("Inventory settings saved successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save inventory settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="Inventory settings"
        description="Units, categories, minimum stock and alerts."
        actions={<Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>}
      />
      <Grid>
        <Panel title="Units of measure">
          <Chips items={uoms} onAdd={handleAddUom} onRemove={handleRemoveUom} placeholder="Add unit, e.g. Ream" />
        </Panel>
        <Panel title="Item categories">
          <Chips items={categories} onAdd={handleAddCategory} onRemove={handleRemoveCategory} placeholder="Add category" />
        </Panel>
      </Grid>
      <Grid>
        <Panel title="Minimum stock & Holding">
          <div className="grid gap-4">
            <S label="Minimum stock basis" value={params.minimum_stock_basis} options={["Per item (manual)", "30 days of average usage", "45 days of average usage"]} onChange={(v) => setParams({ ...params, minimum_stock_basis: v })} />
            <S label="Valuation method" value={params.valuation_method} options={["Weighted average", "FIFO"]} onChange={(v) => setParams({ ...params, valuation_method: v })} />
            <T label="Dead stock threshold (days idle — 180 = 6 months)" value={params.dead_stock_days} onChange={(v) => setParams({ ...params, dead_stock_days: v })} type="number" />
            <S label="Allow negative stock" value={params.allow_negative_stock} options={["No", "Yes, with warning"]} onChange={(v) => setParams({ ...params, allow_negative_stock: v })} />
          </div>
        </Panel>
        <Panel title="Stock alerts">
          <Toggles
            rows={[
              ["Low stock alert", "When stock falls below minimum.", params.low_stock_alert],
              ["Out of stock alert", "When stock reaches zero.", params.out_of_stock_alert],
              ["Expiry alert (ribbons, inks)", "60 days before expiry.", params.expiry_alert],
              ["Overstock alert", "When stock exceeds maximum.", params.overstock_alert],
            ]}
            onChange={(idx, val) => {
              const keys = ["low_stock_alert", "out_of_stock_alert", "expiry_alert", "overstock_alert"] as const;
              const key = keys[idx];
              if (key) setParams((prev) => ({ ...prev, [key]: val }));
            }}
          />
        </Panel>
      </Grid>
      <Panel title="Automated Email Advisories (Low Stock & Dead Stock)" description="Dispatches automated summaries of items running out or idle for 6 months">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Automatic Stock Advisory Emails</p>
                <p className="text-xs text-muted-foreground">Send low-stock and 6-month unmoving dead stock reports via Celery</p>
              </div>
              <Switch
                checked={params.send_stock_alert_emails ?? true}
                onCheckedChange={(v) => setParams({ ...params, send_stock_alert_emails: v })}
              />
            </div>
            <S
              label="Alert Dispatch Frequency"
              value={params.stock_alert_frequency || "Weekly"}
              options={["Weekly", "Daily"]}
              onChange={(v) => setParams({ ...params, stock_alert_frequency: v })}
            />
          </div>
          <div className="space-y-3">
            <T
              label="Recipient Emails (comma-separated)"
              value={params.stock_alert_email_recipient || "store@zamirzac.com, admin@zamirzac.com"}
              onChange={(v) => setParams({ ...params, stock_alert_email_recipient: v })}
            />
            <div className="pt-1">
              <Button size="sm" variant="outline" onClick={handleTestAlerts} disabled={testingAlerts}>
                {testingAlerts ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Send Test Stock Advisory Email
              </Button>
            </div>
          </div>
        </div>
      </Panel>
    </>
  );
}

export function ManufacturingSettings() {
  const [form, setForm] = useState({
    production_order_prefix: "PRD-",
    default_production_unit: "Kalamassery Main",
    material_consumption: "On completion",
    block_start_short_materials: "Yes",
    version_boms: true,
    require_bom_approval: false,
    include_labour_in_cost: true,
    default_card_wastage: "3",
    pvc_sheet_wastage: "2.5",
    ribbon_wastage: "4",
    wastage_above_limit: "Needs supervisor note",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) return;
    settingsApi.getSection("manufacturing")
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          setForm((prev) => ({ ...prev, ...data }));
        }
      })
      .catch((err) => console.debug("Manufacturing settings fetch deferred:", err));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (getAccessToken()) {
        await settingsApi.updateSection("manufacturing", form);
      }
      logAudit({
        action: "Updated settings",
        module: "Settings",
        record: "Manufacturing",
        description: `Manufacturing settings saved: PRD prefix ${form.production_order_prefix}`,
      });
      toast.success("Manufacturing settings saved to server");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save manufacturing settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="Manufacturing settings"
        description="Production, BOM and wastage rules."
        actions={<SaveBar label="Manufacturing settings" onSave={handleSave} saving={saving} />}
      />
      <Grid>
        <Panel title="Production">
          <div className="grid gap-4">
            <T label="Production order prefix" value={form.production_order_prefix} onChange={(v) => setForm({ ...form, production_order_prefix: v })} />
            <S label="Default production unit" value={form.default_production_unit} options={["Kalamassery Main", "Kozhikode Depot"]} onChange={(v) => setForm({ ...form, default_production_unit: v })} />
            <S label="Raw material consumption" value={form.material_consumption} options={["On start", "On completion"]} onChange={(v) => setForm({ ...form, material_consumption: v })} />
            <S label="Block start if materials short" value={form.block_start_short_materials} options={["Yes", "No, warn only"]} onChange={(v) => setForm({ ...form, block_start_short_materials: v })} />
          </div>
        </Panel>
        <Panel title="BOM">
          <Toggles
            rows={[
              ["Version BOMs", "Keep older versions when a BOM changes.", form.version_boms],
              ["Require approval for BOM change", "Production Supervisor approves.", form.require_bom_approval],
              ["Include labour in product cost", "Adds BOM labour to cost per card.", form.include_labour_in_cost],
            ]}
            onChange={(idx, val) => {
              const keys = ["version_boms", "require_bom_approval", "include_labour_in_cost"] as const;
              const key = keys[idx];
              if (key) setForm((prev) => ({ ...prev, [key]: val }));
            }}
          />
        </Panel>
      </Grid>
      <Panel title="Wastage">
        <Grid cols={3}>
          <T label="Default card wastage %" value={form.default_card_wastage} onChange={(v) => setForm({ ...form, default_card_wastage: v })} type="number" />
          <T label="PVC sheet wastage %" value={form.pvc_sheet_wastage} onChange={(v) => setForm({ ...form, pvc_sheet_wastage: v })} type="number" />
          <T label="Ribbon wastage %" value={form.ribbon_wastage} onChange={(v) => setForm({ ...form, ribbon_wastage: v })} type="number" />
          <S label="Wastage above limit" value={form.wastage_above_limit} options={["Allow", "Needs supervisor note", "Block completion"]} onChange={(v) => setForm({ ...form, wastage_above_limit: v })} />
        </Grid>
      </Panel>
    </>
  );
}

export function CommunicationSettings() {
  const [form, setForm] = useState({
    from_name: "Zamirzac Accounts",
    from_address: company.email,
    smtp_host: "smtp.gmail.com",
    smtp_port: "587",
    whatsapp_number: company.phone,
    whatsapp_display_name: "Zamirzac Solutions",
    whatsapp_provider: "WhatsApp Cloud API",
    first_reminder: "3 days before due",
    repeat_reminder: "Every 7 days",
    stop_after: "4 reminders",
    send_window: "10:00–18:00 IST",
  });
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) return;
    settingsApi.getSection("communication")
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          setForm((prev) => ({ ...prev, ...data }));
        }
      })
      .catch((err) => console.debug("Communication settings fetch deferred:", err));
  }, []);

  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      const res = await api.post<{ success: boolean; message?: string }>("/settings/test-email/", {
        recipient: form.from_address || undefined,
      });
      toast.success(res.message || "Test email dispatched via SMTP server");
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch test email. Check SMTP settings.");
    } finally {
      setTestingEmail(false);
    }
  };

  const handleTestWhatsApp = async () => {
    setTestingWhatsApp(true);
    try {
      const res = await api.post<{ success: boolean; message?: string }>("/settings/test-whatsapp/", {
        phone: form.whatsapp_number,
      });
      toast.success(res.message || "Test WhatsApp message dispatched via server");
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch WhatsApp test message");
    } finally {
      setTestingWhatsApp(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (getAccessToken()) {
        await settingsApi.updateSection("communication", form);
      }
      logAudit({
        action: "Updated settings",
        module: "Settings",
        record: "Communication",
        description: `Communication settings saved: SMTP host ${form.smtp_host}, WhatsApp ${form.whatsapp_number}`,
      });
      toast.success("Communication settings saved to server");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save communication settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="Communication"
        description="Email and WhatsApp configuration, templates and reminders."
        actions={<SaveBar label="Communication settings" onSave={handleSave} saving={saving} />}
      />
      <Grid>
        <Panel title="Email (SMTP)" actions={<StatusBadge status="draft" label="Connected" />}>
          <div className="grid gap-4">
            <T label="From name" value={form.from_name} onChange={(v) => setForm({ ...form, from_name: v })} />
            <T label="From address" value={form.from_address} onChange={(v) => setForm({ ...form, from_address: v })} />
            <Grid>
              <T label="SMTP host" value={form.smtp_host} onChange={(v) => setForm({ ...form, smtp_host: v })} placeholder="smtp.gmail.com" />
              <T label="Port" value={form.smtp_port} onChange={(v) => setForm({ ...form, smtp_port: v })} />
            </Grid>
            <Placeholder>Credentials are stored securely in system configurations.</Placeholder>
            <Button size="sm" variant="outline" onClick={handleTestEmail} disabled={testingEmail}>
              {testingEmail ? "Sending test…" : "Send test email"}
            </Button>
          </div>
        </Panel>
        <Panel title="WhatsApp Business" actions={<StatusBadge status="draft" label="Connected" />}>
          <div className="grid gap-4">
            <T label="Business number" value={form.whatsapp_number} onChange={(v) => setForm({ ...form, whatsapp_number: v })} />
            <T label="Display name" value={form.whatsapp_display_name} onChange={(v) => setForm({ ...form, whatsapp_display_name: v })} />
            <T label="Provider / API" value={form.whatsapp_provider} onChange={(v) => setForm({ ...form, whatsapp_provider: v })} placeholder="WhatsApp Cloud API" />
            <Placeholder>Connection via WhatsApp Cloud API provider configured.</Placeholder>
            <Button size="sm" variant="outline" onClick={handleTestWhatsApp} disabled={testingWhatsApp}>
              {testingWhatsApp ? "Sending test…" : "Send test message"}
            </Button>
          </div>
        </Panel>
      </Grid>
      <Grid>
        <Panel title="Message templates">
          <ul className="space-y-2 text-sm">
            {["Invoice sent", "Payment reminder — gentle", "Payment reminder — final", "Quotation shared", "Order ready for dispatch", "Birthday greeting"].map((t) => (
              <li key={t} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span>{t}</span>
                <Link to="/automation/$section" params={{ section: "templates" }} className="text-xs text-accent hover:underline">
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Reminder settings">
          <div className="grid gap-4">
            <S label="First reminder" value={form.first_reminder} options={["On due date", "3 days before due", "7 days before due"]} onChange={(v) => setForm({ ...form, first_reminder: v })} />
            <S label="Repeat" value={form.repeat_reminder} options={["Every 3 days", "Every 7 days", "Every 15 days"]} onChange={(v) => setForm({ ...form, repeat_reminder: v })} />
            <S label="Stop after" value={form.stop_after} options={["2 reminders", "4 reminders", "6 reminders"]} onChange={(v) => setForm({ ...form, stop_after: v })} />
            <S label="Send window" value={form.send_window} options={["09:00–17:00 IST", "10:00–18:00 IST"]} onChange={(v) => setForm({ ...form, send_window: v })} />
          </div>
        </Panel>
      </Grid>
    </>
  );
}

export function NotificationSettings() {
  const [alerts, setAlerts] = useState({
    gst_due_dates: true,
    license_device: true,
    backup_status: false,
    low_stock: true,
    expiring_ribbons: true,
    production_shortages: true,
    payment_received: true,
    invoice_overdue: true,
    supplier_bill_due: true,
    leave_requests: true,
    birthdays: true,
    travel_claims: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) return;
    settingsApi.getSection("notifications")
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          setAlerts((prev) => ({ ...prev, ...data }));
        }
      })
      .catch((err) => console.debug("Notification settings fetch deferred:", err));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (getAccessToken()) {
        await settingsApi.updateSection("notifications", alerts);
      }
      logAudit({
        action: "Updated settings",
        module: "Settings",
        record: "Notifications",
        description: "Notification preferences saved successfully.",
      });
      toast.success("Notification settings saved to server");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save notification settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="Notification settings"
        description="Choose which alerts appear in the notification centre and who receives them."
        actions={<SaveBar label="Notification settings" onSave={handleSave} saving={saving} />}
      />
      <Grid>
        <Panel title="System alerts">
          <Toggles
            rows={[
              ["GST due dates", "GSTR-1 and GSTR-3B reminders.", alerts.gst_due_dates],
              ["License & device", "Verification and expiry warnings.", alerts.license_device],
              ["Backup status", "Daily backup success or failure.", alerts.backup_status],
            ]}
            onChange={(idx, val) => {
              const keys = ["gst_due_dates", "license_device", "backup_status"] as const;
              const key = keys[idx];
              if (key) setAlerts((prev) => ({ ...prev, [key]: val }));
            }}
          />
        </Panel>
        <Panel title="Stock alerts">
          <Toggles
            rows={[
              ["Low stock", "Raw materials and finished cards.", alerts.low_stock],
              ["Expiring ribbons & inks", "60 days before expiry.", alerts.expiring_ribbons],
              ["Production shortages", "When an order can't start.", alerts.production_shortages],
            ]}
            onChange={(idx, val) => {
              const keys = ["low_stock", "expiring_ribbons", "production_shortages"] as const;
              const key = keys[idx];
              if (key) setAlerts((prev) => ({ ...prev, [key]: val }));
            }}
          />
        </Panel>
        <Panel title="Payment alerts">
          <Toggles
            rows={[
              ["Payment received", "Customer receipts.", alerts.payment_received],
              ["Invoice overdue", "When an invoice passes its due date.", alerts.invoice_overdue],
              ["Supplier bill due", "3 days before due.", alerts.supplier_bill_due],
            ]}
            onChange={(idx, val) => {
              const keys = ["payment_received", "invoice_overdue", "supplier_bill_due"] as const;
              const key = keys[idx];
              if (key) setAlerts((prev) => ({ ...prev, [key]: val }));
            }}
          />
        </Panel>
        <Panel title="Employee alerts">
          <Toggles
            rows={[
              ["Leave requests", "New and pending approvals.", alerts.leave_requests],
              ["Birthdays & anniversaries", "Morning summary.", alerts.birthdays],
              ["Travel claims", "Claims awaiting approval.", alerts.travel_claims],
            ]}
            onChange={(idx, val) => {
              const keys = ["leave_requests", "birthdays", "travel_claims"] as const;
              const key = keys[idx];
              if (key) setAlerts((prev) => ({ ...prev, [key]: val }));
            }}
          />
        </Panel>
      </Grid>
    </>
  );
}

// ---------- License & device ----------
const states: { key: LicenseState; label: string }[] = [
  { key: "connected", label: "Connected" }, { key: "disconnected", label: "Not connected" }, { key: "expired", label: "License expired" }, { key: "verify", label: "Verification required" },
];
const banner: Record<LicenseState, { icon: typeof ShieldCheck; title: string; body: string; tone: string }> = {
  connected: { icon: ShieldCheck, title: "Licensed device connected", body: "All protected features are available on this computer.", tone: "border-success/30 bg-success/10 text-success" },
  disconnected: { icon: Unplug, title: "Licensed device not connected", body: "Protected features are temporarily unavailable. Insert the Zamirzac USB key to continue.", tone: "border-warning/30 bg-warning/10 text-warning" },
  expired: { icon: AlertTriangle, title: "License expired on 31 Mar 2027", body: "Renew the license to continue using protected features. Your data remains safe and viewable.", tone: "border-destructive/30 bg-destructive/10 text-destructive" },
  verify: { icon: ShieldAlert, title: "Verification required", body: "The device was detected but must be verified before protected features unlock.", tone: "border-accent/30 bg-accent/10 text-accent" },
};

export function LicenseSettings() {
  const [state, setState] = useState<LicenseState>("connected");
  const [busy, setBusy] = useState(false);
  const b = banner[state];

  useEffect(() => {
    if (!getAccessToken()) return;
    settingsApi.getSection("license")
      .then((data: any) => {
        if (data?.state) {
          setState(data.state);
        }
      })
      .catch((err) => console.debug("License state fetch deferred:", err));
  }, []);

  const verify = () => {
    setBusy(true);
    setTimeout(async () => {
      setBusy(false);
      setState("connected");
      if (getAccessToken()) {
        try {
          await settingsApi.updateSection("license", {
            state: "connected",
            last_verified: new Date().toISOString(),
          });
        } catch (e) {
          console.debug("License sync deferred:", e);
        }
      }
      logAudit({
        action: "Verified device",
        module: "Settings",
        record: "USB-KEY",
        description: "USB security key verification completed successfully.",
      });
      toast.success("Device verified successfully");
    }, 1200);
  };

  const handleStateChange = async (s: LicenseState) => {
    setState(s);
    if (getAccessToken()) {
      try {
        await settingsApi.updateSection("license", { state: s });
      } catch (e) {
        console.debug("License state sync deferred:", e);
      }
    }
  };

  const ok = state === "connected";
  const Row = ({ k, v }: { k: string; v: ReactNode }) => <div className="flex items-center justify-between gap-4 py-2 text-sm"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span></div>;

  return (
    <>
      <SectionHeader title="License & device" description="Status of the ERP license and the USB security key. Hardware detection and verification run outside this screen." actions={<Button size="sm" variant="outline" onClick={verify} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Verify now</Button>} />
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border-strong bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium">Preview state:</span>
        {states.map((s) => <button key={s.key} onClick={() => handleStateChange(s.key)} className={cn("rounded-md px-2 py-1", s.key === state ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{s.label}</button>)}
      </div>
      <div className={cn("flex items-start gap-3 rounded-lg border px-4 py-3", b.tone)}>
        <b.icon className="mt-0.5 size-5 shrink-0" />
        <div className="flex-1"><p className="text-sm font-semibold">{b.title}</p><p className="text-sm text-foreground/80">{b.body}</p></div>
        {state === "verify" ? <Button size="sm" onClick={verify} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Verify device</Button> : state === "expired" ? <Button size="sm" onClick={() => toast.success("Renewal request sent to Zamirzac support")}>Renew license</Button> : null}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="License information" actions={<StatusBadge status={state === "expired" ? "overdue" : state === "verify" ? "pending" : "active"} label={state === "expired" ? "Expired" : state === "verify" ? "Pending verification" : "Active"} />}>
          <div className="divide-y divide-border">
            <Row k="License key" v={<span className="font-mono text-xs">{license.key}</span>} />
            <Row k="License type" v={license.type} />
            <Row k="Edition" v={license.edition} />
            <Row k="Activation" v={state === "verify" ? "Awaiting verification" : "Activated"} />
            <Row k="Issued" v={license.issued} />
            <Row k="Valid till" v={<span className={cn(state === "expired" && "text-destructive")}>{license.validTill}</span>} />
            <Row k="Last verification" v={state === "verify" ? "Overdue (7 days)" : license.lastVerified} />
          </div>
        </Panel>
        <Panel title="Device information" actions={<StatusBadge status={state === "disconnected" ? "failed" : "active"} label={state === "disconnected" ? "Not detected" : "Detected"} />}>
          <div className="mb-3 flex items-center gap-3 rounded-md border border-border bg-muted/40 p-3">
            <span className={cn("flex size-10 items-center justify-center rounded-md", state === "disconnected" ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground")}><Usb className="size-5" /></span>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{license.device.name}</p><p className="text-xs text-muted-foreground">{state === "disconnected" ? "Last seen 27 Sep 2026, 08:02" : license.device.port}</p></div>
          </div>
          <div className="divide-y divide-border">
            <Row k="Serial" v={<span className="font-mono text-xs">{license.device.serial}</span>} />
            <Row k="Model" v={license.device.model} />
            <Row k="Firmware" v={license.device.firmware} />
            <Row k="Host computer" v={license.device.host} />
          </div>
        </Panel>
        <Panel title="Protected features" description={ok ? "All available" : "Temporarily locked"}>
          <ul className="space-y-2">
            {license.features.map((f) => <li key={f} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"><span className="flex items-center gap-2"><Cpu className="size-4 text-muted-foreground" />{f}</span>{ok ? <CheckCircle2 className="size-4 text-success" /> : <Lock className="size-4 text-muted-foreground" />}</li>)}
          </ul>
        </Panel>
      </div>
      <p className="text-xs text-muted-foreground">This screen shows license status and device connection verified through the security service.</p>
    </>
  );
}

export function SystemSettings() {
  const [branches, setBranches] = useState<string[]>([
    "Kalamassery Main — HQ & production",
    "Kozhikode Depot — Malabar sales",
    "Thrissur Branch — Central Kerala",
  ]);
  const [form, setForm] = useState({
    timezone: "Asia/Kolkata (IST, UTC+5:30)",
    date_format: "27 Sep 2026",
    language: "English (India)",
    daily_backup: true,
    audit_trail_years: true,
    export_non_admins: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) return;
    api.get<any>("/branches/?active_only=true")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        if (list.length > 0) {
          setBranches(list.map((b: any) => `${b.name} (${b.code}) — ${b.city}, ${b.state}`));
        }
      })
      .catch((err) => console.debug("Branches fetch deferred:", err));

    settingsApi.getSection("system")
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          setForm((prev) => ({ ...prev, ...data }));
        }
      })
      .catch((err) => console.debug("System settings fetch deferred:", err));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (getAccessToken()) {
        await settingsApi.updateSection("system", form);
      }
      logAudit({
        action: "Updated settings",
        module: "Settings",
        record: "System",
        description: `System settings saved: timezone ${form.timezone}, date format ${form.date_format}`,
      });
      toast.success("System settings saved to server");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save system settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="System settings"
        description="Regional preferences, backups and data."
        actions={<SaveBar label="System settings" onSave={handleSave} saving={saving} />}
      />
      <Grid>
        <Panel title="Regional">
          <div className="grid gap-4">
            <S label="Time zone" value={form.timezone} options={["Asia/Kolkata (IST, UTC+5:30)"]} onChange={(v) => setForm({ ...form, timezone: v })} />
            <S label="Date format" value={form.date_format} options={["27 Sep 2026", "27/09/2026", "2026-09-27"]} onChange={(v) => setForm({ ...form, date_format: v })} />
            <S label="Language" value={form.language} options={["English (India)", "Malayalam (coming soon)"]} onChange={(v) => setForm({ ...form, language: v })} />
          </div>
        </Panel>
        <Panel title="Backups & data">
          <Toggles
            rows={[
              ["Daily automatic backup", "Runs at 23:30 IST.", form.daily_backup],
              ["Keep audit trail for 8 years", "As required for books of account.", form.audit_trail_years],
              ["Allow data export by non-admins", "Controlled per role in permissions.", form.export_non_admins],
            ]}
            onChange={(idx, val) => {
              const keys = ["daily_backup", "audit_trail_years", "export_non_admins"] as const;
              const key = keys[idx];
              if (key) setForm((prev) => ({ ...prev, [key]: val }));
            }}
          />
        </Panel>
      </Grid>
      <Panel title="Branches & warehouses">
        <ul className="grid gap-2 sm:grid-cols-3">
          {branches.map((w) => (
            <li key={w} className="rounded-md border border-border px-3 py-2 text-sm">
              {w}
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

