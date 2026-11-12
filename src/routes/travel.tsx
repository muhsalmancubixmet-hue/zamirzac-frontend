import { createFileRoute } from "@tanstack/react-router";
import { ModuleLayout } from "@/components/erp/ModuleLayout";
import { travelSections } from "@/components/hr/registry";

export const Route = createFileRoute("/travel")({
  component: () => <ModuleLayout title="Travel" base="/travel" sections={travelSections} />,
});
