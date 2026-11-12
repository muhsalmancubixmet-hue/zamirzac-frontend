import { createFileRoute } from "@tanstack/react-router";
import { QuoteDetail } from "@/components/sales/quote-sections";
import { APP_TITLE } from "@/config/company";

export const Route = createFileRoute("/quotations/view/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.id} — Quotation — ${APP_TITLE}` },
      { name: "description", content: "Quotation details with items, terms, attachments and history." },
      { property: "og:title", content: `${params.id} — Quotation — ${APP_TITLE}` },
      { property: "og:description", content: "Quotation details with items, terms, attachments and history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  return <QuoteDetail id={id} />;
}
