"""Builds the human-readable manual (single HTML, print-ready) from the guide markdown files.

Run:  python docs/guide/build_manual.py
Output: docs/guide/Arudra-CRM-User-Manual.html  (open in a browser; Print -> Save as PDF)
Re-run any time a guide file changes.
"""
import base64
import html
import re
from pathlib import Path

import markdown

ROOT = Path(__file__).parent
OUT = ROOT / "Arudra-CRM-User-Manual.html"

PARTS = [
    ("Part 1 · Admin Guide", "admin", "For office staff using the desktop CRM"),
    ("Part 2 · Employee Guide", "employee", "For field and office employees using the mobile portal"),
    ("Part 3 · Website & Customer Guide", "website", "For website visitors and customers"),
    ("Part 4 · Workflows & Reference", "workflows", "End-to-end journeys, glossary and roles"),
]


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def inline_images(body: str) -> str:
    """Embed referenced images as base64 so the manual is one self-contained file."""
    def sub(m):
        path = (ROOT / "admin" / m.group(1)).resolve()
        for base in (ROOT / "admin", ROOT / "employee", ROOT / "website", ROOT):
            cand = (base / m.group(1)).resolve()
            if cand.exists():
                path = cand
                break
        if not path.exists():
            return m.group(0)
        data = base64.b64encode(path.read_bytes()).decode()
        return f'src="data:image/png;base64,{data}"'
    return re.sub(r'src="(\.\./images/[^"]+)"', sub, body)


def render(md_text: str, prefix: str) -> tuple[str, str]:
    """Return (title, html). Heading ids are prefixed so they stay unique across files."""
    md = markdown.Markdown(extensions=["tables", "fenced_code", "sane_lists", "toc"],
                           extension_configs={"toc": {"slugify": lambda v, s: f"{prefix}-{slug(v)}"}})
    body = md.convert(md_text)
    body = inline_images(body)
    m = re.search(r"^#\s+(.+)$", md_text, re.M)
    return (m.group(1).strip() if m else prefix), body


def main() -> None:
    toc, sections = [], []
    intro = ROOT / "00-screen-index.md"

    chap = 0
    for part_title, folder, blurb in PARTS:
        files = sorted((ROOT / folder).glob("*.md")) if (ROOT / folder).exists() else []
        if not files:
            continue
        toc.append(f'<li class="part"><span>{html.escape(part_title)}</span><ul>')
        sections.append(f'<section class="part-cover"><h1 class="part-title">{html.escape(part_title)}</h1>'
                        f'<p>{html.escape(blurb)}</p></section>')
        for f in files:
            chap += 1
            title, body = render(f.read_text(encoding="utf-8"), f"c{chap}")
            title = re.sub(r"^(Admin|Employee|Website) Guide\s*[—-]\s*", "", title)
            toc.append(f'<li><a href="#ch{chap}">{chap}. {html.escape(title)}</a></li>')
            sections.append(f'<section class="chapter" id="ch{chap}"><div class="chap-no">Chapter {chap}</div>{body}</section>')
        toc.append("</ul></li>")

    _, index_body = render(intro.read_text(encoding="utf-8"), "idx")
    ai = ROOT / "AI-INSTRUCTIONS.md"
    _, ai_body = render(ai.read_text(encoding="utf-8"), "ai") if ai.exists() else ("", "")

    qb = ROOT / "question-bank.md"
    _, qbank = render(qb.read_text(encoding="utf-8"), "qb") if qb.exists() else ("", "")

    doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Arudra CRM User Manual</title>
