import { createFileRoute } from "@tanstack/react-router";
import { salesSections } from "@/components/sales/registry";
import { APP_TITLE } from "@/config/company";

const section = salesSections[0]!;
const Comp = section.component;

export const Route = createFileRoute("/sales/")({
  head: () => ({
    meta: [
      { title: `${section.label} — Sales — ${APP_TITLE}` },
      { name: "description", content: section.description },
      { property: "og:title", content: `${section.label} — Sales — ${APP_TITLE}` },
      { property: "og:description", content: section.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Comp />,
});
