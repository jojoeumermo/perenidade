// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prévia de link da Rede (pacote publicar), gerada NO SERVIDOR: o navegador de quem lê nunca toca no site de fora (nem o de
// quem escreve: a rota daqui busca). Este módulo é a parte pura, testável no Node: a conferência de endereço (só http/https,
// sem senha na frente, só as portas 80 e 443, nunca endereço privado, de loopback, de nuvem ou de rede interna: SSRF), a leitura
// das etiquetas Open Graph e a assinatura da imagem (a imagem passa por um proxy nosso, que só aceita o que nós assinamos).
// A busca em si, com DNS conferido no momento de conectar, está em buscar-seguro.ts.
import { createHmac, timingSafeEqual } from "node:crypto";
import { isIPv4, isIPv6 } from "node:net";

/** O endereço IPv4 (a.b.c.d) é privado, reservado ou de rede interna? */
export function ipv4Privado(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true; // o que não se entende, bloqueia
  const [a, b, c] = p;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local e metadados de nuvem (169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) || (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224 // multicast, reservado e broadcast
  );
}

/** Expande um IPv6 em 8 grupos de 16 bits (nulo se não for válido). */
function grupos6(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0];
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const q = v4[1].split(".").map(Number);
    if (q.length !== 4 || q.some((n) => n > 255)) return null;
    s = s.slice(0, -v4[1].length) + ((q[0] << 8) | q[1]).toString(16) + ":" + ((q[2] << 8) | q[3]).toString(16);
  }
  const [cabeca, cauda, extra] = s.split("::");
  if (extra !== undefined) return null;
  const a = cabeca ? cabeca.split(":") : [];
  const z = cauda !== undefined && cauda ? cauda.split(":") : [];
  const faltam = cauda === undefined ? 0 : 8 - a.length - z.length;
  if (cauda === undefined ? a.length !== 8 : faltam < 1) return null;
  const todos = [...a, ...Array(faltam).fill("0"), ...z].map((h) => parseInt(h, 16));
  return todos.length === 8 && todos.every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffff) ? todos : null;
}

/** O endereço IPv6 é privado, local, mapeado para IPv4 privado ou de tradução (NAT64, 6to4, Teredo)? */
export function ipv6Privado(ip: string): boolean {
  const g = grupos6(ip);
  if (!g) return true;
  const [a, b, c, d, e, f, x, y] = g;
  const v4 = (h: number, l: number) => `${h >> 8}.${h & 255}.${l >> 8}.${l & 255}`;
  if (g.every((n) => n === 0) || (g.slice(0, 7).every((n) => n === 0) && y === 1)) return true; // :: e ::1
  if ((a & 0xfe00) === 0xfc00) return true; // fc00::/7 (local único)
  if ((a & 0xffc0) === 0xfe80 || (a & 0xffc0) === 0xfec0) return true; // fe80::/10 e fec0::/10
  if ((a & 0xff00) === 0xff00) return true; // multicast
  if (a === 0x2001 && b === 0x0db8) return true; // documentação
  if (a === 0 && b === 0 && c === 0 && d === 0 && e === 0 && f === 0xffff) return ipv4Privado(v4(x, y)); // ::ffff:a.b.c.d
  if (a === 0 && b === 0 && c === 0 && d === 0 && e === 0 && f === 0) return ipv4Privado(v4(x, y)); // ::a.b.c.d (compatível)
  if (a === 0x64 && b === 0xff9b) return ipv4Privado(v4(x, y)); // NAT64
  if (a === 0x2002) return ipv4Privado(v4(b, c)); // 6to4
  if (a === 0x2001 && b === 0) return true; // Teredo
  return false;
}

/** Este endereço de IP (v4 ou v6) é um destino que a Rede nunca busca? */
export function ipPrivado(ip: string): boolean {
  if (isIPv4(ip)) return ipv4Privado(ip);
  if (isIPv6(ip)) return ipv6Privado(ip);
  return true;
}

/**
 * O link como a Rede aceita buscar: http(s), sem usuário e senha, só porta 80 ou 443, nome com ponto (nada de "localhost",
 * ".local", ".internal"), e se o nome é um número de IP, que não seja privado. Devolve a URL limpa (sem o #fragmento) ou nulo.
 * Quem busca ainda confere o IP de verdade no momento de conectar (um nome pode apontar para dentro de casa).
 */
