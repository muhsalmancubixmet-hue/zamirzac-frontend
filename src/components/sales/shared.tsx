import { isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import { Download, Eye, FileArchive, FileImage, FileSpreadsheet, FileText, Lock, Paperclip, Plus, Printer, RotateCcw, Send, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { EmptyState, Panel } from "@/components/erp/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { inr } from "@/lib/format";
import { currentUser } from "@/lib/user";
import { defaultTerms, lineAmount, totals, customers, products, type Attachment, type Line } from "@/data/sales";

import { companyConfig as company } from "@/config/company";
import { CompanyLogo } from "@/components/erp/CompanyLogo";

export const inr2 = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const typeIcon = { PDF: FileText, Image: FileImage, Excel: FileSpreadsheet, Word: FileText, ZIP: FileArchive } as const;

export function AttachmentPanel({
  items: initial,
  title = "Attachments",
  compact,
  onUpload,
  onDelete,
  uploading = false,
}: {
  items: Attachment[];
  title?: string;
  compact?: boolean;
  onUpload?: (files: FileList) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  uploading?: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (onUpload) {
      await onUpload(files);
      if (ref.current) ref.current.value = "";
      return;
    }
    const added = Array.from(files).map((f, i): Attachment => {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      const type: Attachment["type"] = ext === "pdf" ? "PDF" : ["jpg", "jpeg", "png", "webp"].includes(ext) ? "Image" : ["xls", "xlsx", "csv"].includes(ext) ? "Excel" : ext === "zip" ? "ZIP" : "Word";
      return { id: `NEW-${Date.now()}-${i}`, name: f.name, type, size: `${(f.size / 1048576).toFixed(1)} MB`, uploaded: "Today", by: currentUser.name, record: "—", category: "Uploaded", customer: "—" };
    });
    setItems((x) => [...added, ...x]);
    toast.success(`${added.length} file(s) attached (kept in this session only)`);
    if (ref.current) ref.current.value = "";
  };

  const handleDownload = (a: Attachment) => {
    if (a.fileUrl) {
      const link = document.createElement("a");
      link.href = a.fileUrl;
      link.download = a.name;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Opening ${a.name}`);
      return;
    }
    const blob = new Blob([`ERP Attachment: ${a.name}\nSize: ${a.size}\nType: ${a.type}\nRecord: ${a.record}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = a.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${a.name}`);
  };

  return (
    <Panel title={title} description={`${items.length} file(s)`} bodyClassName="p-0"
      actions={<><input ref={ref} type="file" multiple hidden onChange={(e) => onFiles(e.target.files)} /><Button size="sm" variant="outline" disabled={uploading} onClick={() => ref.current?.click()}><Upload className="size-4 mr-1.5" /> {uploading ? "Uploading..." : "Attach files"}</Button></>}>
      {items.length === 0 ? <div className="p-5"><EmptyState title="No attachments yet" description="Attach order letters, ID-card data, approvals or compliance proofs." /></div> : (
        <Table>
          <TableHeader><TableRow><TableHead>File name</TableHead><TableHead>Type</TableHead>{compact ? null : <TableHead className="hidden md:table-cell">Category</TableHead>}<TableHead className="hidden sm:table-cell">Uploaded</TableHead><TableHead className="hidden lg:table-cell">By</TableHead><TableHead className="w-28 text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((a) => {
              const Icon = typeIcon[a.type] || FileText;
              return (
                <TableRow key={a.id}>
                  <TableCell><div className="flex items-center gap-2"><Icon className="size-4 shrink-0 text-accent" /><div className="min-w-0"><p className="max-w-64 truncate font-medium">{a.name}</p><p className="text-xs text-muted-foreground">{a.size}{a.record !== "—" ? ` · ${a.record}` : ""}</p></div></div></TableCell>
                  <TableCell className="text-muted-foreground">{a.type}</TableCell>
                  {compact ? null : <TableCell className="hidden md:table-cell text-muted-foreground">{a.category}</TableCell>}
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{a.uploaded}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{a.by}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-8" aria-label="Preview" onClick={() => setPreview(a)}><Eye className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="size-8" aria-label="Download" onClick={() => handleDownload(a)}><Download className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="size-8 text-destructive" aria-label="Remove" onClick={async () => {
                      if (onDelete) {
                        await onDelete(a.id);
                      } else {
                        setItems((x) => x.filter((y) => y.id !== a.id));
                        toast.success("Attachment removed");
                      }
                    }}><Trash2 className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle className="truncate pr-6">{preview?.name}</DialogTitle><DialogDescription>{preview?.type} · {preview?.size} · uploaded {preview?.uploaded} by {preview?.by}</DialogDescription></DialogHeader>
          <div className="flex-1 min-h-[300px] flex items-center justify-center rounded-md border border-border bg-muted/20 overflow-hidden">
            {preview?.fileUrl ? (
              preview.type === "Image" ? (
                <img src={preview.fileUrl} alt={preview.name} className="max-h-[60vh] max-w-full rounded object-contain p-2" />
              ) : preview.type === "PDF" ? (
                <iframe src={preview.fileUrl} title={preview.name} className="w-full h-[60vh] border-0" />
              ) : (
                <div className="flex flex-col items-center gap-3 p-6 text-center text-muted-foreground">
                  {(() => { const I = typeIcon[preview.type] || FileText; return <I className="size-16 text-primary" />; })()}
                  <p className="text-sm font-medium">{preview.name}</p>
                  <Button size="sm" onClick={() => handleDownload(preview)}><Download className="size-4 mr-1.5" /> Download to view</Button>
                </div>
              )
            ) : (
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                {preview ? (() => { const I = typeIcon[preview.type] || FileText; return <I className="size-10 text-accent" />; })() : null}
                Document attached in session.
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={() => preview && handleDownload(preview)}><Download className="size-4 mr-1.5" /> Download</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

export function DocumentEditor({ mode, initial, onSaved }: {

  mode: "invoice" | "quotation";
  initial?: { customerId?: string; lines?: Line[]; notes?: string } | undefined;
  onSaved?: (() => void) | undefined;
}) {
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [productList, setProductList] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<string>(initial?.customerId ?? "");
  const [lines, setLines] = useState<Line[]>(initial?.lines ?? []);
  const [canEdit, setCanEdit] = useState(true);
  const [received, setReceived] = useState(0);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().slice(0, 10);
  const defaultDue = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const [docDate, setDocDate] = useState(todayStr);
  const [docDue, setDocDue] = useState(defaultDue);
  const [poRef, setPoRef] = useState("");
  const [notesVal, setNotesVal] = useState(initial?.notes ?? "");

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      api.get<any>("/parties/customers/"),
      api.get<any>("/catalog/items/"),
    ])
      .then(([custRes, itemsRes]) => {
        if (!isMounted) return;
        const cList = Array.isArray(custRes) ? custRes : (custRes?.results ?? []);
        const mappedCusts = cList.map((c: any) => ({
          id: String(c.id),
          name: c.name,
          code: c.code,
          type: c.customer_type || "Business",
          contact: c.contact_person || c.name,
          phone: c.phone || "—",
          email: c.email || "—",
          city: c.city || "Kerala",
          district: c.state || "Kerala",
          address: c.billing_address || `${c.city || ""}, ${c.state || "Kerala"}`.trim(),
          gstin: c.gstin || null,
          group: "Customers",
          creditLimit: Number(c.credit_limit) || 0,
        }));
        setCustomerList(mappedCusts);
        if (!initial?.customerId && mappedCusts.length > 0) {
          setCustomerId(mappedCusts[0]!.id);
        }

        const iList = Array.isArray(itemsRes) ? itemsRes : (itemsRes?.results ?? []);
        const mappedItems = iList.map((item: any) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          unit: item.uom_code || "Nos",
          price: Number(item.selling_price) || 0,
          tax: Number(item.default_tax_rate) || 18,
          hsn: item.hsn_code || "3926",
        }));
        setProductList(mappedItems);

        if ((!initial?.lines || initial.lines.length === 0) && mappedItems.length > 0) {
          const first = mappedItems[0]!;
          setLines([{
            code: first.code,
            name: first.name,
            description: "",
            qty: 1,
            unit: first.unit,
            rate: first.price,
            defaultRate: first.price,
            discount: 0,
            tax: first.tax,
          }]);
        }
      })
      .catch((err) => {
        console.error("Failed to load customer or item list:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [initial?.customerId]);

  const c = customerList.find((x) => String(x.id) === String(customerId)) ?? customerList[0] ?? customers[0];
  const activeProducts = productList.length > 0 ? productList : products;
  const t = totals(lines, received);
  const upd = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const setProduct = (i: number, code: string) => {
    const p = activeProducts.find((x) => x.code === code);
    if (p) {
      upd(i, { code, name: p.name, unit: p.unit, rate: p.price, defaultRate: p.price, tax: p.tax });
    }
  };
  const addLine = () => {
    const p = activeProducts[0];
    if (p) {
      setLines((ls) => [...ls, {
        code: p.code,
        name: p.name,
        description: "",
        qty: 1,
        unit: p.unit,
        rate: p.price,
        defaultRate: p.price,
        discount: 0,
        tax: p.tax,
      }]);
    } else {
      setLines((ls) => [...ls, {
        code: "",
        name: "Item",
        description: "",
        qty: 1,
        unit: "Nos",
        rate: 0,
        defaultRate: 0,
        discount: 0,
        tax: 18,
      }]);
    }
  };
  const label = mode === "invoice" ? "invoice" : "quotation";

  const save = async (isDraft: boolean) => {
    try {
      setSaving(true);
      const custObj = customerList.find((x) => String(x.id) === String(customerId));
      const custBackendId = custObj ? Number(custObj.id) : Number(customerId);
      if (!custBackendId || isNaN(custBackendId)) {
        toast.error("Please select a valid customer from the database before saving");
        return;
      }

      if (!lines.length || !lines.some((l) => l.qty > 0)) {
        toast.error("Please add at least one item line with quantity > 0");
        return;
      }

      const linesPayload = lines.map((l, idx) => {
        const prod =
          productList.find((p) => p.code === l.code) ||
          productList.find((p) => p.name.toLowerCase() === l.name.toLowerCase()) ||
          productList[0];
        const itemId = Number((prod as any)?.id);
        if (!itemId || isNaN(itemId)) {
          throw new Error(`Item on line ${idx + 1} (${l.name || l.code}) is not registered in the database catalog.`);
        }
        return {
          item: itemId,
          description: l.description || l.name || prod?.name || "Item",
          quantity: Number(l.qty) || 1,
          unit_price: Number(l.rate) || 0,
          discount_percentage: Number(l.discount) || 0,
          tax_rate: Number(l.tax) || 18,
        };
      });

      if (mode === "invoice") {
        const payload = {
          customer: custBackendId,
          invoice_date: docDate,
          due_date: docDue,
          customer_po_ref: poRef,
          notes: notesVal,
          status: isDraft ? "Draft" : (received >= t.grand ? "Paid" : received > 0 ? "Partial" : "Pending"),
          received_amount: Number(received) || 0,
          lines: linesPayload,
        };
        const created = await api.post<any>("/sales/invoices/", payload);
        toast.success(isDraft ? "Draft invoice saved" : `Invoice ${created.code || "INV"} saved to database!`);
        onSaved?.();
      } else {
        const payload = {
          customer: custBackendId,
          quotation_date: docDate,
          valid_till: docDue,
          notes: notesVal,
          status: isDraft ? "Draft" : "Sent",
          lines: linesPayload,
        };
        const created = await api.post<any>("/sales/quotations/", payload);
        toast.success(isDraft ? "Draft quotation saved" : `Quotation ${created.code || "QT"} saved to database!`);
        onSaved?.();
      }
    } catch (err: any) {
      const errorMsg =
        err?.fieldErrors
          ? Object.entries(err.fieldErrors)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
              .join("; ")
          : err?.message || "Failed to save document";
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Customer" className="xl:col-span-2">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <Field label="Customer" required>
                {customerList.length > 0 ? (
                  <Select value={String(customerId)} onValueChange={setCustomerId}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{customerList.map((x) => <SelectItem key={x.id} value={String(x.id)}>{x.name} ({x.code || x.id})</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <div className="rounded-md border border-input bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{loading ? "Loading customer list..." : "No customers available in CRM."}</div>
                )}
              </Field>
              {c ? (
                <div className="rounded-md bg-muted/50 p-3 text-sm">
                  <p className="font-medium">{c.contact}</p>
                  <p className="text-muted-foreground">{c.phone} · {c.email}</p>
                </div>
              ) : null}
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-xs font-medium text-muted-foreground">Billing address</p>
              {c ? (
                <>
                  <p>{c.name}<br />{c.address}<br />{c.district && c.district !== "—" ? `${c.district} District` : ""}</p>
                  <p className="text-xs font-medium text-muted-foreground pt-1">GST</p>
                  <p className="font-mono text-xs">{c.gstin ?? "Unregistered (B2C)"} · Place of supply: {c.gstin?.startsWith("33") ? "Tamil Nadu (33)" : "Kerala (32)"}</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">{loading ? "Loading..." : "Please select or create a customer."}</p>
              )}
            </div>
          </div>
        </Panel>
        <Panel title={mode === "invoice" ? "Invoice details" : "Quotation details"}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={mode === "invoice" ? "Invoice no." : "Quotation no."}><Input className="h-9 text-muted-foreground bg-muted" readOnly value="Auto-generated" /></Field>
            <Field label="Date" required><Input className="h-9" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} /></Field>
            <Field label={mode === "invoice" ? "Due date" : "Valid till"}><Input className="h-9" type="date" value={docDue} onChange={(e) => setDocDue(e.target.value)} /></Field>
            <Field label={mode === "invoice" ? "Customer PO" : "Salesperson"}><Input className="h-9" value={poRef} onChange={(e) => setPoRef(e.target.value)} placeholder={mode === "invoice" ? "PO reference" : currentUser.name} /></Field>
          </div>
        </Panel>
      </div>

      <Panel title="Products & services" bodyClassName="p-0"
        actions={
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="size-3.5" /> Price override
            <Switch checked={canEdit} onCheckedChange={setCanEdit} aria-label="Allow price override" />
          </label>
        }>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="min-w-56">Product</TableHead><TableHead className="min-w-40">Description</TableHead><TableHead className="w-24 text-right">Qty</TableHead><TableHead className="w-16">Unit</TableHead>
              <TableHead className="w-36 text-right">Rate (₹)</TableHead><TableHead className="w-20 text-right">Disc %</TableHead><TableHead className="w-20 text-right">Tax %</TableHead><TableHead className="w-32 text-right">Amount</TableHead><TableHead className="w-10" />
            </TableRow></TableHeader>
            <TableBody>
              {lines.map((l, i) => {
                const changed = l.rate !== l.defaultRate;
                return (
                  <TableRow key={i} className="align-top">
                    <TableCell>
                      <select value={l.code} onChange={(e) => setProduct(i, e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                        {activeProducts.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                      </select>
                    </TableCell>
                    <TableCell><Input className="h-9" value={l.description} onChange={(e) => upd(i, { description: e.target.value })} placeholder="Optional" /></TableCell>
                    <TableCell><Input className="h-9 text-right" type="number" min={0} value={l.qty} onChange={(e) => upd(i, { qty: Number(e.target.value) })} /></TableCell>
                    <TableCell className="pt-4 text-muted-foreground">{l.unit}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canEdit ? (
                          <Input className={cn("h-9 text-right", changed && "border-warning bg-warning/10")} type="number" min={0} value={l.rate} onChange={(e) => upd(i, { rate: Number(e.target.value) })} aria-label="Selling price" />
                        ) : (
                          <Tooltip><TooltipTrigger asChild><div className="flex h-9 w-full items-center justify-end gap-1 rounded-md border border-input bg-muted px-2 text-sm tabular"><Lock className="size-3 text-muted-foreground" />{l.rate}</div></TooltipTrigger><TooltipContent>You need price-override permission to change this</TooltipContent></Tooltip>
                        )}
                        {changed && canEdit ? <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label="Reset to default price" onClick={() => upd(i, { rate: l.defaultRate })}><RotateCcw className="size-3.5" /></Button> : null}
                      </div>
                      <p className={cn("mt-1 text-right text-[11px]", changed ? "text-warning-foreground" : "text-muted-foreground")}>Default ₹{l.defaultRate}{changed ? ` · ${l.rate > l.defaultRate ? "+" : ""}${(((l.rate - l.defaultRate) / l.defaultRate) * 100).toFixed(1)}%` : ""}</p>
                    </TableCell>
                    <TableCell><Input className="h-9 text-right" type="number" min={0} max={100} value={l.discount} onChange={(e) => upd(i, { discount: Number(e.target.value) })} /></TableCell>
                    <TableCell>
                      <select value={l.tax} onChange={(e) => upd(i, { tax: Number(e.target.value) })} className="h-9 w-full rounded-md border border-input bg-background px-1 text-right text-sm">
                        {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </TableCell>
                    <TableCell className="pt-4 text-right font-medium tabular">{inr2(lineAmount(l))}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="size-8" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, k) => k !== i))}><Trash2 className="size-4" /></Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="border-t border-border p-3"><Button variant="ghost" size="sm" onClick={addLine}><Plus className="size-4" /> Add line</Button></div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {mode === "quotation" ? (
            <Panel title="Notes & terms">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Notes to customer"><Textarea rows={5} value={notesVal} onChange={(e) => setNotesVal(e.target.value)} placeholder="e.g. Includes one free design revision" /></Field>
                <Field label="Terms & conditions"><Textarea rows={5} defaultValue={defaultTerms} /></Field>
              </div>
            </Panel>
          ) : (
            <Panel title="Notes"><Textarea rows={3} value={notesVal} onChange={(e) => setNotesVal(e.target.value)} placeholder="Thank you for your business." /></Panel>
          )}
          <AttachmentPanel items={[]} compact />
        </div>
        <Panel title="Summary">
          <dl className="space-y-2 text-sm">
            <Row k="Subtotal" v={inr2(t.gross)} />
            <Row k="Discount" v={`− ${inr2(t.discount)}`} />
            <Row k="Taxable value" v={inr2(t.sub)} />
            <Row k={c?.gstin?.startsWith("33") ? "IGST" : "CGST + SGST"} v={inr2(t.tax)} />
            <Row k="Round off" v={inr2(t.grand - t.sub - t.tax)} />
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Grand total</dt><dd className="tabular">{inr(t.grand)}</dd></div>
            {mode === "invoice" ? (
              <>
                <div className="flex items-center justify-between gap-3 pt-2"><dt className="text-muted-foreground">Amount received</dt><dd><Input type="number" min={0} className="h-8 w-32 text-right" value={received} onChange={(e) => setReceived(Number(e.target.value))} /></dd></div>
                <div className={cn("flex justify-between rounded-md px-2 py-1.5 font-semibold", t.balance > 0 ? "bg-warning/15" : "bg-success/10 text-success")}><dt>Balance due</dt><dd className="tabular">{inr(t.balance)}</dd></div>
              </>
            ) : <p className="pt-2 text-xs text-muted-foreground">Quotations do not affect stock or accounts until converted to a sale.</p>}
          </dl>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={saving} onClick={() => save(true)}>Save draft</Button>
            <Button disabled={saving} onClick={() => save(false)}>{saving ? "Saving..." : `Save ${label}`}</Button>
            <Button variant="outline" size="sm" onClick={() => setPreview(true)}><Eye className="size-4" /> Preview</Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Download className="size-4" /> Download</Button>
            <Button variant="outline" size="sm" disabled={saving} onClick={() => save(false)}><Send className="size-4" /> {saving ? "Sending..." : "Save & Email"}</Button>
          </div>
        </Panel>
      </div>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle className="capitalize">{label} preview</DialogTitle><DialogDescription>How the customer will see this document</DialogDescription></DialogHeader>
          <DocumentSheet title={mode === "invoice" ? "TAX INVOICE" : "QUOTATION"} number={mode === "invoice" ? "INV-NEW" : "QT-NEW"} date={docDate} customerId={String(customerId)} lines={lines} received={mode === "invoice" ? received : undefined} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DocumentSheet({ title, number, date, customerId, lines, received, extra }: { title: string; number: string; date: string; customerId: string; lines: Line[]; received?: number | undefined; extra?: ReactNode }) {
  const c = customers.find((x) => String(x.id) === String(customerId)) ?? customers[0] ?? { name: "Customer", address: "—", gstin: "Unregistered" };
  const t = totals(lines, received ?? 0);
  return (
    <div className="rounded-md border border-border bg-card p-5 text-sm">
      <div className="flex flex-wrap justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-start gap-3"><CompanyLogo className="h-12 w-12" /><div><p className="text-base font-semibold">{company.name}</p><p className="text-xs text-muted-foreground">{company.location}</p><p className="text-xs text-muted-foreground">GSTIN {company.gstin} · {company.phone} · {company.email}</p></div></div>
        <div className="text-right"><p className="font-semibold tracking-wide text-accent">{title}</p><p className="font-medium">{number}</p><p className="text-xs text-muted-foreground">{date}</p></div>
      </div>
      <div className="grid gap-4 py-4 sm:grid-cols-2">
        <div><p className="text-xs text-muted-foreground">Bill to</p><p className="font-medium">{c.name}</p><p className="text-muted-foreground">{c.address}</p><p className="font-mono text-xs">{c.gstin ?? "Unregistered"}</p></div>
        {extra}
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Disc</TableHead><TableHead className="text-right">Tax</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
        <TableBody>
          {lines.map((l, i) => (
            <TableRow key={i}><TableCell>{i + 1}</TableCell><TableCell><div>{l.name}</div>{l.description ? <div className="text-xs text-muted-foreground">{l.description}</div> : null}</TableCell><TableCell className="text-right tabular">{l.qty} {l.unit}</TableCell><TableCell className="text-right tabular">{inr2(l.rate)}</TableCell><TableCell className="text-right tabular">{l.discount ? `${l.discount}%` : "—"}</TableCell><TableCell className="text-right tabular">{l.tax}%</TableCell><TableCell className="text-right tabular">{inr2(lineAmount(l))}</TableCell></TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="ml-auto mt-4 max-w-xs space-y-1.5">
        <Row k="Subtotal" v={inr2(t.gross)} /><Row k="Discount" v={`− ${inr2(t.discount)}`} /><Row k="Tax" v={inr2(t.tax)} />
        <div className="flex justify-between border-t border-border pt-1.5 font-semibold"><span>Grand total</span><span className="tabular">{inr(t.grand)}</span></div>
        {received !== undefined ? <><Row k="Received" v={inr(received)} /><div className="flex justify-between font-semibold"><span>Balance due</span><span className="tabular">{inr(t.grand - received)}</span></div></> : null}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="tabular">{v}</dd></div>;
}
/** Standard form field: label, required marker, optional hint / validation error. */
export function Field({ label, children, required, error, hint }: { label: string; children: ReactNode; required?: boolean; error?: string; hint?: string }) {
  const childRequired = isValidElement(children) && Boolean((children.props as { required?: boolean }).required);
  const req = required ?? childRequired;
  return (
    <label className="grid min-w-0 gap-1.5 text-sm">
      <span className="text-xs font-medium text-foreground/80">
        {label}
        {req ? <span className="ml-0.5 text-destructive" aria-hidden>*</span> : null}
      </span>
      {children}
      {error ? <span role="alert" className="text-xs text-destructive">{error}</span> : hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function Timeline({ items }: { items: { id: string; kind: string; when: string; text: string; by: string; customer?: string }[] }) {
  const tone: Record<string, string> = { Sale: "bg-success", Payment: "bg-success", Quotation: "bg-accent", Call: "bg-primary", Message: "bg-chart-3", Email: "bg-chart-4", "Follow-up": "bg-warning", Note: "bg-muted-foreground" };
  if (!items.length) return <EmptyState title="No activity yet" />;
  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {items.map((a) => (
        <li key={a.id} className="relative">
          <span className={cn("absolute -left-[25px] top-1.5 size-2.5 rounded-full ring-4 ring-card", tone[a.kind] ?? "bg-accent")} />
          <p className="text-sm"><span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{a.kind}</span>{a.text}{a.customer ? <span className="text-muted-foreground"> · {a.customer}</span> : null}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{a.when} · {a.by}</p>
        </li>
      ))}
    </ol>
  );
}

export { Paperclip };
