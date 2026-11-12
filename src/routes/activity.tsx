import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { ActivityLogPage } from "@/components/admin/center-sections";
import { APP_TITLE } from "@/config/company";

const title = `Audit Log — ${APP_TITLE}`;
const description = "Audit trail of every action across the ERP.";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell title="Audit Log" breadcrumbs={["Audit Log"]}>
      <div className="space-y-5"><ActivityLogPage /></div>
    </AppShell>
  ),
});
