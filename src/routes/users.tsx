import { createFileRoute } from "@tanstack/react-router";
import { ModuleLayout } from "@/components/erp/ModuleLayout";
import { userSections } from "@/components/admin/registry";

export const Route = createFileRoute("/users")({
  component: () => <ModuleLayout title="Users & Roles" base="/users" sections={userSections} />,
});
