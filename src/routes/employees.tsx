import { createFileRoute } from "@tanstack/react-router";
import { ModuleLayout } from "@/components/erp/ModuleLayout";
import { employeeSections } from "@/components/hr/registry";

export const Route = createFileRoute("/employees")({
  component: () => <ModuleLayout title="Employees" base="/employees" sections={employeeSections} />,
});
