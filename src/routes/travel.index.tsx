import { createFileRoute } from "@tanstack/react-router";
import { travelSections } from "@/components/hr/registry";
import { APP_TITLE } from "@/config/company";

const section = travelSections[0]!;
const Comp = section.component;

export const Route = createFileRoute("/travel/")({
  head: () => ({
    meta: [
      { title: `${section.label} — Travel — ${APP_TITLE}` },
      { name: "description", content: section.description },
      { property: "og:title", content: `${section.label} — Travel — ${APP_TITLE}` },
      { property: "og:description", content: section.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Comp />,
});
