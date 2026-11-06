// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do servidor da federação: se ela está ligada, como chamar o banco (public.rede_fed_servidor, com o segredo), as chaves
// (geradas aqui, guardadas cifradas no banco), o ator remoto (buscado com a trava de SSRF e guardado em cache) e o limite de pedidos.
// Só roda no servidor (rotas app/api/fediverso/** e app/.well-known/**). Sem "@/".
import { ligado } from "../../recursos";
import { gerarParDeChaves } from "./assinatura";
import { cifrar, decifrar } from "./cifra";
import { enderecosDaFederacao, type EnderecosDaFederacao } from "./enderecos";
import { lerJson, pedirAoFediverso } from "./http";
import { textoCurto } from "./texto";
import { assinarPedido } from "./assinatura";
import { ALUMIA_URL } from "../alumia";

const urlDoBanco = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const chavePublicaDoBanco = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SEGREDO = process.env.ALUMIA_FEDIVERSO_SEGREDO ?? "";

/**
 * A federação está ligada? Precisa das quatro coisas: a Alumia v2 (recurso rede-v2), o endereço próprio em https
 * (NEXT_PUBLIC_ALUMIA_URL), o segredo da federação (ALUMIA_FEDIVERSO_SEGREDO, 32 caracteres ou mais) e o banco.
 * Desligada, toda rota da federação responde 404, como se não existisse.
 */
export function federacaoLigada(): boolean {
  return ligado("rede-v2") && /^https:\/\//.test(ALUMIA_URL) && SEGREDO.length >= 32 && Boolean(urlDoBanco && chavePublicaDoBanco);
}

export const fed: EnderecosDaFederacao = enderecosDaFederacao();

export class ErroDoBanco extends Error {}

