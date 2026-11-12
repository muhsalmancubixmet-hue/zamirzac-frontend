import { createFileRoute } from "@tanstack/react-router";
import { ModuleLayout } from "@/components/erp/ModuleLayout";
import { gstSections } from "@/components/gst/registry";

export const Route = createFileRoute("/gst")({
  component: () => <ModuleLayout title="GST" base="/gst" sections={gstSections} />,
});
