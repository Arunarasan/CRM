/**
 * HR → employee profile: the employee's sign-in account. Username / password can only be changed
 * once a login is linked (employees.user_id); the employee's e-mail moves with the username so the
 * two never drift apart. Admin only — the backend enforces ROLE_ADMIN on every call.
 */
import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Link2, Link2Off, Loader2, UserPlus, AlertTriangle, Pencil, Wand2 } from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SearchableSelect from '@/components/ui/searchable-select';
import { toast } from '@/components/ui/toast';

interface LoginUser {
  id: number; name: string; email: string; locked: boolean; disabled: boolean;
  mustChangePassword: boolean; roles: string[];
}
interface LoginStatus { linked: boolean; user?: LoginUser; emailMismatch?: boolean }
interface Candidate { id: number; name: string; email: string }

const errText = (e: any, fallback = 'Action failed') => e?.response?.data?.message || e?.message || fallback;

const TEMP_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const randomPassword = () => {
  const buf = new Uint32Array(12);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => TEMP_CHARS[n % TEMP_CHARS.length]).join('') + '#7';
};

export function LoginAccountCard({ employeeId, onChanged }: { employeeId: number; onChanged?: () => void }) {
  const [status, setStatus] = useState<LoginStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'view' | 'link' | 'edit'>('view');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [pickId, setPickId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/hr/employees/${employeeId}/login`)
      .then((r) => setStatus(r.data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, [employeeId]);

  useEffect(() => { setMode('view'); load(); }, [load]);

  const run = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true);
    try {
      const r = await fn();
      setStatus(r.data);
      setMode('view');
      setPassword('');
      toast.success(ok);
      onChanged?.();
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const startLink = async () => {
    try {
      const r = await api.get('/hr/login-candidates');
      setCandidates(r.data);
      setPickId('');
      setMode('link');
    } catch (e) { toast.error(errText(e)); }
  };

  const startEdit = () => {
    setEmail(status?.user?.email ?? '');
    setPassword('');
    setMode('edit');
  };

  const saveEdit = () => {
    const user = status?.user;
    if (!user) return;
    const body: Record<string, string> = {};
    if (email.trim() && email.trim().toLowerCase() !== user.email.toLowerCase()) body.email = email.trim();
    if (password.trim()) body.password = password.trim();
    if (!body.email && !body.password) { toast.error('Change the username or enter a new password.'); return; }
    run(() => api.put(`/hr/employees/${employeeId}/login`, body),
      body.email ? 'Login updated — the employee must sign in again' : 'Password updated');
  };

  const unlink = () => {
    if (!window.confirm('Unlink this login? The employee will lose access to the portal until a login is linked again.')) return;
    run(() => api.delete(`/hr/employees/${employeeId}/login`), 'Login unlinked');
  };

  const user = status?.user;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="w-4 h-4" /> Login account
          {status && (status.linked
            ? <Badge variant="outline" className="text-green-700 border-green-300">Linked</Badge>
            : <Badge variant="outline" className="text-amber-700 border-amber-300">No login</Badge>)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>}

        {!loading && !status && <p className="text-sm text-muted-foreground">Only administrators can manage employee logins.</p>}

        {!loading && status && !status.linked && mode === 'view' && (
          <>
            <p className="text-sm text-muted-foreground">
              This employee has no linked login, so the username and password can't be changed yet.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={startLink} disabled={busy}><Link2 className="w-4 h-4 mr-1" /> Link existing login</Button>
              <Button size="sm" onClick={() => run(() => api.post(`/hr/employees/${employeeId}/login/create`), 'Login created — sign-in details e-mailed')} disabled={busy}>
                <UserPlus className="w-4 h-4 mr-1" /> Create login
              </Button>
            </div>
          </>
        )}

        {!loading && status && !status.linked && mode === 'link' && (
          <div className="space-y-3 max-w-md">
            <Label>Pick the login to link</Label>
            <SearchableSelect
              value={pickId}
              onChange={setPickId}
              placeholder="Search logins by name or e-mail…"
              options={candidates.map((c) => ({ value: String(c.id), label: c.name || c.email, hint: c.email }))}
            />
            <p className="text-xs text-muted-foreground">The employee's e-mail will be set to the chosen login's username.</p>
            <div className="flex gap-2">
              <Button size="sm" disabled={!pickId || busy}
                onClick={() => run(() => api.post(`/hr/employees/${employeeId}/login/link`, { userId: Number(pickId) }), 'Login linked')}>
                Link
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode('view')}>Cancel</Button>
            </div>
          </div>
        )}

        {!loading && status?.linked && user && mode === 'view' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div><span className="text-muted-foreground block mb-1 text-xs">Username</span><span className="font-medium text-sm break-all">{user.email}</span></div>
              <div><span className="text-muted-foreground block mb-1 text-xs">Account type</span><span className="font-medium text-sm">{user.roles.includes('ROLE_ADMIN') ? 'Admin' : 'Employee'}</span></div>
              <div>
                <span className="text-muted-foreground block mb-1 text-xs">State</span>
                <span className="text-sm flex flex-wrap gap-1">
                  {user.locked && <Badge variant="destructive">Locked</Badge>}
                  {user.disabled && <Badge variant="outline">Disabled</Badge>}
                  {!user.locked && !user.disabled && <Badge variant="outline" className="text-green-700 border-green-300">Active</Badge>}
                </span>
              </div>
              <div><span className="text-muted-foreground block mb-1 text-xs">Password</span><span className="font-medium text-sm">{user.mustChangePassword ? 'Must change on next sign-in' : 'Set by employee'}</span></div>
            </div>
            {status.emailMismatch && (
              <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>The employee e-mail differs from the login username. Use "Change username / password" and save to bring them back in step.</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={startEdit} disabled={busy}><Pencil className="w-4 h-4 mr-1" /> Change username / password</Button>
              <Button size="sm" variant="ghost" onClick={unlink} disabled={busy}><Link2Off className="w-4 h-4 mr-1" /> Unlink</Button>
            </div>
          </>
        )}

        {!loading && status?.linked && user && mode === 'edit' && (
          <div className="space-y-3 max-w-md">
            <div className="space-y-1">
              <Label>Username (e-mail)</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>New password (leave blank to keep)</Label>
              <div className="flex gap-2">
                <Input type="text" value={password} placeholder="At least 10 characters" onChange={(e) => setPassword(e.target.value)} />
                <Button type="button" size="sm" variant="outline" title="Generate" onClick={() => setPassword(randomPassword())}><Wand2 className="w-4 h-4" /></Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Saving signs the employee out of every device. They choose their own password at the next sign-in.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
              <Button size="sm" variant="ghost" onClick={() => setMode('view')}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
