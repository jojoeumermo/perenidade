// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Aula ao vivo (Etapa 9, B31). A decisão e as fontes estão em docs/plano-2026-11/notas/aula-ao-vivo.md.
//
// A sala própria do instituto é o Galène (MIT, servidor leve que roda no mesmo tipo de máquina da VPS), em
// infra/aula-ao-vivo/. O site não guarda nada do servidor de vídeo: só assina, na hora de entrar, um token curto (JWT
// HS256) que o Galène confere com a chave dele (campo "authKeys" do grupo). Quem conduz entra com op + present + record
// (pode gravar e moderar); quem assiste entra só com o chat. Sem o servidor configurado, nada daqui liga: vale o plano B
// (transmissão PeerTube ou YouTube embutida, só depois de um clique).
//
// Este arquivo é puro (sem "@/", sem disco, sem rede) para rodar também no teste em node puro (scripts/testar-aula-ao-vivo.mjs).

/** Os grupos (salas fixas) do Galène que a aula pode usar. O site escolhe um pelo número da aula. */
export const GRUPOS_PADRAO = ["aula-a", "aula-b", "aula-c", "aula-d"];

/** O token vale por pouco tempo: o Galène só o usa uma vez, ao entrar (documentação do protocolo). */
export const VALIDADE_DO_TOKEN_S = 90;

export interface ConfigDaSala {
  /** Endereço público do Galène, sem barra no fim (NEXT_PUBLIC_GALENE_URL). Vazio: sem servidor próprio. */
  url: string;
  /** Chave HS256 em base64url, a mesma de "authKeys" nos grupos (GALENE_JWT_KEY, só no servidor do site). */
  chave: string;
  grupos: string[];
  /** Permissões de quem assiste (GALENE_PERMISSOES_ALUNO, separadas por vírgula; padrão: só o chat). */
  permissoesAluno: string[];
}

type Env = Record<string, string | undefined>;

/** Aceita só https com domínio (ou localhost, nos testes); devolve a origem sem barra, ou "". */
export function origemDoGalene(texto: string | undefined): string {
  try {
    const u = new URL((texto ?? "").trim());
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(local && u.protocol === "http:")) return "";
    if (!local && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname)) return "";
    return u.origin;
  } catch {
    return "";
  }
}

const lista = (texto: string | undefined, padrao: string[], valido: RegExp) => {
  const itens = (texto ?? "").split(",").map((i) => i.trim()).filter((i) => valido.test(i));
  return itens.length ? [...new Set(itens)] : padrao;
};

export function configDaSala(env: Env = process.env): ConfigDaSala {
  return {
    url: origemDoGalene(env.NEXT_PUBLIC_GALENE_URL),
    chave: (env.GALENE_JWT_KEY ?? "").trim(),
    grupos: lista(env.GALENE_GRUPOS, GRUPOS_PADRAO, /^[a-z0-9][a-z0-9-]{0,39}$/),
    permissoesAluno: lista(env.GALENE_PERMISSOES_ALUNO, ["message"], /^[a-z]{2,20}$/),
  };
}

/**
 * O que o navegador pode saber (o Next só troca por valor as referências diretas a process.env.NEXT_PUBLIC_*, por isso
 * estas duas linhas não usam configDaSala()). A chave nunca vai para o navegador.
 */
export const GALENE_URL = origemDoGalene(process.env.NEXT_PUBLIC_GALENE_URL);
export const PEERTUBE_DOMINIOS = dominiosPeerTube({ NEXT_PUBLIC_VIDEO_HOSTS: process.env.NEXT_PUBLIC_VIDEO_HOSTS });

/** Como a página classifica um endereço guardado na aula (sala externa ou gravação). */
export const tipoNoSite = (url: string) => tipoDeLink(url, { galene: GALENE_URL, peertube: PEERTUBE_DOMINIOS });

/** O servidor próprio está pronto para assinar entradas? (endereço e chave de pelo menos 128 bits). */
export function salaPropriaPronta(c: ConfigDaSala): boolean {
  return Boolean(c.url) && bytesDaChave(c.chave).length >= 16;
}

/** Escolhe sempre o mesmo grupo para a mesma aula (FNV-1a do número da aula). */
export function grupoDaAula(aula: string, grupos: string[]): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < aula.length; i++) {
    h ^= aula.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return grupos[h % grupos.length];
}

