import { createFileRoute } from "@tanstack/react-router";
import { gstSections } from "@/components/gst/registry";
import { APP_TITLE } from "@/config/company";

const section = gstSections[0]!;
const Comp = section.component;

export const Route = createFileRoute("/gst/")({
  head: () => ({
    meta: [
      { title: `${section.label} — GST — ${APP_TITLE}` },
      { name: "description", content: section.description },
      { property: "og:title", content: `${section.label} — GST — ${APP_TITLE}` },
      { property: "og:description", content: section.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Comp />,
});
