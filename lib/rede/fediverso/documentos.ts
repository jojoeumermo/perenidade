// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os documentos JSON-LD que a Alumia publica no Fediverso (ActivityStreams 2.0, como o Mastodon lê): o ator de cada pessoa que ligou
// a federação, o post (Note), as atividades (Create, Update, Delete, Accept, Reject, Follow, Undo, Like, Announce, Flag, Block), as
// coleções, a comunidade como Group (Lemmy) e os documentos de descoberta (WebFinger, NodeInfo). Só o codinome e o @nome saem; nunca o
// nome civil, e-mail, núcleo ou comunidade fechada.
//
// O que é novo no "Fediverso total" (menções, mídia, fio, visibilidade, foto, coleções a mais, Group) só sai com as flags
// `fediverso-total` e `fediverso-grupos` (OpcoesDaSaida, lidas na hora por padrão). Com elas desligadas, cada documento sai
// exatamente como antes. Lógica pura, sem "@/".
import { createHash } from "node:crypto";
import { NOME_REDE } from "../alumia";
import { opcoesDaSaida, type EnderecosDaFederacao, type OpcoesDaSaida } from "./enderecos";
import { destinosDeMencao, linksDeMencao, tagsDeMencao, type MencaoFederada } from "./mencoes";
import { escaparHtml, hashtagsDe, textoParaHtml } from "./texto";

export const PUBLICO = "https://www.w3.org/ns/activitystreams#Public";
export const CONTEXTO = [
  "https://www.w3.org/ns/activitystreams",
  "https://w3id.org/security/v1",
  {
    manuallyApprovesFollowers: "as:manuallyApprovesFollowers",
    sensitive: "as:sensitive",
    Hashtag: "as:Hashtag",
    toot: "http://joinmastodon.org/ns#",
    discoverable: "toot:discoverable",
    indexable: "toot:indexable",
  },
];
/** O contexto do modo total: o de sempre mais os termos do Mastodon (featured, blurhash) e do Lemmy (moderators). */
export const CONTEXTO_TOTAL = [
  "https://www.w3.org/ns/activitystreams",
  "https://w3id.org/security/v1",
  {
    manuallyApprovesFollowers: "as:manuallyApprovesFollowers",
    sensitive: "as:sensitive",
    Hashtag: "as:Hashtag",
    toot: "http://joinmastodon.org/ns#",
    discoverable: "toot:discoverable",
    indexable: "toot:indexable",
    featured: { "@id": "toot:featured", "@type": "@id" },
    blurhash: "toot:blurhash",
    lemmy: "https://join-lemmy.org/ns#",
    moderators: { "@id": "lemmy:moderators", "@type": "@id" },
    postingRestrictedToMods: "lemmy:postingRestrictedToMods",
  },
];
export const TIPO_ACTIVITY = "application/activity+json; charset=utf-8";

const contextoDe = (o: OpcoesDaSaida) => (o.total ? CONTEXTO_TOTAL : CONTEXTO);
const https = (v: unknown): v is string => typeof v === "string" && /^https:\/\/[^\s]{1,1990}$/.test(v);

/** Uma imagem pública já com endereço estável (a foto do perfil, a capa, o ícone da comunidade). */
export interface ImagemPublica {
  url: string;
  tipo?: string | null;
}

export interface AtorLocal {
  handle: string;
  nome: string;
  bio: string;
  ligado_em: string | null;
  chave_publica: string;
  // ── modo total (contrato 3.1, ação "ator") ──
  /** A foto do perfil num endereço público (hoje só o rosto da galeria, em PNG: ver `imagemDoBanco`). */
  avatar?: ImagemPublica | null;
  capa?: ImagemPublica | null;
  /** A pessoa escolheu aparecer no diretório e na busca de texto das outras instâncias. Sem escolha: fora (false). */
  discoverable?: boolean;
  /** Perfil que aprova cada seguidor (manuallyApprovesFollowers). */
  trancado?: boolean;
}

/**
 * Uma imagem de um post, como o banco devolve no post (contrato 3.1, ação "post": midia; interno.rede_fed_post_json da F3):
 * `{id, tipo, alt, largura, altura, blurhash, ordem}`. O caminho no depósito NÃO vem no post (ele tem o id interno do perfil): só a
 * rota de mídia o pede, pela ação "midia" {id} → {caminho, tipo, alt, largura, altura}.
 */
export interface MidiaFederada {
  /** O id da imagem em interno.rede_midia (uuid). */
  id?: string | null;
  ordem: number;
  tipo: string;
  alt: string;
  largura?: number | null;
  altura?: number | null;
  blurhash?: string | null;
}