/** Chama public.rede_fed_servidor com o segredo. */
export async function banco<T>(acao: string, p: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(`${urlDoBanco}/rest/v1/rpc/rede_fed_servidor`, {
    method: "POST",
    headers: { apikey: chavePublicaDoBanco, Authorization: `Bearer ${chavePublicaDoBanco}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_segredo: SEGREDO, p_acao: acao, p }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const corpo = (await r.json().catch(() => null)) as unknown;
  if (!r.ok) throw new ErroDoBanco(typeof corpo === "object" && corpo && "message" in corpo ? String((corpo as { message: unknown }).message) : `http_${r.status}`);
  return corpo as T;
}

// ── Chaves ──

export interface AtorDoBanco {
  estado: "ligado" | "saindo" | "desligado" | "inexistente";
  perfil?: string;
  handle?: string;
  nome?: string;
  bio?: string;
  ligado_em?: string | null;
  chave_publica?: string | null;
  chave_privada?: string | null;
}

/** O ator de um @nome, com o par de chaves garantido (gerado aqui na primeira vez). A chave privada volta aberta, só em memória. */
export async function atorComChaves(handle: string): Promise<(AtorDoBanco & { privada: string | null }) | null> {
  const a = await banco<AtorDoBanco>("ator", { handle });
  if (a.estado !== "ligado" && a.estado !== "saindo") return { ...a, privada: null };
  if (a.chave_publica && a.chave_privada) return { ...a, privada: decifrar(a.chave_privada, SEGREDO) };
  if (a.estado !== "ligado" || !a.perfil) return { ...a, privada: null };
  const par = gerarParDeChaves();
  const guardado = await banco<{ chave_publica: string; chave_privada: string }>("chaves", { perfil: a.perfil, publica: par.publica, privada: cifrar(par.privada, SEGREDO) });
  return { ...a, chave_publica: guardado.chave_publica, chave_privada: guardado.chave_privada, privada: decifrar(guardado.chave_privada, SEGREDO) };
}

/** Decifra a chave privada que veio do banco (na fila de entrega). */
export const abrirChave = (cifrada: string | null | undefined) => decifrar(cifrada, SEGREDO);

let instancia: { publica: string; privada: string } | null = null;

/** O par do ator da instância (assina as buscas de perfis remotos). */
export async function chaveDaInstancia(): Promise<{ publica: string; privada: string }> {
  if (instancia) return instancia;
  let r = await banco<{ publica?: string; privada?: string }>("instancia");
  if (!r.publica || !r.privada) {
    const par = gerarParDeChaves();
    r = await banco<{ publica?: string; privada?: string }>("instancia", { publica: par.publica, privada: cifrar(par.privada, SEGREDO) });
  }
  const privada = decifrar(r.privada, SEGREDO);
  if (!r.publica || !privada) throw new ErroDoBanco("chave_da_instancia");
  instancia = { publica: r.publica, privada };
  return instancia;
}

// ── Atores remotos ──

export interface AtorRemoto {
  ator: string;
  chave_id: string | null;
  chave_publica: string | null;
  inbox: string | null;
  inbox_compartilhada: string | null;
  handle: string | null;
  nome: string | null;
  resumo: string | null;
  url: string | null;
  buscado_em?: string;
}

const ACEITA_AP = 'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"';

/** Busca um documento ActivityPub de fora, assinado pelo ator da instância (há instâncias que exigem assinatura até para ler). */
export async function buscarDocumento(url: string): Promise<Record<string, unknown> | null> {
  let assinatura: Record<string, string> = {};
  try {
    const chave = await chaveDaInstancia();
    assinatura = assinarPedido({ metodo: "GET", url, chaveId: fed.chaveDaInstancia, chavePrivada: chave.privada });
  } catch {
    // sem a chave da instância: tenta sem assinar
  }
  const r = await pedirAoFediverso(url, { cabecalhos: { Accept: ACEITA_AP, ...assinatura }, maxBytes: 512 * 1024 });
  if (!r || r.status < 200 || r.status >= 300) return null;
  if (!/json/.test(r.tipo)) return null;
  return lerJson(r.texto);
}

const texto = (v: unknown) => (typeof v === "string" ? v : null);
const urlHttps = (v: unknown) => (typeof v === "string" && /^https:\/\/[^\s]{1,490}$/.test(v) ? v : null);
const mesmoDominio = (a: string, b: string) => {
  try {
    return new URL(a).host === new URL(b).host;
  } catch {
    return false;
  }
};

/** Lê um documento de ator remoto no formato que a Alumia guarda; nulo se não é um ator válido. */
export function lerAtorRemoto(doc: Record<string, unknown>, esperado?: string): AtorRemoto | null {
  const id = urlHttps(doc.id);
  if (!id || (esperado && id !== esperado)) return null;
  if (!["Person", "Service", "Application", "Group", "Organization"].includes(String(doc.type))) return null;
  const chave = (doc.publicKey ?? null) as Record<string, unknown> | null;
  const chaveId = chave ? urlHttps(chave.id) : null;
  const pem = chave ? texto(chave.publicKeyPem) : null;
  const dono = chave ? urlHttps(chave.owner) : null;
  const endpoints = (doc.endpoints ?? {}) as Record<string, unknown>;
  const inbox = urlHttps(doc.inbox);
  const compartilhada = urlHttps(endpoints.sharedInbox);
  const pagina = urlHttps(doc.url);
  return {
    ator: id,
    // A chave só vale se é do próprio ator e mora no mesmo domínio.
    chave_id: chaveId && (!dono || dono === id) && mesmoDominio(chaveId, id) ? chaveId : null,
    chave_publica: pem && /^-----BEGIN (RSA )?PUBLIC KEY-----/.test(pem) && pem.length < 4000 ? pem : null,
    inbox: inbox && mesmoDominio(inbox, id) ? inbox : null,
    inbox_compartilhada: compartilhada && mesmoDominio(compartilhada, id) ? compartilhada : null,
    handle: textoCurto(doc.preferredUsername, 100) ? `${textoCurto(doc.preferredUsername, 100)}@${new URL(id).host}` : null,
    nome: textoCurto(doc.name, 100) || null,
    resumo: typeof doc.summary === "string" ? textoCurto(doc.summary, 500) : null,
    url: pagina,
  };
}

/** O ator remoto: do cache do banco (até 1 dia) ou buscado agora. `renovar` força a busca (chave trocada). */
export async function atorRemoto(id: string, { renovar = false } = {}): Promise<AtorRemoto | null> {
  if (!urlHttps(id)) return null;
  if (!renovar) {
    const guardado = await banco<AtorRemoto | null>("remoto", { ator: id }).catch(() => null);
    if (guardado && guardado.buscado_em && Date.now() - Date.parse(guardado.buscado_em) < 86_400_000) return guardado;
  }
  const doc = await buscarDocumento(id);
  const ator = doc ? lerAtorRemoto(doc, id) : null;
  if (!ator) return null;
  await banco("remoto_salvar", { ator: ator.ator, chave_id: ator.chave_id, chave_publica: ator.chave_publica, inbox: ator.inbox, compartilhada: ator.inbox_compartilhada, handle: ator.handle, nome: ator.nome, resumo: ator.resumo, url: ator.url }).catch(() => undefined);
  return ator;
}

/** Acha o ator de "@nome@instancia" pelo WebFinger da instância. */
export async function atorPorConta(usuario: string, dominio: string): Promise<AtorRemoto | null> {
  const r = await pedirAoFediverso(`https://${dominio}/.well-known/webfinger?resource=${encodeURIComponent(`acct:${usuario}@${dominio}`)}`, {
    cabecalhos: { Accept: "application/jrd+json, application/json" },
    maxBytes: 64 * 1024,
  });
  if (!r || r.status !== 200) return null;
  const doc = lerJson(r.texto);
  const links = Array.isArray(doc?.links) ? (doc.links as Record<string, unknown>[]) : [];
  const self = links.find((l) => l.rel === "self" && /activity\+json|ld\+json/.test(String(l.type ?? "")));
  const href = self ? urlHttps(self.href) : null;
  return href ? atorRemoto(href) : null;
}

// ── Limite de pedidos (por instância do servidor; o banco limita por pessoa) ──

const janelas = new Map<string, number[]>();

/** Deixa passar até `max` pedidos por `janelaMs` para a mesma chave (endereço de rede, domínio remoto). */
export function permitir(chave: string, max: number, janelaMs = 60_000): boolean {
  const agora = Date.now();
  const recentes = (janelas.get(chave) ?? []).filter((t) => agora - t < janelaMs);
  if (recentes.length >= max) {
    janelas.set(chave, recentes);
    return false;
  }
  recentes.push(agora);
  janelas.set(chave, recentes);
  if (janelas.size > 5000) for (const [k, v] of janelas) if (!v.some((t) => agora - t < janelaMs)) janelas.delete(k);
  return true;
}

/** O endereço de rede de quem pede (só para o limite em memória; nunca é guardado). */
export function origemDe(pedido: Request): string {
  return (pedido.headers.get("cf-connecting-ip") ?? pedido.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "?";
}

export const respostaAP = (corpo: unknown, status = 200, segundos = 60) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/activity+json; charset=utf-8", "Cache-Control": `public, max-age=${segundos}`, Vary: "Accept", "X-Robots-Tag": "noindex", "Access-Control-Allow-Origin": "*" },
  });

export const semFederacao = () => new Response("Not Found", { status: 404, headers: { "Cache-Control": "public, max-age=300", "X-Robots-Tag": "noindex" } });
export const muitosPedidos = () => new Response("Too Many Requests", { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
