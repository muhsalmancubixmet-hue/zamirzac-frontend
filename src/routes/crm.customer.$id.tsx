import { createFileRoute } from "@tanstack/react-router";
import { CustomerDetail } from "@/components/sales/crm-sections";
import { APP_TITLE } from "@/config/company";

export const Route = createFileRoute("/crm/customer/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.id} — Customer — ${APP_TITLE}` },
      { name: "description", content: "Customer profile with financials, transactions, communication and timeline." },
      { property: "og:title", content: `${params.id} — Customer — ${APP_TITLE}` },
      { property: "og:description", content: "Customer profile with financials, transactions, communication and timeline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  return <CustomerDetail id={id} />;
}
