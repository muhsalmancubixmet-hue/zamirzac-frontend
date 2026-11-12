import { createFileRoute } from "@tanstack/react-router";
import { userSections } from "@/components/admin/registry";
import { APP_TITLE } from "@/config/company";

const section = userSections[0]!;
const Comp = section.component;
const title = `${section.label} — Users & Roles — ${APP_TITLE}`;

export const Route = createFileRoute("/users/")({
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
