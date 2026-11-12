import { createFileRoute } from "@tanstack/react-router";
import { ModuleLayout } from "@/components/erp/ModuleLayout";
import { salesSections } from "@/components/sales/registry";

export const Route = createFileRoute("/sales")({
  component: () => <ModuleLayout title="Sales" base="/sales" sections={salesSections} />,
});
