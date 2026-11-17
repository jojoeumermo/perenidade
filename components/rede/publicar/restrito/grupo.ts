// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Posts restritos cifrados nas telas (pedido P21, docs/rede/POSTS-RESTRITOS.md): as contas puras que o compositor e o cartão
// dividem. Qual grupo de chave vale para o post (núcleo, ou comunidade FECHADA), o pedido que vai ao banco (texto vazio, o grupo e o
// corpo "p2.…") e a abertura no aparelho. A cifra é a do MLS (lib/rede/grupo-mls.ts), nada feito aqui. Sem "@/" de propósito:
// roda no Node nos testes (scripts/testar-posts-restritos.mjs).
import type { ChaveiroDeGrupo } from "../../../../lib/rede/grupo-mls";
import type { Publico } from "../../../../lib/rede/tipos";
import { mencionadosDoTexto } from "../../../../lib/rede/publicar/visibilidade";

/** O grupo de chave: "nucleo:<uuid>" ou "comunidade:<slug>" (a mesma forma que o banco e a rota da voz aceitam). */
export const FORMA_DO_GRUPO = /^(nucleo:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|comunidade:[a-z0-9-]{2,60})$/;
/** O corpo cifrado de um post: "p2.<época>.<vetor>.<cifrado>". */
const FORMA_DO_CORPO = /^p2\.[1-9][0-9]{0,8}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/;
/** O post curto cifrado tem o mesmo teto do post curto aberto (o bloco cifrado tem folga). */
export const LIMITE_DO_POST_CIFRADO = 500;

/**
 * O grupo de chave do post, ou nulo quando o post não é cifrado. Só dois casos: o público do núcleo (com o id dele) e o público
 * da comunidade quando ela é FECHADA. Comunidade aberta ou restrita, membros, seguidores, internet: o post segue aberto, como
 * sempre (precisa ser lido, buscado e moderado por quem chega).
 */
export function grupoDoPost(destino: { publico: Publico | "roda" | "eu" | null | undefined; nucleo?: string | null; comunidade?: string | null; tipoDaComunidade?: string | null }): string | null {
  if (destino.publico === "nucleo" && destino.nucleo) {
    const g = `nucleo:${destino.nucleo.toLowerCase()}`;
    return FORMA_DO_GRUPO.test(g) ? g : null;
  }
  if (destino.publico === "comunidade" && destino.comunidade && destino.tipoDaComunidade === "fechada") {
    const g = `comunidade:${destino.comunidade}`;
    return FORMA_DO_GRUPO.test(g) ? g : null;
  }
  return null;
}

/** O post chegou cifrado (e com um grupo que dá para abrir)? */
export function postCifrado(post: { grupo?: string | null; corpo_grupo?: string | null }): post is { grupo: string; corpo_grupo: string } {
  return typeof post.grupo === "string" && FORMA_DO_GRUPO.test(post.grupo) && typeof post.corpo_grupo === "string" && FORMA_DO_CORPO.test(post.corpo_grupo);
}

/** O que a cifra devolve à tela: o par que vai ao banco, ou o código da recusa (que a tela traduz). */
export type ResultadoDaCifra = { ok: true; grupo: string; corpo_grupo: string } | { ok: false; codigo: "sem_chave" | "grupo_suspeito" | "falha" };

const codigoDe = (e: unknown) => String((e as { message?: unknown })?.message ?? e);

/**
 * Cifra o texto para o grupo. `sem_chave` (o aparelho ainda não tem o par do grupo) leva a preparar o aparelho e tentar de novo
 * uma vez; se continuar, a tela pede para tentar em seguida. `grupo_suspeito` (alguém apareceu com outra chave) NUNCA publica.
 */
export async function cifrarParaOGrupo(chaveiro: Pick<ChaveiroDeGrupo, "preparar" | "cifrar">, grupo: string, eu: string, texto: string): Promise<ResultadoDaCifra> {
  if (!FORMA_DO_GRUPO.test(grupo) || !eu) return { ok: false, codigo: "falha" };
  for (let vez = 0; vez < 2; vez++) {
    try {
      const corpo = await chaveiro.cifrar(grupo, eu, texto);
      if (!FORMA_DO_CORPO.test(corpo)) return { ok: false, codigo: "falha" };
      return { ok: true, grupo, corpo_grupo: corpo };
    } catch (e) {
      const codigo = codigoDe(e);
      if (codigo.includes("grupo_suspeito")) return { ok: false, codigo: "grupo_suspeito" };
      if (!codigo.includes("sem_chave")) return { ok: false, codigo: "falha" };
      if (vez === 1) return { ok: false, codigo: "sem_chave" };
      try {
        await chaveiro.preparar(eu);
      } catch {
        return { ok: false, codigo: "sem_chave" };
      }
    }
  }
  return { ok: false, codigo: "sem_chave" };
}

/**
 * O pedido que vai ao rede_publicar: o texto (e o corpo longo) vazios, o grupo e o corpo cifrado. O resto do pedido não muda. Com
 * "só mencionados" no post que abre a conversa, vão junto, em aberto, só os @nome marcados no texto (o servidor não tem o texto e
 * precisa deles para saber quem pode responder; a tela diz isso antes de publicar). Sem nenhum @, nada vai: só a autora responde.
 */
export function pedidoCifrado<P extends { texto?: string; corpo?: string; titulo?: string; responde_quem?: string | null; resposta_a?: string | null }>(
  pedido: P,
  cifra: { grupo: string; corpo_grupo: string },
): Omit<P, "corpo" | "titulo"> & { texto: string; grupo: string; corpo_grupo: string; mencionados?: string[] } {
  const { corpo: _corpo, titulo: _titulo, ...resto } = pedido;
  void _corpo;
  void _titulo;
  const mencionados = pedido.responde_quem === "mencionados" && !pedido.resposta_a ? mencionadosDoTexto(pedido.texto ?? "") : [];
  return { ...resto, texto: "", grupo: cifra.grupo, corpo_grupo: cifra.corpo_grupo, ...(mencionados.length ? { mencionados } : {}) };
}

/**
 * Abre um post cifrado neste aparelho: o texto, ou nulo (quem não estava no grupo naquela época, aparelho novo, post mexido, autor
 * sem id). Nunca lança: o cartão mostra "Não dá para abrir neste aparelho".
 */
export async function abrirDoGrupo(chaveiro: Pick<ChaveiroDeGrupo, "abrir">, post: { grupo?: string | null; corpo_grupo?: string | null; autor: { id: string | null } }, eu: string | null): Promise<string | null> {
  if (!eu || !post.autor.id || !postCifrado(post)) return null;
  try {
    return await chaveiro.abrir(post.grupo, eu, post.autor.id, post.corpo_grupo);
  } catch {
    return null;
  }
}
