import { createFileRoute } from "@tanstack/react-router";
import { employeeSections } from "@/components/hr/registry";
import { APP_TITLE } from "@/config/company";

const section = employeeSections[0]!;
const Comp = section.component;

export const Route = createFileRoute("/employees/")({
  head: () => ({
    meta: [
      { title: `${section.label} — Employees — ${APP_TITLE}` },
      { name: "description", content: section.description },
      { property: "og:title", content: `${section.label} — Employees — ${APP_TITLE}` },
      { property: "og:description", content: section.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Comp />,
});
