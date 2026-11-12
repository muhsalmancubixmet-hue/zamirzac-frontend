import { useEffect, useRef, useState } from "react";
import { Download, Eye, FileImage, FileSpreadsheet, FileText, FileArchive, FileType, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { KpiCard, StatusBadge } from "@/components/erp/primitives";
import { DataTable } from "@/components/erp/DataTable";
import { SectionHeader } from "@/components/erp/ModuleLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/sales/shared";
import { currentUser } from "@/lib/user";
import { documents as seed, type Doc, type DocCategory, type DocType } from "@/data/admin";
import { api } from "@/lib/api";

const icons: Record<DocType, typeof FileText> = { PDF: FileText, Image: FileImage, Excel: FileSpreadsheet, Word: FileType, ZIP: FileArchive };
const cats: DocCategory[] = ["Customers", "Suppliers", "Sales", "Purchases", "Employees", "Quotations", "Products", "Other"];
const badge = (s: Doc["status"]) => <StatusBadge status={s === "Verified" ? "active" : s === "Archived" ? "inactive" : "pending"} label={s} />;

export function DocumentsPage() {
  const [rows, setRows] = useState<(Doc & { fileUrl?: string })[]>(seed);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<(Doc & { fileUrl?: string }) | null>(null);
  const [upload, setUpload] = useState(false);

  const fetchDocs = () => {
    setLoading(true);
    api.get<any>("/documents/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        if (list.length > 0) {
          const mapped: (Doc & { fileUrl?: string })[] = list.map((d: any) => ({
            id: d.code || `DOC-${d.id}`,
            name: d.name,
            type: (d.type || "PDF") as DocType,
            category: (d.category || "Other") as DocCategory,
            record: d.record || "—",
            related: d.related || d.record || "—",
            by: d.by || "System",
            date: d.date || "Recent",
            iso: d.iso || new Date().toISOString().slice(0, 10),
            size: d.size || "1.0 MB",
            status: (d.status || "Pending review") as Doc["status"],
            fileUrl: d.file || undefined,
          }));
          setRows(mapped);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const total = rows.reduce((s, d) => s + parseFloat(d.size || "0"), 0);
  return (
    <>
      <SectionHeader title="Documents" description="All files attached to customers, suppliers, sales, purchases, employees, quotations and products." actions={<Button size="sm" onClick={() => setUpload(true)}><Upload className="size-4" /> Upload</Button>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Documents" value={String(rows.length)} hint={`${total.toFixed(1)} MB used`} />
        <KpiCard label="Pending review" value={String(rows.filter((d) => d.status === "Pending review").length)} tone="down" hint="Need verification" />
        <KpiCard label="Customer files" value={String(rows.filter((d) => d.category === "Customers").length)} hint="Order letters, student photos" />
        <KpiCard label="Uploaded this week" value={String(rows.filter((d) => d.iso >= "2026-09-21").length)} hint="Recent" />
      </div>
      <DataTable
        rows={rows}
        getId={(d) => d.id}
        entity="document"
        search={(d) => `${d.name} ${d.related} ${d.record} ${d.by}`}
        searchPlaceholder="Search file, record or uploader"
        date={(d) => d.iso}
        filters={[{ label: "Category", get: (d) => d.category }, { label: "Type", get: (d) => d.type }, { label: "Status", get: (d) => d.status }]}
        onRowClick={setPreview}
        columns={[
          { key: "name", header: "File name", sort: (d) => d.name, render: (d) => { const I = icons[d.type] || FileText; return <span className="flex items-center gap-2.5"><span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><I className="size-4" /></span><span className="min-w-0"><span className="block max-w-72 truncate font-medium">{d.name}</span><span className="block text-xs text-muted-foreground">{d.id}</span></span></span>; } },
          { key: "type", header: "Type", render: (d) => d.type },
          { key: "rel", header: "Related record", render: (d) => <span><span className="block">{d.record}</span><span className="block max-w-52 truncate text-xs text-muted-foreground">{d.category} · {d.related}</span></span> },
          { key: "by", header: "Uploaded by", sort: (d) => d.by, render: (d) => d.by },
          { key: "date", header: "Upload date", sort: (d) => d.iso, render: (d) => d.date },
          { key: "size", header: "Size", align: "right", sort: (d) => parseFloat(d.size), render: (d) => d.size },
          { key: "status", header: "Status", render: (d) => badge(d.status) },
        ]}
        extraActions={[
          { label: "Preview", icon: <Eye className="size-4" />, onClick: setPreview },
          { label: "Download", icon: <Download className="size-4" />, onClick: (d) => downloadDoc(d) },
        ]}
      />
      <PreviewDialog doc={preview} onClose={() => setPreview(null)} />
      <UploadDialog open={upload} onClose={() => setUpload(false)} onDone={() => fetchDocs()} />
    </>
  );
}

function downloadDoc(doc: Doc & { fileUrl?: string }) {
  if (doc.fileUrl) {
    window.open(doc.fileUrl, "_blank");
    toast.success(`Opening ${doc.name}`);
    return;
  }
  const content = `ERP Document Record\nName: ${doc.name}\nCategory: ${doc.category}\nRecord: ${doc.record}\nUploaded By: ${doc.by}\nUpload Date: ${doc.date}\nSize: ${doc.size}\nStatus: ${doc.status}\n`;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = doc.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success(`Downloaded ${doc.name}`);
}

function PreviewDialog({ doc, onClose }: { doc: Doc | null; onClose: () => void }) {
  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {doc ? (
          <>
            <DialogHeader><DialogTitle className="truncate pr-6">{doc.name}</DialogTitle><DialogDescription>{doc.category} · {doc.record} · {doc.size} · uploaded {doc.date} by {doc.by}</DialogDescription></DialogHeader>
            <div className="flex h-80 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
              {doc.type === "Image" ? (
                <div className="w-64 rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
                  <div className="h-8 rounded bg-primary" />
                  <div className="mt-3 flex gap-3"><div className="size-16 rounded bg-muted" /><div className="flex-1 space-y-2"><div className="h-2.5 w-3/4 rounded bg-muted-foreground/30" /><div className="h-2 w-1/2 rounded bg-muted-foreground/20" /><div className="h-2 w-2/3 rounded bg-muted-foreground/20" /></div></div>
                  <p className="mt-3 text-center text-[10px] text-muted-foreground">Image preview</p>
                </div>
              ) : doc.type === "PDF" ? (
                <div className="h-72 w-56 space-y-2 rounded border border-border bg-card p-5 shadow-[var(--shadow-card)]">
                  <div className="h-3 w-1/2 rounded bg-primary/70" />
                  {Array.from({ length: 12 }, (_, i) => <div key={i} className="h-1.5 rounded bg-muted-foreground/20" style={{ width: `${60 + ((i * 17) % 40)}%` }} />)}
                  <p className="pt-3 text-center text-[10px] text-muted-foreground">PDF page 1 of 2 · preview</p>
                </div>
              ) : (
                <div className="text-center"><FileArchive className="mx-auto size-10 text-muted-foreground" /><p className="mt-2 text-sm font-medium">Preview not available for {doc.type} files</p><p className="text-xs text-muted-foreground">Download the file to open it.</p></div>
              )}
            </div>
            <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={() => downloadDoc(doc)}><Download className="size-4" /> Download</Button></DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (d: any) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [cat, setCat] = useState<DocCategory>("Customers");
  const [record, setRecord] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const close = () => { setFile(null); setRecord(""); setSubmitting(false); onClose(); };

  const start = async () => {
    if (!file) { toast.error("Choose a file first"); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error("Files must be under 20 MB"); return; }
    const allowedExts = ["pdf", "jpg", "jpeg", "png", "webp", "xls", "xlsx", "csv", "doc", "docx", "zip"];
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!allowedExts.includes(ext)) {
      toast.error("Invalid file type. Only PDF, Office documents, images, and ZIP files are permitted.");
      return;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

    setSubmitting(true);
    try {
      const type: DocType = ext === "pdf" ? "PDF" : ["jpg", "jpeg", "png", "webp"].includes(ext) ? "Image" : ["xls", "xlsx", "csv"].includes(ext) ? "Excel" : ["doc", "docx"].includes(ext) ? "Word" : "ZIP";
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", safeName);
      formData.append("file_type", type);
      formData.append("category", cat);
      formData.append("related_record", record || "General");
      formData.append("status", "Pending review");

      const res = await api.post<any>("/documents/", formData);
      toast.success(`${safeName} uploaded successfully!`);
      onDone(res);
      close();
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload document to backend");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Upload document</DialogTitle><DialogDescription>PDF, images, Excel, Word or ZIP up to 20 MB. Stored securely on server.</DialogDescription></DialogHeader>
        <button type="button" onClick={() => ref.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-border-strong px-4 py-8 text-center hover:bg-muted/40">
          <Upload className="size-6 text-muted-foreground" />
          <span className="text-sm font-medium">{file ? file.name : "Click to choose a file"}</span>
          <span className="text-xs text-muted-foreground">{file ? `${(file.size / 1024).toFixed(0)} KB` : "or drag it here"}</span>
        </button>
        <input ref={ref} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.docx,.doc,.zip" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category"><Select value={cat} onValueChange={(v) => setCat(v as DocCategory)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Related record"><Input value={record} onChange={(e) => setRecord(e.target.value)} placeholder="e.g. INV-2640 or CUS-1004" /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={close}>Cancel</Button><Button onClick={start} disabled={submitting}>{submitting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Upload className="size-4" />} Upload</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