export type VisibilidadeQueSai = "publico" | "nao_listado";

export interface PostFederado {
  id: string;
  tipo: string;
  titulo: string | null;
  texto: string;
  corpo: string | null;
  aviso: string;
  criado_em: string;
  editado_em: string | null;
  resposta_a: string | null;
  handle: string;
  // ── modo total (contrato 3.1, ação "post") ──
  midia?: MidiaFederada[] | null;
  mencoes?: MencaoFederada[] | null;
  /** "publico" ou "nao_listado". Qualquer outro valor NÃO sai (só-seguidores e direto nunca saem: decisão D5). */
  visibilidade?: string | null;
  /** O id (https) de um post de FORA que este responde. */
  resposta_a_remota?: string | null;
  /** O id do post que abriu o fio (para "context"). */
  raiz?: string | null;
  /** O slug da comunidade onde o post está (para "audience", só com fediverso-grupos). É o nome que a F3 devolve. */
  comunidade?: string | null;
  /** Nome antigo do mesmo campo (aceito só por compatibilidade; o banco devolve `comunidade`). */
  comunidade_slug?: string | null;
}

/**
 * As coleções "featured" (u/[handle]/destaques) e "replies" (p/[id]/respostas) dependem das ações "destaques" {handle} →
 * {itens: post[]} e "respostas" {id, limite} → {itens: id[]}, que ainda NÃO existem no banco (pendência do contrato 3.1 com a F3).
 * Enquanto não existem, o ator e a Note não anunciam as coleções (uma coleção sempre vazia só engana a outra instância). Quando a
 * F3 entregar, é só virar para true.
 */
export const COLECOES_DO_BANCO: { readonly destaques: boolean; readonly respostas: boolean } = { destaques: false, respostas: false };

const TIPOS_DE_IMAGEM = /^image\/(jpeg|png|webp|gif|avif)$/;

/** A visibilidade de um post que pode sair; nulo = não sai. Sem o campo, vale "publico" (o banco só devolve o federável). */
export function visibilidadeQueSai(p: Pick<PostFederado, "visibilidade">): VisibilidadeQueSai | null {
  const v = p.visibilidade ?? "publico";
  return v === "publico" || v === "nao_listado" ? v : null;
}

/** Os rostos e as capas da galeria (arquivos públicos do site), como a ação "ator" devolve: "/rede/avatares/a03.svg". */
const IMAGEM_DA_GALERIA = /^\/rede\/(avatares\/a(?:0[1-9]|1[0-9]|2[0-4])|capas\/c0[1-8])\.svg$/;

/**
 * A foto ou a capa do perfil como o banco devolve (contrato 3.1, ação "ator": avatar_url, capa_url) virada em endereço público.
 *
 * O banco só devolve o rosto ou a capa da GALERIA (caminho relativo de um SVG público). A imagem enviada pela pessoa não sai para
 * fora sem um consentimento próprio (LGPD, art. 6º, III, necessidade; art. 8º, § 4º, finalidade determinada): é a decisão da F3,
 * e por isso esta frente não tem rota que sirva a foto enviada. O Mastodon não aceita SVG como foto de perfil, então sai a versão
 * PNG do mesmo desenho (public/rede/avatares/aNN.png e public/rede/capas/cNN.png), no host da Alumia. O nome do arquivo muda
 * quando a pessoa troca de rosto, e com ele a URL: a outra instância busca a foto nova sozinha. Um https que não é SVG sai como está.
 */
export function imagemDoBanco(e: EnderecosDaFederacao, valor: unknown): ImagemPublica | null {
  if (typeof valor === "string" && IMAGEM_DA_GALERIA.test(valor)) return { url: `${e.base}${valor.replace(/\.svg$/, ".png")}`, tipo: "image/png" };
  if (https(valor) && !/\.svg(\?|$)/i.test(valor)) return { url: valor };
  return null;
}

function imagemAP(i: ImagemPublica | null | undefined) {
  if (!i || !https(i.url)) return undefined;
  return { type: "Image", ...(i.tipo && TIPOS_DE_IMAGEM.test(i.tipo) ? { mediaType: i.tipo } : {}), url: i.url };
}

