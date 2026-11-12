import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { APP_TITLE } from "@/config/company";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: `Set a new password — ${APP_TITLE}` },
      { name: "description", content: "Choose a new password for your ERP account." },
      { property: "og:title", content: `Set a new password — ${APP_TITLE}` },
      { property: "og:description", content: "Choose a new password for your ERP account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Use at least 8 characters with a number and a symbol."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          toast.success("Demo only — password was not changed.");
          navigate({ to: "/login" });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="new">New password</Label>
          <Input id="new" type="password" placeholder="••••••••" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input id="confirm" type="password" placeholder="••••••••" />
        </div>
        <Button type="submit" className="w-full">
          Update password
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        <Link to="/login" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
