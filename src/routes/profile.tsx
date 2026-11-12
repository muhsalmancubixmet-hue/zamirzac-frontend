import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Panel } from "@/components/erp/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { APP_TITLE } from "@/config/company";
import { authApi, getStoredUser, getAccessToken, getRefreshToken, type AuthUser } from "@/lib/api";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: `My profile — ${APP_TITLE}` },
      { name: "description", content: "View your ERP profile details and change your password." },
      { property: "og:title", content: `My profile — ${APP_TITLE}` },
      {
        property: "og:description",
        content: "View your ERP profile details and change your password.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | any>(null);
  const [loading, setLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Profile form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res: any = await authApi.me();
      if (res) {
        setUser(res);
        setName(res.name || "");
        setPhone(res.phone || "");
        setDepartment(res.department || "");
      }
    } catch {
      // Fallback gracefully to cached session
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = getAccessToken();
      const refresh = getRefreshToken();
      if (!token && !refresh) {
        toast.error("Please sign in to access your profile settings.");
        navigate({ to: "/login" });
        return;
      }
    }
    const cached = getStoredUser();
    if (cached) {
      setUser(cached);
      setName(cached.name || "");
      setPhone(cached.phone || "");
      setDepartment(cached.department || "");
    }
    loadProfile();
  }, [navigate]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Full name cannot be empty");
      return;
    }
    try {
      setSavingProfile(true);
      const updated = await authApi.updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        department: department.trim(),
      });
      setUser(updated);
      toast.success("Profile details updated successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    try {
      setSavingPassword(true);
      const res = await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success(res.message || "Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = (name || user?.name || "AD")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "AD";

  const userRole = user?.role_name || user?.role || "Staff";
  const userBranch = user?.branch_name || user?.branch || "Kochi Head Office";

  return (
    <AppShell title="My profile" breadcrumbs={["Account", "Profile"]}>
      <PageHeader title="My profile" description="Your account details and security settings." />

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Profile details</TabsTrigger>
          <TabsTrigger value="security">Password & security</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 grid gap-4 lg:grid-cols-3">
          <Panel className="lg:col-span-1">
            <div className="flex items-center gap-3">
              <span className="flex size-14 items-center justify-center rounded-md bg-primary text-lg font-semibold text-primary-foreground">
                {initials}
              </span>
              <div>
                <p className="font-semibold text-foreground">{user?.name || "Admin"}</p>
                <p className="text-sm text-muted-foreground">{userRole}</p>
                <Badge variant="outline" className="mt-1.5">
                  {userBranch}
                </Badge>
              </div>
            </div>
            <Separator className="my-4" />
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium text-foreground">{user?.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="font-medium text-foreground">{user?.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Department</dt>
                <dd className="font-medium text-foreground">{user?.department || "General"}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Edit details" className="lg:col-span-2">
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleProfileSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dept">Department</Label>
                <Input
                  id="dept"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Sales, Accounts, Operations..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mail">Email (Read only)</Label>
                <Input id="mail" value={user?.email || ""} disabled className="bg-muted/50 cursor-not-allowed" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98460 00000"
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={savingProfile}>
                  {savingProfile ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  {savingProfile ? "Saving changes..." : "Save changes"}
                </Button>
              </div>
            </form>
          </Panel>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Panel title="Change password" className="max-w-xl">
            <form className="space-y-4" onSubmit={handlePasswordSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="current">Current password</Label>
                <div className="relative">
                  <Input
                    id="current"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                  >
                    {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new">New password</Label>
                <div className="relative">
                  <Input
                    id="new"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm new password</Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={savingPassword}>
                {savingPassword ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {savingPassword ? "Updating password..." : "Update password"}
              </Button>
            </form>
          </Panel>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
