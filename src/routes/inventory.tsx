import { createFileRoute } from "@tanstack/react-router";
import { ModuleLayout } from "@/components/erp/ModuleLayout";
import { inventorySections } from "@/components/ops/registry";

export const Route = createFileRoute("/inventory")({
  component: () => <ModuleLayout title="Inventory" base="/inventory" sections={inventorySections} />,
});
