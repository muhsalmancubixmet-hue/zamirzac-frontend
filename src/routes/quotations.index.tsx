import { createFileRoute } from "@tanstack/react-router";
import { quotationSections } from "@/components/sales/registry";
import { APP_TITLE } from "@/config/company";

const section = quotationSections[0]!;
const Comp = section.component;

export const Route = createFileRoute("/quotations/")({
  head: () => ({
    meta: [
      { title: `${section.label} — Quotations — ${APP_TITLE}` },
      { name: "description", content: section.description },
      { property: "og:title", content: `${section.label} — Quotations — ${APP_TITLE}` },
      { property: "og:description", content: section.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Comp />,
});