/** Nome para mostrar na sala: letras, números e pontuação simples; no máximo 40 caracteres. */
export function nomeNaSala(nome: string | undefined): string {
  const limpo = (nome ?? "").normalize("NFC").replace(/[^\p{L}\p{N} .'_-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40);
  return limpo || "Participante";
}

// ---------------------------------------------------------------- JWT HS256 (WebCrypto: roda no site e no teste)

function bytesDaChave(chave: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(chave)) return new Uint8Array();
  const b64 = chave.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const textoB64 = (texto: string) => b64url(new TextEncoder().encode(texto));

export async function assinarJwt(claims: Record<string, unknown>, chave: string): Promise<string> {
  const bytes = bytesDaChave(chave);
  if (bytes.length < 16) throw new Error("chave_invalida");
  const corpo = `${textoB64(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${textoB64(JSON.stringify(claims))}`;
  const k = await crypto.subtle.importKey("raw", bytes as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const assinatura = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(corpo)));
  return `${corpo}.${b64url(assinatura)}`;
}

export interface Entrada {
  url: string;
  grupo: string;
  /** Quem conduz (para a tela dizer "sala do professor"). */
  conduz: boolean;
}

/** O endereço de entrada na sala: o grupo da aula com um token novo, válido por poucos segundos. */
export async function entradaNaSala(p: { aula: string; conduz: boolean; nome?: string; agora?: number; site?: string }, c: ConfigDaSala): Promise<Entrada> {
  if (!salaPropriaPronta(c)) throw new Error("sala_propria_desligada");
  const grupo = grupoDaAula(p.aula, c.grupos);
  const iat = Math.floor((p.agora ?? Date.now()) / 1000);
  const claims = {
    sub: nomeNaSala(p.nome),
    aud: `${c.url}/group/${grupo}/`,
    permissions: p.conduz ? ["op", "present", "record"] : c.permissoesAluno,
    iat,
    exp: iat + VALIDADE_DO_TOKEN_S,
    ...(p.site ? { iss: p.site } : {}),
  };
  const token = await assinarJwt(claims, c.chave);
  return { url: `${c.url}/group/${grupo}/?token=${token}`, grupo, conduz: p.conduz };
}

// ---------------------------------------------------------------- tipos de link (sala própria e plano B)

export type TipoDeLink = "propria" | "peertube" | "youtube" | "meet" | "jitsi" | "outro" | "nenhum";

const UUID_OU_CURTO = /^[A-Za-z0-9-]{8,40}$/;

/** Domínios PeerTube aceitos para embutir: os mesmos de NEXT_PUBLIC_VIDEO_HOSTS (next.config.ts os libera no frame-src). */
export function dominiosPeerTube(env: Env = process.env): string[] {
  return (env.NEXT_PUBLIC_VIDEO_HOSTS ?? "").split(",").map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d));
}

/** O id do vídeo PeerTube (/w/<id> ou /videos/watch/<id>) num domínio da lista; senão, null. */
export function videoPeerTube(url: string, dominios: string[]): { host: string; id: string } | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !dominios.includes(u.hostname.toLowerCase())) return null;
    const m = /^\/(?:w|videos\/watch|videos\/embed)\/([^/]+)\/?$/.exec(u.pathname);
    return m && UUID_OU_CURTO.test(m[1]) ? { host: u.hostname.toLowerCase(), id: m[1] } : null;
  } catch {
    return null;
  }
}

/** O endereço do tocador PeerTube, sem P2P (o P2P mostraria o endereço de rede de quem assiste a outras pessoas). */
export function embedPeerTube(v: { host: string; id: string }): string {
  return `https://${v.host}/videos/embed/${v.id}?autoplay=1&p2p=0&warningTitle=0`;
}

/** O id do YouTube (watch?v=, youtu.be/, live/), ou null. */
export function idDoYoutube(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1);
    else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") id = u.searchParams.get("v") ?? /^\/(?:live|embed)\/([^/]+)/.exec(u.pathname)?.[1] ?? null;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function ehGoogleMeet(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.toLowerCase() === "meet.google.com" && /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/.test(u.pathname);
  } catch {
    return false;
  }
}

/** Que tipo de endereço é este (da sala externa ou da gravação)? */
export function tipoDeLink(url: string, c: { galene: string; peertube: string[]; jitsi?: string[] }): TipoDeLink {
  if (!url) return "nenhum";
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return "outro";
    if (c.galene && u.origin === c.galene) return "propria";
    if (videoPeerTube(url, c.peertube)) return "peertube";
    if (idDoYoutube(url)) return "youtube";
    if (ehGoogleMeet(url)) return "meet";
    if (c.jitsi?.includes(u.hostname.toLowerCase())) return "jitsi";
  } catch {
    // endereço inválido
  }
  return "outro";
}
