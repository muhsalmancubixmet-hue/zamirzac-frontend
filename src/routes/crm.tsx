import { createFileRoute } from "@tanstack/react-router";
import { ModuleLayout } from "@/components/erp/ModuleLayout";
import { crmSections } from "@/components/sales/registry";

export const Route = createFileRoute("/crm")({
  component: () => <ModuleLayout title="CRM" base="/crm" sections={crmSections} />,
});
