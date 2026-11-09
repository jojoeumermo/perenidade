// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os endereços da Alumia no Fediverso (ActivityPub). Todos moram no endereço próprio da Alumia (NEXT_PUBLIC_ALUMIA_URL): o id de
// um ator ou de um post não pode mudar depois que saiu, então a federação só liga com esse endereço definido (docs/rede/FEDIVERSO.md).
// Lógica pura, sem os atalhos "@/" (roda nos testes).
import { lerRecursos, ligado, type Recurso } from "../../recursos";
import { ALUMIA_URL, urlDaAlumiaOk } from "../alumia";

/**
 * Os dois recursos do "Fediverso total" (o plano do Fediverso de 08/11/2026, frente F1). DESLIGADOS por padrão: sem eles, tudo o
 * que a Alumia publica fica exatamente como antes. Os nomes entram em lib/recursos.ts (RECURSOS e SO_PELO_NOME) pela frente F5;
 * o "as Recurso" só cala o tipo até lá.
 *
 * A produção roda com NEXT_PUBLIC_RECURSOS=todos, e "todos" liga qualquer nome que não esteja em SO_PELO_NOME. Por isso estes dois
 * só ligam com o NOME escrito na lista (ou pelo painel), nunca por "todos", mesmo antes de a F5 os pôr em SO_PELO_NOME: mudar o @
 * de todo mundo (D1) e abrir o ator completo não pode acontecer por acaso numa montagem.
 */
export const RECURSO_TOTAL = "fediverso-total";
export const RECURSO_GRUPOS = "fediverso-grupos";

/**
 * Ligado só pelo nome: o nome na variável de montagem ou a decisão do painel; "todos" não conta. O interruptor de emergência do
 * painel (desligado no banco) e o "-nome" da lista sempre desligam, porque passam por `ligado`.
 *
 * Como lib/recursos.ts não expõe o que o painel ligou, a conta é: ligado agora E (ligado pela lista sem "todos" OU ligado só por
 * causa do painel, isto é, a lista sozinha não liga). Limite honesto: com "todos" na variável, o painel só consegue ligar estes
 * dois depois que a F5 os puser em SO_PELO_NOME (hoje o painel nem aceita o nome: lib/recursos-vivos.ts filtra o que não está em
 * RECURSOS). Falha para o lado desligado.
 */
export function ligadoPeloNome(nome: string): boolean {
  const recurso = nome as Recurso;
  if (!ligado(recurso)) return false;
  // A referência literal, como em lib/recursos.ts.
  const lista = lerRecursos(process.env.NEXT_PUBLIC_RECURSOS);
  const semTodos = new Set([...lista].filter((n) => n !== "todos"));
  return ligado(recurso, semTodos) || !ligado(recurso, lista);
}

/** O modo "servidor do Fediverso": @ no domínio curto, ator completo, Note com menções, mídia e fio, NodeInfo completo. */
export const modoTotal = (): boolean => ligadoPeloNome(RECURSO_TOTAL);
/** As comunidades abertas como Group (Lemmy). Só vale junto com o modo total. */
export const gruposLigados = (): boolean => modoTotal() && ligadoPeloNome(RECURSO_GRUPOS);

/** As escolhas que mudam o que sai: lidas das flags na hora (os testes passam as suas). */
export interface OpcoesDaSaida {
  total: boolean;
  grupos: boolean;
}
export const opcoesDaSaida = (): OpcoesDaSaida => ({ total: modoTotal(), grupos: gruposLigados() });

/** O slug de uma comunidade (o mesmo formato do banco: interno.rede_comunidades.slug). */
export const SLUG_DE_COMUNIDADE = /^[a-z0-9-]{2,60}$/;

/**
 * O domínio curto do @ (decisão D1 do plano): "alumia.institutolucia.org" vira "institutolucia.org". Os ids continuam no host da
 * Alumia; só a conta (acct:) muda. Vazio quando não há o que encurtar (o host não começa com "alumia." ou sobraria um nome sem ponto).
 */
export function dominioCurtoDe(dominio: string): string {
  const m = /^alumia\.(.+)$/i.exec(dominio);
  if (!m) return "";
  const resto = m[1].toLowerCase();
  return resto.includes(".") || /^localhost(:\d+)?$/.test(resto) ? resto : "";
}

