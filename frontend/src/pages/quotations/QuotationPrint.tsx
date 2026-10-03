import { useEffect, useMemo, useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays, Check, FileText, Globe, Landmark, Loader2, Mail, MapPin, Package, Pencil, Percent, Phone, Plus, Printer,
  Receipt, Tag, Truck, User, Users, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import { quotationApi } from "@/api/quotationApi";
import { NumCell } from "@/pages/leads/quote/cells";
import {
  buildCategoryBlocks, lineDiscountAmount, lineGross, quoteCharges, type Quotation, type QuotationItem,
} from "@/types/quotation";
import { resolveFileUrl } from "@/lib/uploadFile";
import { colorsOf, useLineProducts } from "@/pages/leads/quote/productCells";
import { fetchCompanyProfile, type CompanyProfile } from "@/lib/companyProfile";
import { lineTotal, pricingPatch, quoteTotals, readPricing, type QuotePricing } from "./quotationPricing";

/**
 * Print-optimised, branded quotation (JB Decor banner, meta cards, Category → Product table with photo,
 * CUSTOM/INVENTORY tag, qty, unit, rate, discount, amount; terms + summary; signatures, contact, QR). Rendered as a full-screen overlay on screen (covers the
 * dashboard chrome), and isolated for printing via the visibility technique in the injected <style>
 * so it prints cleanly regardless of the surrounding layout. No PDF library — the browser's
 * "Save as PDF" produces the file.
 *
 * "Edit" turns the sheet into a form right before printing: item prices, customer discount, GST,
 * dates and terms. Edits save to the quotation itself; the editing controls never print.
 * Items the customer dropped (REJECTED) are left off.
 */
export default function QuotationPrint() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return <QuotationPrintView quotationId={Number(id)} onClose={() => navigate(`/quotations/${id}`)} />;
}