/** O ator de uma pessoa (Person). Sem lista pública de seguidores e fora de diretórios e da busca de texto das outras instâncias. */
export function documentoDoAtor(e: EnderecosDaFederacao, a: AtorLocal, opcoes: OpcoesDaSaida = opcoesDaSaida()) {
  const base = {
    "@context": contextoDe(opcoes),
    id: e.ator(a.handle),
    type: "Person",
    preferredUsername: a.handle,
    name: a.nome,
    summary: a.bio ? `<p>${escaparHtml(a.bio)}</p>` : "",
    url: e.paginaDoPerfil(a.handle),
    inbox: e.inbox(a.handle),
    outbox: e.outbox(a.handle),
    followers: e.seguidores(a.handle),
    endpoints: { sharedInbox: e.inboxCompartilhada },
    manuallyApprovesFollowers: false,
    // Fora do diretório de perfis e da busca de texto do Mastodon: quem quiser achar a pessoa precisa do @nome dela.
    discoverable: false,
    indexable: false,
    ...(a.ligado_em ? { published: new Date(a.ligado_em).toISOString() } : {}),
    publicKey: { id: e.chave(a.handle), owner: e.ator(a.handle), publicKeyPem: a.chave_publica },
  };
  if (!opcoes.total) return base;
  const icon = imagemAP(a.avatar);
  const image = imagemAP(a.capa);
  return {
    ...base,
    following: e.seguindo(a.handle),
    ...(COLECOES_DO_BANCO.destaques ? { featured: e.destaques(a.handle) } : {}),
    manuallyApprovesFollowers: Boolean(a.trancado),
    // A escolha é da pessoa (LGPD, art. 8º: consentimento por finalidade); sem escolha, fica fora do diretório e da busca.
    discoverable: a.discoverable === true,
    indexable: a.discoverable === true,
    ...(icon ? { icon } : {}),
    ...(image ? { image } : {}),
  };
}

/** O ator de quem desligou a federação enquanto as retiradas (Delete, Reject) ainda estão saindo: só a chave, nada mais. */
export function documentoDoAtorSaindo(e: EnderecosDaFederacao, handle: string, chavePublica: string) {
  return {
    "@context": CONTEXTO,
    id: e.ator(handle),
    type: "Person",
    preferredUsername: handle,
    name: "",
    summary: "",
    inbox: e.inbox(handle),
    outbox: e.outbox(handle),
    discoverable: false,
    indexable: false,
    publicKey: { id: e.chave(handle), owner: e.ator(handle), publicKeyPem: chavePublica },
  };
}

/** O ator da instância (Application): assina as buscas de perfis remotos nas instâncias que pedem assinatura até para ler. */
export function documentoDaInstancia(e: EnderecosDaFederacao, chavePublica: string) {
  return {
    "@context": CONTEXTO,
    id: e.instancia,
    type: "Application",
    preferredUsername: e.dominio,
    name: NOME_REDE,
    summary: `<p>${NOME_REDE}, a rede social do Instituto Lúcia.</p>`,
    url: e.base,
    inbox: e.inboxCompartilhada,
    outbox: `${e.instancia}/outbox`,
    manuallyApprovesFollowers: true,
    discoverable: false,
    indexable: false,
    publicKey: { id: e.chaveDaInstancia, owner: e.instancia, publicKeyPem: chavePublica },
  };
}

const MAX_CORPO = 5000;