<style>{CSS}</style></head><body>
<header class="cover"><div class="brand">ARUDRA CRM</div><h1>User Manual</h1>
<p>Step-by-step guidance for Admins, Employees and Website Users</p></header>
<nav class="toc"><h2>Contents</h2><ul><li class="part"><span>Start here</span><ul>
<li><a href="#screens">Where to find every screen</a></li></ul></li>{''.join(toc)}
<li class="part"><span>Appendix</span><ul><li><a href="#ai">Using this manual with an AI assistant</a></li><li><a href="#qbank">Question bank</a></li></ul></li></ul></nav>
<main>
<section class="chapter" id="screens">{index_body}</section>
{''.join(sections)}
<section class="chapter" id="ai">{ai_body}</section>
<section class="chapter" id="qbank">{qbank}</section>
</main></body></html>"""
    OUT.write_text(doc, encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size // 1024} KB, {chap} chapters)")


CSS = """
:root{--ink:#1d2a24;--muted:#5d6b64;--forest:#14352a;--gold:#b08d3c;--line:#e3e0d5;--bg:#fbfaf6;--card:#fff}
@media (prefers-color-scheme:dark){:root{--ink:#e8ede9;--muted:#a3b0a8;--forest:#8fc4ac;--gold:#d9b765;--line:#2c3a33;--bg:#121a16;--card:#18221d}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif}
.cover{background:#14352a;color:#f5efe0;padding:72px 24px;text-align:center}
.cover .brand{letter-spacing:.3em;color:#d9b765;font-size:14px}.cover h1{font-size:44px;margin:12px 0}.cover p{opacity:.85;margin:0}
.toc,main{max-width:860px;margin:0 auto;padding:24px 16px}
.toc h2{color:var(--forest)}.toc ul{list-style:none;padding-left:0}.toc ul ul{padding-left:20px}
.toc .part>span{display:block;margin-top:14px;font-weight:700;color:var(--gold);text-transform:uppercase;font-size:13px;letter-spacing:.06em}
.toc a{color:var(--ink);text-decoration:none;display:block;padding:3px 0}.toc a:hover{color:var(--gold)}
.part-cover{margin:64px 0 8px;padding:32px 24px;border-radius:14px;background:var(--forest);color:#f5efe0}
.part-cover h1{border:0;margin:0;color:#f5efe0}.part-cover p{margin:6px 0 0;opacity:.85}
.chapter{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:8px 28px 20px;margin:20px 0}
.chap-no{margin-top:20px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);font-weight:700}
h1{font-size:30px;color:var(--forest);border-bottom:2px solid var(--gold);padding-bottom:8px}
h2{font-size:21px;color:var(--forest);margin-top:30px}h3{font-size:17px;margin-top:22px}
img{max-width:100%;height:auto;border:1px solid var(--line);border-radius:10px;margin:14px 0 2px;box-shadow:0 4px 14px rgba(0,0,0,.08)}
em{color:var(--muted)}
img[alt^="Phone"]{max-width:270px;display:block;margin:14px auto 2px}
img[alt^="Phone"]+em,p:has(>img[alt^="Phone"]) em{display:block;text-align:center}
blockquote{margin:12px 0;padding:8px 14px;border-left:4px solid var(--gold);background:rgba(176,141,60,.1);color:var(--muted)}
table{border-collapse:collapse;width:100%;font-size:14.5px;margin:14px 0;display:block;overflow-x:auto}
th,td{border:1px solid var(--line);padding:7px 10px;text-align:left;vertical-align:top}th{background:rgba(176,141,60,.14)}
code{background:rgba(127,127,127,.15);padding:1px 5px;border-radius:4px;font-size:.9em}
pre{background:rgba(127,127,127,.12);padding:12px;border-radius:8px;overflow-x:auto}
li{margin:3px 0}hr{border:0;border-top:1px solid var(--line)}
@media print{body{background:#fff;color:#000;font-size:11pt}.cover,.part-cover{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.chapter{border:0;padding:0;margin:0;break-before:page}.part-cover{break-before:page}.toc{break-after:page}h1,h2,h3{break-after:avoid}
img{break-inside:avoid;max-height:150mm;width:auto}table{display:table}a{color:inherit;text-decoration:none}}
@media (max-width:600px){.chapter{padding:6px 16px 16px}.cover h1{font-size:32px}}
"""

if __name__ == "__main__":
    main()
