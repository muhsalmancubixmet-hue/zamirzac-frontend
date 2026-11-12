import { createFileRoute } from "@tanstack/react-router";
import { ModuleLayout } from "@/components/erp/ModuleLayout";
import { automationSections } from "@/components/hr/registry";

export const Route = createFileRoute("/automation")({
  component: () => <ModuleLayout title="Automation" base="/automation" sections={automationSections} />,
});
