# Quotation letterhead

`quote-header.jpg` (top of the printed quotation, the PDF and the customer's quote link) is made here:

- `base.jpg` — the banner artwork (background, gold curve, services strip)
- `logo.png` — the company logo (same as `website/public/jb-decor-logo.png`)
- `details.json` — address, phone, email, website typed onto the banner

To change any of them, edit the file and run (needs Node + Playwright with Chromium):

    cd scripts/quote-header && node render.cjs && convert out.png -quality 90 ../../frontend/public/quote-header.jpg \
      && cp ../../frontend/public/quote-header.jpg ../../website/public/quote-header.jpg && rm out.png
