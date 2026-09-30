import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode, Copy, Download, Share2, Star, ExternalLink } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { toast } from '@/components/ui/toast';

interface QrInfo {
  token: string;
  employeeName: string;
  googleReviewUrl: string | null;
  reviewCount: number;
  averageRating: number;
}

/**
 * Employee self-service: my personal review QR. Show it to customers (or add the link to a business
 * card / signature). A scan lets them rate + message me, then sends them to the Google review page.
 */
export default function EmployeeReviewQr() {
  const [info, setInfo] = useState<QrInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const qrRef = useRef<HTMLDivElement>(null);

  const base = (import.meta.env.VITE_WEBSITE_URL as string) || window.location.origin;
  const link = info?.token ? `${base.replace(/\/$/, '')}/r/${info.token}` : '';

  useEffect(() => {
    employeePortalApi.reviewQr()
      .then(setInfo)
      .catch(() => toast.error('Could not load your review QR'))
      .finally(() => setLoading(false));
  }, []);

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast.success('Link copied'); }
    catch { toast.error('Copy failed'); }
  };

  const download = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'my-review-qr.png';
    a.click();
  };

  const share = async () => {
    const text = `We'd love your feedback! Please rate my service: ${link}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Leave a review', text, url: link }); return; } catch { /* cancelled */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 text-base font-bold">
          <QrCode className="h-5 w-5 text-primary" /> My Review QR
        </h2>
        <p className="mb-5 text-xs text-muted-foreground">
          Show this to a customer to scan. They'll rate you and leave a message, then be sent to our Google review page.
        </p>

        <div ref={qrRef} className="mx-auto flex w-fit justify-center rounded-xl border bg-white p-5">
          {link && <QRCodeCanvas value={link} size={220} level="M" marginSize={2} />}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground"
          />
          <button onClick={copy} className="rounded-lg bg-primary p-2.5 text-primary-foreground active:opacity-80">
            <Copy className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={download} className="flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold active:bg-accent/40">
            <Download className="h-4 w-4" /> Save QR
          </button>
          <button onClick={share} className="flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold text-emerald-700 active:bg-accent/40">
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>

        {link && (
          <a href={link} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ExternalLink className="h-3.5 w-3.5" /> Preview my review page
          </a>
        )}
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="text-center">
          <div className="text-3xl font-black">{info?.averageRating || '—'}</div>
          <div className="flex">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className={`h-4 w-4 ${Math.round(info?.averageRating || 0) >= i ? 'fill-amber-400 text-amber-400' : 'text-muted'}`} />
            ))}
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          <div className="font-semibold text-foreground">
            {info?.reviewCount ?? 0} review{info?.reviewCount === 1 ? '' : 's'}
          </div>
          from customer scans
        </div>
      </div>

      {!info?.googleReviewUrl && (
        <p className="px-1 text-xs text-amber-600">
          Note: your company hasn't set a Google review link yet, so customers won't be redirected after reviewing.
        </p>
      )}
    </div>
  );
}
