import { createFileRoute } from "@tanstack/react-router";
import { automationSections } from "@/components/hr/registry";
import { APP_TITLE } from "@/config/company";

const section = automationSections[0]!;
const Comp = section.component;

export const Route = createFileRoute("/automation/")({
  head: () => ({
    meta: [
      { title: `${section.label} — Automation — ${APP_TITLE}` },
      { name: "description", content: section.description },
      { property: "og:title", content: `${section.label} — Automation — ${APP_TITLE}` },
      { property: "og:description", content: section.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Comp />,
});
