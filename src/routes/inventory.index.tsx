import { createFileRoute } from "@tanstack/react-router";
import { inventorySections } from "@/components/ops/registry";
import { APP_TITLE } from "@/config/company";

const section = inventorySections[0]!;
const Comp = section.component;

export const Route = createFileRoute("/inventory/")({
  head: () => ({
    meta: [
      { title: `${section.label} — Inventory — ${APP_TITLE}` },
      { name: "description", content: section.description },
      { property: "og:title", content: `${section.label} — Inventory — ${APP_TITLE}` },
      { property: "og:description", content: section.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Comp />,
});
