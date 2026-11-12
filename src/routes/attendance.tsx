import { createFileRoute } from "@tanstack/react-router";
import { ModuleLayout } from "@/components/erp/ModuleLayout";
import { attendanceSections } from "@/components/hr/registry";

export const Route = createFileRoute("/attendance")({
  component: () => <ModuleLayout title="Attendance & Leave" base="/attendance" sections={attendanceSections} />,
});
