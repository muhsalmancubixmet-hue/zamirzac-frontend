import { createFileRoute } from "@tanstack/react-router";
import { ModuleLayout } from "@/components/erp/ModuleLayout";
import { accountingSections } from "@/components/accounting/registry";

export const Route = createFileRoute("/accounting")({
  component: () => <ModuleLayout title="Accounting" base="/accounting" sections={accountingSections} />,
});