/** Os anexos de imagem da Note ([M-AP]: url, mediaType, name = texto alternativo, blurhash, width, height). Até 4, só imagem. */
function anexosDe(e: EnderecosDaFederacao, p: PostFederado) {
  return (p.midia ?? [])
    .filter((m) => Number.isInteger(m.ordem) && m.ordem >= 0 && m.ordem <= 3 && TIPOS_DE_IMAGEM.test(m.tipo))
    .sort((a, b) => a.ordem - b.ordem)
    .slice(0, 4)
    .map((m) => ({
      type: "Image",
      mediaType: m.tipo,
      url: e.midiaDoPost(p.id, m.ordem),
      // O texto alternativo: "name" é o que o Mastodon lê como descrição. Vazio = sem descrição (nunca o nome do arquivo).
      name: m.alt ? m.alt.slice(0, 1500) : null,
      ...(m.blurhash && /^[0-9A-Za-z#$%*+,\-.:;=?@[\]^_{|}~]{6,100}$/.test(m.blurhash) ? { blurhash: m.blurhash } : {}),
      ...(m.largura && m.altura ? { width: m.largura, height: m.altura } : {}),
    }));
}

/**
 * O post como Note. O texto longo vai até 5.000 caracteres, com o link para ler o resto na Alumia. No modo total, a Note leva também
 * as menções (tag Mention e o mencionado em "cc"), as imagens com texto alternativo, a resposta a post de fora, o fio ("context"),
 * a coleção de respostas e a visibilidade (público ou não listado); com fediverso-grupos, a comunidade em "audience" (Lemmy).
 * Só-seguidores e direto nunca saem: um post assim lança erro em vez de virar documento (falha fechada).
 */
export function documentoDoPost(e: EnderecosDaFederacao, p: PostFederado, comContexto = true, opcoes: OpcoesDaSaida = opcoesDaSaida()) {
  const visibilidade = visibilidadeQueSai(p);
  if (!visibilidade) throw new Error("visibilidade_que_nao_sai");
  const link = e.paginaDoPost(p.id);
  const mencoes = opcoes.total ? (p.mencoes ?? []) : [];
  const links = mencoes.length ? linksDeMencao(mencoes, [e.dominio, e.dominioCurto].filter(Boolean)) : undefined;
  const partes: string[] = [];
  if (p.titulo) partes.push(`<p><strong>${escaparHtml(p.titulo)}</strong></p>`);
  if (p.texto) partes.push(textoParaHtml(p.texto, e.paginaDaTag, links));
  if (p.corpo) {
    const corpo = Array.from(p.corpo);
    partes.push(textoParaHtml(corpo.slice(0, MAX_CORPO).join("") + (corpo.length > MAX_CORPO ? "…" : ""), e.paginaDaTag, links));
    if (corpo.length > MAX_CORPO) partes.push(`<p><a href="${escaparHtml(link)}">${escaparHtml(link)}</a></p>`);
  }
  const tags = hashtagsDe(`${p.titulo ?? ""}\n${p.texto}\n${p.corpo ?? ""}`);
  const hashtags = tags.map((t) => ({ type: "Hashtag", href: e.paginaDaTag(t), name: `#${t}` }));
  const base = {
    ...(comContexto ? { "@context": contextoDe(opcoes) } : {}),
    id: e.post(p.id),
    type: "Note",
    attributedTo: e.ator(p.handle),
    content: partes.join(""),
    ...(p.aviso ? { summary: escaparHtml(p.aviso), sensitive: true } : { sensitive: false }),
    published: new Date(p.criado_em).toISOString(),
    ...(p.editado_em ? { updated: new Date(p.editado_em).toISOString() } : {}),
    url: link,
    to: [PUBLICO],
    cc: [e.seguidores(p.handle)],
    inReplyTo: p.resposta_a ? e.post(p.resposta_a) : null,
    tag: hashtags as { type: string; href: string; name: string }[],
  };
  if (!opcoes.total) return base;

  const destinos = destinosDeMencao(mencoes);
  const slug = p.comunidade ?? p.comunidade_slug ?? null;
  const grupo = opcoes.grupos && slug && /^[a-z0-9-]{2,60}$/.test(slug) ? e.comunidade(slug) : null;
  // [M-AP]: público = Public em "to"; não listado = Public em "cc". O mencionado vai em "cc" (senão não há aviso).
  const to = visibilidade === "publico" ? [PUBLICO] : [e.seguidores(p.handle)];
  const cc = [...new Set([visibilidade === "publico" ? e.seguidores(p.handle) : PUBLICO, ...destinos, ...(grupo ? [grupo] : [])])];
  const respostaRemota = !p.resposta_a && https(p.resposta_a_remota) ? p.resposta_a_remota : null;
  const contexto = p.raiz ? e.post(p.raiz) : !p.resposta_a && !respostaRemota ? e.post(p.id) : null;
  const anexos = anexosDe(e, p);
  return {
    ...base,
    to,
    cc,
    inReplyTo: p.resposta_a ? e.post(p.resposta_a) : respostaRemota,
    ...(contexto ? { context: contexto } : {}),
    ...(COLECOES_DO_BANCO.respostas ? { replies: e.respostas(p.id) } : {}),
    ...(anexos.length ? { attachment: anexos } : {}),
    ...(grupo ? { audience: grupo, ...(p.titulo ? { name: p.titulo.slice(0, 200) } : {}) } : {}),
    tag: [...hashtags, ...tagsDeMencao(mencoes)],
  };
}

export function atividadeCreate(e: EnderecosDaFederacao, p: PostFederado, opcoes: OpcoesDaSaida = opcoesDaSaida()) {
  const nota = documentoDoPost(e, p, false, opcoes);
  return { "@context": contextoDe(opcoes), id: `${e.post(p.id)}#create`, type: "Create", actor: e.ator(p.handle), published: nota.published, to: nota.to, cc: nota.cc, object: nota };
}

export function atividadeUpdate(e: EnderecosDaFederacao, p: PostFederado, quando = new Date(), opcoes: OpcoesDaSaida = opcoesDaSaida()) {
  const nota = documentoDoPost(e, p, false, opcoes);
  return { "@context": contextoDe(opcoes), id: `${e.post(p.id)}#update-${quando.getTime()}`, type: "Update", actor: e.ator(p.handle), published: quando.toISOString(), to: nota.to, cc: nota.cc, object: nota };
}

export function atividadeDelete(e: EnderecosDaFederacao, handle: string, postId: string) {
  return { "@context": CONTEXTO, id: `${e.post(postId)}#delete`, type: "Delete", actor: e.ator(handle), to: [PUBLICO], object: { id: e.post(postId), type: "Tombstone" } };
}

/** Resposta a um pedido de seguir (Accept ou Reject), com o pedido original dentro. */
export function atividadeResposta(e: EnderecosDaFederacao, tipo: "Accept" | "Reject", handle: string, atorRemoto: string, pedido: string, id: string) {
  return {
    "@context": CONTEXTO,
    id: e.atividade(tipo.toLowerCase(), id),
    type: tipo,
    actor: e.ator(handle),
    object: { id: pedido || undefined, type: "Follow", actor: atorRemoto, object: e.ator(handle) },
  };
}

export function atividadeFollow(e: EnderecosDaFederacao, handle: string, alvo: string, pedido: string) {
  return { "@context": CONTEXTO, id: pedido, type: "Follow", actor: e.ator(handle), object: alvo };
}

export function atividadeUndoFollow(e: EnderecosDaFederacao, handle: string, alvo: string, pedido: string, id: string) {
  return { "@context": CONTEXTO, id: e.atividade("undo", id), type: "Undo", actor: e.ator(handle), object: { id: pedido, type: "Follow", actor: e.ator(handle), object: alvo } };
}

// ── Interações (contrato 3.3: usados pela fila, frente F2) ──

/**
 * O id de uma atividade que sai daqui. Contrato 3.3: `id` é a URL COMPLETA da atividade, no host da Alumia (é o que a F2 passa:
 * `fed.atividade(tipo, hash)` ou o `extra.atividade` guardado na fila). Um sufixo simples (letras, números, "-" e "_") também é
 * aceito e vira `e.atividade(tipo, sufixo)`. Qualquer outra coisa (http, outro host, espaço) lança erro: uma atividade com id de
 * outro servidor seria recusada lá fora e poderia se passar por outra.
 */
export function idDeAtividade(e: EnderecosDaFederacao, tipo: string, id: string): string {
  if (https(id) && id.startsWith(`${e.base}/`)) return id;
  if (/^[A-Za-z0-9_-]{1,100}$/.test(id)) return e.atividade(tipo, id);
  throw new Error("id_de_atividade_invalido");
}

/** Curtir (favoritar) um post, daqui ou de fora. `objeto` é o id do post; `id` é a URL da atividade (ver `idDeAtividade`). */
export function atividadeLike(e: EnderecosDaFederacao, handle: string, objeto: string, id: string) {
  return { "@context": CONTEXTO, id: idDeAtividade(e, "like", id), type: "Like", actor: e.ator(handle), object: objeto };
}

/**
 * Impulsionar (Announce) um post público: vai para Public e para os seguidores de quem impulsiona; `autorDoObjeto`, quando vem,
 * entra em "cc" (é assim que o autor fica sabendo).
 */
export function atividadeAnnounce(e: EnderecosDaFederacao, handle: string, objeto: string, id: string, autorDoObjeto?: string | null, quando = new Date()) {
  return {
    "@context": CONTEXTO,
    id: idDeAtividade(e, "announce", id),
    type: "Announce",
    actor: e.ator(handle),
    published: quando.toISOString(),
    to: [PUBLICO],
    cc: [e.seguidores(handle), ...(https(autorDoObjeto) ? [autorDoObjeto] : [])],
    object: objeto,
  };
}

/**
 * Desfaz uma atividade que saiu daqui (Like, Announce, Block, Follow): o Undo leva a atividade original dentro, sem o contexto.
 * O id do original é fixo (a F2 deriva de pessoa + objeto, para o Undo achar o que desfazer), então o id do Undo NÃO pode ser fixo:
 * curtir, descurtir e curtir de novo daria dois Undo com o mesmo id, e quem deduplica por id ignoraria o segundo. Sem `id`, vai um
 * fragmento com o instante; com `id` (a fila pode passar um uuid), vale `idDeAtividade`.
 */
export function atividadeUndo(
  e: EnderecosDaFederacao,
  handle: string,
  atividadeOriginal: { id: string; type: string; [campo: string]: unknown },
  id?: string,
  quando = new Date(),
) {
  const { ["@context"]: _contexto, ...original } = atividadeOriginal;
  void _contexto;
  return {
    "@context": CONTEXTO,
    id: id ? idDeAtividade(e, "undo", id) : `${atividadeOriginal.id}#undo-${quando.getTime().toString(36)}`,
    type: "Undo",
    actor: e.ator(handle),
    ...(Array.isArray(original.to) ? { to: original.to } : {}),
    ...(Array.isArray(original.cc) ? { cc: original.cc } : {}),
    object: original,
  };
}

/**
 * Denúncia para outra instância (Flag). Sai SEMPRE em nome do ator da instância ([M-AP]: "Sent from the instance actor"): quem
 * denunciou nunca aparece (LGPD, art. 6º, III: só o necessário). `alvos` = o ator denunciado e os posts; `conteudo` = o comentário,
 * texto puro, até 1.000 caracteres.
 */
export function atividadeFlag(e: EnderecosDaFederacao, alvos: readonly string[], conteudo: string, id: string) {
  return {
    "@context": CONTEXTO,
    id: idDeAtividade(e, "flag", id),
    type: "Flag",
    actor: e.instancia,
    object: [...new Set(alvos.filter((a) => https(a)))].slice(0, 20),
    content: Array.from(conteudo.trim()).slice(0, 1000).join(""),
  };
}

/** Bloquear um ator de fora. O Mastodon esconde quem bloqueou; nada mais sai além do par ator → alvo. */
export function atividadeBlock(e: EnderecosDaFederacao, handle: string, alvo: string, id: string) {
  return { "@context": CONTEXTO, id: idDeAtividade(e, "block", id), type: "Block", actor: e.ator(handle), object: alvo };
}

// ── Comunidade como Group (Lemmy, FEP-1b12; só com fediverso-grupos) ──

export interface ComunidadeFederada {
  slug: string;
  nome: string;
  descricao: string;
  criada_em?: string | null;
  chave_publica: string;
  icone?: ImagemPublica | null;
  capa?: ImagemPublica | null;
}

/**
 * A comunidade aberta e pública como Group, como o Lemmy lê ([LEMMY]): "attributedTo" e "moderators" apontam a coleção de
 * moderação; "postingRestrictedToMods" fica ligado enquanto a Alumia não recebe post de fora numa comunidade.
 */
export function documentoDaComunidade(e: EnderecosDaFederacao, c: ComunidadeFederada) {
  const icon = imagemAP(c.icone);
  const image = imagemAP(c.capa);
  return {
    "@context": CONTEXTO_TOTAL,
    id: e.comunidade(c.slug),
    type: "Group",
    preferredUsername: c.slug,
    name: c.nome,
    summary: c.descricao ? `<p>${escaparHtml(c.descricao)}</p>` : "",
    source: { content: c.descricao ?? "", mediaType: "text/markdown" },
    url: e.paginaDaComunidade(c.slug),
    inbox: e.inboxDaComunidade(c.slug),
    outbox: e.outboxDaComunidade(c.slug),
    followers: e.seguidoresDaComunidade(c.slug),
    moderators: e.moderadoresDaComunidade(c.slug),
    attributedTo: e.moderadoresDaComunidade(c.slug),
    endpoints: { sharedInbox: e.inboxCompartilhada },
    manuallyApprovesFollowers: false,
    postingRestrictedToMods: true,
    sensitive: false,
    discoverable: true,
    indexable: false,
    ...(c.criada_em ? { published: new Date(c.criada_em).toISOString() } : {}),
    ...(icon ? { icon } : {}),
    ...(image ? { image } : {}),
    publicKey: { id: e.chaveDaComunidade(c.slug), owner: e.comunidade(c.slug), publicKeyPem: c.chave_publica },
  };
}

/**
 * O Group repassa (Announce) uma atividade aos seguidores da comunidade ([LEMMY]). O id é derivado do id da atividade (o mesmo
 * repasse tem sempre o mesmo id) e mora no host da Alumia, mesmo quando a atividade veio de fora.
 */
export function atividadeAnnounceDoGrupo(e: EnderecosDaFederacao, slug: string, atividade: { id: string; [campo: string]: unknown }) {
  const { ["@context"]: _contexto, ...dentro } = atividade;
  void _contexto;
  const marca = createHash("sha256").update(atividade.id).digest("hex").slice(0, 32);
  return {
    "@context": CONTEXTO_TOTAL,
    id: e.atividade("anuncio-grupo", marca),
    type: "Announce",
    actor: e.comunidade(slug),
    to: [PUBLICO],
    cc: [e.seguidoresDaComunidade(slug)],
    audience: e.comunidade(slug),
    object: dentro,
  };
}

/** A coleção de moderação da comunidade. As rotas passam a lista vazia: quem modera não é exposto para fora (regra da casa). */
export function colecaoDeModeradores(e: EnderecosDaFederacao, slug: string, handles: readonly string[]) {
  const itens = [...new Set(handles.filter((h) => /^[a-z0-9_]{3,20}$/.test(h)))].map((h) => e.ator(h));
  return { "@context": CONTEXTO_TOTAL, id: e.moderadoresDaComunidade(slug), type: "OrderedCollection", totalItems: itens.length, orderedItems: itens };
}

export function colecaoDeSeguidoresDaComunidade(e: EnderecosDaFederacao, slug: string, total: number) {
  return { "@context": CONTEXTO_TOTAL, id: e.seguidoresDaComunidade(slug), type: "OrderedCollection", totalItems: total };
}

/** A caixa de saída do Group: cada post como Announce(Create(Note)), como o Lemmy lê na primeira busca de uma comunidade. */
export function caixaDeSaidaDaComunidade(e: EnderecosDaFederacao, slug: string, total: number, posts: PostFederado[], opcoes: OpcoesDaSaida = opcoesDaSaida()) {
  const comGrupo = { ...opcoes, grupos: true };
  const itens: Record<string, unknown>[] = [];
  for (const p of posts) {
    if (!visibilidadeQueSai(p)) continue;
    const { ["@context"]: _c, ...criar } = atividadeCreate(e, { ...p, comunidade: slug }, comGrupo);
    void _c;
    const { ["@context"]: _a, ...anuncio } = atividadeAnnounceDoGrupo(e, slug, criar);
    void _a;
    itens.push(anuncio);
  }
  return { "@context": CONTEXTO_TOTAL, id: e.outboxDaComunidade(slug), type: "OrderedCollection", totalItems: total, orderedItems: itens };
}

// ── Coleções ──

/** A caixa de saída: a coleção (com o total) ou uma página dela (Create de cada post, do mais novo ao mais antigo). */
export function colecaoDaCaixaDeSaida(e: EnderecosDaFederacao, handle: string, total: number) {
  return { "@context": CONTEXTO, id: e.outbox(handle), type: "OrderedCollection", totalItems: total, first: `${e.outbox(handle)}?pagina=1` };
}

export function paginaDaCaixaDeSaida(e: EnderecosDaFederacao, handle: string, posts: PostFederado[], aqui: string, proxima: string | null, opcoes: OpcoesDaSaida = opcoesDaSaida()) {
  return {
    "@context": contextoDe(opcoes),
    id: aqui,
    type: "OrderedCollectionPage",
    partOf: e.outbox(handle),
    orderedItems: posts
      .filter((p) => visibilidadeQueSai(p))
      .map((p) => {
        const { ["@context"]: _contexto, ...atividade } = atividadeCreate(e, p, opcoes);
        void _contexto;
        return atividade;
      }),
    ...(proxima ? { next: proxima } : {}),
  };
}

/** Os seguidores: só o total. A lista de quem segue não é pública (privacidade de quem segue). */
export function colecaoDeSeguidores(e: EnderecosDaFederacao, handle: string, total: number) {
  return { "@context": CONTEXTO, id: e.seguidores(handle), type: "OrderedCollection", totalItems: total };
}

/** Quem a pessoa segue: também só o total (a lista revelaria a rede de relações dela). */
export function colecaoSeguindo(e: EnderecosDaFederacao, handle: string, total: number) {
  return { "@context": CONTEXTO_TOTAL, id: e.seguindo(handle), type: "OrderedCollection", totalItems: total };
}

/** Os posts fixados no perfil (featured), como Note completa: o Mastodon mostra no topo do perfil. */
export function colecaoDeDestaques(e: EnderecosDaFederacao, handle: string, posts: PostFederado[], opcoes: OpcoesDaSaida = opcoesDaSaida()) {
  const notas = posts.filter((p) => visibilidadeQueSai(p)).slice(0, 5).map((p) => documentoDoPost(e, p, false, opcoes));
  return { "@context": CONTEXTO_TOTAL, id: e.destaques(handle), type: "OrderedCollection", totalItems: notas.length, orderedItems: notas };
}

/** As respostas DAQUI a um post (só as que também podem sair), com a primeira página embutida, como o Mastodon publica. */
export function colecaoDeRespostas(e: EnderecosDaFederacao, postId: string, ids: readonly string[], proxima: string | null = null) {
  const itens = ids.filter((id) => /^[0-9a-f-]{36}$/.test(id)).map((id) => e.post(id));
  return {
    "@context": CONTEXTO_TOTAL,
    id: e.respostas(postId),
    type: "Collection",
    first: { type: "CollectionPage", id: `${e.respostas(postId)}?pagina=1`, partOf: e.respostas(postId), items: itens, ...(proxima ? { next: proxima } : {}) },
  };
}

// ── Descoberta ──

const TIPO_NO_WEBFINGER = "https://www.w3.org/ns/activitystreams#type";

/** WebFinger de uma pessoa. No modo total, o "subject" é a conta no domínio curto (D1) e o link "self" diz que é Person. */
export function documentoWebfinger(e: EnderecosDaFederacao, handle: string, total = false) {
  return {
    subject: `acct:${handle}@${e.dominioDaConta(total)}`,
    aliases: [e.ator(handle), e.paginaDoPerfil(handle)],
    links: [
      { rel: "self", type: "application/activity+json", href: e.ator(handle), ...(total ? { properties: { [TIPO_NO_WEBFINGER]: "Person" } } : {}) },
      { rel: "http://webfinger.net/rel/profile-page", type: "text/html", href: e.paginaDoPerfil(handle) },
    ],
  };
}

/** WebFinger do ator da instância ("acct:<domínio>@<domínio>", a convenção do Mastodon). */
export function documentoWebfingerDaInstancia(e: EnderecosDaFederacao) {
  return {
    subject: `acct:${e.dominio}@${e.dominio}`,
    aliases: [e.instancia],
    links: [
      { rel: "self", type: "application/activity+json", href: e.instancia, properties: { [TIPO_NO_WEBFINGER]: "Application" } },
      { rel: "http://webfinger.net/rel/profile-page", type: "text/html", href: e.base },
    ],
  };
}

/** WebFinger de uma comunidade (Group). O Lemmy escolhe o link "self" pelo tipo quando o mesmo nome é de pessoa e de comunidade. */
export function documentoWebfingerDaComunidade(e: EnderecosDaFederacao, slug: string) {
  return {
    subject: `acct:${slug}@${e.dominioDaConta(true)}`,
    aliases: [e.comunidade(slug), e.paginaDaComunidade(slug)],
    links: [
      { rel: "self", type: "application/activity+json", href: e.comunidade(slug), properties: { [TIPO_NO_WEBFINGER]: "Group" } },
      { rel: "http://webfinger.net/rel/profile-page", type: "text/html", href: e.paginaDaComunidade(slug) },
    ],
  };
}

/** Junta o WebFinger de uma pessoa e de uma comunidade com o mesmo nome: vale o "subject" da pessoa, com os links das duas. */
export function juntarWebfinger(pessoa: ReturnType<typeof documentoWebfinger>, grupo: ReturnType<typeof documentoWebfingerDaComunidade>) {
  return { subject: pessoa.subject, aliases: [...pessoa.aliases, ...grupo.aliases], links: [...pessoa.links, ...grupo.links] };
}

export interface ContagemDoNodeinfo {
  usuarios: number;
  posts: number;
  /**
   * Quem federa e teve post saindo nos últimos 30 e 180 dias (só no modo total). Vêm da ação "contagem_ativos" da F3 ({mes,
   * semestre}), mapeados pela rota do NodeInfo.
   */
  ativos_mes?: number | null;
  ativos_semestre?: number | null;
}

const inteiro = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;

/**
 * NodeInfo 2.1 (ou 2.0, que alguns rastreadores ainda leem): o que a instância é, com números agregados (sem nome de ninguém). No
 * modo total, entram também os ativos do mês e do semestre (opcionais no esquema).
 */
export function documentoNodeinfo(contagem: ContagemDoNodeinfo, versao: string, opcoes: { total?: boolean; esquema?: "2.0" | "2.1" } = {}) {
  const esquema = opcoes.esquema ?? "2.1";
  const ativos = opcoes.total
    ? { ...(inteiro(contagem.ativos_semestre) ? { activeHalfyear: contagem.ativos_semestre } : {}), ...(inteiro(contagem.ativos_mes) ? { activeMonth: contagem.ativos_mes } : {}) }
    : {};
  return {
    version: esquema,
    software:
      esquema === "2.1"
        ? { name: "alumia", version: versao, repository: "https://github.com/jojoeumermo/perenidade", homepage: "https://institutolucia.org" }
        : { name: "alumia", version: versao },
    protocols: ["activitypub"],
    services: { inbound: [], outbound: [] },
    openRegistrations: false,
    usage: { users: { total: inteiro(contagem.usuarios) ? contagem.usuarios : 0, ...ativos }, localPosts: inteiro(contagem.posts) ? contagem.posts : 0 },
    metadata: { nodeName: NOME_REDE, nodeDescription: "A rede social do Instituto Lúcia: estudo e luta, com codinome, sem anúncio e sem rastreio." },
  };
}
