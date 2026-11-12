import { createFileRoute } from "@tanstack/react-router";
import { InvoiceDetail } from "@/components/sales/sales-sections";
import { APP_TITLE } from "@/config/company";

export const Route = createFileRoute("/sales/invoice/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.id} — Sales invoice — ${APP_TITLE}` },
      { name: "description", content: "Invoice details with products, taxes, payments, attachments and history." },
      { property: "og:title", content: `${params.id} — Sales invoice — ${APP_TITLE}` },
      { property: "og:description", content: "Invoice details with products, taxes, payments, attachments and history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  return <InvoiceDetail id={id} />;
}
