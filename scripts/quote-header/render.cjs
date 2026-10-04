// Renders the quotation letterhead (quote-header.jpg) from base.jpg + logo.png + details.json.
// Run from this folder:  node render.cjs   (needs playwright; Chromium at /opt/pw-browsers or installed)
// Writes out.png here — see README.md for copying it into frontend/ and website/.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const details = JSON.parse(fs.readFileSync(path.join(__dirname, 'details.json'), 'utf8'));
  const b = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  const p = await b.newPage({ viewport: { width: 1536, height: 434 } });
  await p.goto('file://' + path.join(__dirname, 'header.html'));
  await p.evaluate((d) => window.render(d), details);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  const png = path.join(__dirname, 'out.png');
  await (await p.$('#b')).screenshot({ path: png });
  await b.close();
  console.log('rendered', png);
})();
