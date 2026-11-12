import { createFileRoute } from "@tanstack/react-router";
import { ModuleLayout } from "@/components/erp/ModuleLayout";
import { manufacturingSections } from "@/components/ops/registry";

export const Route = createFileRoute("/manufacturing")({
  component: () => <ModuleLayout title="Manufacturing" base="/manufacturing" sections={manufacturingSections} />,
});
