import { createFileRoute } from "@tanstack/react-router";
import { ModuleLayout } from "@/components/erp/ModuleLayout";
import { payrollSections } from "@/components/hr/registry";

export const Route = createFileRoute("/payroll")({
  component: () => <ModuleLayout title="Payroll" base="/payroll" sections={payrollSections} />,
});
