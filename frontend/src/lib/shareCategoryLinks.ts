/** Website category links for a lead's chosen categories, ready to send on WhatsApp. */

export interface CatalogCategory { id?: number; name: string; slug: string }

const SITE = ((import.meta.env.VITE_WEBSITE_URL as string) || "https://jbdecorcdm.com").replace(/\/+$/, "");

export const categoryUrl = (slug: string) => `${SITE}/products/${slug}`;

/** Match lead category names (comma-separated list) to website categories, case/space-insensitive. */
export function matchCategories(names: string[], all: CatalogCategory[]) {
  const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const bySlug = new Map(all.map((c) => [key(c.name), c]));
  return names.map((n) => {
    const hit = bySlug.get(key(n));
    return { name: n, url: hit ? categoryUrl(hit.slug) : null };
  });
}

/** wa.me wants digits with the country code; a plain 10-digit number is taken as Indian. */
export function waDigits(phone: string) {
  const d = phone.replace(/\D/g, "").replace(/^0+/, "");
  return d.length === 10 ? `91${d}` : d;
}

export function buildCatalogueMessage(customerName: string, picked: { name: string; url: string }[]) {
  const lines = [
    customerName ? `Hi ${customerName},` : "Hi,",
    "",
    "Greetings from *JB Decor*! As discussed, here " + (picked.length === 1 ? "is our collection" : "are our collections") + " for you:",
    "",
    ...picked.map((p) => `*${p.name}*\n${p.url}`),
    "",
    "Have a look and tell us what you like — we'll be happy to arrange a free site visit and measurement.",
  ];
  return lines.join("\n");
}
