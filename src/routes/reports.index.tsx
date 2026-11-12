import { createFileRoute } from "@tanstack/react-router";
import { reportSections } from "@/components/admin/registry";
import { APP_TITLE } from "@/config/company";

const section = reportSections[0]!;
const Comp = section.component;
const title = `${section.label} — Reports — ${APP_TITLE}`;

export const Route = createFileRoute("/reports/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: section.description },
      { property: "og:title", content: title },
      { property: "og:description", content: section.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Comp />,
});
