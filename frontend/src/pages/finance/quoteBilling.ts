import { quoteCharges } from "@/types/quotation";
import { readPricing } from "@/pages/quotations/quotationPricing";

export interface QuoteBillLine { description: string; quantity: number; unitPrice: number }

/**
 * A quotation's lines priced as they would be billed: the customer discount is spread over the
 * products and everything is scaled to `billPct` (e.g. 30 for an advance).
 */
export function buildQuoteLines(q: any, billPct: number) {
  const n = (v: unknown) => Number(v ?? 0) || 0;
  const items = (q.items || []).filter((i: any) => i.status !== "REJECTED");
  const pricing = readPricing(q);
  const base = items.map((i: any) => {
    let t = n(i.rate) * n(i.quantity);
    if (n(i.discountPercentage) > 0) t -= t * n(i.discountPercentage) / 100;
    else if (n(i.discountAmount) > 0) t -= Math.min(n(i.discountAmount), t);
    return t + n(i.additionalCharges);
  });
  const charges = quoteCharges(q);
  const itemsSum = base.reduce((x: number, y: number) => x + y, 0);
  const chargesSum = charges.reduce((x, c) => x + c.amount, 0);
  const discBase = pricing.itemsOnly === false ? itemsSum + chargesSum : itemsSum;
  const discount = pricing.mode === "PERCENT" ? discBase * pricing.value / 100 : pricing.value;
  const f = discBase > 0 ? 1 - discount / discBase : 1;
  const k = (Number(billPct) || 100) / 100;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const built: QuoteBillLine[] = [
    ...items.map((i: any, idx: number) => ({
      description: [i.itemName, i.color].filter(Boolean).join(" — "),
      quantity: 1,
      unitPrice: r2(base[idx] * f * k),
    })),
    ...charges.map((c) => ({
      description: c.note ? `${c.label} — ${c.note}` : c.label,
      quantity: 1,
      unitPrice: r2(c.amount * (pricing.itemsOnly === false ? f : 1) * k),
    })),
  ].filter((l) => l.unitPrice > 0);
  return { built, pricing, k };
}
