import { useEffect, useState } from 'react';
import { FileText, Download, Plus, Loader2, Clock, XCircle } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { EmployeeDocumentEntry, ProfileChangeRequest } from '@/types/employeePortal';
import FileUploadField from '@/components/FileUploadField';
import { PortalHeader, EmptyState } from './_shared';
import { useT } from '@/i18n';

const DOC_TYPES = [
  { value: 'AADHAAR', label: 'Aadhaar' },
  { value: 'PAN', label: 'PAN Card' },
  { value: 'OFFER_LETTER', label: 'Offer Letter' },
  { value: 'EXPERIENCE_LETTER', label: 'Experience Letter' },
  { value: 'EDUCATION', label: 'Education Certificate' },
  { value: 'BANK', label: 'Bank Proof' },
  { value: 'OTHER', label: 'Other' },
];

export default function Documents() {
  const { t } = useT();
  const [docs, setDocs] = useState<EmployeeDocumentEntry[]>([]);
  const [requests, setRequests] = useState<ProfileChangeRequest[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ documentName: '', documentType: 'AADHAAR', fileUrl: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    employeePortalApi.documents().then(setDocs).catch(() => setDocs([]));
    employeePortalApi.profileChangeRequests().then(setRequests).catch(() => setRequests([]));
  };
  useEffect(() => { load(); }, []);

  const docRequests = requests.filter((r) => r.changeType === 'DOCUMENT' && r.status !== 'APPROVED');

  const submit = async () => {
    setErr(''); setMsg('');
    if (!form.documentName.trim()) { setErr(t('portal.documents.nameRequired')); return; }
    if (!form.fileUrl) { setErr(t('portal.documents.fileRequired')); return; }
    setSaving(true);
    try {
      await employeePortalApi.submitDocument(form);
      setMsg(t('portal.submitted'));
      setForm({ documentName: '', documentType: 'AADHAAR', fileUrl: '' });
      setAdding(false);
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || t('portal.submissionFailed'));
    } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col">
      <PortalHeader title={t('portal.documents.title')} />

      <div className="px-3 pt-3">
        {adding ? (
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-[11px] text-muted-foreground">{t('portal.documents.addHint')}</p>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">{t('portal.documents.documentName')}</span>
              <input value={form.documentName} onChange={(e) => setForm((f) => ({ ...f, documentName: e.target.value }))}
                placeholder={t('portal.documents.namePlaceholder')} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">{t('portal.documents.documentType')}</span>
              <select value={form.documentType} onChange={(e) => setForm((f) => ({ ...f, documentType: e.target.value }))}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm">
                {DOC_TYPES.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
            <FileUploadField module="EMPLOYEE_DOC" label={t('portal.documents.file')} value={form.fileUrl}
              onChange={({ url }) => setForm((f) => ({ ...f, fileUrl: url }))} />
            {err && <p className="text-xs text-destructive">{err}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setAdding(false); setErr(''); }}
                className="flex-1 rounded-lg border py-2.5 text-sm font-semibold active:scale-[0.99]">{t('common.cancel')}</button>
              <button onClick={submit} disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {t('common.submit')}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => { setAdding(true); setMsg(''); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-sm font-semibold text-primary active:scale-[0.99]">
            <Plus className="h-4 w-4" /> {t('portal.documents.addDocument')}
          </button>
        )}
        {msg && !adding && <p className="mt-2 text-center text-xs text-emerald-600">{msg}</p>}
      </div>

      {docRequests.length > 0 && (
        <>
          <h3 className="px-4 pb-1 pt-4 text-xs font-semibold uppercase text-muted-foreground">{t('portal.documents.awaitingApproval')}</h3>
          <div className="mx-3 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
            {docRequests.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${r.status === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                  {r.status === 'REJECTED' ? <XCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.docName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.status === 'REJECTED'
                      ? `${t('portal.documents.rejected')}${r.reviewRemarks ? ` · ${r.reviewRemarks}` : ''}`
                      : t('portal.documents.pendingApprovalDoc')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="px-4 pb-1 pt-4 text-xs font-semibold uppercase text-muted-foreground">{t('portal.documents.myDocuments')}</h3>
      <div className="mx-3 my-1 mb-3 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {docs.length === 0 ? (
          <EmptyState message={t('portal.documents.none')} />
        ) : (
          docs.map((d) => (
            <a key={d.id} href={d.fileUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 px-4 py-3 active:bg-accent/40">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.documentName}</p>
                <p className="text-xs text-muted-foreground">{d.documentType.replace(/_/g, ' ')}{d.uploadedDate ? ` · ${d.uploadedDate}` : ''}</p>
              </div>
              <Download className="h-4 w-4 text-muted-foreground" />
            </a>
          ))
        )}
      </div>
    </div>
  );
}
