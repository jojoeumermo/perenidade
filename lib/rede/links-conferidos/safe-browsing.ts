// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conferência dos LINKS de um post da Alumia no Google Safe Browsing (onda 11, 11F), feita pelo servidor do site
// (app/api/rede/links/route.ts). Só o link entra aqui, nunca o texto do post, o nome ou a conta de quem escreve.
//
// O Google não vê o link: usamos a API v5 "hashes:search" com PREFIXOS de resumo. Cada link é arrumado pela regra pública do
// Safe Browsing (canonizar), vira até 30 expressões (o nome do lugar e os começos do caminho), cada expressão vira um resumo
// SHA-256 (node:crypto) e só os 4 primeiros bytes de cada resumo vão ao Google. Cada prefixo de 4 bytes serve para muitíssimos
// endereços; o Google devolve os resumos COMPLETOS das páginas perigosas que começam assim, e quem compara com o resumo do nosso
// link é este servidor. A resposta do Google fica na memória pelo tempo que ela mesma diz (cacheDuration), sem o link.
// Nada daqui grava em banco ou em registro. Sem a chave (GOOGLE_SAFE_BROWSING_KEY), não sai nada: `conferido: false`.
//
// Referências: developers.google.com/safe-browsing/reference (URLs and Hashing; hashes.search v5). Sem "@/" de propósito: os
// testes rodam este arquivo direto no Node.
import { createHash } from "node:crypto";
import { domainToASCII } from "node:url";

// ───── Canonizar (a regra do Safe Browsing) ─────

/** Os bytes do texto como uma "string binária" (cada caractere < 256 é um byte; o resto vira UTF-8). */
function emBytes(texto: string): string {
  let saida = "";
  for (const c of texto) {
    const n = c.codePointAt(0) ?? 0;
    if (n < 256) saida += c;
    else for (const b of Buffer.from(c, "utf8")) saida += String.fromCharCode(b);
  }
  return saida;
}