export const HANDLE_FED = /^[a-z0-9_]{3,20}$/;
export const ID_DE_POST = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Os endereços da federação a partir da base (https://alumia.institutolucia.org). */
export function enderecosDaFederacao(base: string = ALUMIA_URL) {
  const raiz = base.replace(/\/+$/, "");
  const api = `${raiz}/api/fediverso`;
  const dominio = urlDaAlumiaOk(raiz) ? new URL(raiz).host : "";
  const dominioCurto = dominioCurtoDe(dominio);
  return {
    base: raiz,
    dominio,
    /** O domínio curto do @ (D1), ou vazio. Só vale no modo total: ver `dominioDaConta`. */
    dominioCurto,
    /** O domínio do acct: canônico. Sem o modo total, o de sempre (o host da Alumia). */
    dominioDaConta: (total: boolean) => (total && dominioCurto ? dominioCurto : dominio),
    ator: (handle: string) => `${api}/u/${handle}`,
    chave: (handle: string) => `${api}/u/${handle}#main-key`,
    inbox: (handle: string) => `${api}/u/${handle}/inbox`,
    outbox: (handle: string) => `${api}/u/${handle}/outbox`,
    seguidores: (handle: string) => `${api}/u/${handle}/seguidores`,
    seguindo: (handle: string) => `${api}/u/${handle}/seguindo`,
    destaques: (handle: string) => `${api}/u/${handle}/destaques`,
    inboxCompartilhada: `${api}/inbox`,
    /** O ator da instância (assina as buscas de perfis remotos que pedem assinatura). */
    instancia: `${api}/ator`,
    chaveDaInstancia: `${api}/ator#main-key`,
    post: (id: string) => `${api}/p/${id}`,
    respostas: (id: string) => `${api}/p/${id}/respostas`,
    /**
     * A imagem de um post federado, num endereço estável (o depósito "rede-midia" é privado e só dá links assinados que expiram).
     * A ordem identifica a imagem no post (interno.rede_midia: unique (post, ordem)).
     */
    midiaDoPost: (id: string, ordem: number) => `${api}/p/${id}/midia/${ordem}`,
    /** Comunidade aberta como Group (Lemmy, FEP-1b12). */
    comunidade: (slug: string) => `${api}/c/${slug}`,
    chaveDaComunidade: (slug: string) => `${api}/c/${slug}#main-key`,
    inboxDaComunidade: (slug: string) => `${api}/c/${slug}/inbox`,
    outboxDaComunidade: (slug: string) => `${api}/c/${slug}/outbox`,
    seguidoresDaComunidade: (slug: string) => `${api}/c/${slug}/seguidores`,
    moderadoresDaComunidade: (slug: string) => `${api}/c/${slug}/moderadores`,
    paginaDaComunidade: (slug: string) => `${raiz}/c/${slug}`,
    atividade: (tipo: string, id: string) => `${api}/atividades/${tipo}/${id}`,
    /** As páginas de gente (HTML): o perfil curto e o post, no endereço da Alumia. */
    paginaDoPerfil: (handle: string) => `${raiz}/@${handle}`,
    paginaDoPost: (id: string) => `${raiz}/p/${id}`,
    paginaDaTag: (tag: string) => `${raiz}/tag/${encodeURIComponent(tag)}`,
  };
}

export type EnderecosDaFederacao = ReturnType<typeof enderecosDaFederacao>;

/** Lê um endereço de conta do Fediverso: "@nome@instancia.org", "nome@instancia.org" ou "acct:nome@instancia.org". */
export function lerConta(texto: string): { usuario: string; dominio: string } | null {
  const m = /^(?:acct:)?@?([a-z0-9_.-]{1,64})@([a-z0-9.-]{3,253}(?::\d{1,5})?)$/i.exec(texto.trim());
  if (!m) return null;
  const dominio = m[2].toLowerCase();
  if (!dominio.includes(".") && !/^localhost(:\d+)?$/.test(dominio)) return null;
  return { usuario: m[1], dominio };
}

/** Os domínios que esta instância aceita num acct: (o da Alumia e, no modo total, o curto). */
export function dominiosDaConta(e: { dominio: string; dominioCurto: string }, total: boolean): string[] {
  return [e.dominio, ...(total && e.dominioCurto ? [e.dominioCurto] : [])].filter(Boolean).map((d) => d.toLowerCase());
}

/**
 * O @nome local de um pedido WebFinger ("acct:nome@alumia.institutolucia.org"), se for desta instância. `dominio` pode ser uma
 * lista (no modo total, o host da Alumia e o domínio curto): os dois levam ao MESMO ator, como o Mastodon confere ([M-WF]).
 * O endereço do ator ou do perfil curto só vale no host da Alumia (é lá que eles moram).
 */
export function handleDoWebfinger(resource: string, dominio: string | readonly string[]): string | null {
  const dominios = (typeof dominio === "string" ? [dominio] : [...dominio]).map((d) => d.toLowerCase()).filter(Boolean);
  const conta = lerConta(resource);
  if (conta && dominios.includes(conta.dominio) && HANDLE_FED.test(conta.usuario.toLowerCase())) return conta.usuario.toLowerCase();
  // Também aceita o endereço do ator ou do perfil curto como "resource".
  try {
    const u = new URL(resource);
    if (u.host !== dominios[0]) return null;
    const m = /^\/(?:api\/fediverso\/u\/|@)([a-z0-9_]{3,20})$/.exec(u.pathname);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** O slug de comunidade de um pedido WebFinger (o Lemmy pergunta "acct:slug@dominio"; "!slug@dominio" é só como ele mostra). */
export function slugDoWebfinger(resource: string, dominios: readonly string[]): string | null {
  const conta = lerConta(resource.replace(/^(acct:)?!/, "$1"));
  if (conta && dominios.map((d) => d.toLowerCase()).includes(conta.dominio) && SLUG_DE_COMUNIDADE.test(conta.usuario.toLowerCase())) return conta.usuario.toLowerCase();
  try {
    const u = new URL(resource);
    if (u.host !== dominios[0]) return null;
    const m = /^\/(?:api\/fediverso\/c\/|c\/)([a-z0-9-]{2,60})$/.exec(u.pathname);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** O pedido é pelo ator da instância? A convenção do Mastodon: "acct:<domínio>@<domínio>" (ou o próprio endereço do ator). */
export function webfingerDaInstancia(resource: string, e: { dominio: string; instancia: string }): boolean {
  if (resource === e.instancia) return true;
  const conta = lerConta(resource);
  return Boolean(conta && e.dominio && conta.dominio === e.dominio.toLowerCase() && conta.usuario.toLowerCase() === e.dominio.toLowerCase());
}
