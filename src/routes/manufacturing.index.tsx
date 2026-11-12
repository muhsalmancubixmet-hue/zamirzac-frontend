import { createFileRoute } from "@tanstack/react-router";
import { manufacturingSections } from "@/components/ops/registry";
import { APP_TITLE } from "@/config/company";

const section = manufacturingSections[0]!;
const Comp = section.component;

export const Route = createFileRoute("/manufacturing/")({
  head: () => ({
    meta: [
      { title: `${section.label} — Manufacturing — ${APP_TITLE}` },
      { name: "description", content: section.description },
      { property: "og:title", content: `${section.label} — Manufacturing — ${APP_TITLE}` },
      { property: "og:description", content: section.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Comp />,
});
