import { createFileRoute, notFound } from "@tanstack/react-router";
import { reportSections } from "@/components/admin/registry";
import { EmptyState } from "@/components/erp/primitives";
import { APP_TITLE } from "@/config/company";

export const Route = createFileRoute("/reports/$section")({
  loader: ({ params }) => {
    const s = reportSections.find((x) => x.slug && x.slug === params.section);
    if (!s) throw notFound();
    return { slug: s.slug };
  },
  head: ({ loaderData }) => {
    const s = reportSections.find((x) => x.slug === loaderData?.slug);
    if (!s) return { meta: [{ title: `Not found — ${APP_TITLE}` }, { name: "robots", content: "noindex" }] };
    const title = `${s.label} — Reports — ${APP_TITLE}`;
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
  const section = reportSections.find((x) => x.slug === slug || x.aliases?.includes(slug)) ?? reportSections[0];
  const Comp = section?.component;
  if (!Comp) return <SectionNotFound />;
  return <Comp />;
}

function SectionNotFound() {
  return <EmptyState title="Page not found" description="This Reports page does not exist. Pick a section from the menu." />;
}
