import { cn } from "@/lib/utils";
import { companyConfig } from "@/config/company";

/** Company logo from the central config. Keeps original proportions (object-contain) at any size. */
export function CompanyLogo({ className, tile }: { className?: string; tile?: boolean }) {
  const img = <img src={companyConfig.logo} alt={`${companyConfig.name} logo`} className={cn("object-contain", tile ? "size-full" : className ?? "size-8")} />;
  // On dark surfaces the logo sits on a white tile so its original colours stay untouched.
  return tile ? <span className={cn("flex shrink-0 items-center justify-center rounded-md bg-card p-1", className ?? "size-8")}>{img}</span> : img;
}
