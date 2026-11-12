import { createFileRoute } from "@tanstack/react-router";
import { ModuleLayout } from "@/components/erp/ModuleLayout";
import { purchaseSections } from "@/components/ops/registry";

export const Route = createFileRoute("/purchase")({
  component: () => <ModuleLayout title="Purchase" base="/purchase" sections={purchaseSections} />,
});
