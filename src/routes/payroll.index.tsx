import { createFileRoute } from "@tanstack/react-router";
import { payrollSections } from "@/components/hr/registry";
import { APP_TITLE } from "@/config/company";

const section = payrollSections[0]!;
const Comp = section.component;

export const Route = createFileRoute("/payroll/")({
  head: () => ({
    meta: [
      { title: `${section.label} — Payroll — ${APP_TITLE}` },
      { name: "description", content: section.description },
      { property: "og:title", content: `${section.label} — Payroll — ${APP_TITLE}` },
      { property: "og:description", content: section.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Comp />,
});
