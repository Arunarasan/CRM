import { useEffect, useState } from "react";
import { KeyRound, ShieldCheck, ShieldOff, Copy, Loader2, UserPlus, Trash2, Check, Power, PauseCircle, PlayCircle } from "lucide-react";
import { customer360Api, type PortalAccess, type PortalGrantResult } from "@/lib/customer360Api";
import { toast } from "@/components/ui/toast";

/**
 * Portal Access — grant this customer a self-service login so they see their own projects, orders,
 * quotations and invoices in the website portal. Portal data is scoped by the customer record, so
 * once a login is linked here, everything on this customer becomes visible to that client.
 */
export default function PortalAccessTab({ customerId }: { customerId: string }) {
  const [access, setAccess] = useState<PortalAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [grant, setGrant] = useState<PortalGrantResult | null>(null);
  const [copied, setCopied] = useState(false);

  const load = () => {
    setLoading(true);
    customer360Api.getPortalAccess(customerId)
      .then((a) => { setAccess(a); setEmail(a.customerEmail ?? ""); })
      .catch(() => toast.error("Could not load portal access."))
      .finally(() => setLoading(false));
  };
  useEffect(load, [customerId]);

  const doGrant = async () => {
    setBusy(true);
    setGrant(null);
    try {
      const res = await customer360Api.grantPortalAccess(customerId, email.trim() || undefined);
      setGrant(res);
      toast.success(res.linkedExistingAccount ? "Linked an existing login." : "Portal access granted.");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Could not grant access.");
    } finally { setBusy(false); }
  };

  const doRevoke = async (userId: number) => {
    if (!confirm("Revoke this login's access to the customer's portal?")) return;
    try {
      await customer360Api.revokePortalAccess(customerId, userId);
      toast.success("Access revoked.");
      load();
    } catch (e: any) { toast.error(e?.message || "Could not revoke."); }
  };

  const doSuspend = async (userId: number, suspended: boolean) => {
    try {
      await customer360Api.suspendPortalAccess(customerId, userId, suspended);
      toast.success(suspended ? "Portal access suspended." : "Portal access restored.");
      load();
    } catch (e: any) { toast.error(e?.message || "Could not update."); }
  };

  const toggleGlobal = async () => {
    if (!access) return;
    const next = !access.portalGloballyEnabled;
    if (!next && !confirm("Turn the ENTIRE customer portal off for all customers?")) return;
    try {
      await customer360Api.setPortalPolicy(next);
      toast.success(next ? "Portal turned on." : "Portal turned off for everyone.");
      load();
    } catch (e: any) { toast.error(e?.message || "Could not update portal."); }
  };

  const copyPw = () => {
    if (!grant?.temporaryPassword) return;
    navigator.clipboard?.writeText(grant.temporaryPassword).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  if (loading) {
    return <div className="flex items-center gap-2 py-12 justify-center text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }

  return (
    <div className="max-w-2xl space-y-6 py-2">
      {/* Global portal switch (site-wide) */}
      {access && (
        <div className={`flex items-center justify-between gap-3 rounded-xl border p-4 ${
          access.portalGloballyEnabled ? "bg-white" : "border-amber-300 bg-amber-50"}`}>
          <div className="flex items-start gap-3">
            <Power className={`mt-0.5 h-5 w-5 ${access.portalGloballyEnabled ? "text-emerald-600" : "text-amber-600"}`} />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Customer portal is {access.portalGloballyEnabled ? "ON" : "OFF"} (all customers)
              </p>
              <p className="text-xs text-muted-foreground">
                Master switch for the whole portal — turning it off signs no one in until it's back on.
              </p>
            </div>
          </div>
          <button onClick={toggleGlobal}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold ${
              access.portalGloballyEnabled
                ? "border border-input text-slate-700 hover:border-amber-400 hover:text-amber-700"
                : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
            {access.portalGloballyEnabled ? "Turn off" : "Turn on"}
          </button>
        </div>
      )}

      {/* Status */}
      <div className="rounded-xl border bg-white p-5">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            access?.hasAccess ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            {access?.hasAccess ? <ShieldCheck className="h-5 w-5" /> : <ShieldOff className="h-5 w-5" />}
          </span>
          <div>
            <h3 className="font-semibold text-slate-900">
              {access?.hasAccess ? "Has portal access" : "No portal access yet"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {access?.hasAccess
                ? "This client can sign in at the website and see their projects, orders, quotations and invoices."
                : "Grant a login so this client can track their projects and orders in the website portal."}
            </p>
          </div>
        </div>

        {access && access.logins.length > 0 && (
          <ul className="mt-4 divide-y rounded-lg border">
            {access.logins.map((l) => (
              <li key={l.userId} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {l.email}
                    {l.primary && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">PRIMARY</span>}
                    {l.suspended && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">SUSPENDED</span>}
                    {!l.emailVerified && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">UNVERIFIED</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{l.name} · {l.portalRole}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => doSuspend(l.userId, !l.suspended)}
                    title={l.suspended ? "Restore access" : "Suspend access"}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                    {l.suspended ? <><PlayCircle className="h-3.5 w-3.5" /> Restore</> : <><PauseCircle className="h-3.5 w-3.5" /> Suspend</>}
                  </button>
                  <button onClick={() => doRevoke(l.userId)} title="Revoke access"
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" /> Revoke
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Grant */}
      <div className="rounded-xl border bg-white p-5">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <KeyRound className="h-4 w-4 text-primary" /> Grant portal access
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Creates a login for this email (or links it, if the client already registered). If the same
          email placed guest orders, those carry into the portal automatically.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="login email"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button onClick={doGrant} disabled={busy || !email.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Grant access
          </button>
        </div>

        {grant && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
            {grant.linkedExistingAccount ? (
              <p className="text-emerald-800">
                Linked the existing account <span className="font-semibold">{grant.email}</span>. They can sign in with their own password.
              </p>
            ) : (
              <>
                <p className="text-emerald-800">
                  Login created for <span className="font-semibold">{grant.email}</span>. Share this temporary password — the client will set their own on first sign-in:
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="rounded bg-white px-2 py-1 font-mono text-sm text-slate-800 border">{grant.temporaryPassword}</code>
                  <button onClick={copyPw} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-slate-600 hover:text-primary">
                    {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
