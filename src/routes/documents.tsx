import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { DocumentsPage } from "@/components/admin/documents-section";
import { APP_TITLE } from "@/config/company";

const title = `Documents — ${APP_TITLE}`;
const description = "Central library of customer, supplier, sales, purchase, employee and product files.";

export const Route = createFileRoute("/documents")({
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
    <AppShell title="Documents" breadcrumbs={["Documents"]}>
      <div className="space-y-5"><DocumentsPage /></div>
    </AppShell>
  ),
});
