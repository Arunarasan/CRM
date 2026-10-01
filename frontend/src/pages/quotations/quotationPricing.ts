import type { Quotation, QuotationItem } from "@/types/quotation";

// One place for quotation price maths, shared by the quotation page, the print page and the lead's
// Sales Journey, so every screen shows the same numbers as the server (QuotationService.recalculateTotals).

export type DiscountMode = "PERCENT" | "FLAT";
export interface QuotePricing { mode: DiscountMode; value: number; gst: number }

const num = (v: unknown) => Number(v ?? 0) || 0;

/** Line total exactly as the server computes it (rate × qty, less line discount, + charges, + line GST). */
export function lineTotal(it: QuotationItem, rate = it.rate) {
  if (rate == null || it.quantity == null) return num(it.totalAmount);
  let t = num(rate) * num(it.quantity);
  if (num(it.discountPercentage) > 0) t -= t * num(it.discountPercentage) / 100;
  t += num(it.additionalCharges);
  if (num(it.gstPercentage) > 0) t += t * num(it.gstPercentage) / 100;
  return t;
}

/** The single customer discount + GST the UI edits, read from the quotation's discount/tax rows. */
export function readPricing(q: Quotation): QuotePricing {
  const discounts: any[] = (q as any).discounts || [];
  const taxes: any[] = (q as any).taxes || [];
  const gst = taxes.filter((t) => !t.isInclusive).reduce((s, t) => s + num(t.percentage), 0);
  if (discounts.length === 1 && num(discounts[0].percentage) > 0) {
    return { mode: "PERCENT", value: num(discounts[0].percentage), gst };
  }
  return num(q.discount) > 0 ? { mode: "FLAT", value: num(q.discount), gst } : { mode: "PERCENT", value: 0, gst };
}

/** Update payload for the customer discount + GST (replaces the discount and tax rows). */
export function pricingPatch(p: QuotePricing) {
  return {
    discounts: p.value > 0 ? [{
      discountType: "OVERALL", description: "Customer discount",
      ...(p.mode === "PERCENT" ? { percentage: p.value } : { amount: p.value }),
    }] : [],
    taxes: p.gst > 0 ? [{ taxType: "GST", percentage: p.gst, isInclusive: false }] : [],
  };
}

/**
 * Totals for the given items (default: everything not dropped by the customer), with optional
 * unsaved rate drafts and unsaved discount/GST.
 */
export function quoteTotals(
  q: Quotation,
  opts: { items?: QuotationItem[]; rateDrafts?: Record<number, number | null | undefined>; pricing?: QuotePricing } = {},
) {
  const items = opts.items ?? (q.items || []).filter((i) => i.status !== "REJECTED");
  const drafts = opts.rateDrafts ?? {};
  const pricing = opts.pricing ?? readPricing(q);
  const rateOf = (i: QuotationItem) => (i.id != null && drafts[i.id] !== undefined ? drafts[i.id] ?? 0 : i.rate);
  const itemsTotal = items.reduce((s, i) => s + lineTotal(i, rateOf(i)), 0);
  const labours = ((q as any).labours || []).reduce((s: number, l: any) => s + num(l.amount), 0);
  const charges = ((q as any).additionalCharges || []).reduce((s: number, c: any) => s + num(c.amount), 0);
  const subtotal = itemsTotal + labours + charges;
  const discount = pricing.mode === "PERCENT" ? subtotal * pricing.value / 100 : pricing.value;
  const gst = (subtotal - discount) * pricing.gst / 100;
  return {
    count: items.length, subtotal, discount, gst, grand: subtotal - discount + gst,
    material: items.reduce((s, i) => s + num(i.materialCost), 0),
    labour: items.reduce((s, i) => s + num(i.labourCost), 0),
  };
}
