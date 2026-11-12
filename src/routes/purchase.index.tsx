import { createFileRoute } from "@tanstack/react-router";
import { purchaseSections } from "@/components/ops/registry";
import { APP_TITLE } from "@/config/company";

const section = purchaseSections[0]!;
const Comp = section.component;

export const Route = createFileRoute("/purchase/")({
  head: () => ({
    meta: [
      { title: `${section.label} — Purchase — ${APP_TITLE}` },
      { name: "description", content: section.description },
      { property: "og:title", content: `${section.label} — Purchase — ${APP_TITLE}` },
      { property: "og:description", content: section.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Comp />,
});
