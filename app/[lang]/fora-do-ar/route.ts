// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { getDict } from "@/i18n";
import { htmlLang, isLocale, type Locale } from "@/i18n/config";

// A página "fantasma": o que aparece no lugar do site (ou de uma área) enquanto a coordenação o mantém fora do ar.
// É uma resposta mínima e à parte do site, sem cabeçalho, menu nem scripts: o proxy.ts reescreve para cá os caminhos
// fechados e passa a área e o recado público por cabeçalhos. Ela nunca vai para o cache: o site volta assim que reabre.
export const dynamic = "force-dynamic";

const escapar = (texto: string) => texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

export async function GET(request: Request, { params }: RouteContext<"/[lang]/fora-do-ar">) {
  const { lang: pedido } = await params;
  const lang: Locale = isLocale(pedido) ? pedido : "pt";
  const t = getDict(lang).closed;
  const area = request.headers.get("x-lucia-area") ?? "geral";
  let recado = "";
  try {
    recado = decodeURIComponent(request.headers.get("x-lucia-recado") ?? "").slice(0, 300);
  } catch {
    recado = "";
  }
  const geral = area === "geral";
  const titulo = geral ? t.siteTitle : t.areaTitle;
  const html = `<!doctype html><html lang="${htmlLang[lang]}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapar(titulo)} — Instituto Lúcia</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4ecd8;color:#1f1a14;font-family:Georgia,"Times New Roman",serif;padding:1.5rem}main{max-width:34rem}p.nome{font-family:ui-monospace,Consolas,monospace;font-size:.75rem;letter-spacing:.25em;text-transform:uppercase;color:#8a5f1c;margin:0 0 1rem}h1{font-size:2rem;line-height:1.15;margin:0 0 .75rem}p{font-size:1.15rem;line-height:1.5}.recado{border-left:3px solid #6e1f1a;padding-left:1rem}nav{margin-top:2rem;font-family:system-ui,sans-serif;font-size:.85rem;display:flex;gap:1.5rem}a{color:#5a4e3c}@media(prefers-color-scheme:dark){body{background:#17130e;color:#efe4c8}p.nome{color:#d4a24c}.recado{border-color:#e0837a}a{color:#b3a584}}</style></head>
<body><main><p class="nome">Instituto Lúcia</p><h1>${escapar(titulo)}</h1><p>${escapar(geral ? t.siteLead : t.areaLead)}</p>${recado ? `<p class="recado">${escapar(recado)}</p>` : ""}
<nav>${geral ? "" : `<a href="/${lang}">${escapar(t.home)}</a>`}<a href="/${lang}/entrar">${escapar(t.team)}</a></nav></main></body></html>`;
  return new Response(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "600", "X-Robots-Tag": "noindex" },
  });
}
