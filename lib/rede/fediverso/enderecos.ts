// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os endereços da Alumia no Fediverso (ActivityPub). Todos moram no endereço próprio da Alumia (NEXT_PUBLIC_ALUMIA_URL): o id de
// um ator ou de um post não pode mudar depois que saiu, então a federação só liga com esse endereço definido (docs/rede/FEDIVERSO.md).
// Lógica pura, sem os atalhos "@/" (roda nos testes).
import { ALUMIA_URL, urlDaAlumiaOk } from "../alumia";

export const HANDLE_FED = /^[a-z0-9_]{3,20}$/;
export const ID_DE_POST = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Os endereços da federação a partir da base (https://alumia.institutolucia.org). */
export function enderecosDaFederacao(base: string = ALUMIA_URL) {
  const raiz = base.replace(/\/+$/, "");
  const api = `${raiz}/api/fediverso`;
  return {
    base: raiz,
    dominio: urlDaAlumiaOk(raiz) ? new URL(raiz).host : "",
    ator: (handle: string) => `${api}/u/${handle}`,
    chave: (handle: string) => `${api}/u/${handle}#main-key`,
    inbox: (handle: string) => `${api}/u/${handle}/inbox`,
    outbox: (handle: string) => `${api}/u/${handle}/outbox`,
    seguidores: (handle: string) => `${api}/u/${handle}/seguidores`,
    inboxCompartilhada: `${api}/inbox`,
    /** O ator da instância (assina as buscas de perfis remotos que pedem assinatura). */
    instancia: `${api}/ator`,
    chaveDaInstancia: `${api}/ator#main-key`,
    post: (id: string) => `${api}/p/${id}`,
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

/** O @nome local de um pedido WebFinger ("acct:nome@alumia.institutolucia.org"), se for desta instância. */
export function handleDoWebfinger(resource: string, dominio: string): string | null {
  const conta = lerConta(resource);
  if (conta && conta.dominio === dominio.toLowerCase() && HANDLE_FED.test(conta.usuario.toLowerCase())) return conta.usuario.toLowerCase();
  // Também aceita o endereço do ator ou do perfil curto como "resource".
  try {
    const u = new URL(resource);
    if (u.host !== dominio) return null;
    const m = /^\/(?:api\/fediverso\/u\/|@)([a-z0-9_]{3,20})$/.exec(u.pathname);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}
