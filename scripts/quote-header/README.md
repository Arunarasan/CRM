# Quotation / invoice letterhead

`banner-art.png` is the artwork (logo, curtains, pin icon, gold rule) with **no address or phone text**;
`frontend/public/quote-header.jpg` and `website/public/quote-header.jpg` are its JPEG copies (2000 × 382).
The address and phone numbers are typed on top by the app from Settings → Company
(`contact.address`, `contact.phone`, `contact.phone2`). Where they sit: `frontend/src/lib/letterhead.ts`
(the website copy is in `website/src/pages/ViewQuote.tsx`).

To change the artwork, replace the three files with a new image of the same size (leave the text areas blank).
