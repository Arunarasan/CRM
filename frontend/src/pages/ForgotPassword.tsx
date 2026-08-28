import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import api from "@/lib/api";

type Step = "request" | "reset" | "done";

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setInfo("If an account exists for that email, a 6-digit code is on its way. Enter it below.");
      setStep("reset");
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { email, otp, newPassword });
      setStep("done");
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Invalid or expired code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setInfo("A new code has been sent.");
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Could not resend the code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">Reset your password</CardTitle>
          <CardDescription>
            {step === "request" && "Enter your account email and we'll send you a verification code."}
            {step === "reset" && "Enter the code from your email and choose a new password."}
            {step === "done" && "Your password has been updated."}
          </CardDescription>
        </CardHeader>

        {error && (
          <div className="mx-6 mb-2 bg-destructive/15 text-destructive text-sm p-3 rounded-md flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {info && step !== "done" && (
          <div className="mx-6 mb-2 bg-primary/10 text-primary text-sm p-3 rounded-md">
            {info}
          </div>
        )}

        {step === "request" && (
          <form onSubmit={requestOtp}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none" htmlFor="email">Email</label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@arudra.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send code
              </Button>
              <a href={import.meta.env.BASE_URL + "login"} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </a>
            </CardFooter>
          </form>
        )}

        {step === "reset" && (
          <form onSubmit={resetPassword}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none" htmlFor="otp">Verification code</label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  maxLength={6}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none" htmlFor="newPassword">New password</label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none" htmlFor="confirmPassword">Confirm new password</label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Reset password
              </Button>
              <div className="flex items-center justify-between w-full text-sm">
                <button
                  type="button"
                  onClick={() => { setStep("request"); setError(""); setInfo(""); }}
                  className="text-muted-foreground hover:text-primary flex items-center gap-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Change email
                </button>
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={loading}
                  className="text-muted-foreground hover:text-primary disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>
            </CardFooter>
          </form>
        )}

        {step === "done" && (
          <>
            <CardContent className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <p className="text-sm text-muted-foreground text-center">
                You can now sign in with your new password.
              </p>
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={() => (window.location.href = import.meta.env.BASE_URL + "login")}>
                Go to sign in
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}
