import { useEffect, useState } from "react";
import {
  BadgeCheck, Check, Copy, Download, ExternalLink, Link2Off, Loader2, Mail, MessageCircle, RefreshCw, Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { quotationApi, type QuoteShareState } from "@/api/quotationApi";
import type { Quotation } from "@/types/quotation";
import type { CompanyProfile } from "@/lib/companyProfile";

/**
 * "Share Quote": the quotation's PDF + its customer link (/q/{token} — opens only this quotation,
 * no login, nothing else reachable) + a formal message, sent in one go.
 * Phones attach the PDF through the share sheet; on a computer WhatsApp can't take a file from a
 * web page, so the PDF is downloaded and WhatsApp opens with the message — drag the PDF into the chat.
 */

export interface PreparedShare {
  quotation: Quotation;
  pdf: File;
  share: QuoteShareState;
  company: CompanyProfile;
  itemCount: number;
}

const inr = (v?: number | null) => "₹" + Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

/** Public link: the website serves /q/:token at the site root (the CRM itself lives under /crm). */
export const quoteLink = (token: string) => `${window.location.origin}/q/${token}`;

function customerOf(q: Quotation) {
  const c: any = q.customer || {};
  const l: any = q.lead || {};
  return {
    name: (c.name || l.name || "").trim(),
    phone: (c.whatsappNumber || c.phone || c.mobileNumber || l.whatsappNumber || l.mobileNumber || "").trim(),
    email: (c.email || l.email || "").trim(),
  };
}

/** wa.me wants digits with the country code; a plain 10-digit number is taken as Indian. */
function waNumber(phone: string) {
  const d = phone.replace(/\D/g, "").replace(/^0+/, "");
  return d.length === 10 ? `91${d}` : d;
}

export function buildShareMessage(p: PreparedShare, link: string) {
  const q = p.quotation;
  const who = customerOf(q).name;
  const company = p.company.name || "our team";
  const gst = Number(q.gst ?? 0) > 0 ? ", inclusive of GST" : "";
  const lines = [
    who ? `Dear ${who},` : "Dear Customer,",
    "",
    `Greetings from *${company}*!`,
    "",
    `Thank you for giving us the opportunity to serve you. Please find attached our quotation *${q.quotationNumber}*${q.quotationDate ? ` dated ${fmtDate(q.quotationDate)}` : ""} for your interior requirements.`,
    "",
    `*Total amount: ${inr(q.grandTotal)}* (${p.itemCount} item${p.itemCount === 1 ? "" : "s"}${gst})`,
    "",
    "You can also view the quotation online and accept it at any time:",
    link,
    ...(q.expiryDate ? ["", `Quotation valid until: ${fmtDate(q.expiryDate)}`] : []),
    "",
    "Should you have any questions or wish to make changes, please feel free to contact us. We look forward to working with you.",
    "",
    "Warm regards,",
    ...(p.share.staffName ? [p.share.staffName] : []),
    p.company.tagline ? `${company} — ${p.company.tagline}` : company,
    ...(p.company.phone ? [`📞 ${p.company.phone}`] : []),
  ];
  return lines.join("\n");
}

export default function ShareQuoteDialog({ prepared, onClose }: {
  prepared: PreparedShare | null;
  onClose: () => void;
}) {
  const [share, setShare] = useState<QuoteShareState | null>(null);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!prepared) return;
    setShare(prepared.share);
    setMessage(buildShareMessage(prepared, quoteLink(prepared.share.shareToken)));
    setPhone(customerOf(prepared.quotation).phone);
    setCopied(false);
  }, [prepared]);

  if (!prepared || !share) return null;
  const q = prepared.quotation;
  const link = quoteLink(share.shareToken);
  const email = customerOf(q).email;
  const canShareFile = typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [prepared.pdf] });

  const downloadPdf = () => {
    const url = URL.createObjectURL(prepared.pdf);
    const a = document.createElement("a");
    a.href = url;
    a.download = prepared.pdf.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const shareWithPdf = async () => {
    try {
      await navigator.share({ files: [prepared.pdf], text: message, title: `Quotation ${q.quotationNumber}` });
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error("Could not open sharing — use WhatsApp or Download PDF instead.");
    }
  };

  const whatsApp = () => {
    if (!canShareFile) downloadPdf();
    const to = waNumber(phone);
    window.open(`https://wa.me/${to}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    if (!canShareFile) toast.success("PDF downloaded — drag it into the WhatsApp chat with the message");
  };

  const mail = () => {
    downloadPdf();
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Quotation ${q.quotationNumber} — ${prepared.company.name || ""}`.trim())}&body=${encodeURIComponent(message.replace(/\*/g, ""))}`;
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { toast.error("Could not copy — select the link and copy it."); }
  };

  const updateLink = async (kind: "off" | "new") => {
    if (kind === "new" && !window.confirm("Make a new link? The link already sent will stop working.")) return;
    if (kind === "off" && !window.confirm("Turn the link off? The customer won't be able to open it.")) return;
    setBusy(kind);
    try {
      const next = kind === "new"
        ? await quotationApi.regenerateShare(q.id as number)
        : await quotationApi.setShareEnabled(q.id as number, false);
      setShare({ ...next, staffName: share.staffName });
      if (kind === "new") {
        setMessage((m) => m.split(link).join(quoteLink(next.shareToken)));
        toast.success("New link made — the old one no longer works");
      } else {
        toast.success("Link turned off");
      }
    } catch {
      toast.error("Could not change the link.");
    } finally { setBusy(null); }
  };

  const enable = async () => {
    setBusy("on");
    try { setShare({ ...(await quotationApi.setShareEnabled(q.id as number, true)), staffName: share.staffName }); }
    catch { toast.error("Could not turn the link on."); }
    finally { setBusy(null); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Share2 className="h-5 w-5" /> Share {q.quotationNumber}</DialogTitle>
        </DialogHeader>

        {share.customerAcceptedAt && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <BadgeCheck className="h-4 w-4 shrink-0" />
            Accepted online by {share.customerAcceptedName} on {fmtDate(share.customerAcceptedAt)}
          </div>
        )}

        {/* Customer link */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">Customer link — opens only this quotation, no login</span>
            <span className={share.shareEnabled ? "text-emerald-700" : "text-destructive"}>{share.shareEnabled ? "Active" : "Turned off"}</span>
          </div>
          <div className="flex gap-1.5">
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Customer link"
              className={`h-9 min-w-0 flex-1 rounded-md border bg-muted/40 px-2.5 text-sm ${share.shareEnabled ? "" : "line-through text-muted-foreground"}`} />
            <Button size="sm" variant="outline" className="h-9" onClick={copyLink} aria-label="Copy link">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="outline" className="h-9" asChild>
              <a href={link} target="_blank" rel="noopener noreferrer" aria-label="Open link"><ExternalLink className="h-4 w-4" /></a>
            </Button>
          </div>
        </div>

        {/* Message */}
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Message (you can edit it)</span>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={10}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">WhatsApp to</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Customer's number (or leave empty to pick in WhatsApp)"
            inputMode="tel" className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2.5 text-sm outline-none focus:border-ring" />
        </label>

        <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Download className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{prepared.pdf.name} · {(prepared.pdf.size / 1024).toFixed(0)} KB</span>
          <button type="button" onClick={downloadPdf} className="font-medium text-primary hover:underline">Download</button>
        </div>

        {/* Send */}
        <div className="grid gap-2 sm:grid-cols-2">
          {canShareFile && (
            <Button className="h-10 sm:col-span-2" onClick={shareWithPdf} disabled={!share.shareEnabled}>
              <Share2 className="h-4 w-4" /> Share PDF + message
            </Button>
          )}
          <Button className={`h-10 ${canShareFile ? "" : "bg-[#1F7A4D] text-white hover:bg-[#19663F]"}`} variant={canShareFile ? "outline" : "default"}
            onClick={whatsApp} disabled={!share.shareEnabled}>
            <MessageCircle className="h-4 w-4" /> WhatsApp{canShareFile ? " (text only)" : ""}
          </Button>
          <Button className="h-10" variant="outline" onClick={mail} disabled={!share.shareEnabled}>
            <Mail className="h-4 w-4" /> Email
          </Button>
        </div>
        {!canShareFile && (
          <p className="text-xs text-muted-foreground">
            On a computer WhatsApp can't receive a file from a web page: the PDF downloads and WhatsApp opens with the
            message — drag the PDF into the chat. On a phone, "Share PDF + message" attaches it for you.
          </p>
        )}

        {/* Link controls */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs">
          {share.shareEnabled ? (
            <button type="button" onClick={() => updateLink("off")} disabled={!!busy}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive">
              {busy === "off" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2Off className="h-3.5 w-3.5" />} Turn link off
            </button>
          ) : (
            <button type="button" onClick={enable} disabled={!!busy}
              className="inline-flex items-center gap-1 text-primary hover:underline">
              {busy === "on" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Turn link on
            </button>
          )}
          <button type="button" onClick={() => updateLink("new")} disabled={!!busy}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            {busy === "new" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} New link
          </button>
          <span className="ml-auto text-muted-foreground">Changes to the sheet reach the link when you share again.</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