/** Tira os escapes %XX de novo e de novo, até não sobrar nenhum. */
function desescapar(s: string): string {
  let antes = "";
  let agora = s;
  for (let i = 0; i < 64 && antes !== agora; i++) {
    antes = agora;
    agora = agora.replace(/%([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
  }
  return agora;
}

/** Escapa o que a regra manda: até o espaço (32), de 127 em diante, "#" e "%". Hexadecimal em maiúsculas. */
function escapar(s: string): string {
  let saida = "";
  for (const c of s) {
    const n = c.charCodeAt(0);
    saida += n <= 32 || n >= 127 || c === "#" || c === "%" ? `%${n.toString(16).toUpperCase().padStart(2, "0")}` : c;
  }
  return saida;
}

/** O nome do lugar é um endereço de rede escrito de qualquer jeito (decimal, octal, hexadecimal, menos de 4 partes)? */
function comoIp(host: string): string | null {
  const partes = host.split(".");
  if (partes.length < 1 || partes.length > 4 || partes.some((p) => p === "")) return null;
  const nums: number[] = [];
  for (const p of partes) {
    let n: number;
    if (/^0x[0-9a-f]*$/i.test(p)) n = p.length === 2 ? 0 : parseInt(p.slice(2), 16);
    else if (/^0[0-7]*$/.test(p)) n = parseInt(p, 8);
    else if (/^[1-9][0-9]*$/.test(p)) n = parseInt(p, 10);
    else return null;
    if (!Number.isFinite(n)) return null;
    nums.push(n);
  }
  const ultimo = nums.pop() as number;
  if (nums.some((n) => n > 255) || ultimo >= 256 ** (4 - nums.length)) return null;
  const bytes = [...nums];
  for (let i = 3 - nums.length; i >= 0; i--) bytes.push(Math.floor(ultimo / 256 ** i) % 256);
  return bytes.join(".");
}

function arrumarHost(bruto: string): { host: string; ip: boolean } {
  let h = desescapar(bruto);
  const arroba = h.lastIndexOf("@");
  if (arroba >= 0) h = h.slice(arroba + 1);
  h = h.replace(/:\d*$/, "");
  // Só as letras ASCII descem para minúscula aqui: os outros bytes podem ser pedaços de UTF-8 (o punycode cuida deles).
  h = h.replace(/^\.+|\.+$/g, "").replace(/\.{2,}/g, ".").replace(/[A-Z]+/g, (x) => x.toLowerCase());
  const ip = comoIp(h);
  if (ip) return { host: ip, ip: true };
  // Nome com letras de outro alfabeto: o punycode do próprio Node (o mesmo que o navegador usa para abrir). Os bytes podem ser
  // UTF-8 (vieram escapados) ou já as letras; o que não vira nome válido fica como está e é escapado abaixo.
  if (/[^\x00-\x7f]/.test(h)) {
    let letras = h;
    try {
      letras = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(h, "latin1"));
    } catch {
      // não era UTF-8: as letras já são as do texto
    }
    const ascii = domainToASCII(letras);
    if (ascii) h = ascii;
  }
  return { host: escapar(h), ip: false };
}

function arrumarCaminho(bruto: string): string {
  const segmentos = desescapar(bruto).split("/");
  const pilha: string[] = [];
  for (let i = 1; i < segmentos.length; i++) {
    const s = segmentos[i];
    const ultimo = i === segmentos.length - 1;
    if (s === "..") {
      pilha.pop();
      if (ultimo) pilha.push("");
    } else if (s === ".") {
      if (ultimo) pilha.push("");
    } else if (s === "" && !ultimo) {
      // barras repetidas viram uma
    } else pilha.push(s);
  }
  return escapar("/" + pilha.join("/"));
}

/**
 * O link arrumado pela regra do Safe Browsing ("http://host/caminho?consulta"), ou nulo quando não é um link da web. Exemplos da
 * referência estão no teste (scripts/testar-alumia-o11-links.mjs).
 */
export function canonizar(link: string): string | null {
  if (/^\s*(javascript|data|vbscript|mailto|file|tel|about|blob|ftp):/i.test(link)) return null;
  let u = link.replace(/^[\s\x00]+|[\s\x00]+$/g, "").replace(/[\t\r\n]/g, "");
  const cerquilha = u.indexOf("#");
  if (cerquilha >= 0) u = u.slice(0, cerquilha);
  u = emBytes(u);
  const m = /^([a-z][a-z0-9+.-]*):\/\//i.exec(u);
  let esquema = "http";
  if (m) {
    esquema = m[1].toLowerCase();
    u = u.slice(m[0].length);
  }
  if (esquema !== "http" && esquema !== "https") return null;
  const fimDoHost = u.search(/[/?]/);
  const hostBruto = fimDoHost < 0 ? u : u.slice(0, fimDoHost);
  let resto = fimDoHost < 0 ? "/" : u.slice(fimDoHost);
  if (resto.startsWith("?")) resto = "/" + resto;
  const interrogacao = resto.indexOf("?");
  const caminho = interrogacao < 0 ? resto : resto.slice(0, interrogacao);
  const consulta = interrogacao < 0 ? null : resto.slice(interrogacao + 1);
  const { host } = arrumarHost(hostBruto);
  if (!host) return null;
  return `${esquema}://${host}${arrumarCaminho(caminho)}${consulta === null ? "" : `?${escapar(desescapar(consulta))}`}`;
}

// ───── As expressões (nome do lugar × começo do caminho) ─────

/** As até 30 expressões de um link canonizado, sem esquema, como a referência manda. */
export function expressoes(canonico: string): string[] {
  const m = /^https?:\/\/([^/]*)(\/[^?]*)(\?.*)?$/.exec(canonico);
  if (!m) return [];
  const host = m[1];
  const caminho = m[2];
  const consulta = m[3] ?? null;
  const hosts = [host];
  if (!comoIp(host)) {
    const partes = host.split(".").slice(-5);
    for (let i = 0; i <= partes.length - 2 && hosts.length < 5; i++) {
      const h = partes.slice(i).join(".");
      if (h !== host && !hosts.includes(h)) hosts.push(h);
    }
  }
  const caminhos: string[] = [];
  const juntar = (c: string) => !caminhos.includes(c) && caminhos.push(c);
  if (consulta !== null) juntar(caminho + consulta);
  juntar(caminho);
  const pedacos = caminho.split("/").slice(1, -1);
  let atual = "/";
  juntar(atual);
  for (let i = 0; i < pedacos.length && i < 3; i++) {
    atual += `${pedacos[i]}/`;
    juntar(atual);
  }
  const saida: string[] = [];
  for (const h of hosts) for (const c of caminhos) if (saida.length < 30) saida.push(h + c);
  return saida;
}

/** O resumo SHA-256 de uma expressão (os bytes dela como estão). */
export function resumo(expressao: string): Buffer {
  return createHash("sha256").update(Buffer.from(expressao, "latin1")).digest();
}

/** Os resumos e os prefixos de 4 bytes (base64) de um link; vazio quando não é link da web. */
export function prefixosDoLink(link: string): { resumos: Buffer[]; prefixos: string[] } {
  const c = canonizar(link);
  if (!c) return { resumos: [], prefixos: [] };
  const resumos = expressoes(c).map(resumo);
  return { resumos, prefixos: [...new Set(resumos.map((r) => r.subarray(0, 4).toString("base64")))] };
}

// ───── A consulta (hashes:search v5) ─────

export type TipoDePerigo = "MALWARE" | "SOCIAL_ENGINEERING" | "UNWANTED_SOFTWARE" | "POTENTIALLY_HARMFUL_APPLICATION" | string;

export interface LinkPerigoso {
  link: string;
  tipos: TipoDePerigo[];
}

export interface ResultadoDaConferencia {
  /** O Google respondeu (com a chave configurada). Falso: só valeu a lista do aparelho. */
  conferido: boolean;
  perigosos: LinkPerigoso[];
}

interface Guardado {
  ate: number;
  /** resumo completo (base64) → tipos de perigo que valem para link aberto direto */
  completos: Map<string, TipoDePerigo[]>;
}

/** A memória das respostas do Google, por prefixo (sem o link). Exportada para os testes limparem. */
export const memoriaDoGoogle = new Map<string, Guardado>();
const MAXIMO_NA_MEMORIA = 20_000;

export const ENDERECO_DA_CONSULTA = "https://safebrowsing.googleapis.com/v5/hashes:search";
export const MAXIMO_DE_LINKS = 10;

/** "300s", "3.5s" → milissegundos (no mínimo 30 s, no máximo 1 dia). */
function duracao(texto: unknown): number {
  const s = typeof texto === "string" ? parseFloat(texto.replace(/s$/, "")) : NaN;
  return Math.min(Math.max(Number.isFinite(s) ? s * 1000 : 300_000, 30_000), 86_400_000);
}

type Buscar = (url: string, init?: { method?: string; headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/**
 * Confere os links (até 10) e diz quais são perigosos. `chave` é a GOOGLE_SAFE_BROWSING_KEY (só no servidor); sem ela, nada sai.
 * `buscar` é o fetch (os testes passam um dublê do Google). Falha de rede ou resposta torta: `conferido: false`, sem bloquear.
 */
export async function conferirLinks(links: readonly string[], chave: string | undefined, buscar: Buscar = fetch as unknown as Buscar, agora: number = Date.now()): Promise<ResultadoDaConferencia> {
  const lista = [...new Set(links.filter((l) => typeof l === "string" && l.length > 0 && l.length <= 2048))].slice(0, MAXIMO_DE_LINKS);
  if (!chave || lista.length === 0) return { conferido: Boolean(chave) && lista.length === 0, perigosos: [] };
  const porLink = lista.map((link) => ({ link, ...prefixosDoLink(link) }));
  const faltam = [...new Set(porLink.flatMap((x) => x.prefixos))].filter((p) => {
    const g = memoriaDoGoogle.get(p);
    return !g || g.ate <= agora;
  });
  if (faltam.length) {
    try {
      const q = new URLSearchParams();
      for (const p of faltam) q.append("hashPrefixes", p);
      q.set("key", chave);
      const r = await buscar(`${ENDERECO_DA_CONSULTA}?${q.toString()}`, { method: "GET", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(4000) });
      if (!r.ok) return { conferido: false, perigosos: [] };
      const corpo = (await r.json()) as { fullHashes?: { fullHash?: string; fullHashDetails?: { threatType?: string; attributes?: string[] }[] }[]; cacheDuration?: string };
      const ate = agora + duracao(corpo?.cacheDuration);
      const novos = new Map<string, Map<string, TipoDePerigo[]>>(faltam.map((p) => [p, new Map()]));
      for (const f of Array.isArray(corpo?.fullHashes) ? corpo.fullHashes : []) {
        if (typeof f?.fullHash !== "string") continue;
        const completo = Buffer.from(f.fullHash, "base64");
        if (completo.length !== 32) continue;
        // CANARY: o Google diz que não é para barrar; FRAME_ONLY: só vale para página dentro de outra (não é o caso de um link).
        const tipos = (f.fullHashDetails ?? [])
          .filter((d) => typeof d?.threatType === "string" && !(d.attributes ?? []).some((a) => a === "CANARY" || a === "FRAME_ONLY"))
          .map((d) => d.threatType as string);
        const p = completo.subarray(0, 4).toString("base64");
        if (tipos.length && novos.has(p)) novos.get(p)!.set(completo.toString("base64"), [...new Set(tipos)]);
      }
      if (memoriaDoGoogle.size > MAXIMO_NA_MEMORIA) memoriaDoGoogle.clear();
      for (const [p, completos] of novos) memoriaDoGoogle.set(p, { ate, completos });
    } catch {
      return { conferido: false, perigosos: [] };
    }
  }
  const perigosos: LinkPerigoso[] = [];
  for (const x of porLink) {
    const tipos = new Set<TipoDePerigo>();
    for (const r of x.resumos) {
      const achado = memoriaDoGoogle.get(r.subarray(0, 4).toString("base64"))?.completos.get(r.toString("base64"));
      achado?.forEach((t) => tipos.add(t));
    }
    if (tipos.size) perigosos.push({ link: x.link, tipos: [...tipos] });
  }
  return { conferido: true, perigosos };
}
