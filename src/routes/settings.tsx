import { createFileRoute } from "@tanstack/react-router";
import { ModuleLayout } from "@/components/erp/ModuleLayout";
import { settingSections } from "@/components/admin/registry";

export const Route = createFileRoute("/settings")({
  component: () => <ModuleLayout title="Settings" base="/settings" sections={settingSections} />,
});
