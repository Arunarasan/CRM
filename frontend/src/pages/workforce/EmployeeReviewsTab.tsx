import { BaseInput } from '@/components/ui/input';
import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  QrCode, Copy, Download, RefreshCw, ExternalLink, MessageSquare, Star, Trash2,
  Eye, EyeOff, AlertTriangle,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface EmployeeReview {
  id: number;
  reviewerName?: string;
  reviewerPhone?: string;
  rating: number;
  comment?: string;
  status: string;
  createdAt?: string;
}
interface QrInfo {
  token: string;
  employeeName: string;
  googleReviewUrl: string | null;
  reviewCount: number;
  averageRating: number;
}

const Stars = ({ n, size = "w-4 h-4" }: { n: number; size?: string }) => (
  <div className="flex">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} className={`${size} ${n >= i ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
    ))}
  </div>
);

/**
 * Per-employee review QR. Shows the printable/downloadable QR that a customer scans to leave a
 * rating + message (captured against this employee) before being sent to the company's Google
 * review page, plus the captured reviews with moderation.
 */
export default function EmployeeReviewsTab({ employeeId }: { employeeId: number }) {
  const [info, setInfo] = useState<QrInfo | null>(null);
  const [reviews, setReviews] = useState<EmployeeReview[]>([]);
  const [summary, setSummary] = useState<{ count: number; average: number }>({ count: 0, average: 0 });
  const [loading, setLoading] = useState(true);
  const qrRef = useRef<HTMLDivElement>(null);

  // Website is served at the same origin's root; CRM lives under /crm. Allow an explicit override.
  const base = (import.meta.env.VITE_WEBSITE_URL as string) || window.location.origin;
  const link = info?.token ? `${base.replace(/\/$/, "")}/r/${info.token}` : "";

  const loadReviews = () =>
    api.get(`/hr/employees/${employeeId}/reviews`).then((res) => {
      setReviews(res.data.reviews || []);
      setSummary({ count: res.data.count ?? 0, average: res.data.average ?? 0 });
    });

  useEffect(() => {
    setLoading(true);
    Promise.all([api.get(`/hr/employees/${employeeId}/review-qr`), loadReviews()])
      .then(([qr]) => setInfo(qr.data))
      .catch(() => toast.error("Could not load the review QR"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Review link copied");
    } catch {
      toast.error("Copy failed — select and copy the link manually");
    }
  };

  const download = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `review-qr-${info?.employeeName?.replace(/\s+/g, "-").toLowerCase() || employeeId}.png`;
    a.click();
  };

  const regenerate = () => {
    if (!confirm("Generate a new QR? The current QR and link will stop working.")) return;
    api.post(`/hr/employees/${employeeId}/review-qr/regenerate`)
      .then((res) => { setInfo(res.data); toast.success("New QR generated"); })
      .catch(() => toast.error("Could not regenerate the QR"));
  };

  const moderate = (r: EmployeeReview) => {
    const next = r.status === "HIDDEN" ? "APPROVED" : "HIDDEN";
    api.patch(`/hr/reviews/${r.id}/status`, { status: next })
      .then(() => { setReviews((xs) => xs.map((x) => (x.id === r.id ? { ...x, status: next } : x))); loadReviews(); })
      .catch(() => toast.error("Update failed"));
  };

  const remove = (r: EmployeeReview) => {
    if (!confirm("Delete this review permanently?")) return;
    api.delete(`/hr/reviews/${r.id}`)
      .then(() => { setReviews((xs) => xs.filter((x) => x.id !== r.id)); loadReviews(); toast.success("Review deleted"); })
      .catch(() => toast.error("Delete failed"));
  };

  const wa = `https://wa.me/?text=${encodeURIComponent(`We'd love your feedback! Please rate us: ${link}`)}`;

  if (loading) return <div className="py-12 text-center text-sm text-slate-400">Loading…</div>;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* -------- QR card -------- */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white border rounded-2xl shadow-sm p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-1">
            <QrCode className="w-4 h-4 text-emerald-600" /> Personal Review QR
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            The customer scans this, leaves a rating + message, and is then sent to your Google review page.
          </p>

          <div ref={qrRef} className="flex justify-center rounded-xl border border-slate-100 bg-white p-5">
            {link && (
              <QRCodeCanvas value={link} size={200} level="M" marginSize={2} />
            )}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <BaseInput
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
            />
            <Button onClick={copy} size="icon" className="rounded-lg shrink-0"><Copy className="w-4 h-4" /></Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={download} size="sm" variant="outline" className="rounded-lg">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download QR
            </Button>
            <a href={wa} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" className="rounded-lg text-emerald-700 border-emerald-200">
                <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> WhatsApp
              </Button>
            </a>
            {link && (
              <a href={link} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" className="rounded-lg text-slate-600">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Preview
                </Button>
              </a>
            )}
            <Button onClick={regenerate} size="sm" variant="outline" className="rounded-lg text-slate-500">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerate
            </Button>
          </div>

          {!info?.googleReviewUrl && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                No Google review link is set yet, so customers won't be redirected. Add it under{" "}
                <b>Website → Settings → Google Review Link</b>.
              </span>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="bg-white border rounded-2xl shadow-sm p-6 flex items-center gap-4">
          <div className="text-center">
            <div className="text-3xl font-black text-slate-900">{summary.average || "—"}</div>
            <Stars n={Math.round(summary.average)} />
          </div>
          <div className="text-sm text-slate-500">
            <div className="font-semibold text-slate-700">{summary.count} review{summary.count === 1 ? "" : "s"}</div>
            captured from QR scans
          </div>
        </div>
      </div>

      {/* -------- Reviews list -------- */}
      <div className="lg:col-span-3">
        <div className="bg-white border rounded-2xl shadow-sm">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="text-sm font-bold text-slate-900">Customer Reviews</h3>
          </div>
          {reviews.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">No reviews yet.</div>
          ) : (
            <ul className="divide-y">
              {reviews.map((r) => (
                <li key={r.id} className={`p-4 ${r.status === "HIDDEN" ? "bg-slate-50 opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Stars n={r.rating} size="w-3.5 h-3.5" />
                        <span className="text-sm font-semibold text-slate-800 truncate">
                          {r.reviewerName || "Anonymous"}
                        </span>
                        {r.status === "HIDDEN" && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hidden</span>
                        )}
                      </div>
                      {r.reviewerPhone && <div className="text-xs text-slate-400 mt-0.5">{r.reviewerPhone}</div>}
                      {r.comment && <p className="mt-1.5 text-sm text-slate-600">{r.comment}</p>}
                      {r.createdAt && (
                        <div className="mt-1 text-xs text-slate-400">{format(new Date(r.createdAt), "MMM d, yyyy · h:mm a")}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => moderate(r)}
                        title={r.status === "HIDDEN" ? "Show" : "Hide"}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      >
                        {r.status === "HIDDEN" ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => remove(r)}
                        title="Delete"
                        className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
