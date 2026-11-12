import { createFileRoute } from "@tanstack/react-router";
import { ModuleLayout } from "@/components/erp/ModuleLayout";
import { quotationSections } from "@/components/sales/registry";

export const Route = createFileRoute("/quotations")({
  component: () => <ModuleLayout title="Quotations" base="/quotations" sections={quotationSections} />,
});
