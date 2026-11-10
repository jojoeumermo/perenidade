// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A ponte de sessão (login único entre institutolucia.org, alumia.institutolucia.org e escola.institutolucia.org): a lógica pura,
// que roda no navegador, na rota /api/sessao/ponte e nos testes. Sem "@/" de propósito.
//
// Como funciona (docs/rede/ENTRADA.md):
//  1. A Alumia (ou a Escola) sem sessão abre, num quadro escondido, /api/sessao/ponte do SITE (institutolucia.org). O quadro só
//     pode ser embutido pelos dois subdomínios (frame-ancestors) e só responde a eles (event.origin conferido aqui).
//  2. Lá dentro, o quadro lê a sessão do site (o armazenamento do próprio site) e, se houver, pede à rota (POST, mesma origem, com
//     o token no cabeçalho) um código de entrada de UMA vez (o "token_hash" de um link mágico gerado no servidor com a chave de
//     serviço, que nunca é enviado por e-mail nem vai em endereço).
//  3. O código volta por postMessage, só para a origem que pediu; a Alumia troca o código por uma sessão NOVA, dela (verifyOtp).
//     A sessão do site não é copiada: cada endereço tem a sua, e o segundo fator é pedido de novo no endereço novo.
// Nada de token em URL, nada de cookie no domínio .institutolucia.org.

const SUBDOMINIOS = ["alumia", "escola"] as const;
const DOMINIO = "institutolucia.org";

function partes(origem: string): URL | null {
  try {
    const u = new URL(origem);
    if (u.pathname !== "/" || u.search || u.hash || u.username || u.password) return null;
    return u;
  } catch {
    return null;
  }
}

const local = (u: URL) => u.protocol === "http:" && (u.hostname === "localhost" || u.hostname.endsWith(".localhost"));
const seguro = (u: URL) => u.protocol === "https:" || local(u);

/** A origem do site do instituto vista de um subdomínio (alumia./escola.); nula fora deles. */
export function origemDoSite(origemAtual: string): string | null {
  const u = partes(origemAtual);
  if (!u || !seguro(u)) return null;
  const [primeiro, ...resto] = u.hostname.toLowerCase().split(".");
  if (!(SUBDOMINIOS as readonly string[]).includes(primeiro) || resto.length === 0) return null;
  const host = resto.join(".");
  if (u.protocol === "http:" && host !== "localhost") return null;
  // Em produção, só o domínio do instituto (a ponte não serve para outro site).
  if (u.protocol === "https:" && host !== DOMINIO) return null;
  return `${u.protocol}//${host}${u.port ? `:${u.port}` : ""}`;
}

/** A origem que pede (event.origin, ou o "destino" da rota) é exatamente alumia.<site> ou escola.<site>, mesmo esquema e porta? */
export function origemPodePedir(origemPedido: string, origemSite: string): boolean {
  const p = partes(origemPedido);
  const s = partes(origemSite);
  if (!p || !s || !seguro(p) || p.protocol !== s.protocol || p.port !== s.port) return false;
  const host = s.hostname.toLowerCase();
  if (p.protocol === "http:" && host !== "localhost") return false;
  return SUBDOMINIOS.some((sub) => p.hostname.toLowerCase() === `${sub}.${host}`);
}

export type MensagemDaPonte =
  | { tipo: "pronto" }
  | { tipo: "pedir"; n: string }
  | { tipo: "sessao"; n: string; token_hash: string }
  | { tipo: "nada"; n: string; motivo: string };

const NUMERO = /^[a-f0-9]{32}$/;
const CODIGO = /^[a-f0-9]{20,128}$/;

/** Confere a forma de uma mensagem da ponte (o resto é descartado). */
export function mensagemDaPonte(bruta: unknown): MensagemDaPonte | null {
  if (!bruta || typeof bruta !== "object") return null;
  const m = bruta as Record<string, unknown>;
  if (m.tipo === "pronto") return { tipo: "pronto" };
  if (typeof m.n !== "string" || !NUMERO.test(m.n)) return null;
  if (m.tipo === "pedir") return { tipo: "pedir", n: m.n };
  if (m.tipo === "sessao" && typeof m.token_hash === "string" && CODIGO.test(m.token_hash)) return { tipo: "sessao", n: m.n, token_hash: m.token_hash };
  if (m.tipo === "nada") return { tipo: "nada", n: m.n, motivo: typeof m.motivo === "string" ? m.motivo.slice(0, 40).replace(/[^a-z_]/g, "") : "" };
  return null;
}

/** Um número da vez (32 letras hexadecimais), para casar o pedido com a resposta. */
export function numeroDaVez(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
