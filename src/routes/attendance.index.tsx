import { createFileRoute } from "@tanstack/react-router";
import { attendanceSections } from "@/components/hr/registry";
import { APP_TITLE } from "@/config/company";

const section = attendanceSections[0]!;
const Comp = section.component;

export const Route = createFileRoute("/attendance/")({
  head: () => ({
    meta: [
      { title: `${section.label} — Attendance & Leave — ${APP_TITLE}` },
      { name: "description", content: section.description },
      { property: "og:title", content: `${section.label} — Attendance & Leave — ${APP_TITLE}` },
      { property: "og:description", content: section.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Comp />,
});