/** The print sheet as an overlay — also opened in place from the lead's Sales Journey (no route change). */
export function QuotationPrintView({ quotationId, onClose, onSaved, readOnly }: {
  quotationId: number;
  onClose: () => void;
  /** No Edit button — used where prices are typed on the price sheet, not on the printout. */
  readOnly?: boolean;
  /** Called after an edit is saved, so the screen underneath can refresh. */
  onSaved?: (q: Quotation) => void;
}) {
  const { hasAuthority, isAdmin } = useAuth();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rates, setRates] = useState<Record<number, number | null | undefined>>({});
  const [pricing, setPricing] = useState<QuotePricing>({ mode: "PERCENT", value: 0, gst: 0 });
  const [fields, setFields] = useState({ quotationDate: "", expiryDate: "", termsAndConditions: "" });

  const adopt = (q: Quotation) => {
    setQuotation(q);
    setRates({});
    setPricing(readPricing(q));
    setFields({ quotationDate: q.quotationDate || "", expiryDate: q.expiryDate || "", termsAndConditions: q.termsAndConditions || "" });
  };

  const [company, setCompany] = useState<CompanyProfile>({ name: "JB Decor" });
  useEffect(() => { fetchCompanyProfile().then(setCompany); }, []);

  useEffect(() => {
    quotationApi.get(quotationId).then(adopt).catch(console.error).finally(() => setLoading(false));
  }, [quotationId]);

  const status = quotation?.status || "DRAFT";
  const isManager = isAdmin || hasAuthority("ROLE_MANAGER") || hasAuthority("ROLE_PROJECT_MANAGER");
  // Same rule as the server: approved quotations are repriced by managers only; converted never.
  const canEdit = !readOnly && (hasAuthority("QUOTATION_WRITE") || isAdmin) && status !== "CONVERTED"
    && (status !== "APPROVED" || isManager);

  const items = useMemo(() => (quotation?.items || []).filter((i) => i.status !== "REJECTED"), [quotation]);
  const rateOf = (it: QuotationItem) => (rates[it.id!] !== undefined ? rates[it.id!] ?? 0 : it.rate);
  // Live lines while editing: totals, and the material/labour split scaled to the new price
  // (the server does the same on save).
  const liveItems = useMemo(() => items.map((it) => {
    const total = lineTotal(it, rateOf(it));
    if (!editing || rates[it.id!] === undefined) return it;
    return { ...it, rate: rateOf(it), totalAmount: total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [items, rates, editing]);
  const blocks = useMemo(() => buildCategoryBlocks(liveItems), [liveItems]);
  const { products } = useLineProducts(items.map((i) => i.productId).filter((x): x is number => x != null));
  const swatchOf = (it: QuotationItem) =>
    it.productId != null && it.color
      ? colorsOf(products[it.productId]).find((c) => c.name.toLowerCase() === it.color!.toLowerCase())?.hex
      : undefined;
  const totals = useMemo(
    () => (quotation ? quoteTotals(quotation, { items, rateDrafts: rates, pricing }) : null),
    [quotation, items, rates, pricing],
  );
  const client = quotation?.customer?.name || quotation?.lead?.name;

  const saveEdits = async () => {
    if (!quotation) return;
    setSaving(true);
    try {
      const saved = await quotationApi.update(quotationId, {
        ...quotation,
        ...fields,
        quotationDate: fields.quotationDate || undefined,
        expiryDate: fields.expiryDate || undefined,
        items: (quotation.items || []).map((i) => (i.id != null && rates[i.id] !== undefined ? { ...i, rate: rates[i.id] ?? 0 } : i)),
        ...pricingPatch(pricing),
      } as Quotation);
      adopt(saved);
      onSaved?.(saved);
      setEditing(false);
      toast.success("Quotation updated");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not save the changes.");
    } finally { setSaving(false); }
  };


  if (loading) return <div className="fixed inset-0 z-50 bg-white flex items-center justify-center text-slate-500">Loading…</div>;
  if (!quotation || !totals) return <div className="fixed inset-0 z-50 bg-white flex items-center justify-center text-red-600">Failed to load quotation.</div>;

  const charges = quoteCharges(quotation);
  const itemsTotal = liveItems.reduce((s, i) => s + Number(i.totalAmount ?? 0), 0);
  const grossTotal = liveItems.reduce((s, i) => s + lineGross(i), 0);
  const lineDiscTotal = liveItems.reduce((s, i) => s + lineDiscountAmount(i), 0);
  const shown = editing ? totals : {
    discount: quotation.discount, gst: quotation.gst, grand: quotation.grandTotal,
  };
  // Labour and Shipping always show (₹0 when none), like the approved design; any other charge follows.
  const isLabour = (l: string) => /labou?r/i.test(l);
  const isShipping = (l: string) => /ship|transport|delivery/i.test(l);
  const labourAmt = charges.filter((c) => isLabour(c.label)).reduce((s, c) => s + c.amount, 0);
  const shippingAmt = charges.filter((c) => isShipping(c.label)).reduce((s, c) => s + c.amount, 0);
  const otherCharges = charges.filter((c) => !isLabour(c.label) && !isShipping(c.label));

  const lead: any = quotation.lead || {};
  const cust: any = quotation.customer || {};
  const clientCode = cust.customerCode || lead.leadNumber;
  const site = quotation.project?.projectName || lead.siteAddress || cust.siteAddress
    || (quotation.siteVisit as any)?.locationAddress || lead.city || cust.city;
  const qDate = editing ? fields.quotationDate : quotation.quotationDate;
  const xDate = editing ? fields.expiryDate : quotation.expiryDate;
  const validDays = daysBetween(qDate, xDate);
  const terms = (quotation.termsAndConditions || "").split(/\r?\n/)
    .map((t) => t.replace(/^\s*(\d+[.)]|[-•*])\s*/, "").trim()).filter(Boolean);
  let rowNo = 0;

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-neutral-200">
      <style>{QP_CSS}</style>

      {/* Screen-only toolbar */}
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-white border-b px-4 py-2 shadow-sm">
        <span className="text-sm font-medium text-slate-600">
          {editing ? "Editing — prices, discount, GST, dates and terms" : `Print preview — ${quotation.quotationNumber}`}
        </span>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button size="sm" variant="outline" disabled={saving} onClick={() => { adopt(quotation); setEditing(false); }}>
                <X className="mr-1.5 h-4 w-4" /> Cancel
              </Button>
              <Button size="sm" disabled={saving} onClick={saveEdits} className="bg-green-600 hover:bg-green-700 text-white">
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />} Save changes
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={onClose}>
                <X className="mr-1.5 h-4 w-4" /> Close
              </Button>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="mr-1.5 h-4 w-4" /> Edit
                </Button>
              )}
              <Button size="sm" onClick={() => window.print()}>
                <Printer className="mr-1.5 h-4 w-4" /> Print / Save as PDF
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="qp-scroll">
        <div id="quotation-print" className="qp">
          {/* Brand banner */}
          <header className="qp-banner">
            <div className="qp-banner-brand">
              <img src={`${import.meta.env.BASE_URL}jb-decor-logo-md.png`} alt={company.name} className="qp-logo" />
            </div>
            <div className="qp-banner-photo">
              <img src={BANNER_PHOTO} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            </div>
            <div className="qp-banner-tag">
              <p>Beautiful<br />Spaces<br />Better Living</p>
              <span />
            </div>
          </header>

          <div className="qp-body">
            {/* Title + meta cards */}
            <div className="qp-head">
              <div className="qp-title">
                <h1>QUOTATION</h1>
                <p>INTERIOR &amp; DECOR SOLUTIONS</p>
              </div>
              <div className="qp-meta">
                <div className="qp-meta-cell">
                  <FileText className="qp-ico" />
                  <div>
                    <small>Quote No.</small>
                    <b>{quotation.quotationNumber}{quotation.revisionNumber ? ` · v${quotation.revisionNumber}` : ""}</b>
                    {editing ? (
                      <input type="date" className="qp-input" value={fields.quotationDate}
                        onChange={(e) => setFields((f) => ({ ...f, quotationDate: e.target.value }))} />
                    ) : <span>{fmtDate(qDate)}</span>}
                  </div>
                </div>
                <div className="qp-meta-cell">
                  <User className="qp-ico" />
                  <div>
                    <small>Customer</small>
                    <b>{client || "—"}</b>
                    {clientCode && <span>{clientCode}</span>}
                  </div>
                </div>
                <div className="qp-meta-cell">
                  <MapPin className="qp-ico" />
                  <div>
                    <small>Site / Project</small>
                    <span className="qp-site">{site || "—"}</span>
                  </div>
                </div>
              </div>
              <div className="qp-valid">
                <CalendarDays className="qp-ico" />
                <div>
                  <small>Valid Till</small>
                  {editing ? (
                    <input type="date" className="qp-input" value={fields.expiryDate}
                      onChange={(e) => setFields((f) => ({ ...f, expiryDate: e.target.value }))} />
                  ) : <b>{fmtDate(xDate)}</b>}
                  {validDays != null && validDays >= 0 && <span>{validDays} days</span>}
                </div>
              </div>
            </div>

            {/* Items, grouped by category */}
            <table className="qp-table">
              <colgroup>
                <col style={{ width: "6%" }} /><col /><col style={{ width: "8%" }} /><col style={{ width: "8%" }} />
                <col style={{ width: "11%" }} /><col style={{ width: "9%" }} /><col style={{ width: "13%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>#</th><th className="qp-left">Description</th><th>Qty</th><th>Unit</th>
                  <th>Rate (₹)</th><th>Disc. (%)</th><th className="qp-right">Amount (₹)</th>
                </tr>
              </thead>
              {blocks.map((block, bi) => {
                const tone = TONES[bi % TONES.length];
                return (
                  <tbody key={block.category} className="qp-block">
                    <tr className="qp-cat">
                      <td colSpan={7}>
                        <div className="qp-cat-row" style={{ background: tone.bg, borderLeftColor: tone.bar }}>
                          <Package className="qp-cat-ico" style={{ color: tone.bar }} />
                          <span className="qp-cat-name">{block.category.toUpperCase()}</span>
                          <span className="qp-cat-count">{block.items.length} item{block.items.length === 1 ? "" : "s"}</span>
                          <span className="qp-cat-total"><small>Category Total</small>{fmtMoney(block.total)}</span>
                        </div>
                      </td>
                    </tr>
                    {block.items.map((it) => {
                      rowNo += 1;
                      const hex = swatchOf(it);
                      const sub = [it.description?.split(/\r?\n/)[0], it.color, it.location || it.roomName].filter(Boolean);
                      return (
                        <tr key={it.id} className="qp-row">
                          <td>{rowNo}</td>
                          <td className="qp-left">
                            <div className="qp-item">
                              <div className="qp-thumb">
                                {it.imageUrl ? (
                                  <img src={resolveFileUrl(it.imageUrl)} alt=""
                                    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                                ) : <Package className="h-6 w-6" />}
                              </div>
                              <div className="min-w-0">
                                <p className="qp-name">
                                  {it.itemName}
                                  <span className={it.productId != null ? "qp-badge qp-badge-inv" : "qp-badge"}>
                                    {it.productId != null ? "INVENTORY" : "CUSTOM"}
                                  </span>
                                </p>
                                {sub.length > 0 && (
                                  <p className="qp-sub">
                                    {hex && <i className="qp-swatch" style={{ background: hex }} />}
                                    {sub.join("  ·  ")}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>{fmtNum(it.quantity)}</td>
                          <td>{unitLabel(it.unit)}</td>
                          <td>
                            {editing ? (
                              <span className="block w-24 ml-auto">
                                <NumCell value={rateOf(it) != null ? Math.round(Number(rateOf(it)) * 100) / 100 : null} col="printRate" className="h-7 text-xs border-slate-300 bg-amber-50"
                                  onCommit={(v) => setRates((r) => ({ ...r, [it.id!]: v ?? 0 }))} />
                              </span>
                            ) : fmtNum(it.rate)}
                          </td>
                          <td>{discLabel(it)}</td>
                          <td className="qp-right qp-amt">{fmtNum(it.totalAmount)}</td>
                        </tr>
                      );
                    })}
                    <tr className="qp-gap"><td colSpan={7} /></tr>
                  </tbody>
                );
              })}
            </table>

            {/* Terms + summary */}
            <div className="qp-bottom">
              <div className={editing || terms.length > 0 ? "qp-terms qp-terms-box" : "qp-terms"}>
                {(editing || terms.length > 0) && (
                  <>
                    <h3><Package className="qp-terms-ico" /> Terms &amp; Conditions</h3>
                    {editing ? (
                      <textarea rows={5} className="qp-textarea" value={fields.termsAndConditions}
                        placeholder="One term per line — payment terms, validity, warranty…"
                        onChange={(e) => setFields((f) => ({ ...f, termsAndConditions: e.target.value }))} />
                    ) : (
                      <ol>{terms.map((t, i) => <li key={i}>{t}</li>)}</ol>
                    )}
                  </>
                )}
              </div>

              <div className="qp-summary">
                <div className="qp-sum-rows">
                  <SumRow icon={<Receipt />} label="Products Total" value={fmtMoney(grossTotal)} />
                  {lineDiscTotal > 0 && <SumRow icon={<Tag />} label="Line Discount" value={`- ${fmtMoney(lineDiscTotal)}`} />}
                  <SumRow icon={<Package />} label="Products Net Total" value={fmtMoney(itemsTotal)} strong />
                  <SumRow icon={<Users />} label="Labour" value={fmtMoney(labourAmt)} />
                  <SumRow icon={<Truck />} label="Shipping" value={fmtMoney(shippingAmt)} />
                  {otherCharges.map((c, i) => (
                    <SumRow key={i} icon={<Plus />} label={c.note ? `${c.label} · ${c.note}` : c.label} value={fmtMoney(c.amount)} />
                  ))}
                  {(editing || Number(shown.discount ?? 0) > 0) && (
                    <SumRow icon={<Percent />} value={`- ${fmtMoney(shown.discount)}`} label={
                      <span className="inline-flex items-center gap-1">
                        Discount
                        {editing ? (
                          <>
                            <select className="qp-input" value={pricing.mode}
                              onChange={(e) => setPricing((p) => ({ ...p, mode: e.target.value as QuotePricing["mode"], value: 0 }))}>
                              <option value="PERCENT">%</option>
                              <option value="FLAT">₹</option>
                            </select>
                            <span className="w-16"><NumCell value={pricing.value} className="h-6 text-xs border-slate-300 bg-amber-50"
                              onCommit={(v) => setPricing((p) => ({ ...p, value: v ?? 0 }))} /></span>
                          </>
                        ) : pricing.mode === "PERCENT" && pricing.value > 0 ? ` (${pricing.value}%)` : ""}
                      </span>
                    } />
                  )}
                  <SumRow icon={<Landmark />} value={fmtMoney(shown.gst ?? 0)} label={
                    <span className="inline-flex items-center gap-1">
                      GST
                      {editing ? (
                        <span className="w-16 flex items-center gap-0.5"><NumCell value={pricing.gst} className="h-6 text-xs border-slate-300 bg-amber-50"
                          onCommit={(v) => setPricing((p) => ({ ...p, gst: v ?? 0 }))} />%</span>
                      ) : ` (${pricing.gst}%)`}
                    </span>
                  } />
                </div>
                <div className="qp-final">
                  <span className="qp-final-ico">₹</span>
                  <span className="qp-final-label">Final Price</span>
                  <span className="qp-final-val">{fmtMoney(shown.grand)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <footer className="qp-foot">
              <div className="qp-thanks">
                <p className="qp-script">Thank You!</p>
                <p>We look forward to working with you.</p>
              </div>
              <div className="qp-sign">
                {quotation.customerSignatureBase64 && <img src={quotation.customerSignatureBase64} alt="" />}
                <span>Customer Signature</span>
              </div>
              <div className="qp-sign">
                <span>Authorised Signature<br />{company.name}</span>
              </div>
              <div className="qp-contact">
                {company.phone && <p><Phone /> {company.phone}</p>}
                {company.email && <p><Mail /> {company.email}</p>}
                <p><Globe /> {WEBSITE.replace(/^https?:\/\//, "")}</p>
              </div>
              <div className="qp-qr">
                <QRCodeSVG value={WEBSITE} size={64} level="M" />
                <span>Scan to<br />view online</span>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

function SumRow({ icon, label, value, strong }: { icon: ReactNode; label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className={strong ? "qp-sum qp-sum-strong" : "qp-sum"}>
      <span className="qp-sum-ico">{icon}</span>
      <span className="qp-sum-label">{label}</span>
      <span className="qp-sum-val">{value}</span>
    </div>
  );
}

const WEBSITE = "https://jbdecorcdm.com";
/** Optional banner photo — put an interior image at frontend/public/quote-banner.jpg; hidden when absent. */
const BANNER_PHOTO = `${import.meta.env.BASE_URL}quote-banner.jpg`;
/** Category header tints, cycled. */
const TONES = [
  { bg: "#fbf3e2", bar: "#c99a3e" },
  { bg: "#eaf1fb", bar: "#5b8bd0" },
  { bg: "#e8f4ee", bar: "#3f8f68" },
  { bg: "#f8ecef", bar: "#b8607a" },
];

const fmtNum = (v?: number | null) =>
  v === undefined || v === null ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const fmtMoney = (v?: number | null) => (v === undefined || v === null ? "—" : `₹${fmtNum(v)}`);

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function daysBetween(a?: string | null, b?: string | null) {
  if (!a || !b) return null;
  const x = new Date(a).getTime(), y = new Date(b).getTime();
  return isNaN(x) || isNaN(y) ? null : Math.round((y - x) / 86400000);
}

function unitLabel(u?: string) {
  if (!u) return "—";
  const l = u.toLowerCase();
  if (l === "sqft" || l === "sft") return "Sqft";
  return u.charAt(0).toUpperCase() + u.slice(1);
}

function discLabel(it: QuotationItem) {
  if (Number(it.discountPercentage ?? 0) > 0) return `${fmtNum(it.discountPercentage)}%`;
  if (Number(it.discountAmount ?? 0) > 0) return `₹${fmtNum(it.discountAmount)}`;
  return "0%";
}

// Scoped, exact colours (the app's Tailwind palette is remapped by the theme, so the sheet doesn't use it).
const QP_CSS = `
.qp-scroll { padding: 24px 16px; }
.qp { --ink:#0f2a33; --gold:#c99a3e; --line:#e3e8ee; --muted:#5d6b78; --soft:#f6f8fb;
  max-width: 920px; margin: 0 auto; background:#fff; color: var(--ink); font-family: Inter, system-ui, sans-serif;
  box-shadow: 0 10px 40px rgba(15,42,51,.15); border-radius: 14px; overflow: hidden;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.qp * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.qp-banner { display:flex; height:118px; background:#f3f1ec; position:relative; }
.qp-banner-brand { flex: 0 0 44%; background: linear-gradient(135deg,#0b2a35 0%,#123f4d 100%); display:flex; align-items:center;
  padding: 0 28px; clip-path: polygon(0 0,100% 0,88% 100%,0 100%); position:relative; z-index:2; }
.qp-banner-brand::after { content:""; position:absolute; top:0; right:0; width:10px; height:100%;
  background: linear-gradient(180deg,#e6c27a,#b8862f); clip-path: polygon(60% 0,100% 0,40% 100%,0 100%); }
.qp-logo { height: 66px; width:auto; }
.qp-banner-photo { flex:1; margin-left:-60px; background: linear-gradient(120deg,#e9dfcf,#f6efe3 60%,#efe6d6); overflow:hidden; }
.qp-banner-photo img { width:100%; height:100%; object-fit:cover; }
.qp-banner-tag { flex:0 0 24%; display:flex; flex-direction:column; justify-content:center; padding: 0 22px;
  background: linear-gradient(90deg,rgba(247,246,242,0),#f7f6f2 30%); }
.qp-banner-tag p { font-family:"Playfair Display",Georgia,serif; font-size:21px; line-height:1.15; color:#123f4d; margin:0; }
.qp-banner-tag span { display:block; width:56px; height:2px; background:var(--gold); margin-top:10px; }
.qp-body { padding: 22px 22px 18px; }
.qp-head { display:flex; gap:12px; align-items:stretch; margin-bottom: 18px; }
.qp-title { flex: 0 0 auto; padding-right: 4px; }
.qp-title h1 { font-family:"Playfair Display",Georgia,serif; font-weight:700; font-size:38px; line-height:1; color:#0b1f3a; margin:6px 0 10px; letter-spacing:.3px; }
.qp-title p { font-size:10.5px; letter-spacing:2.6px; color:#4a5866; margin:0; }
.qp-meta { flex:1; display:flex; background: var(--soft); border:1px solid var(--line); border-radius:12px; min-width:0; }
.qp-meta-cell { flex:1 1 auto; display:flex; gap:7px; padding:11px 10px; align-items:flex-start; min-width:0; }
.qp-meta-cell + .qp-meta-cell { border-left:1px solid var(--line); }
.qp-meta small, .qp-valid small { display:block; font-size:11.5px; color:var(--muted); }
.qp-meta b, .qp-valid b { display:block; font-size:14px; font-weight:600; color:var(--ink); margin:2px 0; white-space:nowrap; }
.qp-meta span, .qp-valid span { display:block; font-size:12px; color:var(--muted); white-space:nowrap; }
.qp-meta .qp-site { white-space:normal; }
.qp-meta .qp-site { color: var(--ink); font-size:13px; margin-top:3px; overflow-wrap:anywhere; }
.qp-ico { width:20px; height:20px; color:#123f4d; flex-shrink:0; margin-top:4px; stroke-width:1.6; }
.qp-valid { flex: 0 0 auto; display:flex; gap:10px; padding:12px 14px; background:#fbf3e2; border-radius:12px; }
.qp-table { width:100%; border-collapse:separate; border-spacing:0; font-size:13px; }
.qp-table thead th { background:var(--soft); border-top:1px solid var(--line); border-bottom:1px solid var(--line); padding:10px 8px; font-weight:600; text-align:center; color:var(--ink); }
.qp-table thead th:first-child { border-left:1px solid var(--line); border-radius:10px 0 0 10px; }
.qp-table thead th:last-child { border-right:1px solid var(--line); border-radius:0 10px 10px 0; }
.qp-table td { padding:8px; text-align:center; vertical-align:middle; }
.qp-table .qp-left { text-align:left; }
.qp-table .qp-right { text-align:right; padding-right:18px; }
.qp-block { break-inside: avoid; page-break-inside: avoid; }
.qp-cat td { padding: 8px 0 0; }
.qp-cat-row { display:flex; align-items:center; gap:12px; border-left:4px solid; border-radius:8px; padding:9px 18px 9px 16px; }
.qp-cat-ico { width:22px; height:22px; stroke-width:1.6; }
.qp-cat-name { font-family:"Playfair Display",Georgia,serif; font-weight:700; font-size:18px; letter-spacing:.3px; }
.qp-cat-count { font-size:12.5px; color:var(--muted); }
.qp-cat-total { margin-left:auto; font-weight:700; font-size:16px; white-space:nowrap; }
.qp-cat-total small { font-weight:400; font-size:12.5px; color:var(--muted); margin-right:8px; }
.qp-row td { border-bottom:1px solid var(--line); border-left:1px solid var(--line); }
.qp-row td:last-child { border-right:1px solid var(--line); }
.qp-item { display:flex; align-items:center; gap:14px; }
.qp-thumb { width:56px; height:50px; border-radius:6px; background:#f1efe9; display:flex; align-items:center; justify-content:center;
  color:#b7ad9a; overflow:hidden; flex-shrink:0; border:1px solid var(--line); }
.qp-thumb img { width:100%; height:100%; object-fit:cover; }
.qp-name { font-weight:600; font-size:14.5px; margin:0; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.qp-badge { font-size:10.5px; font-weight:600; letter-spacing:.4px; padding:2px 7px; border-radius:4px; background:#e6effc; color:#2f63b5; }
.qp-badge-inv { background:#e3f4e8; color:#25804a; }
.qp-sub { margin:3px 0 0; font-size:12px; color:var(--muted); display:flex; align-items:center; gap:5px; white-space:pre-wrap; }
.qp-swatch { display:inline-block; width:10px; height:10px; border-radius:50%; border:1px solid #cfd6dd; }
.qp-amt { font-weight:600; }
.qp-gap td { padding:4px 0; border:0; }
.qp-bottom { display:flex; gap:22px; margin-top:10px; align-items:flex-start; break-inside:avoid; page-break-inside:avoid; }
.qp-terms { flex:1; min-width:0; }
.qp-terms-box { border:1px solid var(--line); border-radius:14px; padding:16px 20px; min-height:150px; }
.qp-terms h3 { display:flex; align-items:center; gap:10px; font-size:15px; font-weight:600; margin:0 0 8px; }
.qp-terms-ico { width:30px; height:30px; padding:5px; background:#fbf3e2; border-radius:8px; color:#123f4d; stroke-width:1.6; }
.qp-terms ol { margin:0; padding-left:20px; list-style:decimal; font-size:12.5px; color:#3d4a56; line-height:1.75; }
.qp-textarea { width:100%; border:1px solid #cbd5e1; background:#fffbeb; border-radius:6px; padding:8px; font-size:12px; }
.qp-summary { flex: 0 0 300px; }
.qp-sum-rows { border:1px solid var(--line); border-bottom:0; border-radius:12px 12px 0 0; background:var(--soft); padding:6px 0 8px; }
.qp-sum { display:flex; align-items:center; gap:10px; padding:4px 14px; font-size:13px; color:#3d4a56; }
.qp-sum-ico svg { width:15px; height:15px; color:#6b7785; stroke-width:1.6; display:block; }
.qp-sum-label { flex:1; }
.qp-sum-val { font-size:15px; color:var(--ink); white-space:nowrap; }
.qp-sum-strong { background:#fbf3e2; color:var(--ink); font-weight:700; padding:7px 14px; margin:3px 0; }
.qp-sum-strong .qp-sum-val { font-weight:700; font-size:16px; }
.qp-sum-strong .qp-sum-ico svg { color:var(--gold); }
.qp-final { display:flex; align-items:center; gap:12px; background: linear-gradient(135deg,#0b2a35,#0f3a45); color:#fff; border-radius:10px; padding:13px 18px; }
.qp-final-ico { width:26px; height:26px; border-radius:50%; background:#fff; color:#0b2a35; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; }
.qp-final-label { flex:1; font-family:"Playfair Display",Georgia,serif; font-size:20px; font-weight:600; }
.qp-final-val { font-family:"Playfair Display",Georgia,serif; font-size:24px; font-weight:700; white-space:nowrap; }
.qp-foot { display:flex; align-items:flex-end; gap:20px; margin-top:22px; break-inside:avoid; page-break-inside:avoid; }
.qp-thanks { flex: 1.3; }
.qp-script { font-family:"Playfair Display",Georgia,serif; font-style:italic; font-size:30px; color:var(--gold); margin:0; transform: rotate(-4deg); transform-origin:left; }
.qp-thanks p:last-child { font-size:13px; color:#3d4a56; margin:4px 0 0 18px; }
.qp-sign { flex:1; text-align:center; font-size:11.5px; color:#3d4a56; }
.qp-sign img { max-height:40px; margin:0 auto 2px; }
.qp-sign span { display:block; border-top:1px solid #9aa5b1; padding-top:4px; }
.qp-contact { flex:1.2; font-size:12.5px; color:#3d4a56; min-width:0; }
.qp-contact p { display:flex; align-items:center; gap:8px; margin:2px 0; overflow-wrap:anywhere; }
.qp-contact svg { width:14px; height:14px; color:var(--ink); flex-shrink:0; }
.qp-qr { display:flex; align-items:flex-end; gap:6px; font-size:11px; color:var(--muted); line-height:1.25; }
.qp-input { border:1px solid #cbd5e1; background:#fffbeb; border-radius:4px; padding:1px 4px; font-size:12px; }
@media (max-width: 760px) {
  .qp-head, .qp-bottom, .qp-foot { flex-wrap:wrap; }
  .qp-meta { flex-wrap:wrap; flex-basis:100%; } .qp-summary { flex-basis:100%; }
  .qp-banner-tag { display:none; } .qp-banner-brand { flex-basis:70%; } .qp-title h1 { font-size:34px; }
  .qp-table { font-size:12px; } .qp-scroll { padding: 12px 0; }
}
@media print {
  body * { visibility: hidden !important; }
  #quotation-print, #quotation-print * { visibility: visible !important; }
  #quotation-print { position: absolute; left: 0; top: 0; width: 100%; max-width:none; box-shadow: none !important; margin: 0 !important; border-radius:0; }
  .qp-scroll { padding:0; }
  .no-print { display: none !important; }
  @page { size: A4; margin: 8mm; }
}
`;
