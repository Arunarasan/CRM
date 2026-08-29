import { useEffect, useState } from "react";
import { Link2, Copy, RefreshCw, Star, Eye, EyeOff, ExternalLink, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { projectApi } from "@/api/projectApi";

interface ProjectReview {
  id: number;
  reviewerName?: string;
  rating: number;
  comment?: string;
  status: string;
  createdAt?: string;
}

/**
 * Admin control for a project's public, no-login tracking link (the customer-facing /track/{token}
 * page). Shows the shareable link with a copy button, an on/off toggle, a regenerate (revoke) action,
 * and moderation of the reviews customers leave from that page.
 */
export default function TrackingLinkDialog({ projectId }: { projectId: number }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [reviews, setReviews] = useState<ProjectReview[]>([]);

  // Website is served at the same origin's root; CRM lives under /crm. Allow an explicit override.
  const base = (import.meta.env.VITE_WEBSITE_URL as string) || window.location.origin;
  const link = token ? `${base.replace(/\/$/, "")}/track/${token}` : "";

  const load = () => {
    setLoading(true);
    Promise.all([projectApi.getTracking(projectId), projectApi.getReviews(projectId)])
      .then(([t, r]) => {
        setToken(t.shareToken);
        setEnabled(t.trackingEnabled);
        setReviews(r || []);
      })
      .catch(() => toast.error("Could not load the tracking link"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Tracking link copied");
    } catch {
      toast.error("Copy failed — select and copy the link manually");
    }
  };

  const toggle = (next: boolean) => {
    setEnabled(next);
    projectApi.setTracking(projectId, next)
      .then(() => toast.success(next ? "Public tracking enabled" : "Public tracking disabled"))
      .catch(() => { setEnabled(!next); toast.error("Update failed"); });
  };

  const regenerate = () => {
    if (!confirm("Generate a new link? The current link will stop working.")) return;
    projectApi.regenerateTracking(projectId)
      .then((t) => { setToken(t.shareToken); toast.success("New link generated"); })
      .catch(() => toast.error("Could not regenerate the link"));
  };

  const moderate = (r: ProjectReview) => {
    const next = r.status === "HIDDEN" ? "APPROVED" : "HIDDEN";
    projectApi.setReviewStatus(r.id, next)
      .then(() => { setReviews((xs) => xs.map((x) => x.id === r.id ? { ...x, status: next } : x)); })
      .catch(() => toast.error("Update failed"));
  };

  const wa = `https://wa.me/?text=${encodeURIComponent(`Track your project live: ${link}`)}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl border-slate-200 text-slate-600">
          <Link2 className="w-4 h-4 mr-2" /> Tracking Link
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Link2 className="w-5 h-5 text-emerald-600" /> Public Tracking Link</DialogTitle>
          <DialogDescription>
            Share this with the customer — no login needed. They see the project timeline, live progress,
            and can send a request or leave a review.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <div className="space-y-5">
            {/* On/off */}
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                {enabled ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                <span className="font-medium text-slate-700">{enabled ? "Link is active" : "Link is disabled"}</span>
              </div>
              <Switch checked={enabled} onCheckedChange={toggle} />
            </div>

            {/* Link + copy */}
            <div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
                />
                <Button onClick={copy} className="bg-emerald-500 hover:bg-emerald-600 rounded-lg shrink-0">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <a href={wa} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" className="rounded-lg text-emerald-700 border-emerald-200">
                    <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Share on WhatsApp
                  </Button>
                </a>
                <a href={link} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" className="rounded-lg text-slate-600">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Preview
                  </Button>
                </a>
                <Button variant="outline" size="sm" onClick={regenerate} className="rounded-lg text-slate-500">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerate
                </Button>
              </div>
            </div>

            {/* Reviews */}
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-700">
                Customer Reviews {reviews.length > 0 && <span className="text-slate-400">({reviews.length})</span>}
              </h4>
              {reviews.length === 0 ? (
                <p className="text-sm text-slate-400">No reviews yet.</p>
              ) : (
                <ul className="max-h-52 space-y-2 overflow-auto">
                  {reviews.map((r) => (
                    <li key={r.id} className={`rounded-lg border px-3 py-2 ${r.status === "HIDDEN" ? "border-slate-100 bg-slate-50 opacity-60" : "border-slate-100"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star key={n} className={`w-3.5 h-3.5 ${r.rating >= n ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                            ))}
                          </div>
                          <span className="text-sm font-medium text-slate-700">{r.reviewerName || "Customer"}</span>
                        </div>
                        <button onClick={() => moderate(r)} className="text-xs text-slate-400 hover:text-slate-600">
                          {r.status === "HIDDEN" ? "Show" : "Hide"}
                        </button>
                      </div>
                      {r.comment && <p className="mt-1 text-sm text-slate-500">{r.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
