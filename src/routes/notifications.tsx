import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { NotificationsPage } from "@/components/admin/center-sections";
import { APP_TITLE } from "@/config/company";

const title = `Notifications — ${APP_TITLE}`;
const description = "Notification centre for stock, payment, approval and automation alerts.";

export const Route = createFileRoute("/notifications")({
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
    <AppShell title="Notifications" breadcrumbs={["Notifications"]}>
      <div className="space-y-5"><NotificationsPage /></div>
    </AppShell>
  ),
});
