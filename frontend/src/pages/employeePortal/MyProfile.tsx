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
import { useT } from '@/i18n';

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
  const [msgOk, setMsgOk] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  const [form, setForm] = useState({ phone: '', emergencyContactName: '', emergencyContactPhone: '', profilePhotoUrl: '' });
  const photoInput = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { t } = useT();

  const load = () => employeePortalApi.profile().then((d) => {
    setP(d);
    setForm({
      phone: d.phone ?? '',
      emergencyContactName: d.emergencyContactName ?? '',
      emergencyContactPhone: d.emergencyContactPhone ?? '',
      profilePhotoUrl: d.profilePhotoUrl ?? '',
    });
  }).catch(() => {});

  const loadPending = () => employeePortalApi.profileChangeRequests()
    .then((rs) => setHasPending(rs.some((r) => r.changeType === 'PROFILE' && r.status === 'PENDING')))
    .catch(() => setHasPending(false));

  useEffect(() => { load(); loadPending(); }, []);

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
    } catch { setMsgOk(false); setMsg(t('portal.submissionFailed')); }
    finally { setUploading(false); }
  };

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await employeePortalApi.submitProfileChange(form);
      await load();
      await loadPending();
      setEditing(false);
      setMsgOk(true);
      setMsg(t('portal.profile.submittedPending'));
    } catch (e: any) { setMsgOk(false); setMsg(e?.response?.data?.message || e?.message || t('portal.submissionFailed')); }
    finally { setSaving(false); }
  };

  const photo = editing ? form.profilePhotoUrl : p?.profilePhotoUrl;

  return (
    <div className="flex flex-col">
      <PortalHeader
        title={t('portal.profile.title')}
        action={editing ? (
          <div className="flex items-center gap-1">
            <button onClick={cancel} className="flex h-9 w-9 items-center justify-center rounded-full active:bg-accent" aria-label={t('common.cancel')}><X className="h-5 w-5" /></button>
            <button onClick={save} disabled={saving} className="flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground active:scale-95 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t('common.save')}
            </button>
          </div>
        ) : (
          <button onClick={startEdit} className="flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-semibold active:bg-accent">
            <Pencil className="h-4 w-4" /> {t('common.edit')}
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
        <p className="text-sm text-muted-foreground">{p?.designation || t('portal.more.employee')}</p>
        <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">{p?.employeeCode}</span>
      </div>

      {hasPending && !editing && (
        <p className="mx-3 mb-2 rounded-md bg-amber-50 p-2 text-center text-xs text-amber-700">
          {t('portal.profile.pendingApproval')}
        </p>
      )}
      {msg && <p className={`mx-3 mb-2 rounded-md p-2 text-center text-xs ${msgOk ? 'bg-emerald-50 text-emerald-700' : 'bg-destructive/15 text-destructive'}`}>{msg}</p>}

      {/* Contact — editable phone; email/department locked (HR-managed / identity link) */}
      <h3 className="px-4 pb-1 pt-2 text-xs font-semibold uppercase text-muted-foreground">{t('portal.profile.contact')}</h3>
      <div className="mx-3 mb-3 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        <Row icon={Mail} label={t('portal.profile.email')} value={p?.email} locked />
        {editing ? (
          <EditRow label={t('portal.profile.mobile')} value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder={t('common.phone')} type="tel" />
        ) : (
          <Row icon={Phone} label={t('portal.profile.mobile')} value={p?.phone} />
        )}
        <Row icon={Building2} label={t('portal.profile.department')} value={p?.department?.name} locked />
        <Row icon={BadgeCheck} label={t('common.status')} value={p?.status} locked />
        <Row icon={CalendarDays} label={t('portal.profile.dateOfJoining')} value={p?.dateOfJoining} locked />
      </div>

      {/* Emergency contact — fully editable */}
      <h3 className="px-4 pb-1 pt-2 text-xs font-semibold uppercase text-muted-foreground">{t('portal.profile.emergencyContact')}</h3>
      <div className="mx-3 mb-3 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {editing ? (
          <>
            <EditRow label={t('portal.profile.name')} value={form.emergencyContactName} onChange={(v) => setForm((f) => ({ ...f, emergencyContactName: v }))} />
            <EditRow label={t('portal.profile.phone')} value={form.emergencyContactPhone} onChange={(v) => setForm((f) => ({ ...f, emergencyContactPhone: v }))} type="tel" />
          </>
        ) : (
          <>
            <Row icon={ShieldAlert} label={t('portal.profile.name')} value={p?.emergencyContactName} />
            <Row icon={Phone} label={t('portal.profile.phone')} value={p?.emergencyContactPhone} />
          </>
        )}
      </div>

      {/* Password — handled on its own secure screen */}
      {!editing && (
        <div className="mx-3 mb-3 overflow-hidden rounded-xl border bg-card shadow-sm">
          <button onClick={() => navigate('/employee/settings')} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-accent/40">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">{t('portal.changePassword')}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Payroll & bank — always read-only (HR-managed) */}
      <h3 className="px-4 pb-1 pt-2 text-xs font-semibold uppercase text-muted-foreground">{t('portal.profile.payrollBank')}</h3>
      <div className="mx-3 mb-6 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        <Row icon={Landmark} label={t('portal.profile.bankAccount')} value={p?.bankAccount} locked />
        <Row icon={Landmark} label={t('portal.profile.ifsc')} value={p?.ifsc} locked />
        <Row icon={BadgeCheck} label={t('portal.profile.pfNumber')} value={p?.pfNumber} locked />
        <Row icon={BadgeCheck} label={t('portal.profile.esiNumber')} value={p?.esiNumber} locked />
        <Row icon={BadgeCheck} label={t('portal.profile.uan')} value={p?.uan} locked />
      </div>
    </div>
  );
}
