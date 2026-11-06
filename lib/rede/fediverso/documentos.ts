// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os documentos JSON-LD que a Alumia publica no Fediverso (ActivityStreams 2.0, como o Mastodon lê): o ator de cada pessoa que ligou
// a federação, o post (Note), as atividades (Create, Update, Delete, Accept, Reject, Follow, Undo), as coleções e os documentos de
// descoberta (WebFinger, NodeInfo). Só o codinome e o @nome saem; nunca o nome civil, e-mail, núcleo ou comunidade fechada.
// Lógica pura, sem "@/".
import type { EnderecosDaFederacao } from "./enderecos";
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
export const TIPO_ACTIVITY = "application/activity+json; charset=utf-8";

export interface AtorLocal {
  handle: string;
  nome: string;
  bio: string;
  ligado_em: string | null;
  chave_publica: string;
}

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
}

/** O ator de uma pessoa (Person). Sem lista pública de seguidores e fora de diretórios e da busca de texto das outras instâncias. */
export function documentoDoAtor(e: EnderecosDaFederacao, a: AtorLocal) {
  return {
    "@context": CONTEXTO,
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
    name: "Alumia",
    summary: "<p>Alumia, a rede social do Instituto Lúcia.</p>",
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

/** O post como Note. O texto longo vai até 5.000 caracteres, com o link para ler o resto na Alumia. */
export function documentoDoPost(e: EnderecosDaFederacao, p: PostFederado, comContexto = true) {
  const link = e.paginaDoPost(p.id);
  const partes: string[] = [];
  if (p.titulo) partes.push(`<p><strong>${escaparHtml(p.titulo)}</strong></p>`);
  if (p.texto) partes.push(textoParaHtml(p.texto, e.paginaDaTag));
  if (p.corpo) {
    const corpo = Array.from(p.corpo);
    partes.push(textoParaHtml(corpo.slice(0, MAX_CORPO).join("") + (corpo.length > MAX_CORPO ? "…" : ""), e.paginaDaTag));
    if (corpo.length > MAX_CORPO) partes.push(`<p><a href="${escaparHtml(link)}">${escaparHtml(link)}</a></p>`);
  }
  const tags = hashtagsDe(`${p.titulo ?? ""}\n${p.texto}\n${p.corpo ?? ""}`);
  return {
    ...(comContexto ? { "@context": CONTEXTO } : {}),
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
    tag: tags.map((t) => ({ type: "Hashtag", href: e.paginaDaTag(t), name: `#${t}` })),
  };
}

export function atividadeCreate(e: EnderecosDaFederacao, p: PostFederado) {
  const nota = documentoDoPost(e, p, false);
  return { "@context": CONTEXTO, id: `${e.post(p.id)}#create`, type: "Create", actor: e.ator(p.handle), published: nota.published, to: nota.to, cc: nota.cc, object: nota };
}

export function atividadeUpdate(e: EnderecosDaFederacao, p: PostFederado, quando = new Date()) {
  const nota = documentoDoPost(e, p, false);
  return { "@context": CONTEXTO, id: `${e.post(p.id)}#update-${quando.getTime()}`, type: "Update", actor: e.ator(p.handle), published: quando.toISOString(), to: nota.to, cc: nota.cc, object: nota };
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

/** A caixa de saída: a coleção (com o total) ou uma página dela (Create de cada post, do mais novo ao mais antigo). */
export function colecaoDaCaixaDeSaida(e: EnderecosDaFederacao, handle: string, total: number) {
  return { "@context": CONTEXTO, id: e.outbox(handle), type: "OrderedCollection", totalItems: total, first: `${e.outbox(handle)}?pagina=1` };
}

export function paginaDaCaixaDeSaida(e: EnderecosDaFederacao, handle: string, posts: PostFederado[], aqui: string, proxima: string | null) {
  return {
    "@context": CONTEXTO,
    id: aqui,
    type: "OrderedCollectionPage",
    partOf: e.outbox(handle),
    orderedItems: posts.map((p) => {
      const { ["@context"]: _contexto, ...atividade } = atividadeCreate(e, p);
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

export function documentoWebfinger(e: EnderecosDaFederacao, handle: string) {
  return {
    subject: `acct:${handle}@${e.dominio}`,
    aliases: [e.ator(handle), e.paginaDoPerfil(handle)],
    links: [
      { rel: "self", type: "application/activity+json", href: e.ator(handle) },
      { rel: "http://webfinger.net/rel/profile-page", type: "text/html", href: e.paginaDoPerfil(handle) },
    ],
  };
}

/** NodeInfo 2.1: o que a instância é, com números agregados (sem nome de ninguém). */
export function documentoNodeinfo(contagem: { usuarios: number; posts: number }, versao: string) {
  return {
    version: "2.1",
    software: { name: "alumia", version: versao, repository: "https://github.com/jojoeumermo/perenidade", homepage: "https://institutolucia.org" },
    protocols: ["activitypub"],
    services: { inbound: [], outbound: [] },
    openRegistrations: false,
    usage: { users: { total: contagem.usuarios }, localPosts: contagem.posts },
    metadata: { nodeName: "Alumia", nodeDescription: "A rede social do Instituto Lúcia: estudo e luta, com codinome, sem anúncio e sem rastreio." },
  };
}
