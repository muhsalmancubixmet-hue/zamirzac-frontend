import { createFileRoute } from "@tanstack/react-router";
import { crmSections } from "@/components/sales/registry";
import { APP_TITLE } from "@/config/company";

const section = crmSections[0]!;
const Comp = section.component;

export const Route = createFileRoute("/crm/")({
  head: () => ({
    meta: [
      { title: `${section.label} — CRM — ${APP_TITLE}` },
      { name: "description", content: section.description },
      { property: "og:title", content: `${section.label} — CRM — ${APP_TITLE}` },
      { property: "og:description", content: section.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Comp />,
});
