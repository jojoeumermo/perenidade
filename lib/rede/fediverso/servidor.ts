// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do servidor da federação: se ela está ligada, como chamar o banco (public.rede_fed_servidor, com o segredo), as chaves
// (geradas aqui, guardadas cifradas no banco), o ator remoto (buscado com a trava de SSRF e guardado em cache) e o limite de pedidos.
// Só roda no servidor (rotas app/api/fediverso/** e app/.well-known/**). Sem "@/".
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { ligado, lerRecursos, RECURSOS, type Recurso } from "../../recursos";
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

// ── As chaves do modo "mesclado" (PLANO-FEDIVERSO, seção 4, F5) ──
// "fediverso-total": a Alumia como servidor do Fediverso (entrada de respostas, menções, curtidas, impulsos, denúncias e bloqueios de
// qualquer instância não bloqueada; curtir, impulsionar e responder post de fora). "fediverso-grupos": as comunidades como Group.
// As duas nascem DESLIGADAS: desligadas, a caixa de entrada e a fila fazem exatamente o que faziam antes.
// Até a junção com F5 (que as põe em lib/recursos.ts), só ligam com o nome escrito na lista: "todos" NÃO as liga. Quando entrarem
// em RECURSOS, vale ligado() (e elas precisam estar em SO_PELO_NOME, para "todos" continuar sem ligá-las).
export type ChaveDaFederacao = "fediverso-total" | "fediverso-grupos";
// A lista da montagem, lida uma vez como lib/recursos.ts faz: serve para saber se foi o painel que decidiu.
const LISTA_DA_MONTAGEM = lerRecursos(process.env.NEXT_PUBLIC_RECURSOS);
export function recursoDaFederacao(nome: ChaveDaFederacao): boolean {
  const agora = lerRecursos(process.env.NEXT_PUBLIC_RECURSOS);
  if (!(nome in RECURSOS)) return agora.has(nome) && !agora.has(`-${nome}`);
  const r = nome as Recurso;
  // Se o painel ligou ou desligou (o resultado geral difere do que a montagem sozinha daria), vale o painel. Senão vale a lista
  // lida agora: em produção é a mesma da montagem; nos testes, que trocam a variável no meio, desligar a chave desliga de verdade.
  const geral = ligado(r);
  if (geral !== ligado(r, LISTA_DA_MONTAGEM)) return geral;
  return ligado(r, agora);
}
export const modoTotal = () => recursoDaFederacao("fediverso-total");
export const gruposLigados = () => modoTotal() && recursoDaFederacao("fediverso-grupos");

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

/**
 * A chave privada de uma comunidade (Group, com "fediverso-grupos"), gerada aqui na primeira vez, como a das pessoas: RSA não se
 * gera no SQL. Mesmo par que app/api/fediverso/c/[slug] publica (ações do banco "comunidade" e "comunidade_chaves", da F3).
 * Nulo se a comunidade não pode sair (fechada, restrita, núcleo, desligada) ou se falta o segredo.
 */
export async function comunidadeComChaves(slug: string): Promise<string | null> {
  const c = await banco<{ estado?: string; chave_publica?: string | null; chave_privada?: string | null } | null>("comunidade", { slug });
  if (!c || c.estado !== "ligado") return null;
  if (c.chave_publica && c.chave_privada) return decifrar(c.chave_privada, SEGREDO);
  if (SEGREDO.length < 32) return null;
  const par = gerarParDeChaves();
  const g = await banco<{ chave_publica?: string | null; chave_privada?: string | null }>("comunidade_chaves", { slug, publica: par.publica, privada: cifrar(par.privada, SEGREDO) });
  return g?.chave_privada ? decifrar(g.chave_privada, SEGREDO) : null;
}

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
  /** A coleção de seguidores (só quando o documento acabou de ser lido; o cache do banco não a guarda). */
  seguidores?: string | null;
  /** O avatar (https), só quando o documento acabou de ser lido. */
  avatar?: string | null;
}

const ACEITA_AP = 'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"';

/**
 * Busca um documento ActivityPub de fora, assinado pelo ator da instância (há instâncias que exigem assinatura até para ler).
 * Devolve também o status (0 = não conectou), para quem precisa distinguir "sumiu lá" (404/410) de "fora do ar".
 */
export async function buscarDocumentoComStatus(url: string): Promise<{ status: number; doc: Record<string, unknown> | null; final: string | null }> {
  let assinatura: Record<string, string> = {};
  try {
    const chave = await chaveDaInstancia();
    assinatura = assinarPedido({ metodo: "GET", url, chaveId: fed.chaveDaInstancia, chavePrivada: chave.privada });
  } catch {
    // sem a chave da instância: tenta sem assinar
  }
  const r = await pedirAoFediverso(url, { cabecalhos: { Accept: ACEITA_AP, ...assinatura }, maxBytes: 512 * 1024 });
  if (!r) return { status: 0, doc: null, final: null };
  if (r.status < 200 || r.status >= 300 || !/json/.test(r.tipo)) return { status: r.status, doc: null, final: r.url.href };
  return { status: r.status, doc: lerJson(r.texto), final: r.url.href };
}

