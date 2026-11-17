// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O seletor de visibilidade do Escrever (decisão de 17/11, D3/P9 opção A): as opções que valem para o post que está sendo escrito,
// cada uma com o público que vai ao banco e se o post sai da Alumia; e os @ marcados do post cifrado com "só mencionados". Sem
// estado de tela e sem "@/" de propósito: roda no Node dos testes (scripts/testar-alumia-visibilidade.mjs). O banco é
// supabase/migracoes/20261122-alumia-visibilidade.sql.
//
//   eu          Só eu (privado). Ninguém mais vê; nunca sai da Alumia. Vai pela vida do post (rede_pub_vida_publicar).
//   roda        Amigos próximos (a roda de confiança). Nunca sai. Vai pela vida do post.
//   seguidores  Quem segue você na Alumia. Nunca sai.
//   membros     Todos na Alumia (só nela). Nunca sai: nem Fediverso, nem RSS, nem incorporação, nem Telegram, nem resumo.
//   internet    No perfil: Alumia e Fediverso (só com o modo total ligado; na Alumia vale para quem tem conta, e sai para o
//               Fediverso quando a pessoa ligou a federação). Na comunidade das disciplinas: aberto na internet e no Fediverso.
//   comunidade  Só a comunidade escolhida (a fechada vai cifrada, P21).
//   equipe      Só a equipe do instituto (só para quem é da equipe).

/** A versão do banco (public.rede_alumia_versao) a partir da qual o público "só eu" existe (20261122-alumia-visibilidade.sql). */
export const VERSAO_DO_SO_EU = 13;

/** O que o Escrever oferece em "Quem vê". */
export type Visibilidade = "eu" | "roda" | "seguidores" | "membros" | "internet" | "comunidade" | "nucleo" | "equipe";

/** Por que a opção aparece mas não dá para escolher (a tela diz o porquê embaixo dela). */
export type MotivoDesligada = "fediverso_desligado_no_perfil" | "fediverso_impedido";

export interface OpcaoDeVisibilidade {
  valor: Visibilidade;
  /** O post sai da Alumia (outros servidores recebem e podem guardar uma cópia). */
  saiDaAlumia: boolean;
  /** Aparece, mas não dá para escolher agora. */
  desligada: MotivoDesligada | null;
}

/** A situação do Fediverso para quem escreve: o modo total no banco e a federação do próprio perfil. */
export interface FediversoDoEscrever {
  /** O modo total está ligado (o post de perfil pode sair). */
  total: boolean;
  /** A pessoa ligou a federação no perfil. Nulo: ainda não se sabe (a opção aparece, e o banco decide). */
  ligado: boolean | null;
  /** A pessoa pode federar (tem @nome, não é invisível, não está suspensa). Nulo: ainda não se sabe. */
  pode: boolean | null;
}

export interface ContextoDaVisibilidade {
  /** A comunidade escolhida em "Onde publicar" (nulo: o perfil). */
  comunidade: { categoria: string; tipo?: string | null } | null;
  /** O tipo é o Ato (chamado para a rua): sem "só eu" e sem a roda. */
  ato: boolean;
  /** As escolhas da vida do post existem neste banco (a onda 9): sem elas, nem "só eu" nem a roda. */
  comVida: boolean;
  /**
   * O banco já tem o público "só eu" (rede_alumia_versao() >= VERSAO_DO_SO_EU). Num banco de antes, o pedido de "só eu" chegaria ao
   * gatilho antigo, que não o conhece, e o post ficaria para os seguidores: por isso a opção só aparece quando o banco cumpre.
   */
  soEu: boolean;
  /** Quem escreve é da equipe do instituto. */
  equipe: boolean;
  fediverso: FediversoDoEscrever;
}

/**
 * As opções de "Quem vê", da mais fechada para a mais aberta. No perfil: só eu, amigos próximos, seguidores, todos na Alumia e,
 * com o modo total, Alumia e Fediverso. Numa comunidade: a comunidade, todos na Alumia, seguidores e, nas disciplinas, o aberto na
 * internet. A equipe por último, só para quem é dela.
 */
export function opcoesDeVisibilidade(ctx: ContextoDaVisibilidade): OpcaoDeVisibilidade[] {
  const op = (valor: Visibilidade, saiDaAlumia = false, desligada: MotivoDesligada | null = null): OpcaoDeVisibilidade => ({ valor, saiDaAlumia, desligada });
  const lista: OpcaoDeVisibilidade[] = [];
  if (!ctx.comunidade) {
    if (ctx.comVida && !ctx.ato) lista.push(...(ctx.soEu ? [op("eu")] : []), op("roda"));
    lista.push(op("seguidores"), op("membros"));
    if (ctx.fediverso.total) {
      const desligada = ctx.fediverso.pode === false ? "fediverso_impedido" : ctx.fediverso.ligado === false ? "fediverso_desligado_no_perfil" : null;
      lista.push(op("internet", true, desligada));
    }
  } else {
    lista.push(op("comunidade"), op("membros"), op("seguidores"));
    if (ctx.comunidade.categoria === "disciplinas") lista.push(op("internet", true));
  }
  if (ctx.equipe) lista.push(op("equipe"));
  return lista;
}

/** A visibilidade que vale quando a escolhida some da lista (trocou de lugar, por exemplo): "todos na Alumia", que nunca sai. */
export function visibilidadeQueVale(escolhida: Visibilidade, opcoes: OpcaoDeVisibilidade[]): Visibilidade {
  const achada = opcoes.find((o) => o.valor === escolhida);
  return achada && !achada.desligada ? escolhida : "membros";
}

/** "Só eu" e a roda vão pela vida do post (rede_pub_vida_publicar): o banco confere como "seguidores" e o gatilho grava a escolha. */
export const vaiPelaVida = (v: Visibilidade) => v === "eu" || v === "roda";

/** O público que as conferências de antes de publicar recebem (as frentes não conhecem "só eu" nem a roda). */
export function publicoParaConferir(v: Visibilidade): Exclude<Visibilidade, "eu" | "roda"> {
  return v === "eu" || v === "roda" ? "seguidores" : v;
}

/** O máximo de @ que vão junto com o post cifrado (o banco recusa mais). */
export const MAXIMO_DE_MENCIONADOS = 20;

/**
 * Os @nome marcados num texto, sem repetir e em minúsculas, na ordem em que aparecem (até 20). "@nome@servidor" é gente de fora e
 * não conta (a mesma regra de interno.rede3_conv_mencionar). É o que vai em aberto junto do post cifrado com "só mencionados".
 */
export function mencionadosDoTexto(texto: string): string[] {
  const achados: string[] = [];
  for (const m of texto.toLowerCase().matchAll(/(?:^|[^a-z0-9_@])@([a-z0-9_]{3,20})(?![a-z0-9_@])/g)) {
    if (!achados.includes(m[1])) achados.push(m[1]);
    if (achados.length === MAXIMO_DE_MENCIONADOS) break;
  }
  return achados;
}
