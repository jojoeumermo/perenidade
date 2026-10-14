// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Material da auditoria: percorre o site montado a partir de um idioma, seguindo só links internos, e anota links
// quebrados, páginas sem <h1>, imagens sem alt e páginas pesadas.
//
//   npm run build && npm start -- -p 3200          (em outro terminal)
//   node docs/auditoria/rastrear.mjs http://localhost:3200 /pt
// No Git Bash do Windows, ponha MSYS_NO_PATHCONV=1 na frente, senão "/pt" vira um caminho de pasta.
const base = process.argv[2] ?? "http://localhost:3200";
const prefixo = process.argv[3] ?? "/pt";
const fila = [prefixo];
const vistos = new Set(fila);
const origens = new Map();
const quebrados = [];
const semAlt = new Map();
const semH1 = [];
const pesados = [];
let abertos = 0;

const links = (html) => [...html.matchAll(/href="([^"#?]*)(?:[?#][^"]*)?"/g)].map((achado) => achado[1]).filter((href) => href.startsWith("/") && !href.startsWith("//"));

async function visitar(caminho) {
  let resposta;
  try {
    resposta = await fetch(base + caminho, { redirect: "manual", signal: AbortSignal.timeout(60_000) });
  } catch (erro) {
    quebrados.push({ caminho, origem: origens.get(caminho), status: `erro ${erro.message}` });
    return;
  }
  abertos++;
  if (resposta.status >= 300 && resposta.status < 400) return;
  if (resposta.status !== 200) {
    quebrados.push({ caminho, origem: origens.get(caminho), status: resposta.status });
    return;
  }
  if (!(resposta.headers.get("content-type") ?? "").includes("text/html")) return;
  const html = await resposta.text();
  if (html.length > 600_000) pesados.push({ caminho, kb: Math.round(html.length / 1024) });
  if (!/<h1[\s>]/.test(html)) semH1.push(caminho);
  for (const img of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt=/.test(img[0])) semAlt.set(caminho, (semAlt.get(caminho) ?? 0) + 1);
  for (const link of links(html)) {
    if (/^\/(_next|pyodide|php|workers)\//.test(link)) continue;
    if (!link.startsWith(prefixo) && !/\.(png|jpe?g|webp|svg|pdf|epub|json|xml|txt|ico)$/.test(link)) continue;
    if (vistos.has(link)) continue;
    vistos.add(link);
    origens.set(link, caminho);
    fila.push(link);
  }
}

async function trabalhador() {
  while (fila.length) await visitar(fila.shift());
}
const inicio = Date.now();
while (fila.length) await Promise.all(Array.from({ length: 12 }, trabalhador));
console.log(JSON.stringify({ abertos, segundos: Math.round((Date.now() - inicio) / 1000), quebrados, semH1, semAlt: [...semAlt], pesados }, null, 1));