/** Busca um documento ActivityPub de fora (nulo se não veio). */
export async function buscarDocumento(url: string): Promise<Record<string, unknown> | null> {
  return (await buscarDocumentoComStatus(url)).doc;
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
    seguidores: urlHttps(doc.followers) && mesmoDominio(String(doc.followers), id) ? String(doc.followers) : null,
    avatar: urlHttps(typeof doc.icon === "object" && doc.icon ? (doc.icon as { url?: unknown }).url : doc.icon),
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

// ── Mídia de fora pela rota-proxy (app/api/fediverso/midia) ──
// O navegador de quem lê nunca toca a instância de fora (ela não vê o IP de ninguém): a imagem passa pela nossa rota, que só serve
// o endereço que o servidor assinou (HMAC com uma chave derivada do segredo da federação), para a rota não virar proxy aberto.
// Quem assina é só o servidor, e só endereço que veio de um documento de fora já lido (perfil, post, fio) ou que o banco guardou
// (a linha mista): ninguém pede "assine esta URL". A assinatura VENCE (de 7 a 14 dias, em janelas de 7 dias, para o cache do
// navegador e do Cloudflare continuar valendo dentro da janela): um endereço assinado não serve para sempre.

const SEMANA_S = 7 * 24 * 3600;
const chaveDaMidia = () => (SEGREDO ? createHash("sha256").update(`alumia-fediverso-midia-v2:${SEGREDO}`).digest() : null);
const assinarUrl = (url: string, vence: number, chave: Buffer) => createHmac("sha256", chave).update(`${vence} ${url}`).digest("base64url").slice(0, 32);

/** O endereço da rota-proxy para uma mídia de fora (https). Nulo se o endereço não serve ou se falta o segredo. */
export function urlDaMidia(url: unknown, agora = Date.now()): string | null {
  const u = urlHttps(url);
  const chave = chaveDaMidia();
  if (!u || !chave) return null;
  const vence = (Math.floor(agora / 1000 / SEMANA_S) + 2) * SEMANA_S;
  return `/api/fediverso/midia?u=${encodeURIComponent(u)}&e=${vence}&s=${assinarUrl(u, vence, chave)}`;
}

/** A assinatura de uma URL de mídia confere e ainda não venceu? (comparação em tempo constante) */
export function midiaAssinada(url: string, vence: string, s: string, agora = Date.now()): boolean {
  const chave = chaveDaMidia();
  if (!chave || !/^[A-Za-z0-9_-]{32}$/.test(s) || !/^\d{9,11}$/.test(vence)) return false;
  const e = Number(vence);
  if (e * 1000 <= agora || e * 1000 > agora + 3 * SEMANA_S * 1000) return false;
  const a = Buffer.from(assinarUrl(url, e, chave));
  const b = Buffer.from(s);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Troca, num cartão que veio do banco (linha mista, fio), os endereços de fora pela rota-proxy assinada: "avatar" e "midia[].url".
 * Endereço que não serve some (o navegador nunca recebe a URL de fora para buscar sozinho).
 */
export function assinarCartao<T>(cartao: T): T {
  if (!cartao || typeof cartao !== "object" || Array.isArray(cartao)) return cartao;
  const c = { ...(cartao as Record<string, unknown>) };
  if ("avatar" in c) c.avatar = typeof c.avatar === "string" && /^https:/.test(c.avatar) ? urlDaMidia(c.avatar) : typeof c.avatar === "string" && c.avatar.startsWith("/") ? c.avatar : null;
  if (Array.isArray(c.midia)) {
    c.midia = c.midia
      .filter((m): m is Record<string, unknown> => Boolean(m) && typeof m === "object")
      .map((m) => ({ ...m, url: urlDaMidia(m.url) }))
      .filter((m) => m.url);
  }
  return c as T;
}

export const respostaAP = (corpo: unknown, status = 200, segundos = 60) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/activity+json; charset=utf-8", "Cache-Control": `public, max-age=${segundos}`, Vary: "Accept", "X-Robots-Tag": "noindex", "Access-Control-Allow-Origin": "*" },
  });

export const semFederacao = () => new Response("Not Found", { status: 404, headers: { "Cache-Control": "public, max-age=300", "X-Robots-Tag": "noindex" } });
export const muitosPedidos = () => new Response("Too Many Requests", { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
