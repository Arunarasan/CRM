import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserCircle, Phone, Mail, Building2, BadgeCheck, CalendarDays, Landmark, ShieldAlert,
  Pencil, X, Check, Camera, Lock, KeyRound, ChevronRight, Loader2,
} from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { EmployeeProfile } from '@/types/employeePortal';
import { uploadFile } from '@/lib/uploadFile';
import { PortalHeader } from './_shared';

/** Read-only display row. `locked` shows a small lock hint for HR-managed fields. */
function Row({ icon: Icon, label, value, locked }: { icon: React.ElementType; label: string; value?: string | null; locked?: boolean }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}{locked && <Lock className="h-2.5 w-2.5" />}
        </p>
        <p className="truncate text-sm font-medium">{value || '—'}</p>
      </div>
    </div>
  );
}

/** Editable field row. */
function EditRow({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block px-4 py-2.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
    </label>
  );
}

export default function MyProfile() {
  const [p, setP] = useState<EmployeeProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ phone: '', emergencyContactName: '', emergencyContactPhone: '', profilePhotoUrl: '' });
  const photoInput = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const load = () => employeePortalApi.profile().then((d) => {
    setP(d);
    setForm({
      phone: d.phone ?? '',
      emergencyContactName: d.emergencyContactName ?? '',
      emergencyContactPhone: d.emergencyContactPhone ?? '',
      profilePhotoUrl: d.profilePhotoUrl ?? '',
    });
  }).catch(() => {});

  useEffect(() => { load(); }, []);

  const startEdit = () => { setMsg(''); setEditing(true); };
  const cancel = () => { setEditing(false); if (p) setForm({ phone: p.phone ?? '', emergencyContactName: p.emergencyContactName ?? '', emergencyContactPhone: p.emergencyContactPhone ?? '', profilePhotoUrl: p.profilePhotoUrl ?? '' }); };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const { fileUrl } = await uploadFile(file, 'EMPLOYEE');
      setForm((f) => ({ ...f, profilePhotoUrl: fileUrl }));
    } catch { setMsg('Photo upload failed.'); }
    finally { setUploading(false); }
  };

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await employeePortalApi.updateProfile(form);
      await load();
      setEditing(false);
      setMsg('Profile updated.');
    } catch (e: any) { setMsg(e?.message || 'Update failed.'); }
    finally { setSaving(false); }
  };

  const photo = editing ? form.profilePhotoUrl : p?.profilePhotoUrl;

  return (
    <div className="flex flex-col">
      <PortalHeader
        title="My Profile"
        action={editing ? (
          <div className="flex items-center gap-1">
            <button onClick={cancel} className="flex h-9 w-9 items-center justify-center rounded-full active:bg-accent" aria-label="Cancel"><X className="h-5 w-5" /></button>
            <button onClick={save} disabled={saving} className="flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground active:scale-95 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
            </button>
          </div>
        ) : (
          <button onClick={startEdit} className="flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-semibold active:bg-accent">
            <Pencil className="h-4 w-4" /> Edit
          </button>
        )}
      />

      <div className="flex flex-col items-center gap-2 py-6">
        <button
          onClick={() => editing && photoInput.current?.click()}
          disabled={!editing || uploading}
          className={`relative rounded-full ${editing ? 'active:scale-95' : ''}`}
        >
          {photo ? (
            <img src={photo} alt="" className="h-24 w-24 rounded-full object-cover shadow" />
          ) : (
            <UserCircle className="h-24 w-24 text-muted-foreground" />
          )}
          {editing && (
            <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </span>
          )}
        </button>
        <input ref={photoInput} type="file" accept="image/*" capture="user" className="hidden" onChange={onPhoto} />
        <h2 className="text-lg font-bold">{p ? `${p.firstName} ${p.lastName}` : '…'}</h2>
        <p className="text-sm text-muted-foreground">{p?.designation || 'Employee'}</p>
        <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">{p?.employeeCode}</span>
      </div>

      {msg && <p className={`mx-3 mb-2 rounded-md p-2 text-center text-xs ${msg.includes('updated') ? 'bg-emerald-50 text-emerald-700' : 'bg-destructive/15 text-destructive'}`}>{msg}</p>}

      {/* Contact — editable phone; email/department locked (HR-managed / identity link) */}
      <h3 className="px-4 pb-1 pt-2 text-xs font-semibold uppercase text-muted-foreground">Contact</h3>
      <div className="mx-3 mb-3 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        <Row icon={Mail} label="Email" value={p?.email} locked />
        {editing ? (
          <EditRow label="Mobile" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="Phone number" type="tel" />
        ) : (
          <Row icon={Phone} label="Mobile" value={p?.phone} />
        )}
        <Row icon={Building2} label="Department" value={p?.department?.name} locked />
        <Row icon={BadgeCheck} label="Status" value={p?.status} locked />
        <Row icon={CalendarDays} label="Date of Joining" value={p?.dateOfJoining} locked />
      </div>

      {/* Emergency contact — fully editable */}
      <h3 className="px-4 pb-1 pt-2 text-xs font-semibold uppercase text-muted-foreground">Emergency Contact</h3>
      <div className="mx-3 mb-3 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {editing ? (
          <>
            <EditRow label="Name" value={form.emergencyContactName} onChange={(v) => setForm((f) => ({ ...f, emergencyContactName: v }))} />
            <EditRow label="Phone" value={form.emergencyContactPhone} onChange={(v) => setForm((f) => ({ ...f, emergencyContactPhone: v }))} type="tel" />
          </>
        ) : (
          <>
            <Row icon={ShieldAlert} label="Name" value={p?.emergencyContactName} />
            <Row icon={Phone} label="Phone" value={p?.emergencyContactPhone} />
          </>
        )}
      </div>

      {/* Password — handled on its own secure screen */}
      {!editing && (
        <div className="mx-3 mb-3 overflow-hidden rounded-xl border bg-card shadow-sm">
          <button onClick={() => navigate('/employee/settings')} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-accent/40">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">Change Password</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Payroll & bank — always read-only (HR-managed) */}
      <h3 className="px-4 pb-1 pt-2 text-xs font-semibold uppercase text-muted-foreground">Payroll &amp; Bank</h3>
      <div className="mx-3 mb-6 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        <Row icon={Landmark} label="Bank Account" value={p?.bankAccount} locked />
        <Row icon={Landmark} label="IFSC" value={p?.ifsc} locked />
        <Row icon={BadgeCheck} label="PF Number" value={p?.pfNumber} locked />
        <Row icon={BadgeCheck} label="ESI Number" value={p?.esiNumber} locked />
        <Row icon={BadgeCheck} label="UAN" value={p?.uan} locked />
      </div>
    </div>
  );
}
