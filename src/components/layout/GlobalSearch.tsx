import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight, Boxes, Building2, FileText, FolderClosed, IdCard, ReceiptIndianRupee, Search, ShoppingCart, Truck } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { searchIndex } from "@/data/admin";

const icons: Record<string, typeof Search> = { Customers: Building2, Suppliers: Truck, Products: Boxes, Sales: ReceiptIndianRupee, Quotations: FileText, Purchases: ShoppingCart, Employees: IdCard, Documents: FolderClosed, Transactions: ArrowLeftRight };
const order = Object.keys(icons);

export function GlobalSearch({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); } };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const hits = term ? searchIndex.filter((h) => `${h.title} ${h.meta}`.toLowerCase().includes(term)) : searchIndex.filter((_, i) => i % 9 === 0);
    return order.map((g) => ({ g, items: hits.filter((h) => h.group === g).slice(0, term ? 6 : 2) })).filter((x) => x.items.length);
  }, [q]);

  const go = (to: string) => { setOpen(false); setQ(""); navigate({ to: to as "/" }); };

  return (
    <>
      {compact ? (
        <button onClick={() => setOpen(true)} className="flex h-7 w-full items-center gap-2 text-sm text-muted-foreground"><Search className="size-4" /> Search…</button>
      ) : (
        <button onClick={() => setOpen(true)} className="relative hidden h-9 w-56 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-left text-sm text-muted-foreground hover:bg-muted/50 md:flex lg:w-72">
          <Search className="size-4" /><span className="flex-1 truncate">Search customers, invoices, items…</span>
          <kbd className="rounded border border-border bg-muted px-1.5 font-mono text-[10px]">Ctrl K</kbd>
        </button>
      )}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput value={q} onValueChange={setQ} placeholder="Search customers, suppliers, products, invoices, quotations, employees…" />
        <CommandList className="max-h-[420px]">
          <CommandEmpty>No results for “{q}”.</CommandEmpty>
          {groups.map(({ g, items }, gi) => {
            const I = icons[g]!;
            return (
              <div key={g}>
                {gi ? <CommandSeparator /> : null}
                <CommandGroup heading={q ? g : `${g} · suggestions`}>
                  {items.map((h) => (
                    <CommandItem key={`${g}-${h.title}-${h.meta}`} value={`${g} ${h.title} ${h.meta}`} onSelect={() => go(h.to)}>
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><I className="size-3.5" /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{h.title}</span><span className="block truncate text-xs text-muted-foreground">{h.meta}</span></span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
