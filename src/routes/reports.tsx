import { createFileRoute } from "@tanstack/react-router";
import { ModuleLayout } from "@/components/erp/ModuleLayout";
import { reportSections } from "@/components/admin/registry";

export const Route = createFileRoute("/reports")({
  component: () => <ModuleLayout title="Reports" base="/reports" sections={reportSections} />,
});
