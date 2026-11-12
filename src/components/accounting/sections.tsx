import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Ban, Building2, CheckCircle2, Download, FileSpreadsheet, Landmark, Paperclip, Plus, Send, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { KpiCard, Panel, StatusBadge, EmptyState } from "@/components/erp/primitives";
import { DataTable, DetailGrid, FormGrid, type Column } from "@/components/erp/DataTable";
import { ExportButtons, ReportToolbar, SectionHeader } from "@/components/erp/ModuleLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr } from "@/lib/format";
import {
  transfers,
  type Account, type Journal, type LedgerLine,
} from "@/data/finance";
import { companyConfig as company } from "@/config/company";
import { api } from "@/lib/api";

const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);
const lakh = (n: number) => `₹${(n / 100000).toFixed(2)} L`;
const Muted = ({ children }: { children: ReactNode }) => <span className="text-muted-foreground">{children}</span>;
const accountNames: string[] = [];
const bankList: string[] = [];

// ---------------- Overview ----------------
export function AccountsOverview() {
  const [bankList, setBankList] = useState<any[]>([]);
  const [cashList, setCashList] = useState<any[]>([]);
  const [accList, setAccList] = useState<Account[]>([]);
  const [recentJournals, setRecentJournals] = useState<Journal[]>([]);

  useEffect(() => {
    Promise.allSettled([
      api.get<any>("/finance/bank-accounts/"),
      api.get<any>("/finance/cash-accounts/"),
      api.get<any>("/finance/accounts/"),
      api.get<any>("/finance/journal-entries/"),
    ]).then(([banksRes, cashRes, accsRes, jnlRes]) => {
      if (banksRes.status === "fulfilled") {
        const list = Array.isArray(banksRes.value) ? banksRes.value : (banksRes.value?.results ?? []);
        setBankList(list.map((b: any) => ({
          id: String(b.id),
          bank: b.bank_name || b.name,
          type: b.account_type || "Current",
          accNo: b.account_number ? `···· ${b.account_number.slice(-4)}` : "—",
          ifsc: b.ifsc_code || "—",
          branch: b.branch_name || "Main",
          balance: Number(b.balance ?? 0),
          reconciled: "Live",
        })));
      }

      if (cashRes.status === "fulfilled") {
        const list = Array.isArray(cashRes.value) ? cashRes.value : (cashRes.value?.results ?? []);
        setCashList(list.map((c: any) => ({
          id: String(c.id),
          name: c.name,
          custodian: c.custodian || "Cashier",
          balance: Number(c.balance ?? 0),
        })));
      }

      if (accsRes.status === "fulfilled") {
        const list = Array.isArray(accsRes.value) ? accsRes.value : (accsRes.value?.results ?? []);
        setAccList(list.map((a: any) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          type: a.account_type as Account["type"],
          group: !!a.is_group,
          parent: a.parent_code || undefined,
          opening: Number(a.opening_balance) || 0,
          current: Number(a.current_balance ?? a.opening_balance) || 0,
          status: a.is_active ? "Active" : "Inactive",
        })));
      }

      if (jnlRes.status === "fulfilled") {
        const list = Array.isArray(jnlRes.value) ? jnlRes.value : (jnlRes.value?.results ?? []);
        setRecentJournals(list.slice(0, 6).map((j: any) => ({
          id: j.entry_number || `JV-${j.id}`,
          date: j.date || j.entry_date || new Date().toISOString().slice(0, 10),
          iso: j.date || j.entry_date || new Date().toISOString().slice(0, 10),
          ref: j.reference_number || "—",
          description: j.narration || "Journal entry",
          amount: Number(j.total_debit) || Number(j.total_amount) || 0,
          status: (j.status ?? "Draft") as Journal["status"],
          attachments: 0,
          notes: j.narration || "",
          lines: [],
        })));
      }
    });
  }, []);

  const cash = sum(cashList, (c) => c.balance || 0);
  const bank = sum(bankList, (b) => b.balance || 0);
  const inc = sum(accList.filter((a) => a.type === "Income"), (a) => a.current);
  const exp = sum(accList.filter((a) => a.type === "Expenses"), (a) => a.current);
  const receivables = sum(accList.filter((a) => a.code === "1200" || a.name.toLowerCase().includes("debtor") || a.name.toLowerCase().includes("receivable")), (a) => a.current);
  const payables = sum(accList.filter((a) => a.code === "2100" || a.name.toLowerCase().includes("creditor") || a.name.toLowerCase().includes("payable")), (a) => a.current);
  const quick = [
    { label: "Record receipt", slug: "receipts" }, { label: "Record payment", slug: "payments" },
    { label: "New journal entry", slug: "journal-entries" }, { label: "Add expense", slug: "expenses" },
    { label: "Trial balance", slug: "trial-balance" }, { label: "Profit & loss", slug: "profit-loss" },
  ];
  return (
    <>
      <SectionHeader title="Accounts overview" description={`Financial position of ${company.name} · ${company.fy} to date`} actions={<ExportButtons />} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Cash in hand" value={inr(cash)} hint={`${cashList.length} cash account(s)`} />
        <KpiCard label="Bank balance" value={inr(bank)} hint={`${bankList.length} bank account(s)`} />
        <KpiCard label="Receivables" value={inr(receivables)} hint="Live ledger" tone="up" />
        <KpiCard label="Payables" value={inr(payables)} hint="Live ledger" tone="down" />
        <KpiCard label="Net profit (YTD)" value={inr(inc - exp)} hint={inc > 0 ? `Margin ${(((inc - exp) / inc) * 100).toFixed(1)}%` : "YTD"} tone="up" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Recent journal entries" className="xl:col-span-2" bodyClassName="p-0"
          actions={<Button variant="ghost" size="sm" asChild><Link to="/accounting/$section" params={{ section: "journal-entries" }}>View all</Link></Button>}>
          <Table>
            <TableHeader><TableRow><TableHead>Entry</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {recentJournals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                    No recent journal entries.
                  </TableCell>
                </TableRow>
              ) : (
                recentJournals.slice(0, 6).map((j) => (
                  <TableRow key={j.id}>
                    <TableCell><div className="font-medium">{j.id}</div><div className="text-xs text-muted-foreground">{j.date}</div></TableCell>
                    <TableCell className="max-w-64 truncate">{j.description}</TableCell>
                    <TableCell className="text-right tabular">{inr(j.amount)}</TableCell>
                    <TableCell><StatusBadge status={j.status} /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Panel>
        <Panel title="Quick actions">
          <div className="grid grid-cols-2 gap-2">
            {quick.map((q) => (
              <Link key={q.slug} to="/accounting/$section" params={{ section: q.slug }}
                className="rounded-md border border-border px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent hover:bg-accent/5">
                {q.label}
              </Link>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="Bank & cash balances" bodyClassName="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="hidden md:table-cell">Details</TableHead><TableHead className="hidden sm:table-cell">Status</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
          <TableBody>
            {bankList.length === 0 && cashList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                  No bank or cash accounts configured.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {bankList.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.bank}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{b.type} · {b.accNo}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{b.reconciled}</TableCell>
                    <TableCell className={cn("text-right tabular", b.balance < 0 && "text-destructive")}>{inr(b.balance)}</TableCell>
                  </TableRow>
                ))}
                {cashList.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">Custodian: {c.custodian}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">Active</TableCell>
                    <TableCell className="text-right tabular">{inr(c.balance)}</TableCell>
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

// ---------------- Chart of accounts ----------------
const depth = (a: Account, accList: Account[]): number => {
  if (!a.parent) return 0;
  const parentAcc = accList.find((x) => x.code === a.parent);
  return parentAcc ? 1 + depth(parentAcc, accList) : 1;
};
export function ChartOfAccounts() {
  const [tab, setTab] = useState("All");
  const [apiAccounts, setApiAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [totalServerCount, setTotalServerCount] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const accountsAbortRef = useRef<AbortController | null>(null);

  const fetchAccounts = async () => {
    if (accountsAbortRef.current) {
      accountsAbortRef.current.abort();
    }
    const controller = new AbortController();
    accountsAbortRef.current = controller;
    setLoadingAccounts(true);
    setFetchError(null);
    setIsTruncated(false);

    try {
      let allResults: any[] = [];
      let pageNum = 1;
      let hasMore = true;
      const MAX_PAGES = 10; // Circuit breaker: up to 1,000 accounts max

      while (hasMore && pageNum <= MAX_PAGES) {
        if (controller.signal.aborted) return;
        const res = await api.get<any>(
          "/finance/accounts/",
          { page: pageNum, page_size: 100 },
          { signal: controller.signal }
        );
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        allResults = [...allResults, ...list];

        const totalCount = res?.count ?? allResults.length;
        setTotalServerCount(totalCount);
        if (Array.isArray(res) || !res?.next || allResults.length >= totalCount) {
          hasMore = false;
        } else if (pageNum >= MAX_PAGES) {
          hasMore = false;
          setIsTruncated(true);
        } else {
          pageNum++;
        }
      }

      // Deduplicate by code or id
      const seen = new Set<string>();
      const deduplicated = allResults.filter((a) => {
        const key = String(a.code || a.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const mapped: Account[] = deduplicated.map((a: any) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.account_type as Account["type"],
        group: !!a.is_group,
        parent: a.parent_code || undefined,
        opening: Number(a.opening_balance) || 0,
        current: Number(a.current_balance ?? a.opening_balance) || 0,
        status: a.is_active ? "Active" : "Inactive",
      }));

      setApiAccounts(mapped);
    } catch (err: any) {
      if (err?.name === "AbortError" || controller.signal.aborted) return;
      toast.error("Failed to load chart of accounts");
      setFetchError(err?.message || "Failed to load Chart of Accounts");
      setApiAccounts([]);
    } finally {
      if (accountsAbortRef.current === controller) {
        setLoadingAccounts(false);
      }
    }
  };

  useEffect(() => {
    fetchAccounts();
    return () => {
      if (accountsAbortRef.current) accountsAbortRef.current.abort();
    };
  }, []);

  const currentAccounts = apiAccounts;
  const rows = useMemo(() => (tab === "All" ? currentAccounts : currentAccounts.filter((a) => a.type === tab)), [tab, currentAccounts]);

  const handleSave = async (formData: Record<string, any>, existing: Account | null) => {
    const parentVal = formData["Parent account"];
    let parentId: number | null = null;
    if (parentVal && parentVal !== "None") {
      const parentObj = currentAccounts.find(
        (x) => x.name === parentVal || `${x.code} · ${x.name}` === parentVal || x.code === parentVal
      );
      if (parentObj?.id) {
        parentId = parentObj.id;
      }
    }

    const payload: any = {
      name: formData["Account name"],
      code: (formData["Account code"] || "").trim().toUpperCase(),
      account_type: formData["Account type"] || "Assets",
      parent: parentId,
      is_group: formData["Account kind"] === "Group",
      opening_balance: Number(formData["Opening balance (₹)"]) || 0,
      is_active: formData["Status"] !== "Inactive",
    };

    try {
      if (existing?.id) {
        await api.patch(`/finance/accounts/${existing.id}/`, payload);
        toast.success(`Account ${payload.code} updated`);
      } else {
        await api.post("/finance/accounts/", payload);
        toast.success(`Account ${payload.code} created`);
      }
      fetchAccounts();
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to save account");
      return false;
    }
  };

  const handleDelete = async (a: Account) => {
    if (!a.id) return;
    try {
      await api.delete(`/finance/accounts/${a.id}/`);
      toast.success(`Account ${a.code} deleted`);
      fetchAccounts();
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete account");
      return false;
    }
  };

  const groupOptions = ["None", ...currentAccounts.filter((x) => x.group).map((x) => `${x.code} · ${x.name}`)];

  const cols: Column<Account>[] = [
    { key: "code", header: "Code", sort: (a) => a.code, render: (a) => <span className="font-mono text-xs">{a.code}</span> },
    { key: "name", header: "Account name", sort: (a) => a.name, render: (a) => (
      <span style={{ paddingLeft: depth(a, currentAccounts) * 18 }} className={cn(a.group ? "font-semibold text-foreground" : "")}>{a.name}</span>
    ) },
    { key: "type", header: "Type", render: (a) => <Muted>{a.type}{a.group ? " · Group" : ""}</Muted> },
    { key: "parent", header: "Parent", className: "hidden lg:table-cell", render: (a) => <Muted>{currentAccounts.find((x) => x.code === a.parent)?.name ?? "—"}</Muted> },
    { key: "opening", header: "Opening", align: "right", sort: (a) => a.opening, render: (a) => (a.group ? "" : inr(a.opening)) },
    { key: "current", header: "Current balance", align: "right", sort: (a) => a.current, render: (a) => (a.group ? "" : <span className="font-medium">{inr(a.current)}</span>) },
    { key: "status", header: "Status", render: (a) => <StatusBadge status={a.status} /> },
  ];
  return (
    <>
      <SectionHeader title="Chart of accounts" description="Account hierarchy grouped by Assets, Liabilities, Equity, Income and Expenses." actions={<ExportButtons />} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          {["All", "Assets", "Liabilities", "Equity", "Income", "Expenses"].map((t) => <TabsTrigger key={t} value={t}>{t}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      {fetchError ? (
        <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <span>{fetchError}</span>
          <Button variant="outline" size="sm" onClick={() => fetchAccounts()}>Retry</Button>
        </div>
      ) : isTruncated ? (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0 text-amber-600" />
          <span>
            Showing first {apiAccounts.length} of {totalServerCount} accounts. Account hierarchy is partially loaded. Filter by account group or type to view complete sub-trees.
          </span>
        </div>
      ) : null}
      <DataTable
        rows={rows} columns={cols} getId={(a) => a.code} entity="account" pageSize={14}
        search={(a) => `${a.code} ${a.name}`} searchPlaceholder="Search by code or name"
        filters={[{ label: "Status", get: (a) => a.status }]}
        createLabel="New account"
        onSave={handleSave}
        onDelete={handleDelete}
        removeLabel="Delete"
        form={(a) => {
          const parentCurrent = a?.parent
            ? (currentAccounts.find((x) => x.code === a.parent) ? `${a.parent} · ${currentAccounts.find((x) => x.code === a.parent)?.name}` : a.parent)
            : "None";
          return (
            <FormGrid fields={[
              { label: "Account name", value: a?.name, wide: true, required: true },
              { label: "Account code", value: a?.code, required: true },
              { label: "Account type", value: a?.type || "Assets", options: ["Assets", "Liabilities", "Equity", "Income", "Expenses"] },
              { label: "Account kind", value: a?.group ? "Group" : "Ledger", options: ["Ledger", "Group"] },
              { label: "Parent account", value: parentCurrent, options: groupOptions },
              { label: "Opening balance (₹)", value: a?.opening ?? 0, type: "number" },
              { label: "Status", value: a?.status || "Active", options: ["Active", "Inactive"] },
            ]} />
          );
        }}
        detail={(a) => (
          <DetailGrid items={[["Account name", a.name], ["Code", a.code], ["Type", a.type], ["Parent", currentAccounts.find((x) => x.code === a.parent)?.name ?? "—"],
            ["Opening balance", inr(a.opening)], ["Current balance", inr(a.current)], ["Status", <StatusBadge key="s" status={a.status} />], ["Kind", a.group ? "Group" : "Ledger"]]} />
        )}
      />
    </>
  );
}

// ---------------- Journal entries ----------------
function JournalLines({ j }: { j: Journal }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <Table>
        <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
        <TableBody>
          {j.lines.map((l, i) => (
            <TableRow key={i}>
              <TableCell className={cn(l.credit ? "pl-8" : "")}>{l.credit ? "To " : ""}{l.account}</TableCell>
              <TableCell className="text-right tabular">{l.debit ? inr(l.debit) : ""}</TableCell>
              <TableCell className="text-right tabular">{l.credit ? inr(l.credit) : ""}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter><TableRow><TableCell>Total</TableCell><TableCell className="text-right tabular">{inr(j.amount)}</TableCell><TableCell className="text-right tabular">{inr(j.amount)}</TableCell></TableRow></TableFooter>
      </Table>
    </div>
  );
}
function JournalForm({ j, accountOptions = [] }: { j: Journal | null; accountOptions?: string[] }) {
  const options = accountOptions;
  const [lines, setLines] = useState(
    j?.lines && j.lines.length > 0
      ? j.lines
      : [
          { account: options[0] || "", debit: 0, credit: 0 },
          { account: options[1] || options[0] || "", debit: 0, credit: 0 },
        ]
  );
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachedFiles((prev) => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} file(s) attached`);
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const dr = sum(lines, (l) => Number(l.debit) || 0);
  const cr = sum(lines, (l) => Number(l.credit) || 0);
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <input type="hidden" name="lines_json" value={JSON.stringify(lines)} />
      <input type="hidden" name="attachments_count" value={attachedFiles.length} />
      <input type="file" ref={fileInputRef} multiple className="hidden" onChange={handleFileChange} />
      <FormGrid fields={[
        { label: "Entry number", value: j?.id ?? "Auto-generated", readOnly: true },
        { label: "Date", value: j?.iso ?? todayIso, type: "date" },
        { label: "Reference", value: j?.ref },
        { label: "Status", value: j?.status ?? "Draft", options: ["Draft", "Posted"] },
        { label: "Description", value: j?.description, wide: true },
      ]} />
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_95px_95px] sm:grid-cols-[1fr_120px_120px] gap-2 text-xs font-medium text-muted-foreground">
          <span>Account</span><span className="text-right">Debit (₹)</span><span className="text-right">Credit (₹)</span>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_95px_95px] sm:grid-cols-[1fr_120px_120px] gap-2 items-center">
            <select
              value={l.account}
              onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, account: e.target.value } : x)))}
              className="h-9 w-full min-w-0 truncate rounded-md border border-input bg-background px-2 text-xs sm:text-sm"
            >
              {options.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <Input
              type="number"
              className="h-9 min-w-0 text-right text-xs sm:text-sm"
              defaultValue={l.debit || ""}
              onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, debit: Number(e.target.value) } : x)))}
            />
            <Input
              type="number"
              className="h-9 min-w-0 text-right text-xs sm:text-sm"
              defaultValue={l.credit || ""}
              onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, credit: Number(e.target.value) } : x)))}
            />
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setLines([...lines, { account: options[0] || "1110 · Federal Bank - Current", debit: 0, credit: 0 }])}
          >
            <Plus className="size-4" /> Add line
          </Button>
          <span className={cn("text-xs font-medium tabular", dr === cr && dr > 0 ? "text-success font-semibold" : "text-destructive")}>
            Dr {inr(dr)} · Cr {inr(cr)} {dr === cr && dr > 0 ? "· Balanced ✓" : dr === 0 && cr === 0 ? "· Enter amounts" : `· Unbalanced (${inr(Math.abs(dr - cr))} diff)`}
          </span>
        </div>
      </div>
      <FormGrid fields={[{ label: "Notes", value: j?.notes, wide: true }]} />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border-strong py-3 text-sm text-muted-foreground hover:bg-muted"
      >
        <Paperclip className="size-4" /> Attach bills or supporting documents
      </button>
      {attachedFiles.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-xs font-semibold text-muted-foreground">Attached Files ({attachedFiles.length})</div>
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((file, idx) => (
              <span key={idx} className="inline-flex items-center gap-1.5 rounded bg-muted px-2.5 py-1 text-xs">
                <Paperclip className="size-3 text-muted-foreground" />
                <span className="max-w-[150px] truncate">{file.name}</span>
                <span className="text-[10px] text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                <button type="button" onClick={() => removeFile(idx)} className="ml-1 text-muted-foreground hover:text-destructive">
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
export function JournalEntries() {
  const [entryRows, setEntryRows] = useState<Journal[]>([]);
  const [accountOptions, setAccountOptions] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const loadJournalEntries = (p = page, q = searchQuery, status = statusFilter, size = pageSize) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    const params: Record<string, any> = {
      page: p + 1, // DRF 1-indexed
      page_size: size,
    };
    if (q.trim()) params["q"] = q.trim();
    if (status && status !== "all") params["status"] = status;

    api.get<any>("/finance/journal-entries/", params, { signal: controller.signal })
      .then((res) => {
        const count = res?.count ?? (Array.isArray(res) ? res.length : 0);
        setTotalCount(count);
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const mapped: Journal[] = list.map((j: any) => ({
          id: j.entry_number || `JV-${j.id}`,
          date: j.date || j.entry_date || new Date().toISOString().slice(0, 10),
          iso: j.date || j.entry_date || new Date().toISOString().slice(0, 10),
          ref: j.reference_number || "—",
          description: j.narration || "Journal entry",
          amount: Number(j.total_debit) || Number(j.total_amount) || 0,
          status: (j.status ?? "Draft") as Journal["status"],
          attachments: Number(j.attachments_count || 0),
          notes: j.narration || "",
          lines: (j.lines || []).map((l: any) => ({
            account: l.account_name || l.account_code || `Account #${l.account}`,
            debit: Number(l.debit_amount) || 0,
            credit: Number(l.credit_amount) || 0,
          })),
        }));
        setEntryRows(mapped);
      })
      .catch((err: any) => {
        if (err?.name === "AbortError") return;
        setEntryRows([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    api.get<any>("/finance/accounts/", { page_size: 100 })
      .then((accRes) => {
        const accList = Array.isArray(accRes) ? accRes : (accRes?.results ?? []);
        const nonGroups = accList.filter((a: any) => !a.is_group).map((a: any) => `${a.code} · ${a.name}`);
        if (nonGroups.length > 0) {
          setAccountOptions(nonGroups);
        }
      })
      .catch(() => {});

    loadJournalEntries(0, "", "all", 25);
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const handleSave = async (formData: Record<string, any>, existing: Journal | null) => {
    let linesRaw: Array<{ account: string; debit: number; credit: number }> = [];
    if (formData["lines_json"]) {
      try {
        linesRaw = JSON.parse(formData["lines_json"]);
      } catch {
        linesRaw = [];
      }
    }
    const linesPayload = linesRaw
      .map((l, idx) => {
        const rawCode = l.account?.includes("·") ? (l.account.split("·")[0]?.trim() ?? l.account) : (l.account ?? "");
        const accCode = rawCode;
        return {
          line_number: idx + 1,
          account: accCode,
          debit_amount: (Number(l.debit) || 0).toFixed(2),
          credit_amount: (Number(l.credit) || 0).toFixed(2),
          description: formData["Description"] || "",
        };
      })
      .filter((l) => Number(l.debit_amount) > 0 || Number(l.credit_amount) > 0);

    if (linesPayload.length < 2) {
      toast.error("A journal entry requires at least two lines (at least one debit and one credit)");
      return false;
    }

    const totalDebit = linesRaw.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCredit = linesRaw.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      toast.error(`Entry is not balanced: Total Debit (${inr(totalDebit)}) must equal Total Credit (${inr(totalCredit)}). Difference: ${inr(Math.abs(totalDebit - totalCredit))}`);
      return false;
    }

    const payload = {
      date: formData["Date"] || new Date().toISOString().slice(0, 10),
      narration: formData["Description"] || "",
      status: formData["Status"] || "Draft",
      lines: linesPayload,
    };

    try {
      const res = await api.post<any>("/finance/journal-entries/", payload);
      toast.success(existing ? "Journal entry updated" : `Journal entry ${res?.entry_number || "created"}`);
      loadJournalEntries();
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to save journal entry");
      return false;
    }
  };

  const cols: Column<Journal>[] = [
    { key: "id", header: "Entry no.", sort: (j) => j.id, render: (j) => <span className="font-medium">{j.id}</span> },
    { key: "date", header: "Date", sort: (j) => j.iso, render: (j) => <Muted>{j.date}</Muted> },
    { key: "ref", header: "Reference", className: "hidden 2xl:table-cell", render: (j) => <Muted>{j.ref}</Muted> },
    { key: "desc", header: "Description", render: (j) => <span className="block max-w-48 truncate">{j.description}</span> },
    { key: "drcr", header: "Debit / Credit", className: "hidden lg:table-cell", render: (j) => <div className="text-xs leading-5"><div><span className="font-semibold text-success">Dr</span> {j.lines[0]?.account}</div><div><span className="font-semibold text-destructive">Cr</span> <Muted>{j.lines[1]?.account}</Muted></div></div> },
    { key: "amount", header: "Amount", align: "right", sort: (j) => j.amount, render: (j) => inr(j.amount) },
    { key: "att", header: "", className: "hidden md:table-cell", render: (j) => (j.attachments ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Paperclip className="size-3" />{j.attachments}</span> : null) },
    { key: "status", header: "Status", render: (j) => <StatusBadge status={j.status} /> },
  ];
  return (
    <>
      <SectionHeader title="Journal entries" description="Double-entry vouchers with debit and credit lines." actions={<ExportButtons />} />
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Total vouchers" value={String(totalCount)} />
        <KpiCard label="Posted value (page)" value={inr(sum(entryRows.filter((j) => j.status === "Posted"), (j) => j.amount))} />
        <KpiCard label="Drafts (page)" value={String(entryRows.filter((j) => j.status === "Draft").length)} hint="Awaiting approval" />
        <KpiCard label="Voided (page)" value={String(entryRows.filter((j) => j.status === "Void").length)} />
      </div>
      <DataTable
        rows={entryRows}
        columns={cols}
        getId={(j) => j.id}
        entity="journal entry"
        removeLabel="Void"
        searchPlaceholder="Search entry, reference or account"
        filters={[{ label: "Status", get: (j) => j.status, options: ["Draft", "Posted", "Void"] }]}
        createLabel="New journal entry"
        form={(j) => <JournalForm j={j} accountOptions={accountOptions} />}
        onSave={handleSave}
        detail={(j) => (
          <div className="space-y-4">
            <DetailGrid items={[["Date", j.date], ["Reference", j.ref], ["Description", j.description], ["Status", <StatusBadge key="s" status={j.status} />], ["Notes", j.notes || "—"], ["Attachments", `${j.attachments} file(s)`]]} />
            <JournalLines j={j} />
          </div>
        )}
        serverSide={{
          totalCount,
          page,
          pageSize,
          loading,
          onPageChange: (newPage) => {
            setPage(newPage);
            loadJournalEntries(newPage, searchQuery, statusFilter, pageSize);
          },
          onPageSizeChange: (newSize) => {
            setPageSize(newSize);
            setPage(0);
            loadJournalEntries(0, searchQuery, statusFilter, newSize);
          },
          onSearchChange: (newQ) => {
            setSearchQuery(newQ);
            setPage(0);
            loadJournalEntries(0, newQ, statusFilter, pageSize);
          },
          onFilterChange: (newFv) => {
            const nextStatus = newFv["Status"] || "all";
            setStatusFilter(nextStatus);
            setPage(0);
            loadJournalEntries(0, searchQuery, nextStatus, pageSize);
          },
        }}
      />
    </>
  );
}

// ---------------- Cash & bank ----------------
type BankTxn = {
  id: string;
  date: string;
  iso: string;
  account: string;
  description: string;
  ref: string;
  debit: number;
  credit: number;
  status: string;
};
type Transfer = (typeof transfers)[number];
export function CashBank() {
  const [recon, setRecon] = useState<Record<string, boolean>>({});
  const [bankList, setBankList] = useState<any[]>([]);
  const [cashList, setCashList] = useState<any[]>([]);
  const [transferRows, setTransferRows] = useState<Transfer[]>([]);
  const [txns, setTxns] = useState<BankTxn[]>([]);
  const stmtInputRef = useRef<HTMLInputElement>(null);

  const fetchAccounts = () => {
    Promise.allSettled([
      api.get<any>("/finance/bank-accounts/"),
      api.get<any>("/finance/cash-accounts/"),
      api.get<any>("/finance/journal-entries/"),
    ]).then(([banksRes, cashRes, jnlRes]) => {
      let bNames: string[] = [];
      let cNames: string[] = [];
      if (banksRes.status === "fulfilled") {
        const list = Array.isArray(banksRes.value) ? banksRes.value : (banksRes.value?.results ?? []);
        bNames = list.map((b: any) => b.bank_name || b.name);
        setBankList(list.map((b: any) => ({
          id: String(b.id),
          bank: b.bank_name || b.name,
          type: b.account_type || "Current",
          accNo: b.account_number ? `···· ${b.account_number.slice(-4)}` : "—",
          ifsc: b.ifsc_code || "—",
          branch: b.branch_name || "Main",
          balance: Number(b.balance ?? 0),
          reconciled: "Live",
        })));
      }

      if (cashRes.status === "fulfilled") {
        const list = Array.isArray(cashRes.value) ? cashRes.value : (cashRes.value?.results ?? []);
        cNames = list.map((c: any) => c.name);
        setCashList(list.map((c: any) => ({
          id: String(c.id),
          name: c.name,
          custodian: c.custodian || "Cashier",
          balance: Number(c.balance ?? 0),
        })));
      }

      if (jnlRes.status === "fulfilled") {
        const list = Array.isArray(jnlRes.value) ? jnlRes.value : (jnlRes.value?.results ?? []);
        const allKeywords = [...bNames, ...cNames, "bank", "cash"];
        const txnList: BankTxn[] = [];
        list.forEach((j: any) => {
          (j.lines || []).forEach((l: any, idx: number) => {
            const acc = l.account_name || l.account_code || "";
            const isMatch = allKeywords.some((k) => acc.toLowerCase().includes(k.toLowerCase()));
            if (isMatch) {
              txnList.push({
                id: `TXN-${j.id}-${idx}`,
                date: j.date || j.entry_date || new Date().toISOString().slice(0, 10),
                iso: j.date || j.entry_date || new Date().toISOString().slice(0, 10),
                account: acc,
                description: j.narration || "Bank / Cash transaction",
                ref: j.reference_number || "—",
                debit: Number(l.debit_amount) || 0,
                credit: Number(l.credit_amount) || 0,
                status: "Reconciled",
              });
            }
          });
        });
        setTxns(txnList);
      }
    });
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const unrec = txns.filter((t) => t.status === "Unreconciled");
  const accountOptions = [...cashList.map((c) => c.name), ...bankList.map((b) => b.bank)];

  const handleStatementUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.success(`Statement "${file.name}" uploaded. Processing reconciliation...`);
    }
  };

  const handleTransferSave = async (formData: Record<string, any>) => {
    const from = formData["From account"];
    const to = formData["To account"];
    const amount = Number(formData["Amount (₹)"]) || 0;
    const date = formData["Date"] || new Date().toISOString().slice(0, 10);
    const mode = formData["Mode"] || "NEFT";

    if (!from || !to || amount <= 0) {
      toast.error("Please specify both accounts and a valid amount");
      return false;
    }
    if (from === to) {
      toast.error("Source and destination accounts must be different");
      return false;
    }

    const payload = {
      date,
      narration: `Funds transfer from ${from} to ${to} via ${mode}`,
      status: "Posted",
      lines: [
        { line_number: 1, account: to, debit_amount: amount.toFixed(2), credit_amount: "0.00", description: `Transfer received from ${from}` },
        { line_number: 2, account: from, debit_amount: "0.00", credit_amount: amount.toFixed(2), description: `Transfer sent to ${to}` },
      ],
    };

    try {
      await api.post("/finance/journal-entries/", payload);
      const newTransfer: Transfer = {
        id: `TRF-${Date.now().toString().slice(-4)}`,
        date: new Date(date).toLocaleDateString(),
        iso: date,
        from,
        to,
        amount,
        mode,
        status: "Completed",
      };
      setTransferRows((prev) => [newTransfer, ...prev]);
      toast.success(`Transfer of ${inr(amount)} recorded successfully`);
      fetchAccounts();
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to record transfer in journal");
      return false;
    }
  };

  return (
    <>
      <SectionHeader title="Cash & bank" description="Cash accounts, bank accounts, transactions and transfers." actions={<ExportButtons />} />
      <Tabs defaultValue="accounts">
        <TabsList><TabsTrigger value="accounts">Accounts</TabsTrigger><TabsTrigger value="txns">Transactions</TabsTrigger><TabsTrigger value="transfers">Transfers</TabsTrigger><TabsTrigger value="recon">Reconciliation</TabsTrigger></TabsList>
        <TabsContent value="accounts" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard label="Total cash" value={inr(sum(cashList, (c) => c.balance || 0))} />
            <KpiCard label="Total bank" value={inr(sum(bankList, (b) => b.balance || 0))} />
            <KpiCard label="Unreconciled items" value={String(unrec.length)} hint={inr(sum(unrec, (t) => t.debit + t.credit))} tone="down" />
          </div>
          {bankList.length === 0 && cashList.length === 0 ? (
            <Panel bodyClassName="p-8 text-center text-sm text-muted-foreground">
              No cash or bank accounts found. Configure bank accounts in setup.
            </Panel>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {bankList.map((b) => (
                <Panel key={b.id} bodyClassName="p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold"><Landmark className="size-4 text-accent" />{b.bank}</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{b.branch}</p>
                  <p className={cn("mt-3 text-lg font-semibold tabular", b.balance < 0 && "text-destructive")}>{inr(b.balance)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{b.type} · {b.accNo} · {b.ifsc}</p>
                </Panel>
              ))}
              {cashList.map((c) => (
                <Panel key={c.id} bodyClassName="p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold"><Wallet className="size-4 text-accent" />{c.name}</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">Custodian: {c.custodian}</p>
                  <p className="mt-3 text-lg font-semibold tabular">{inr(c.balance)}</p>
                </Panel>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="txns" className="mt-4">
          <DataTable<BankTxn> rows={txns} getId={(t) => t.id} entity="transaction" removeLabel={null}
            search={(t) => `${t.id} ${t.description} ${t.ref}`} filters={[{ label: "Accounts", get: (t) => t.account ?? "" }, { label: "Status", get: (t) => t.status }]}
            columns={[
              { key: "date", header: "Date", sort: (t) => t.iso, render: (t) => <Muted>{t.date}</Muted> },
              { key: "acc", header: "Account", render: (t) => t.account },
              { key: "desc", header: "Description", render: (t) => <span className="block max-w-64 truncate">{t.description}</span> },
              { key: "ref", header: "Reference", className: "hidden xl:table-cell", render: (t) => <Muted>{t.ref}</Muted> },
              { key: "wd", header: "Withdrawal", align: "right", sort: (t) => t.debit, render: (t) => (t.debit ? <span className="text-destructive">{inr(t.debit)}</span> : "") },
              { key: "dp", header: "Deposit", align: "right", sort: (t) => t.credit, render: (t) => (t.credit ? <span className="text-success">{inr(t.credit)}</span> : "") },
              { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
            ]}
            detail={(t) => <DetailGrid items={[["Date", t.date], ["Account", t.account], ["Description", t.description], ["Reference", t.ref], ["Amount", inr(t.debit || t.credit)], ["Status", t.status]]} />}
          />
        </TabsContent>
        <TabsContent value="transfers" className="mt-4">
          <DataTable<Transfer> rows={transferRows} getId={(t) => t.id} entity="transfer" removeLabel="Void"
            search={(t) => `${t.id} ${t.from} ${t.to}`} filters={[{ label: "Status", get: (t) => t.status }]}
            createLabel="New transfer"
            onSave={handleTransferSave}
            form={(t) => <FormGrid fields={[{ label: "From account", value: t?.from, options: accountOptions, required: true }, { label: "To account", value: t?.to, options: accountOptions, required: true }, { label: "Date", value: t?.iso ?? new Date().toISOString().slice(0, 10), type: "date" }, { label: "Amount (₹)", value: t?.amount, type: "number", required: true }, { label: "Mode", value: t?.mode || "NEFT", options: ["NEFT", "RTGS", "IMPS", "Cash deposit", "Cash withdrawal"] }]} />}
            columns={[
              { key: "id", header: "Transfer", render: (t) => <span className="font-medium">{t.id}</span> },
              { key: "date", header: "Date", sort: (t) => t.iso, render: (t) => <Muted>{t.date}</Muted> },
              { key: "route", header: "From → To", render: (t) => <span className="inline-flex items-center gap-1.5">{t.from}<ArrowRightLeft className="size-3 text-muted-foreground" />{t.to}</span> },
              { key: "mode", header: "Mode", render: (t) => <Muted>{t.mode}</Muted> },
              { key: "amt", header: "Amount", align: "right", sort: (t) => t.amount, render: (t) => inr(t.amount) },
              { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
            ]}
          />
        </TabsContent>
        <TabsContent value="recon" className="mt-4">
          <Panel
            title="Bank reconciliation"
            description="Tick entries that appear on the bank statement. Statement import processes CSV/PDF."
            actions={
              <>
                <input type="file" ref={stmtInputRef} className="hidden" accept=".csv,.xlsx,.xls,.pdf" onChange={handleStatementUpload} />
                <Button size="sm" variant="outline" onClick={() => stmtInputRef.current?.click()}>Upload statement</Button>
              </>
            }
            bodyClassName="p-0"
          >
            {unrec.length === 0 ? <div className="p-5"><EmptyState title="All caught up" description="Every bank entry is reconciled." /></div> : (
              <Table>
                <TableHeader><TableRow><TableHead className="w-10" /><TableHead>Date</TableHead><TableHead>Account</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {unrec.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell><input type="checkbox" aria-label={`Reconcile ${t.id}`} checked={!!recon[t.id]} onChange={(e) => setRecon({ ...recon, [t.id]: e.target.checked })} className="size-4 accent-[var(--color-accent)]" /></TableCell>
                      <TableCell className="text-muted-foreground">{t.date}</TableCell><TableCell>{t.account}</TableCell><TableCell>{t.description}</TableCell>
                      <TableCell className="text-right tabular">{inr(t.debit || t.credit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="flex justify-end border-t border-border p-3">
              <Button size="sm" disabled={!Object.values(recon).some(Boolean)} onClick={() => { toast.success(`${Object.values(recon).filter(Boolean).length} entries marked reconciled`); setRecon({}); }}>Mark reconciled</Button>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </>
  );
}

// ---------------- Receipts / Payments / Expenses / Income ----------------
type Receipt = {
  id: string;
  date: string;
  iso: string;
  party: string;
  place: string;
  mode: string;
  ref: string;
  account: string;
  against: string;
  amount: number;
  status: "Cleared" | "Pending" | "Bounced";
};
export function Receipts() {
  const [receiptRows, setReceiptRows] = useState<Receipt[]>([]);
  const [customerNames, setCustomerNames] = useState<string[]>([]);
  const [depositOptions, setDepositOptions] = useState<string[]>([]);

  const fetchReceipts = () => {
    Promise.allSettled([
      api.get<any>("/sales/payments/"),
      api.get<any>("/sales/customers/"),
      api.get<any>("/finance/bank-accounts/"),
      api.get<any>("/finance/cash-accounts/"),
    ]).then(([payRes, custRes, bankRes, cashRes]) => {
      if (payRes.status === "fulfilled") {
        const list = Array.isArray(payRes.value) ? payRes.value : (payRes.value?.results ?? []);
        const mapped: Receipt[] = list.map((p: any) => ({
          id: p.payment_number || `REC-${p.id}`,
          date: p.payment_date || new Date().toISOString().slice(0, 10),
          iso: p.payment_date || new Date().toISOString().slice(0, 10),
          party: p.customer_name || p.customer?.name || "Customer",
          place: p.place || "Kerala, India",
          mode: p.payment_method || "NEFT",
          ref: p.reference_number || "—",
          account: p.deposit_account || "Federal Bank - Current",
          against: p.invoice_number || "—",
          amount: Number(p.amount) || 0,
          status: (p.status === "cleared" ? "Cleared" : p.status === "bounced" ? "Bounced" : "Pending") as Receipt["status"],
        }));
        setReceiptRows(mapped);
      }
      if (custRes.status === "fulfilled") {
        const custList = Array.isArray(custRes.value) ? custRes.value : (custRes.value?.results ?? []);
        setCustomerNames(custList.map((c: any) => c.name || c.company_name));
      }
      const bList = bankRes.status === "fulfilled" && Array.isArray(bankRes.value) ? bankRes.value.map((b: any) => b.bank_name || b.name) : [];
      const cList = cashRes.status === "fulfilled" && Array.isArray(cashRes.value) ? cashRes.value.map((c: any) => c.name) : [];
      if (bList.length || cList.length) {
        setDepositOptions([...bList, ...cList]);
      }
    });
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  const handleSave = async (formData: Record<string, any>) => {
    const payload = {
      amount: Number(formData["Amount (₹)"]) || 0,
      payment_method: formData["Mode"] || "NEFT",
      reference_number: formData["Payment reference / UTR"] || "",
      payment_date: formData["Date"] || new Date().toISOString().slice(0, 10),
    };
    try {
      await api.post("/sales/payments/", payload);
      toast.success("Receipt recorded successfully");
      fetchReceipts();
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to record receipt");
      return false;
    }
  };

  const currentBankList = depositOptions;
  const currentCustList = customerNames;

  return (
    <>
      <SectionHeader title="Receipts" description="Money received from customers against invoices." />
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Received" value={inr(sum(receiptRows.filter((r) => r.status === "Cleared"), (r) => r.amount))} hint={<span className="inline-flex items-center gap-1"><ArrowDownLeft className="size-3" /> Money in</span>} tone="up" />
        <KpiCard label="Pending clearance" value={inr(sum(receiptRows.filter((r) => r.status === "Pending"), (r) => r.amount))} />
        <KpiCard label="Bounced cheques" value={String(receiptRows.filter((r) => r.status === "Bounced").length)} tone="down" hint="Follow up required" />
        <KpiCard label="Total receipts" value={String(receiptRows.length)} />
      </div>
      <DataTable<Receipt> rows={receiptRows} getId={(r) => r.id} entity="receipt" removeLabel="Void"
        search={(r) => `${r.id} ${r.party} ${r.ref} ${r.against}`} searchPlaceholder="Search receipt, customer or UTR"
        filters={[{ label: "Modes", get: (r) => r.mode }, { label: "Status", get: (r) => r.status }]}
        createLabel="New receipt"
        onSave={handleSave}
        form={(r) => <FormGrid fields={[{ label: "Customer", value: r?.party, options: currentCustList, wide: true }, { label: "Date", value: r?.iso ?? new Date().toISOString().slice(0, 10), type: "date" }, { label: "Amount (₹)", value: r?.amount, type: "number" }, { label: "Mode", value: r?.mode, options: ["NEFT", "RTGS", "UPI", "IMPS", "Cheque", "Cash"] }, { label: "Deposit to", value: r?.account, options: currentBankList }, { label: "Payment reference / UTR", value: r?.ref }, { label: "Against invoice", value: r?.against }]} />}
        detail={(r) => <DetailGrid items={[["Customer", `${r.party}, ${r.place}`], ["Date", r.date], ["Amount", inr(r.amount)], ["Mode", r.mode], ["Reference", r.ref], ["Deposited to", r.account], ["Against", r.against], ["Status", <StatusBadge key="s" status={r.status} />]]} />}
        columns={[
          { key: "id", header: "Receipt", sort: (r) => r.id, render: (r) => <span className="font-medium">{r.id}</span> },
          { key: "date", header: "Date", sort: (r) => r.iso, render: (r) => <Muted>{r.date}</Muted> },
          { key: "party", header: "Customer", sort: (r) => r.party, render: (r) => <div><div>{r.party}</div><div className="text-xs text-muted-foreground">{r.place}</div></div> },
          { key: "mode", header: "Mode", render: (r) => r.mode },
          { key: "ref", header: "Reference", className: "hidden xl:table-cell", render: (r) => <Muted>{r.ref}</Muted> },
          { key: "acc", header: "Deposited to", className: "hidden lg:table-cell", render: (r) => <Muted>{r.account}</Muted> },
          { key: "amt", header: "Amount", align: "right", sort: (r) => r.amount, render: (r) => <span className="font-medium">{inr(r.amount)}</span> },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
    </>
  );
}

type Payment = {
  id: string;
  date: string;
  iso: string;
  party: string;
  category: string;
  mode: string;
  ref: string;
  account: string;
  amount: number;
  status: "Completed" | "Pending" | "Void";
};
export function Payments() {
  const [paymentRows, setPaymentRows] = useState<Payment[]>([]);
  const [bankAccountOptions, setBankAccountOptions] = useState<string[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<string[]>([]);

  const fetchPayments = () => {
    Promise.allSettled([
      api.get<any>("/purchases/bills/"),
      api.get<any>("/finance/bank-accounts/"),
      api.get<any>("/finance/cash-accounts/"),
      api.get<any>("/parties/suppliers/"),
    ]).then(([billsRes, bankRes, cashRes, suppRes]) => {
      if (billsRes.status === "fulfilled") {
        const list = Array.isArray(billsRes.value) ? billsRes.value : (billsRes.value?.results ?? []);
        const mapped: Payment[] = list
          .filter((b: any) => Number(b.paid_amount || 0) > 0)
          .map((b: any) => ({
            id: `PMT-${b.code || b.id}`,
            date: b.bill_date || new Date().toISOString().slice(0, 10),
            iso: b.bill_date || new Date().toISOString().slice(0, 10),
            party: b.supplier_name || b.supplier?.name || "Supplier",
            category: "Supplier",
            mode: "NEFT",
            ref: b.supplier_bill_no || "—",
            account: "Federal Bank - Current",
            amount: Number(b.paid_amount) || 0,
            status: "Completed",
          }));
        setPaymentRows(mapped);
      }
      const bList = bankRes.status === "fulfilled" && Array.isArray(bankRes.value) ? bankRes.value.map((b: any) => b.bank_name || b.name) : [];
      const cList = cashRes.status === "fulfilled" && Array.isArray(cashRes.value) ? cashRes.value.map((c: any) => c.name) : [];
      if (bList.length || cList.length) {
        setBankAccountOptions([...bList, ...cList]);
      }
      if (suppRes.status === "fulfilled") {
        const sList = Array.isArray(suppRes.value) ? suppRes.value : (suppRes.value?.results ?? []);
        setSupplierOptions(sList.map((s: any) => s.name));
      }
    }).catch(() => {
      setPaymentRows([]);
    });
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleSave = async (formData: Record<string, any>) => {
    const amt = Number(formData["Amount (₹)"]) || 0;
    if (amt <= 0) {
      toast.error("Payment amount must be greater than zero.");
      return false;
    }
    const payee = formData["Payee"] || "Vendor";
    const mode = formData["Mode"] || "NEFT";
    const ref = formData["Payment reference"] || "";
    const date = formData["Date"] || new Date().toISOString().slice(0, 10);
    const cat = formData["Category"] || "Supplier";

    const debitAccount = cat === "Supplier" ? "2110" : cat === "Expense" ? "5200" : cat === "Salary" ? "2130" : "2140";
    const creditAccount = mode === "Cash" ? "1110" : "1120";

    const payload = {
      entry_type: "Payment",
      date,
      narration: `Payment to ${payee} (${cat}) via ${mode} ref:${ref}`,
      lines: [
        {
          line_number: 1,
          account: debitAccount,
          debit_amount: amt.toFixed(2),
          credit_amount: "0.00",
          description: `Payment to ${payee}`,
        },
        {
          line_number: 2,
          account: creditAccount,
          debit_amount: "0.00",
          credit_amount: amt.toFixed(2),
          description: `Paid from ${formData["Paid from"] || mode}`,
        },
      ],
    };

    try {
      await api.post("/finance/journal-entries/", payload);
      toast.success(`Payment of ${inr(amt)} to ${payee} recorded successfully.`);
      fetchPayments();
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to record payment transaction.");
      return false;
    }
  };

  const by = (c: string) => sum(paymentRows.filter((p) => p.category === c && p.status !== "Void"), (p) => p.amount);
  const currentBankList = bankAccountOptions.length > 0 ? bankAccountOptions : ["Federal Bank - Current", "State Bank of India", "Cash in Hand"];
  const currentPayeeList = supplierOptions.length > 0 ? supplierOptions : ["Apex Materials", "Kerala Tech Printers", "Malabar Paper Mills"];

  return (
    <>
      <SectionHeader title="Payments" description="Money paid to suppliers, staff, tax authorities and for expenses." />
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Supplier payments" value={inr(by("Supplier"))} hint={<span className="inline-flex items-center gap-1"><ArrowUpRight className="size-3" /> Money out</span>} />
        <KpiCard label="Expense payments" value={inr(by("Expense"))} />
        <KpiCard label="Salary & tax" value={inr(by("Salary") + by("Tax"))} />
        <KpiCard label="Pending approval" value={String(paymentRows.filter((p) => p.status === "Pending").length)} tone="down" hint="Needs sign-off" />
      </div>
      <DataTable<Payment> rows={paymentRows} getId={(p) => p.id} entity="payment" removeLabel="Void"
        search={(p) => `${p.id} ${p.party} ${p.ref}`} searchPlaceholder="Search payment, payee or UTR"
        filters={[{ label: "Categories", get: (p) => p.category }, { label: "Status", get: (p) => p.status }]}
        createLabel="New payment"
        onSave={handleSave}
        form={(p) => <FormGrid fields={[{ label: "Payee", value: p?.party, options: currentPayeeList, wide: true }, { label: "Category", value: p?.category, options: ["Supplier", "Expense", "Salary", "Tax"] }, { label: "Date", value: p?.iso ?? new Date().toISOString().slice(0, 10), type: "date" }, { label: "Amount (₹)", value: p?.amount, type: "number" }, { label: "Mode", value: p?.mode, options: ["NEFT", "RTGS", "UPI", "Cheque", "Cash"] }, { label: "Paid from", value: p?.account, options: currentBankList }, { label: "Payment reference", value: p?.ref }]} />}
        detail={(p) => <DetailGrid items={[["Payee", p.party], ["Category", p.category], ["Date", p.date], ["Amount", inr(p.amount)], ["Mode", p.mode], ["Reference", p.ref], ["Paid from", p.account], ["Status", <StatusBadge key="s" status={p.status} />]]} />}
        columns={[
          { key: "id", header: "Payment", sort: (p) => p.id, render: (p) => <span className="font-medium">{p.id}</span> },
          { key: "date", header: "Date", sort: (p) => p.iso, render: (p) => <Muted>{p.date}</Muted> },
          { key: "party", header: "Payee", sort: (p) => p.party, render: (p) => p.party },
          { key: "cat", header: "Category", render: (p) => <Muted>{p.category}</Muted> },
          { key: "mode", header: "Mode", className: "hidden lg:table-cell", render: (p) => p.mode },
          { key: "ref", header: "Reference", className: "hidden xl:table-cell", render: (p) => <Muted>{p.ref}</Muted> },
          { key: "amt", header: "Amount", align: "right", sort: (p) => p.amount, render: (p) => <span className="font-medium">{inr(p.amount)}</span> },
          { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
        ]}
      />
    </>
  );
}

export type PaymentBatchRow = {
  id: string;
  batch_number: string;
  bank_name: string;
  payment_method: string;
  total_amount: number;
  item_count: number;
  status: "Draft" | "Submitted" | "Approved" | "Exported" | "Cancelled";
  export_count: number;
  created_at: string;
  iso: string;
};

export function PaymentBatches() {
  const [batches, setBatches] = useState<PaymentBatchRow[]>([]);
  const [bankList, setBankList] = useState<{ id: number; name: string }[]>([]);

  const fetchBatches = () => {
    Promise.allSettled([
      api.get<any>("/finance/payment-batches/"),
      api.get<any>("/finance/bank-accounts/"),
    ]).then(([batchesRes, bankRes]) => {
      if (batchesRes.status === "fulfilled") {
        const list = Array.isArray(batchesRes.value) ? batchesRes.value : (batchesRes.value?.results ?? []);
        const mapped: PaymentBatchRow[] = list.map((b: any) => ({
          id: String(b.id),
          batch_number: b.batch_number || `BATCH-${b.id}`,
          bank_name: b.bank_account_name || b.bank_account?.bank_name || "Primary Bank",
          payment_method: b.payment_method || "NEFT",
          total_amount: Number(b.total_amount) || 0,
          item_count: Number(b.item_count) || 0,
          status: (b.status || "Draft") as PaymentBatchRow["status"],
          export_count: Number(b.export_count) || 0,
          created_at: b.created_at ? b.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
          iso: b.created_at ? b.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
        }));
        setBatches(mapped);
      }
      if (bankRes.status === "fulfilled") {
        const list = Array.isArray(bankRes.value) ? bankRes.value : (bankRes.value?.results ?? []);
        setBankList(list.map((b: any) => ({ id: b.id, name: b.bank_name || b.name })));
      }
    });
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleDownloadFile = async (batchId: string, batchNumber: string) => {
    try {
      const res = await fetch(`/api/v1/finance/payment-batches/${batchId}/download-file/`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || "Export download failed");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bank_payment_batch_${batchNumber}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(`Bank execution file for batch ${batchNumber} downloaded.`);
      fetchBatches();
    } catch (err: any) {
      toast.error(err?.message || "Failed to download bank execution file.");
    }
  };

  const handleSave = async (formData: Record<string, any>) => {
    const bankName = formData["Bank Account"];
    const matchedBank = bankList.find((b) => b.name === bankName) || bankList[0];
    const payload = {
      bank_account: matchedBank?.id || 1,
      payment_method: formData["Payment Method"] || "NEFT",
      notes: formData["Notes"] || "",
    };
    try {
      await api.post("/finance/payment-batches/", payload);
      toast.success("Payment batch created successfully.");
      fetchBatches();
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to create payment batch.");
      return false;
    }
  };

  return (
    <>
      <SectionHeader title="Bank Payment Batches" description="Maker-checker bulk payment processing and authorized banking portal file generation." />
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Total Batches" value={String(batches.length)} />
        <KpiCard label="Draft" value={String(batches.filter((b) => b.status === "Draft").length)} />
        <KpiCard label="Approved" value={String(batches.filter((b) => b.status === "Approved").length)} tone="up" hint="Ready for export" />
        <KpiCard label="Exported" value={String(batches.filter((b) => b.status === "Exported").length)} hint="Uploaded to bank" />
      </div>
      <DataTable<PaymentBatchRow>
        rows={batches}
        getId={(b) => b.id}
        entity="payment batch"
        search={(b) => `${b.batch_number} ${b.bank_name}`}
        searchPlaceholder="Search batch number or bank"
        filters={[{ label: "Status", get: (b) => b.status }]}
        createLabel="New batch"
        onSave={handleSave}
        form={() => (
          <FormGrid
            fields={[
              { label: "Bank Account", options: bankList.map((b) => b.name), wide: true },
              { label: "Payment Method", options: ["NEFT", "RTGS", "IMPS"] },
              { label: "Notes", wide: true },
            ]}
          />
        )}
        extraActions={[
          {
            label: "Submit for Approval",
            icon: <Send className="size-4" />,
            show: (b) => b.status === "Draft",
            onClick: async (b) => {
              try {
                await api.post(`/finance/payment-batches/${b.id}/submit_for_approval/`);
                toast.success(`Batch ${b.batch_number} submitted for approval.`);
                fetchBatches();
              } catch (err: any) {
                toast.error(err?.error?.message || err?.message || "Failed to submit batch.");
              }
            },
          },
          {
            label: "Approve (Checker)",
            icon: <CheckCircle2 className="size-4 text-emerald-600" />,
            show: (b) => b.status === "Submitted",
            onClick: async (b) => {
              try {
                await api.post(`/finance/payment-batches/${b.id}/approve/`);
                toast.success(`Batch ${b.batch_number} approved successfully.`);
                fetchBatches();
              } catch (err: any) {
                toast.error(err?.error?.message || err?.message || "Failed to approve batch. Self-approval is barred.");
              }
            },
          },
          {
            label: "Download Bank File",
            icon: <FileSpreadsheet className="size-4 text-blue-600" />,
            show: (b) => b.status === "Approved" || b.status === "Exported",
            onClick: (b) => handleDownloadFile(b.id, b.batch_number),
          },
        ]}
        columns={[
          { key: "num", header: "Batch Number", sort: (b) => b.batch_number, render: (b) => <span className="font-mono font-medium">{b.batch_number}</span> },
          { key: "bank", header: "Disbursing Bank", render: (b) => b.bank_name },
          { key: "method", header: "Method", render: (b) => b.payment_method },
          { key: "items", header: "Bills", align: "right", sort: (b) => b.item_count, render: (b) => b.item_count },
          { key: "amt", header: "Total Amount", align: "right", sort: (b) => b.total_amount, render: (b) => <span className="font-medium">{inr(b.total_amount)}</span> },
          { key: "status", header: "Status", render: (b) => <StatusBadge status={b.status === "Approved" ? "approved" : b.status === "Exported" ? "completed" : b.status === "Submitted" ? "pending" : "active"} label={b.status} /> },
          { key: "date", header: "Created", sort: (b) => b.iso, render: (b) => <Muted>{b.created_at}</Muted> },
        ]}
      />
    </>
  );
}

type Expense = {
  id: string;
  date: string;
  iso: string;
  category: string;
  vendor: string;
  account: string;
  amount: number;
  gst: number;
  status: "Paid" | "Pending";
};
export function Expenses() {
  const [expenseRows, setExpenseRows] = useState<Expense[]>([]);
  const cats = Array.from(new Set(expenseRows.map((e) => e.category))).map((c) => ({ c, v: sum(expenseRows.filter((e) => e.category === c), (e) => e.amount) })).sort((a, b) => b.v - a.v);
  const total = sum(expenseRows, (e) => e.amount);
  return (
    <>
      <SectionHeader title="Expenses" description="Operating expenses with GST input where applicable." />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid gap-4 sm:grid-cols-3 xl:col-span-2 xl:grid-cols-3">
          <KpiCard label="Total expenses" value={inr(total)} />
          <KpiCard label="GST input on expenses" value={inr(sum(expenseRows, (e) => e.gst))} />
          <KpiCard label="Unpaid" value={String(expenseRows.filter((e) => e.status === "Pending").length)} tone="down" />
        </div>
        <Panel title="By category" bodyClassName="space-y-2 p-4">
          {cats.length === 0 ? (
            <p className="text-xs text-muted-foreground">No expenses recorded.</p>
          ) : (
            cats.slice(0, 4).map(({ c, v }) => (
              <div key={c} className="text-xs">
                <div className="flex justify-between"><span>{c}</span><span className="tabular text-muted-foreground">{inr(v)}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{ width: `${(v / (cats[0]?.v || 1)) * 100}%` }} /></div>
              </div>
            ))
          )}
        </Panel>
      </div>
      <DataTable<Expense> rows={expenseRows} getId={(e) => e.id} entity="expense"
        search={(e) => `${e.id} ${e.vendor} ${e.category}`} filters={[{ label: "Categories", get: (e) => e.category }, { label: "Status", get: (e) => e.status }]}
        createLabel="Add expense"
        form={(e) => <FormGrid fields={[{ label: "Category", value: e?.category, options: ["Electricity", "Rent", "Freight", "Fuel", "Telephone", "Office supplies", "Repairs", "Travel"] }, { label: "Vendor", value: e?.vendor }, { label: "Date", value: e?.iso ?? new Date().toISOString().slice(0, 10), type: "date" }, { label: "Amount (₹)", value: e?.amount, type: "number" }, { label: "GST (₹)", value: e?.gst, type: "number" }, { label: "Paid from", value: e?.account, options: bankList }]} />}
        detail={(e) => <DetailGrid items={[["Category", e.category], ["Vendor", e.vendor], ["Date", e.date], ["Amount", inr(e.amount)], ["GST", inr(e.gst)], ["Total", inr(e.amount + e.gst)], ["Paid from", e.account], ["Status", e.status]]} />}
        columns={[
          { key: "id", header: "Expense", render: (e) => <span className="font-medium">{e.id}</span> },
          { key: "date", header: "Date", sort: (e) => e.iso, render: (e) => <Muted>{e.date}</Muted> },
          { key: "cat", header: "Category", sort: (e) => e.category, render: (e) => e.category },
          { key: "vendor", header: "Vendor", render: (e) => <Muted>{e.vendor}</Muted> },
          { key: "acc", header: "Paid from", className: "hidden lg:table-cell", render: (e) => <Muted>{e.account}</Muted> },
          { key: "amt", header: "Amount", align: "right", sort: (e) => e.amount, render: (e) => inr(e.amount) },
          { key: "gst", header: "GST", align: "right", className: "hidden md:table-cell", render: (e) => (e.gst ? inr(e.gst) : "—") },
          { key: "status", header: "Status", render: (e) => <StatusBadge status={e.status} /> },
        ]}
      />
    </>
  );
}

type Income = {
  id: string;
  date: string;
  iso: string;
  source: string;
  party: string;
  account: string;
  amount: number;
  status: "Received" | "Pending";
};
export function IncomePage() {
  const [incomeRows, setIncomeRows] = useState<Income[]>([]);
  return (
    <>
      <SectionHeader title="Income" description="Sales and other income credited to bank accounts." />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Sales income" value={inr(sum(incomeRows.filter((i) => i.source === "Sales"), (i) => i.amount))} tone="up" />
        <KpiCard label="Other income" value={inr(sum(incomeRows.filter((i) => i.source !== "Sales"), (i) => i.amount))} />
        <KpiCard label="Pending" value={String(incomeRows.filter((i) => i.status === "Pending").length)} />
      </div>
      <DataTable<Income> rows={incomeRows} getId={(i) => i.id} entity="income entry"
        search={(i) => `${i.id} ${i.party} ${i.source}`} filters={[{ label: "Sources", get: (i) => i.source }, { label: "Status", get: (i) => i.status }]}
        createLabel="Add income"
        form={(i) => <FormGrid fields={[{ label: "Source", value: i?.source, options: ["Sales", "Interest", "Commission", "Rent received", "Scrap sale"] }, { label: "Received from", value: i?.party }, { label: "Date", value: i?.iso ?? new Date().toISOString().slice(0, 10), type: "date" }, { label: "Amount (₹)", value: i?.amount, type: "number" }, { label: "Deposited to", value: i?.account, options: bankList }]} />}
        detail={(i) => <DetailGrid items={[["Source", i.source], ["From", i.party], ["Date", i.date], ["Amount", inr(i.amount)], ["Account", i.account], ["Status", i.status]]} />}
        columns={[
          { key: "id", header: "Entry", render: (i) => <span className="font-medium">{i.id}</span> },
          { key: "date", header: "Date", sort: (i) => i.iso, render: (i) => <Muted>{i.date}</Muted> },
          { key: "src", header: "Source", sort: (i) => i.source, render: (i) => i.source },
          { key: "party", header: "Received from", render: (i) => <Muted>{i.party}</Muted> },
          { key: "acc", header: "Account", className: "hidden lg:table-cell", render: (i) => <Muted>{i.account}</Muted> },
          { key: "amt", header: "Amount", align: "right", sort: (i) => i.amount, render: (i) => <span className="font-medium">{inr(i.amount)}</span> },
          { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
        ]}
      />
    </>
  );
}

// ---------------- Ledgers ----------------
function LedgerView({
  title,
  description,
  ledgers,
  debitNormal,
}: {
  title: string;
  description: string;
  ledgers: { name: string; opening: number; lines: LedgerLine[]; place?: string; gstin?: string }[];
  debitNormal: boolean;
}) {
  const [name, setName] = useState(ledgers[0]?.name ?? "");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (ledgers.length > 0 && !ledgers.some((x) => x.name === name)) {
      setName(ledgers[0]?.name ?? "");
    }
  }, [ledgers, name]);

  if (ledgers.length === 0) {
    return (
      <>
        <SectionHeader title={title} description={description} />
        <Panel bodyClassName="p-8">
          <EmptyState title="No ledger records" description="No accounts or transactions found for this ledger." />
        </Panel>
      </>
    );
  }

  const l = ledgers.find((x) => x.name === name) || ledgers[0];
  if (!l) {
    return (
      <>
        <SectionHeader title={title} description={description} />
        <Panel bodyClassName="p-8">
          <EmptyState title="No ledger selected" description="Please select an account to view its ledger." />
        </Panel>
      </>
    );
  }

  let bal = l.opening;
  const rows = l.lines.map((line) => {
    bal += debitNormal ? line.debit - line.credit : line.credit - line.debit;
    return { ...line, bal };
  });
  const shown = rows.filter((r) => `${r.voucher} ${r.narration} ${r.type}`.toLowerCase().includes(q.toLowerCase()));
  const dr = sum(l.lines, (x) => x.debit);
  const cr = sum(l.lines, (x) => x.credit);

  return (
    <>
      <SectionHeader title={title} description={description} />
      <ReportToolbar accountOptions={ledgers.map((x) => x.name)} account={l.name} onAccount={setName} onSearch={setQ} />
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Opening balance" value={inr(l.opening)} hint={l.place ? `${l.place}${l.gstin ? ` · ${l.gstin}` : ""}` : undefined} />
        <KpiCard label="Total debit" value={inr(dr)} />
        <KpiCard label="Total credit" value={inr(cr)} />
        <KpiCard label="Closing balance" value={inr(bal)} hint={debitNormal ? "Dr" : "Cr"} />
      </div>
      <Panel bodyClassName="p-0">
        {shown.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No transactions recorded" description="There are no entries for this account." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Voucher</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Narration</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-muted/40">
                  <TableCell colSpan={6} className="font-medium">Opening balance</TableCell>
                  <TableCell className="text-right tabular font-medium">{inr(l.opening)}</TableCell>
                </TableRow>
                {shown.map((r) => (
                  <TableRow key={r.voucher + r.iso}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{r.date}</TableCell>
                    <TableCell className="font-medium">{r.voucher}</TableCell>
                    <TableCell className="text-muted-foreground">{r.type}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{r.narration}</TableCell>
                    <TableCell className="text-right tabular">{r.debit ? inr(r.debit) : ""}</TableCell>
                    <TableCell className="text-right tabular">{r.credit ? inr(r.credit) : ""}</TableCell>
                    <TableCell className="text-right tabular">{inr(r.bal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4}>Closing balance</TableCell>
                  <TableCell className="text-right tabular">{inr(dr)}</TableCell>
                  <TableCell className="text-right tabular">{inr(cr)}</TableCell>
                  <TableCell className="text-right tabular">{inr(bal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </Panel>
    </>
  );
}

export function CustomerLedger() {
  const [ledgers, setLedgers] = useState<{ name: string; opening: number; lines: LedgerLine[]; place?: string; gstin?: string }[]>([]);

  useEffect(() => {
    Promise.allSettled([
      api.get<any>("/parties/customers/"),
      api.get<any>("/sales/invoices/"),
      api.get<any>("/sales/payments/"),
    ]).then(([custRes, invRes, pmtRes]) => {
      const customers = custRes.status === "fulfilled" ? (Array.isArray(custRes.value) ? custRes.value : (custRes.value?.results ?? [])) : [];
      const invoices = invRes.status === "fulfilled" ? (Array.isArray(invRes.value) ? invRes.value : (invRes.value?.results ?? [])) : [];
      const payments = pmtRes.status === "fulfilled" ? (Array.isArray(pmtRes.value) ? pmtRes.value : (pmtRes.value?.results ?? [])) : [];

      const list = customers.map((c: any) => {
        const cInvs = invoices.filter((i: any) => i.customer === c.id || i.customer_name === c.name);
        const cPmts = payments.filter((p: any) => p.customer === c.id || p.customer_name === c.name);

        const lines: LedgerLine[] = [];
        cInvs.forEach((inv: any) => {
          const dt = inv.invoice_date || inv.date || new Date().toISOString().slice(0, 10);
          lines.push({
            date: dt,
            iso: dt,
            voucher: inv.code || `INV-${inv.id}`,
            type: "Invoice",
            narration: `Sales Invoice #${inv.code || inv.id}`,
            debit: Number(inv.total_amount) || 0,
            credit: 0,
          });
        });

        cPmts.forEach((pmt: any) => {
          const dt = pmt.payment_date || pmt.date || new Date().toISOString().slice(0, 10);
          lines.push({
            date: dt,
            iso: dt,
            voucher: pmt.code || `RCPT-${pmt.id}`,
            type: "Receipt",
            narration: pmt.reference_number ? `Receipt ref: ${pmt.reference_number}` : `Customer Receipt #${pmt.code || pmt.id}`,
            debit: 0,
            credit: Number(pmt.amount) || 0,
          });
        });

        lines.sort((a, b) => a.iso.localeCompare(b.iso));

        return {
          name: c.name,
          opening: 0,
          place: c.city || c.address || "",
          gstin: c.gstin || "",
          lines,
        };
      });

      setLedgers(list);
    }).catch(() => {
      setLedgers([]);
    });
  }, []);

  return <LedgerView title="Customer ledger" description="Live invoice and receipt history per customer with running balance." ledgers={ledgers} debitNormal />;
}

export function SupplierLedger() {
  const [ledgers, setLedgers] = useState<{ name: string; opening: number; lines: LedgerLine[]; place?: string; gstin?: string }[]>([]);

  useEffect(() => {
    Promise.allSettled([
      api.get<any>("/parties/suppliers/"),
      api.get<any>("/purchases/bills/"),
    ]).then(([suppRes, billsRes]) => {
      const suppliers = suppRes.status === "fulfilled" ? (Array.isArray(suppRes.value) ? suppRes.value : (suppRes.value?.results ?? [])) : [];
      const bills = billsRes.status === "fulfilled" ? (Array.isArray(billsRes.value) ? billsRes.value : (billsRes.value?.results ?? [])) : [];

      const list = suppliers.map((s: any) => {
        const sBills = bills.filter((b: any) => b.supplier === s.id || b.supplier_name === s.name);
        const lines: LedgerLine[] = [];

        sBills.forEach((b: any) => {
          const dt = b.bill_date || b.date || new Date().toISOString().slice(0, 10);
          const total = Number(b.total_amount) || 0;
          const paid = Number(b.paid_amount) || 0;

          lines.push({
            date: dt,
            iso: dt,
            voucher: b.code || `BILL-${b.id}`,
            type: "Bill",
            narration: `Purchase Bill #${b.code || b.id}`,
            debit: 0,
            credit: total,
          });

          if (paid > 0) {
            lines.push({
              date: dt,
              iso: dt,
              voucher: `PMT-${b.code || b.id}`,
              type: "Payment",
              narration: `Payment for Bill #${b.code || b.id}`,
              debit: paid,
              credit: 0,
            });
          }
        });

        lines.sort((a, b) => a.iso.localeCompare(b.iso));

        return {
          name: s.name,
          opening: 0,
          place: s.city || "",
          gstin: s.gstin || "",
          lines,
        };
      });

      setLedgers(list);
    }).catch(() => {
      setLedgers([]);
    });
  }, []);

  return <LedgerView title="Supplier ledger" description="Live bill and payment history per supplier with running balance." ledgers={ledgers} debitNormal={false} />;
}

export function GeneralLedger() {
  const [ledgers, setLedgers] = useState<{ name: string; opening: number; lines: LedgerLine[] }[]>([]);

  useEffect(() => {
    Promise.allSettled([
      api.get<any>("/finance/accounts/"),
      api.get<any>("/finance/journal-entries/"),
    ]).then(([accRes, jnlRes]) => {
      const accounts = accRes.status === "fulfilled" ? (Array.isArray(accRes.value) ? accRes.value : (accRes.value?.results ?? [])) : [];
      const journals = jnlRes.status === "fulfilled" ? (Array.isArray(jnlRes.value) ? jnlRes.value : (jnlRes.value?.results ?? [])) : [];

      const leafAccs = accounts.filter((a: any) => !a.is_group);
      const list = leafAccs.map((a: any) => {
        const lines: LedgerLine[] = [];

        journals.forEach((j: any) => {
          const jDate = j.date || j.entry_date || new Date().toISOString().slice(0, 10);
          (j.lines || []).forEach((l: any) => {
            if (l.account === a.id || l.account_code === a.code || l.account_name === a.name) {
              lines.push({
                date: jDate,
                iso: jDate,
                voucher: j.entry_number || `JV-${j.id}`,
                type: "Journal",
                narration: l.narration || j.narration || "Journal entry",
                debit: Number(l.debit_amount) || 0,
                credit: Number(l.credit_amount) || 0,
              });
            }
          });
        });

        lines.sort((a, b) => a.iso.localeCompare(b.iso));

        return {
          name: `${a.code} · ${a.name}`,
          opening: Number(a.opening_balance) || 0,
          lines,
        };
      });

      setLedgers(list);
    }).catch(() => {
      setLedgers([]);
    });
  }, []);

  return <LedgerView title="General ledger" description="Account-wise transaction history directly from double-entry journal records." ledgers={ledgers} debitNormal />;
}

// ---------------- Reports ----------------
export function TrialBalance() {
  const [q, setQ] = useState("");
  const [accList, setAccList] = useState<any[]>([]);

  useEffect(() => {
    api.get<any>("/finance/accounts/").then((res) => {
      const list = Array.isArray(res) ? res : (res?.results ?? []);
      setAccList(list.filter((a: any) => !a.is_group));
    }).catch(() => {
      setAccList([]);
    });
  }, []);

  const rows = accList.map((a: any) => {
    const bal = Number(a.current_balance ?? a.opening_balance ?? 0);
    const isDebitNormal = a.normal_balance === "Debit" || ["Assets", "Expenses"].includes(a.account_type);
    let debit = 0;
    let credit = 0;
    if (isDebitNormal) {
      if (bal >= 0) debit = bal;
      else credit = Math.abs(bal);
    } else {
      if (bal >= 0) credit = bal;
      else debit = Math.abs(bal);
    }
    return {
      code: a.code,
      name: a.name,
      type: a.account_type,
      debit,
      credit,
    };
  }).filter((r) => `${r.code} ${r.name}`.toLowerCase().includes(q.toLowerCase()));

  const dr = sum(rows, (r) => r.debit);
  const cr = sum(rows, (r) => r.credit);

  return (
    <>
      <SectionHeader title="Trial balance" description={`Live Chart of Accounts trial balance · ${company.name}`} />
      <ReportToolbar onSearch={setQ} />
      <Panel bodyClassName="p-0">
        {rows.length === 0 ? (
          <div className="p-8">
            <EmptyState title="No accounts found" description="No active leaf accounts available to generate trial balance." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="hidden sm:table-cell">Group</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.code}>
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{r.type}</TableCell>
                  <TableCell className="text-right tabular">{r.debit ? inr(r.debit) : ""}</TableCell>
                  <TableCell className="text-right tabular">{r.credit ? inr(r.credit) : ""}</TableCell>
                  <TableCell className="text-right tabular text-muted-foreground">
                    {inr(r.debit || r.credit)} {r.debit ? "Dr" : "Cr"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell className="text-right tabular">{inr(dr)}</TableCell>
                <TableCell className="text-right tabular">{inr(cr)}</TableCell>
                <TableCell className="text-right">
                  <StatusBadge status={dr === cr ? "Matched" : "Mismatch"} />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </Panel>
    </>
  );
}

function Statement({ children }: { children: ReactNode }) {
  return <Panel bodyClassName="p-0"><div className="mx-auto max-w-3xl px-4 py-6 sm:px-8">{children}</div></Panel>;
}
function StmtSection({ title, rows, total, totalLabel }: { title: string; rows: [string, number][]; total?: number; totalLabel?: string }) {
  return (
    <div className="mb-5">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between border-b border-dashed border-border py-1.5 text-sm">
          <span>{k}</span>
          <span className={cn("tabular", v < 0 && "text-muted-foreground")}>{v < 0 ? `(${inr(-v)})` : inr(v)}</span>
        </div>
      ))}
      {total !== undefined ? (
        <div className="flex justify-between py-2 text-sm font-semibold">
          <span>{totalLabel}</span>
          <span className="tabular">{inr(total)}</span>
        </div>
      ) : null}
    </div>
  );
}
function StmtTotal({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={cn("mb-5 flex justify-between rounded-md px-3 py-2.5 text-sm font-semibold", strong ? "bg-primary text-primary-foreground" : "bg-muted")}>
      <span>{label}</span>
      <span className="tabular">{inr(value)}</span>
    </div>
  );
}
function StmtHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-6 border-b border-border pb-4 text-center">
      <p className="text-sm font-semibold">{company.name}</p>
      <p className="text-xs text-muted-foreground">{company.location} · GSTIN {company.gstin}</p>
      <p className="mt-2 text-base font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

export function ProfitLoss() {
  const [accList, setAccList] = useState<any[]>([]);

  useEffect(() => {
    api.get<any>("/finance/accounts/").then((res) => {
      const list = Array.isArray(res) ? res : (res?.results ?? []);
      setAccList(list.filter((a: any) => !a.is_group));
    }).catch(() => {
      setAccList([]);
    });
  }, []);

  const revAccounts: [string, number][] = accList
    .filter((a: any) => a.account_type === "Income")
    .map((a: any) => [a.name, Number(a.current_balance ?? a.opening_balance ?? 0)]);

  const costAccounts: [string, number][] = accList
    .filter((a: any) => a.account_type === "Expenses" && (a.code === "5100" || a.name.toLowerCase().includes("cost of goods")))
    .map((a: any) => [a.name, Number(a.current_balance ?? a.opening_balance ?? 0)]);

  const opexAccounts: [string, number][] = accList
    .filter((a: any) => a.account_type === "Expenses" && !(a.code === "5100" || a.name.toLowerCase().includes("cost of goods")))
    .map((a: any) => [a.name, Number(a.current_balance ?? a.opening_balance ?? 0)]);

  const rev = sum(revAccounts, (x) => x[1]);
  const cost = sum(costAccounts, (x) => x[1]);
  const gross = rev - cost;
  const opex = sum(opexAccounts, (x) => x[1]);
  const pbt = gross - opex;
  const tax = 0;
  const netProfit = pbt - tax;

  return (
    <>
      <SectionHeader title="Profit & loss" description={`Revenue, cost of goods, operating expenses and net profit · ${company.name}`} />
      <ReportToolbar />
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Revenue" value={lakh(rev)} />
        <KpiCard label="Gross profit" value={lakh(gross)} hint={rev > 0 ? `${((gross / rev) * 100).toFixed(1)}% margin` : "0% margin"} tone="up" />
        <KpiCard label="Operating expenses" value={lakh(opex)} />
        <KpiCard label="Net profit" value={lakh(netProfit)} hint={rev > 0 ? `${((netProfit / rev) * 100).toFixed(1)}% net margin` : "0% margin"} tone="up" />
      </div>
      <Statement>
        <StmtHead title="Statement of Profit & Loss" sub={`FY ${company.fy} · Live Data`} />
        <StmtSection title="Revenue from operations" rows={revAccounts.length > 0 ? revAccounts : [["Operating Revenue", 0]]} total={rev} totalLabel="Net revenue" />
        <StmtSection title="Cost of goods sold" rows={costAccounts.length > 0 ? costAccounts : [["Cost of Sales", 0]]} total={cost} totalLabel="Total cost" />
        <StmtTotal label="Gross profit" value={gross} />
        <StmtSection title="Operating expenses" rows={opexAccounts.length > 0 ? opexAccounts : [["General & Administrative", 0]]} total={opex} totalLabel="Total operating expenses" />
        <StmtTotal label="Profit before tax" value={pbt} />
        <StmtTotal label="Net profit" value={netProfit} strong />
      </Statement>
    </>
  );
}

export function BalanceSheet() {
  const [accList, setAccList] = useState<any[]>([]);

  useEffect(() => {
    api.get<any>("/finance/accounts/").then((res) => {
      const list = Array.isArray(res) ? res : (res?.results ?? []);
      setAccList(list.filter((a: any) => !a.is_group));
    }).catch(() => {
      setAccList([]);
    });
  }, []);

  const getRows = (type: string, codePrefix?: string) =>
    accList
      .filter((a: any) => a.account_type === type && (!codePrefix || String(a.code).startsWith(codePrefix)))
      .map((a: any) => [a.name, Number(a.current_balance ?? a.opening_balance ?? 0)] as [string, number]);

  const ca = getRows("Assets", "11");
  const fa = getRows("Assets", "12");
  const otherAssets = accList
    .filter((a: any) => a.account_type === "Assets" && !String(a.code).startsWith("11") && !String(a.code).startsWith("12"))
    .map((a: any) => [a.name, Number(a.current_balance ?? a.opening_balance ?? 0)] as [string, number]);

  const allAssets = [...ca, ...fa, ...otherAssets];
  const totalAssets = sum(allAssets, (x) => x[1]);

  const cl = getRows("Liabilities", "21");
  const ll = getRows("Liabilities", "22");
  const otherLiab = accList
    .filter((a: any) => a.account_type === "Liabilities" && !String(a.code).startsWith("21") && !String(a.code).startsWith("22"))
    .map((a: any) => [a.name, Number(a.current_balance ?? a.opening_balance ?? 0)] as [string, number]);

  const allLiab = [...cl, ...ll, ...otherLiab];
  const totalLiab = sum(allLiab, (x) => x[1]);

  const equityAccounts = getRows("Equity");
  const directEquity = sum(equityAccounts, (x) => x[1]);
  const reserves = totalAssets - totalLiab - directEquity;

  const equityRows: [string, number][] = [
    ...equityAccounts,
    ...(reserves !== 0 ? [["Reserves & Surplus (Current Earnings)", reserves] as [string, number]] : []),
  ];

  return (
    <>
      <SectionHeader title="Balance sheet" description={`Assets, liabilities and equity · ${company.name}`} />
      <ReportToolbar />
      <div className="grid gap-4 lg:grid-cols-2">
        <Statement>
          <p className="mb-4 text-base font-semibold">Assets</p>
          <StmtSection title="Current assets" rows={ca.length > 0 ? ca : [["Current Assets", 0]]} total={sum(ca, (x) => x[1])} totalLabel="Total current assets" />
          <StmtSection title="Fixed & non-current assets" rows={fa.length > 0 ? fa : [["Fixed Assets", 0]]} total={sum(fa, (x) => x[1])} totalLabel="Total fixed assets" />
          {otherAssets.length > 0 && <StmtSection title="Other assets" rows={otherAssets} total={sum(otherAssets, (x) => x[1])} totalLabel="Total other assets" />}
          <StmtTotal label="Total assets" value={totalAssets} strong />
        </Statement>
        <Statement>
          <p className="mb-4 text-base font-semibold">Liabilities & equity</p>
          <StmtSection title="Current liabilities" rows={cl.length > 0 ? cl : [["Current Liabilities", 0]]} total={sum(cl, (x) => x[1])} totalLabel="Total current liabilities" />
          {ll.length > 0 && <StmtSection title="Long-term borrowings" rows={ll} total={sum(ll, (x) => x[1])} totalLabel="Total borrowings" />}
          {otherLiab.length > 0 && <StmtSection title="Other liabilities" rows={otherLiab} total={sum(otherLiab, (x) => x[1])} totalLabel="Total other liabilities" />}
          <StmtSection title="Equity & capital" rows={equityRows.length > 0 ? equityRows : [["Owner's Equity", reserves]]} total={totalAssets - totalLiab} totalLabel="Total equity" />
          <StmtTotal label="Total liabilities & equity" value={totalAssets} strong />
        </Statement>
      </div>
    </>
  );
}

export function CashFlowPage() {
  const [bankList, setBankList] = useState<any[]>([]);
  const [cashList, setCashList] = useState<any[]>([]);
  const [accList, setAccList] = useState<any[]>([]);

  useEffect(() => {
    Promise.allSettled([
      api.get<any>("/finance/bank-accounts/"),
      api.get<any>("/finance/cash-accounts/"),
      api.get<any>("/finance/accounts/"),
    ]).then(([banksRes, cashRes, accRes]) => {
      if (banksRes.status === "fulfilled") {
        setBankList(Array.isArray(banksRes.value) ? banksRes.value : (banksRes.value?.results ?? []));
      }
      if (cashRes.status === "fulfilled") {
        setCashList(Array.isArray(cashRes.value) ? cashRes.value : (cashRes.value?.results ?? []));
      }
      if (accRes.status === "fulfilled") {
        setAccList(Array.isArray(accRes.value) ? accRes.value : (accRes.value?.results ?? []));
      }
    });
  }, []);

  const totalBankCash = sum(bankList, (b) => Number(b.balance ?? 0)) + sum(cashList, (c) => Number(c.balance ?? 0));
  const income = sum(accList.filter((a) => a.account_type === "Income"), (a) => Number(a.current_balance ?? a.opening_balance ?? 0));
  const expense = sum(accList.filter((a) => a.account_type === "Expenses"), (a) => Number(a.current_balance ?? a.opening_balance ?? 0));
  const netOp = income - expense;

  const opRows: [string, number][] = [
    ["Net profit / (loss) from operations", netOp],
  ];
  const invRows: [string, number][] = [
    ["Capital expenditure / assets", 0],
  ];
  const finRows: [string, number][] = [
    ["Equity / owner contributions", 0],
  ];

  return (
    <>
      <SectionHeader title="Cash flow" description={`Indirect method · FY ${company.fy} · Live Data`} />
      <ReportToolbar />
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Operating" value={inr(netOp)} tone={netOp >= 0 ? "up" : "down"} hint="Net cash from operations" />
        <KpiCard label="Investing" value={inr(0)} />
        <KpiCard label="Financing" value={inr(0)} />
        <KpiCard label="Closing cash & bank" value={inr(totalBankCash)} hint={`${bankList.length + cashList.length} account(s)`} />
      </div>
      <Statement>
        <StmtHead title="Cash Flow Statement" sub={`FY ${company.fy} · Live Data`} />
        <StmtSection title="A. Operating activities" rows={opRows} total={netOp} totalLabel="Net cash from operating activities" />
        <StmtSection title="B. Investing activities" rows={invRows} total={0} totalLabel="Net cash from investing activities" />
        <StmtSection title="C. Financing activities" rows={finRows} total={0} totalLabel="Net cash from financing activities" />
        <StmtSection title="Summary" rows={[["Net change in cash & bank", netOp], ["Closing cash & bank balance", totalBankCash]]} />
        <StmtTotal label="Closing cash & bank" value={totalBankCash} strong />
      </Statement>
    </>
  );
}

type DayRow = {
  date: string;
  iso: string;
  voucher: string;
  type: string;
  party: string;
  account: string;
  debit: number;
  credit: number;
};
export function DayBook() {
  const [dayRows, setDayRows] = useState<DayRow[]>([]);

  useEffect(() => {
    api.get<any>("/finance/journal-entries/").then((res) => {
      const list = Array.isArray(res) ? res : (res?.results ?? []);
      const rows: DayRow[] = [];
      list.forEach((j: any) => {
        const jDate = j.date || j.entry_date || new Date().toISOString().slice(0, 10);
        (j.lines || []).forEach((l: any) => {
          rows.push({
            date: jDate,
            iso: jDate,
            voucher: j.entry_number || `JV-${j.id}`,
            type: "Journal",
            party: j.narration || "General Journal",
            account: l.account_name || l.account_code || `Account #${l.account}`,
            debit: Number(l.debit_amount) || 0,
            credit: Number(l.credit_amount) || 0,
          });
        });
      });
      setDayRows(rows);
    }).catch(() => {
      setDayRows([]);
    });
  }, []);

  return (
    <>
      <SectionHeader title="Day book" description="All vouchers in chronological order." actions={<ExportButtons />} />
      <DataTable<DayRow> rows={dayRows} getId={(r) => r.voucher} entity="voucher" removeLabel={null} pageSize={15}
        search={(r) => `${r.voucher} ${r.party} ${r.account}`} searchPlaceholder="Search voucher, party or account"
        filters={[{ label: "Voucher types", get: (r) => r.type }]}
        detail={(r) => <DetailGrid items={[["Date", r.date], ["Voucher", r.voucher], ["Type", r.type], ["Party / narration", r.party], ["Account", r.account], ["Debit", r.debit ? inr(r.debit) : "—"], ["Credit", r.credit ? inr(r.credit) : "—"]]} />}
        columns={[
          { key: "date", header: "Date", sort: (r) => r.iso, render: (r) => <Muted>{r.date}</Muted> },
          { key: "voucher", header: "Voucher", render: (r) => <span className="font-medium">{r.voucher}</span> },
          { key: "type", header: "Type", render: (r) => <span className="inline-flex items-center gap-1.5">{r.type === "Receipt" ? <ArrowDownLeft className="size-3 text-success" /> : r.type === "Journal" ? <Building2 className="size-3 text-accent" /> : <ArrowUpRight className="size-3 text-destructive" />}{r.type}</span> },
          { key: "party", header: "Party / narration", render: (r) => <span className="block max-w-60 truncate">{r.party}</span> },
          { key: "acc", header: "Account", className: "hidden lg:table-cell", render: (r) => <span className="block max-w-56 truncate text-muted-foreground">{r.account}</span> },
          { key: "dr", header: "Debit", align: "right", sort: (r) => r.debit, render: (r) => (r.debit ? inr(r.debit) : "") },
          { key: "cr", header: "Credit", align: "right", sort: (r) => r.credit, render: (r) => (r.credit ? inr(r.credit) : "") },
        ]}
        footer={(rs) => <TableFooter><TableRow><TableCell colSpan={5}>Total ({rs.length} vouchers)</TableCell><TableCell className="text-right tabular">{inr(sum(rs, (r) => r.debit))}</TableCell><TableCell className="text-right tabular">{inr(sum(rs, (r) => r.credit))}</TableCell><TableCell /></TableRow></TableFooter>}
      />
    </>
  );
}
