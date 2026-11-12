import { createFileRoute } from "@tanstack/react-router";
import { EmployeeDetail } from "@/components/hr/employee-sections";
import { APP_TITLE } from "@/config/company";

export const Route = createFileRoute("/employees/view/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.id} — Employee — ${APP_TITLE}` },
      { name: "description", content: "Employee profile with employment, salary, attendance, leave, payroll, documents and travel." },
      { property: "og:title", content: `${params.id} — Employee — ${APP_TITLE}` },
      { property: "og:description", content: "Employee profile with employment, salary, attendance, leave, payroll, documents and travel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  return <EmployeeDetail id={id} />;
}
