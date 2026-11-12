import { Fragment } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr2 } from "@/components/sales/shared";
import { pTotals, type Item, type PLine } from "@/data/ops";

export const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);
export const tip = { borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 };
export const axis = { tickLine: false, axisLine: false, fontSize: 12 } as const;
export const k = (n: number) => (Math.abs(n) >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${Math.round(n / 1000)}k`);
export const qty = (n: number, unit?: string) => `${n.toLocaleString("en-IN", { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ""}`;
export const chartColors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];
export const short = (s: string) => (s || "").split(/[,(]/)[0]?.trim() || "";

export function TypeBadge({ type }: { type: Item["type"] }) {
  const cls = {
    "Raw Material": "border-chart-3/40 bg-chart-3/10 text-foreground",
    "Finished Good": "border-primary/30 bg-primary/10 text-primary",
    Consumable: "border-border bg-muted text-muted-foreground",
    Service: "border-accent/30 bg-accent/10 text-accent",
  }[type];
  return <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", cls)}>{type}</span>;
}

export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={cn("flex size-6 items-center justify-center rounded-full border text-xs font-semibold tabular",
            i < current ? "border-success bg-success text-success-foreground" : i === current ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>
            {i < current ? <Check className="size-3.5" /> : i + 1}
          </span>
          <span className={cn(i === current ? "font-medium text-foreground" : "text-muted-foreground")}>{s}</span>
          {i < steps.length - 1 ? <span className="mx-1 hidden h-px w-8 bg-border sm:block" /> : null}
        </li>
      ))}
    </ol>
  );
}

export function LineEditor({ lines, onChange, catalog, readOnly }: { lines: PLine[]; onChange: (l: PLine[]) => void; catalog: Item[]; readOnly?: boolean }) {
  const t = pTotals(lines);
  const upd = (i: number, p: Partial<PLine>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...p } : l)));
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead className="min-w-64">Product</TableHead><TableHead className="w-24 text-right">Qty</TableHead><TableHead className="w-16">Unit</TableHead>
          <TableHead className="w-28 text-right">Rate</TableHead><TableHead className="w-20 text-right">Disc %</TableHead><TableHead className="w-20 text-right">GST %</TableHead>
          <TableHead className="w-32 text-right">Amount</TableHead>{readOnly ? null : <TableHead className="w-10" />}
        </TableRow></TableHeader>
        <TableBody>
          {lines.map((l, i) => {
            const item = catalog.find((c) => c.code === l.code);
            const amount = l.qty * l.rate * (1 - l.discount / 100) * (1 + l.tax / 100);
            return (
              <TableRow key={i}>
                <TableCell>{readOnly ? <span className="text-sm">{item?.name ?? l.code}</span> : (
                  <Select value={l.code} onValueChange={(v) => { const c = catalog.find((x) => x.code === v)!; upd(i, { code: v, rate: c.purchase, tax: c.tax }); }}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{catalog.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>)}
                </TableCell>
                {(["qty", "rate", "discount", "tax"] as const).map((f, n) => (
                  <Fragment key={f}>
                    <TableCell className="text-right tabular">{readOnly ? (f === "rate" ? inr2(l.rate) : l[f]) : <Input type="number" value={l[f]} onChange={(e) => upd(i, { [f]: Number(e.target.value) })} className="h-8 text-right" />}</TableCell>
                    {n === 0 ? <TableCell key="unit" className="text-muted-foreground">{item?.unit}</TableCell> : null}
                  </Fragment>
                ))}
                <TableCell className="text-right tabular font-medium">{inr2(amount)}</TableCell>
                {readOnly ? null : <TableCell><Button variant="ghost" size="icon" className="size-8" aria-label="Remove line" onClick={() => onChange(lines.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button></TableCell>}
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow><TableCell colSpan={6} className="text-right text-muted-foreground">Subtotal (after ₹{Math.round(t.discount).toLocaleString("en-IN")} discount)</TableCell><TableCell className="text-right tabular">{inr2(t.sub)}</TableCell>{readOnly ? null : <TableCell />}</TableRow>
          <TableRow><TableCell colSpan={6} className="text-right text-muted-foreground">GST</TableCell><TableCell className="text-right tabular">{inr2(t.tax)}</TableCell>{readOnly ? null : <TableCell />}</TableRow>
          <TableRow><TableCell colSpan={6} className="text-right font-semibold">Total</TableCell><TableCell className="text-right tabular font-semibold">{inr2(t.total)}</TableCell>{readOnly ? null : <TableCell />}</TableRow>
        </TableFooter>
      </Table>
      {readOnly ? null : (
        <div className="p-3"><Button variant="outline" size="sm" onClick={() => {
          const c = catalog[0];
          if (!c) {
            onChange([...lines, { code: "ITEM-01", qty: 1, rate: 100, discount: 0, tax: 18 }]);
          } else {
            onChange([...lines, { code: c.code, qty: 1, rate: c.purchase, discount: 0, tax: c.tax }]);
          }
        }}><Plus className="size-4" /> Add line</Button></div>
      )}
    </div>
  );
}
