// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Manda as páginas públicas do site para o Wayback Machine do Internet Archive (Save Page Now), para que exista uma
// cópia fora das nossas mãos mesmo se o site cair ou for derrubado (pedido de 09/11/2026, item 1 das pequenas tarefas).
// Roda toda semana pelo GitHub Actions (.github/workflows/arquivar.yml) e não precisa de chave nenhuma.
//
// Como funciona: lê o mapa do site (sitemap.xml), fica só com os endereços do próprio site, pula os que já têm cópia
// no Wayback com menos de 30 dias e manda os demais, um de cada vez, com pausa entre eles (o Save Page Now sem conta
// aceita poucos pedidos por minuto). Cada execução manda no máximo LIMITE páginas, então em algumas semanas o site
// inteiro passa e depois só o que envelheceu. Falha de uma página não derruba as outras nem a execução.
//
// Uso: node scripts/arquivar-no-wayback.mjs [--site https://institutolucia.org] [--limite 150] [--seco]

const args = process.argv.slice(2);
const opcao = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : padrao;
};
const SITE = opcao("site", process.env.SITE_URL || "https://institutolucia.org").replace(/\/$/, "");
const LIMITE = Math.max(1, Math.min(300, Number(opcao("limite", "150")) || 150));
const SECO = args.includes("--seco");
const PAUSA_MS = 15_000;
const VELHO_MS = 30 * 24 * 3600 * 1000;
const AGENTE = "InstitutoLucia-arquivo/1.0 (+https://institutolucia.org)";

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function buscar(url, init = {}) {
  const ctl = new AbortController();
  const prazo = setTimeout(() => ctl.abort(), 90_000);
  try {
    return await fetch(url, { ...init, signal: ctl.signal, headers: { "User-Agent": AGENTE, ...(init.headers ?? {}) } });
  } finally {
    clearTimeout(prazo);
  }
}

/** Os endereços do mapa do site (segue um índice de mapas, se houver), só do próprio host. */
async function enderecosDoSite() {
  const host = new URL(SITE).host;
  const vistos = new Set();
  const fila = [`${SITE}/sitemap.xml`];
  const paginas = new Set();
  while (fila.length && vistos.size < 20) {
    const mapa = fila.shift();
    if (vistos.has(mapa)) continue;
    vistos.add(mapa);
    const r = await buscar(mapa);
    if (!r.ok) throw new Error(`mapa do site respondeu ${r.status}: ${mapa}`);
    const xml = await r.text();
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
    for (const loc of locs) {
      let u;
      try {
        u = new URL(loc);
      } catch {
        continue;
      }
      if (u.host !== host || u.protocol !== "https:") continue;
      if (/sitemap.*\.xml$/.test(u.pathname)) fila.push(u.href);
      else paginas.add(u.href);
    }
  }
  return [...paginas];
}

/** Data da cópia mais recente no Wayback (ou null). */
async function ultimaCopia(url) {
  try {
    const r = await buscar(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`);
    if (!r.ok) return null;
    const j = await r.json();
    const ts = j?.archived_snapshots?.closest?.timestamp;
    if (!ts || !/^\d{14}$/.test(ts)) return null;
    return new Date(Date.UTC(+ts.slice(0, 4), +ts.slice(4, 6) - 1, +ts.slice(6, 8), +ts.slice(8, 10), +ts.slice(10, 12)));
  } catch {
    return null;
  }
}

async function arquivar(url) {
  const r = await buscar(`https://web.archive.org/save/${url}`, { redirect: "manual" });
  const onde = r.headers.get("content-location") || r.headers.get("location") || "";
  return { ok: r.status < 400, status: r.status, onde };
}

const todas = await enderecosDoSite();
// O português vem primeiro (é o texto original; as outras línguas vêm depois). Dentro de cada grupo, começa por um
// ponto diferente a cada semana, para não mandar sempre as mesmas primeiro.
const semana = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
const girar = (lista) => {
  lista.sort();
  const i = lista.length ? (semana * LIMITE) % lista.length : 0;
  return [...lista.slice(i), ...lista.slice(0, i)];
};
const ePortugues = (u) => new URL(u).pathname === "/" || new URL(u).pathname.startsWith("/pt");
const ordem = [...girar(todas.filter(ePortugues)), ...girar(todas.filter((u) => !ePortugues(u)))];
console.log(`${todas.length} páginas no mapa de ${SITE}; esta execução manda até ${LIMITE}${SECO ? " (simulação, sem mandar)" : ""}.`);

let mandadas = 0;
let puladas = 0;
let falhas = 0;
for (const url of ordem) {
  if (mandadas >= LIMITE) break;
  const ultima = await ultimaCopia(url);
  if (ultima && Date.now() - ultima.getTime() < VELHO_MS) {
    puladas++;
    continue;
  }
  if (SECO) {
    console.log(`mandaria: ${url}`);
    mandadas++;
    continue;
  }
  try {
    const r = await arquivar(url);
    if (r.ok) {
      mandadas++;
      console.log(`ok ${r.status} ${url}`);
    } else {
      falhas++;
      console.log(`falhou ${r.status} ${url}`);
      // 429: o Archive pediu calma; espera mais antes do próximo.
      if (r.status === 429) await dormir(PAUSA_MS * 4);
    }
  } catch (e) {
    falhas++;
    console.log(`falhou ${url}: ${e instanceof Error ? e.message : e}`);
  }
  await dormir(PAUSA_MS);
}
console.log(`\nMandadas: ${mandadas} · com cópia recente (puladas): ${puladas} · falhas: ${falhas}.`);
