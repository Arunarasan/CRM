import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { ShieldAlert, Loader2, KeyRound } from "lucide-react";
import api, { MUST_CHANGE_PASSWORD_KEY, signOut } from "@/lib/api";
import { getAuthorities, isFieldEmployeeOnly } from "@/hooks/useAuth";
import Logo from "@/components/brand/Logo";

const MIN_LENGTH = 10;

/**
 * Forced first sign-in step for accounts created with a temporary password (new employees,
 * admin-set or admin-reset passwords). The backend refuses every other API call until this is done.
 */
export default function SetPassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < MIN_LENGTH) {
      setError(`New password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirm) {
      setError("The two new passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/change-password", { currentPassword, newPassword });
      // Changing the password signs out every other device and returns a fresh session for this one.
      if (res.data?.token) localStorage.setItem("token", res.data.token);
      if (res.data?.refreshToken) localStorage.setItem("refreshToken", res.data.refreshToken);
      localStorage.removeItem(MUST_CHANGE_PASSWORD_KEY);
      const home = isFieldEmployeeOnly(getAuthorities()) ? "employee" : "dashboard";
      window.location.href = import.meta.env.BASE_URL + home;
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Could not update the password. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2 text-center items-center">
          <Logo size="lg" />
          <CardDescription className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Choose your own password to continue
          </CardDescription>
        </CardHeader>
        <form onSubmit={submit}>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You signed in with a temporary password. Set a new one of at least {MIN_LENGTH} characters
              that you don't use anywhere else.
            </p>
            {error && (
              <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none" htmlFor="current">Temporary password</label>
              <Input id="current" type="password" autoComplete="current-password" required
                value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none" htmlFor="new">New password</label>
              <Input id="new" type="password" autoComplete="new-password" required minLength={MIN_LENGTH}
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none" htmlFor="confirm">Confirm new password</label>
              <Input id="confirm" type="password" autoComplete="new-password" required
                value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save password
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => signOut()}>
              Sign out
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
