import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MailCheck } from "lucide-react";
import { APP_TITLE } from "@/config/company";
import { companyConfig as company } from "@/config/company";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: `Forgot password — ${APP_TITLE}` },
      { name: "description", content: "Request a password reset link for your ERP account." },
      { property: "og:title", content: `Forgot password — ${APP_TITLE}` },
      {
        property: "og:description",
        content: "Request a password reset link for your ERP account.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email a secure reset link to your registered address."
    >
      {sent ? (
        <div className="space-y-4">
          <Alert>
            <MailCheck className="size-4" />
            <AlertTitle>Reset link sent</AlertTitle>
            <AlertDescription>
              If the address exists, a reset link will arrive within a few minutes.
            </AlertDescription>
          </Alert>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/reset-password">Open reset screen</Link>
          </Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Registered email</Label>
            <Input id="email" type="email" placeholder={`you@${company.email.split("@")[1]}`} />
          </div>
          <Button type="submit" className="w-full">
            Send reset link
          </Button>
        </form>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        <Link to="/login" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
