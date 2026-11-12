import { createFileRoute } from "@tanstack/react-router";
import { accountingSections } from "@/components/accounting/registry";
import { APP_TITLE } from "@/config/company";

const section = accountingSections[0]!;
const Comp = section.component;

export const Route = createFileRoute("/accounting/")({
  head: () => ({
    meta: [
      { title: `${section.label} — Accounting — ${APP_TITLE}` },
      { name: "description", content: section.description },
      { property: "og:title", content: `${section.label} — Accounting — ${APP_TITLE}` },
      { property: "og:description", content: section.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Comp />,
});