export function urlSegura(texto: string, opcoes: { qualquerPorta?: boolean } = {}): URL | null {
  let u: URL;
  try {
    u = new URL(texto.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== "80" && u.port !== "443" && !opcoes.qualquerPorta) return null;
  const nome = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!nome || nome.length > 253) return null;
  if (isIPv4(nome) || isIPv6(nome)) return ipPrivado(nome) ? null : ((u.hash = ""), u);
  if (!nome.includes(".") || /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain)$/.test(nome) || /\.arpa$/.test(nome)) return null;
  // Formas esquisitas de escrever IPv4 (0x7f.1, 2130706433, 017700000001) viram IP na URL e já caíram acima; o que sobra é nome de verdade.
  if (/^[0-9.]+$/.test(nome) || /^0x/i.test(nome)) return null;
  u.hash = "";
  return u;
}

export interface PreviaDeLink {
  url: string;
  dominio: string;
  titulo: string;
  descricao: string;
  /** Endereço (absoluto, http/https) da imagem no site de origem; o cliente só a vê pelo nosso proxy assinado. */
  imagem: string | null;
}

const entidades: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decodificar = (s: string) =>
  s
    .replace(/&#(\d{1,6});/g, (_, n: string) => (Number(n) < 0x110000 ? String.fromCodePoint(Number(n)) : ""))
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, n: string) => (parseInt(n, 16) < 0x110000 ? String.fromCodePoint(parseInt(n, 16)) : ""))
    .replace(/&([a-z]+);/gi, (inteiro, n: string) => entidades[n.toLowerCase()] ?? inteiro);

/** Lê os atributos de uma etiqueta <meta ...>. */
function atributos(tag: string): Record<string, string> {
  const r: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) r[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? "";
  return r;
}

const limpar = (s: string, max: number) => decodificar(s).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** Tira título, descrição e imagem das etiquetas Open Graph (ou Twitter, ou <title> e meta description). Só olha o <head>. */
export function extrairPrevia(html: string, base: URL): PreviaDeLink {
  const cabeca = html.slice(0, 300_000).split(/<\/head>/i)[0];
  const meta: Record<string, string> = {};
  for (const m of cabeca.matchAll(/<meta\b[^>]*>/gi)) {
    const a = atributos(m[0]);
    const chave = (a.property ?? a.name ?? "").toLowerCase();
    if (chave && a.content !== undefined && !(chave in meta)) meta[chave] = a.content;
  }
  const titulo = limpar(meta["og:title"] ?? meta["twitter:title"] ?? cabeca.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "", 200);
  const descricao = limpar(meta["og:description"] ?? meta["twitter:description"] ?? meta.description ?? "", 300);
  let imagem: string | null = null;
  const bruta = decodificar(meta["og:image"] ?? meta["og:image:url"] ?? meta["twitter:image"] ?? "").trim();
  if (bruta) {
    try {
      const u = urlSegura(new URL(bruta, base).href);
      imagem = u ? u.href : null;
    } catch {
      imagem = null; // endereço de imagem malformado na página de fora: sem imagem, nunca erro
    }
  }
  return { url: base.href, dominio: base.hostname.replace(/^www\./, ""), titulo, descricao, imagem };
}

// ── Assinatura da imagem ──

const assinatura = (url: string, segredo: string) => createHmac("sha256", segredo).update(url).digest("hex").slice(0, 32);

/** O endereço do nosso proxy para a imagem de uma prévia; sem segredo configurado, não há imagem (nulo). */
export function enderecoDaImagem(imagem: string | null, segredo: string | undefined): string | null {
  if (!imagem || !segredo) return null;
  return `/api/rede/previa/imagem?u=${encodeURIComponent(imagem)}&s=${assinatura(imagem, segredo)}`;
}

/** O proxy só serve imagem cuja assinatura é nossa (impede usar a rota como proxy aberto). */
export function assinaturaConfere(url: string, s: string, segredo: string | undefined): boolean {
  if (!segredo || !/^[0-9a-f]{32}$/.test(s)) return false;
  const esperado = Buffer.from(assinatura(url, segredo));
  const recebido = Buffer.from(s);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}
