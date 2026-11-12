import type { LicenseDoc } from '../../shared/licenses';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Tisknutelná HTML verze licence (Ctrl+P → Uložit jako PDF). */
export function renderLicenseHtml(doc: LicenseDoc, lang: 'cs' | 'en', banner = ''): string {
  const printLabel = lang === 'cs' ? 'Vytisknout / uložit jako PDF' : 'Print / save as PDF';
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(doc.title)}</title>
<style>
  :root{color-scheme:light}
  body{font:15px/1.6 Georgia,'Times New Roman',serif;color:#111;background:#f3f1ec;margin:0;padding:32px 16px}
  main{max-width:760px;margin:0 auto;background:#fff;padding:56px 64px;box-shadow:0 1px 0 #0002,0 20px 60px -30px #0006}
  h1{font:700 26px/1.2 Helvetica,Arial,sans-serif;margin:0 0 6px;letter-spacing:-.01em}
  .sub{font:13px/1.4 Helvetica,Arial,sans-serif;color:#555;margin:0 0 28px;text-transform:uppercase;letter-spacing:.06em}
  h2{font:700 15px/1.3 Helvetica,Arial,sans-serif;margin:26px 0 8px}
  p{margin:0 0 9px;text-align:justify;hyphens:auto}
  .parties p{text-align:left}
  .bar{max-width:760px;margin:0 auto 16px;display:flex;gap:12px;justify-content:space-between;align-items:center;font:13px Helvetica,Arial,sans-serif}
  .bar button{font:inherit;padding:9px 16px;border:1px solid #111;background:#111;color:#fff;border-radius:999px;cursor:pointer}
  .banner{color:#a33}
  footer{margin-top:36px;padding-top:14px;border-top:1px solid #ddd;font:12px Helvetica,Arial,sans-serif;color:#666}
  @media (max-width:640px){main{padding:32px 22px}}
  @media print{body{background:#fff;padding:0}main{box-shadow:none;padding:0;max-width:none}.bar{display:none}}
</style></head><body>
<div class="bar"><span class="banner">${esc(banner)}</span><button onclick="window.print()">${printLabel}</button></div>
<main>
<h1>${esc(doc.title)}</h1><p class="sub">${esc(doc.subtitle)}</p>
<div class="parties">${doc.parties.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
${doc.sections.map((s) => `<h2>${esc(s.h)}</h2>${s.p.map((p) => `<p>${esc(p)}</p>`).join('')}`).join('')}
<footer>${esc(doc.footer)}</footer>
</main></body></html>`;
}
