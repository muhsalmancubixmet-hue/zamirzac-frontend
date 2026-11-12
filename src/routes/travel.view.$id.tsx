import { createFileRoute } from "@tanstack/react-router";
import { TravelDetail } from "@/components/hr/travel-sections";
import { APP_TITLE } from "@/config/company";

export const Route = createFileRoute("/travel/view/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.id} — Travel record — ${APP_TITLE}` },
      { name: "description", content: "Travel route, timings, distance, allowance and approval." },
      { property: "og:title", content: `${params.id} — Travel record — ${APP_TITLE}` },
      { property: "og:description", content: "Travel route, timings, distance, allowance and approval." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  return <TravelDetail id={id} />;
}
