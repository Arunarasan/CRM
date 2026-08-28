import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Loader2 } from "lucide-react";
import api from "@/lib/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login", { email, password });
      
      if (response.data && response.data.token) {
        localStorage.setItem("token", response.data.token);
        if (response.data.refreshToken) {
            localStorage.setItem("refreshToken", response.data.refreshToken);
        }
        
        // Setup user details if available
        const roles: string[] = Array.isArray(response.data.roles)
          ? response.data.roles.map((r: any) => (typeof r === "string" ? r : r?.authority ?? String(r)))
          : [];
        if (response.data.roles) {
            localStorage.setItem("userRoles", JSON.stringify(response.data.roles));
        }

        // Field employees (any ROLE_EMPLOYEE who is not an admin) land on the mobile self-service
        // portal and never touch the desktop ERP. Everyone else goes to the desktop dashboard.
        // Mirrors isFieldEmployeeOnly() in hooks/useAuth.ts — keep the two in step.
        const roleNames = roles.filter((r) => r.startsWith("ROLE_"));
        const isFieldEmployee = roleNames.includes("ROLE_EMPLOYEE") && !roleNames.includes("ROLE_ADMIN");

        // Use window.location for full reload to reset all app state and layout effects.
        // Prefix with BASE_URL (/crm/ in the Option A production build, / in dev) so the
        // redirect stays inside the CRM app instead of hitting the public website at root.
        window.location.href = import.meta.env.BASE_URL + (isFieldEmployee ? "employee" : "dashboard");
      } else {
        setError("Invalid login response from server");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Invalid credentials or account locked. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">Arudra CRM</CardTitle>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none" htmlFor="email">
                Email
              </label>
              <Input 
                id="email" 
                type="email" 
                placeholder="admin@arudra.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium leading-none" htmlFor="password">
                  Password
                </label>
                {/* TEMPORARILY DISABLED for production — re-enable to restore self-service password reset.
                <a href="/forgot-password" className="text-sm text-muted-foreground hover:text-primary">
                  Forgot password?
                </a>
                */}
              </div>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sign In
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
