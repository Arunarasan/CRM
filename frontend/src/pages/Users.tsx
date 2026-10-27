import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, BaseInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Plus, KeyRound, Pencil, Trash2, LockOpen, ShieldCheck, Loader2 } from "lucide-react";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  locked: boolean;
  failedAttempts: number;
  roles: string[];
  createdAt: string | null;
  employeeId?: number | null;
  employeeName?: string | null;
}

const ACCOUNT_TYPES = [
  { role: "ROLE_ADMIN", label: "Admin" },
  { role: "ROLE_EMPLOYEE", label: "Employee" },
];

const prettyRole = (r: string) => r.replace(/^ROLE_/, "").replaceAll("_", " ");

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  // create / edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<{ name: string; email: string; phone: string; password: string; roles: string[] }>({
    name: "", email: "", phone: "", password: "", roles: [],
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // reset password dialog
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwUser, setPwUser] = useState<AdminUser | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/users").then((r) => r.data as AdminUser[]),
    ])
      .then(([u]) => setUsers(u))
      .catch((e) => alert(e.response?.data?.message || e.message || "Failed to load users"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: "", email: "", phone: "", password: "", roles: ["ROLE_EMPLOYEE"] });
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (u: AdminUser) => {
    setEditingId(u.id);
    setForm({ name: u.name, email: u.email, phone: u.phone ?? "", password: "", roles: [u.roles.includes("ROLE_ADMIN") ? "ROLE_ADMIN" : "ROLE_EMPLOYEE"] });
    setFormError("");
    setDialogOpen(true);
  };

  const accountRole = form.roles[0];
  const linkedEmployee = !!editingId && !!users.find((u) => u.id === editingId)?.employeeId;

  const save = async () => {
    setFormError("");
    setSaving(true);
    try {
      if (editingId) {
        // Only send roles when the type was changed, so legacy/customer accounts keep theirs.
        const orig = users.find((u) => u.id === editingId);
        const origType = orig?.roles.includes("ROLE_ADMIN") ? "ROLE_ADMIN" : "ROLE_EMPLOYEE";
        const changed = form.roles[0] !== origType;
        await api.put(`/users/${editingId}`, {
          name: form.name, email: form.email, phone: form.phone, ...(changed ? { roles: form.roles } : {}),
        });
      } else {
        await api.post("/users", {
          name: form.name, email: form.email, phone: form.phone, password: form.password, roles: form.roles,
        });
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      setFormError(e.response?.data?.message || e.message || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const openReset = (u: AdminUser) => {
    setPwUser(u);
    setPwValue("");
    setPwError("");
    setPwDialogOpen(true);
  };

  const submitReset = async () => {
    if (pwValue.length < 10) { setPwError("Password must be at least 10 characters."); return; }
    setPwError("");
    setPwSaving(true);
    try {
      await api.post(`/users/${pwUser!.id}/reset-password`, { newPassword: pwValue });
      setPwDialogOpen(false);
    } catch (e: any) {
      setPwError(e.response?.data?.message || e.message || "Failed to reset password");
    } finally {
      setPwSaving(false);
    }
  };

  const unlock = async (u: AdminUser) => {
    try {
      await api.post(`/users/${u.id}/unlock`);
      load();
    } catch (e: any) {
      alert(e.response?.data?.message || e.message || "Failed to unlock user");
    }
  };

  const remove = async (u: AdminUser) => {
    if (!window.confirm(`Delete user "${u.name}" (${u.email})? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      load();
    } catch (e: any) {
      alert(e.response?.data?.message || e.message || "Failed to delete user");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">Manage logins, roles and passwords.</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Add User</Button>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin inline" />
                </TableCell>
              </TableRow>
            )}
            {!loading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No users yet.</TableCell>
              </TableRow>
            )}
            {!loading && users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  {u.name}
                  {u.employeeId && (
                    <div className="text-xs font-normal text-muted-foreground">Employee: {u.employeeName}</div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {u.email}
                  {u.phone && <div className="text-xs">{u.phone}</div>}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.roles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    {u.roles.map((r) => (
                      <Badge key={r} variant="secondary" className="text-[10px]">{prettyRole(r)}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {u.locked ? (
                    <Badge variant="destructive">Locked</Badge>
                  ) : (
                    <Badge variant="outline" className="text-green-700 border-green-300">Active</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" title="Edit" onClick={() => openEdit(u)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" title="Reset password" onClick={() => openReset(u)}>
                      <KeyRound className="w-4 h-4" />
                    </Button>
                    {u.locked && (
                      <Button size="sm" variant="ghost" title="Unlock account" onClick={() => unlock(u)}>
                        <LockOpen className="w-4 h-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" title="Delete" onClick={() => remove(u)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? "Edit User" : "Add User"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {formError && (
              <div className="bg-destructive/15 text-destructive text-sm p-2 rounded-md">{formError}</div>
            )}
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} disabled={linkedEmployee}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
              {linkedEmployee && (
                <p className="text-xs text-muted-foreground">Linked to an employee — change the username from their HR profile.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Phone (optional, for phone sign-in)</Label>
              <Input type="tel" value={form.phone} placeholder="10-digit mobile number"
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            {!editingId && (
              <div className="space-y-1">
                <Label>Temporary Password</Label>
                <Input type="text" value={form.password} placeholder="At least 10 characters"
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            )}
            <div className="space-y-1">
              <Label>Account type</Label>
              <div className="grid grid-cols-2 gap-2">
                {ACCOUNT_TYPES.map((t) => (
                  <label key={t.role} className={`flex items-center gap-2 text-sm cursor-pointer border rounded-md p-2 ${accountRole === t.role ? "border-primary bg-primary/5" : ""}`}>
                    <BaseInput type="radio" name="accountType" checked={accountRole === t.role}
                      onChange={() => setForm({ ...form, roles: [t.role] })} />
                    {t.label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Only Admin or Employee. Project manager, designer, etc. are work roles assigned on projects, not separate logins.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name || !form.email || (!editingId && form.password.length < 10)}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog open={pwDialogOpen} onOpenChange={setPwDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Set a new password for<span className="font-medium text-foreground">{pwUser?.name}</span>. They'll use it on their next sign-in.
            </p>
            {pwError && <div className="bg-destructive/15 text-destructive text-sm p-2 rounded-md">{pwError}</div>}
            <div className="space-y-1">
              <Label>New Password</Label>
              <Input type="text" value={pwValue} placeholder="At least 10 characters"
                onChange={(e) => setPwValue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitReset} disabled={pwSaving || pwValue.length < 10}>
              {pwSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
