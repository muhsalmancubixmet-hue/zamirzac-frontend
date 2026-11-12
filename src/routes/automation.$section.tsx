import { createFileRoute, notFound } from "@tanstack/react-router";
import { automationSections } from "@/components/hr/registry";
import { EmptyState } from "@/components/erp/primitives";
import { APP_TITLE } from "@/config/company";

export const Route = createFileRoute("/automation/$section")({
  loader: ({ params }) => {
    const s = automationSections.find((x) => x.slug && x.slug === params.section);
    if (!s) throw notFound();
    return { slug: s.slug };
  },
  head: ({ loaderData }) => {
    const s = automationSections.find((x) => x.slug === loaderData?.slug);
    if (!s) return { meta: [{ title: `Not found — ${APP_TITLE}` }, { name: "robots", content: "noindex" }] };
    const title = `${s.label} — Automation — ${APP_TITLE}`;
    return {
      meta: [
        { title },
        { name: "description", content: s.description },
        { property: "og:title", content: title },
        { property: "og:description", content: s.description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: SectionPage,
  notFoundComponent: SectionNotFound,
});

function SectionPage() {
  const { slug } = Route.useLoaderData();
  const section = automationSections.find((x) => x.slug === slug || x.aliases?.includes(slug)) ?? automationSections[0];
  const Comp = section?.component;
  if (!Comp) return <SectionNotFound />;
  return <Comp />;
}

function SectionNotFound() {
  return <EmptyState title="Page not found" description="This Automation page does not exist. Pick a section from the menu." />;
}
