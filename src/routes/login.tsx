import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { APP_TITLE } from "@/config/company";
import { companyConfig as company } from "@/config/company";
import { authApi, ApiError } from "@/lib/api";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: `Sign in — ${APP_TITLE}` },
      { name: "description", content: `Sign in to the ${APP_TITLE} workspace.` },
      { property: "og:title", content: `Sign in — ${APP_TITLE}` },
      { property: "og:description", content: `Sign in to the ${APP_TITLE} workspace.` },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    const emailParam = params.get("email");
    const actionParam = params.get("action");

    if (actionParam === "revoke") {
      toast.info("Registration revoked. This invitation has been marked as cancelled.");
      return;
    }

    if (tokenParam) {
      setMagicLoading(true);
      authApi
        .magicLogin(tokenParam)
        .then((res) => {
          toast.success(`Welcome to your workspace, ${res.user.name || res.user.email}!`);
          navigate({ to: "/" });
        })
        .catch((err: unknown) => {
          setMagicLoading(false);
          const msg = err instanceof ApiError ? err.message : "Invalid or expired login link.";
          toast.error(msg);
          if (emailParam) {
            setEmail(emailParam);
            setPassword("");
          }
        });
    } else if (emailParam) {
      setEmail(emailParam);
      setPassword("");
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.login(email.trim(), password);
      toast.success(`Signed in as ${res.user.name || res.user.email} (${res.user.role})`);
      navigate({ to: "/" });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Unable to sign in. Please check backend connection and credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (magicLoading) {
    return (
      <AuthLayout
        title="Signing in to your workspace"
        subtitle="Verifying your onboarding credentials and loading your dashboard..."
      >
        <div className="flex flex-col items-center justify-center py-10 space-y-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            Opening {APP_TITLE} Dashboard...
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Sign in to your workspace"
      subtitle="Use your company email or employee ID to continue."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email or employee ID</Label>
          <Input
            id="email"
            type="email"
            placeholder={`name@${company.email.split("@")[1]}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs font-medium text-accent hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox defaultChecked /> Remember me on this device
        </label>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
