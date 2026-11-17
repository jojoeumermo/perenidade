// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas da linha com regra aberta ao banco (supabase/migracoes/20261113-alumia-o7-linha.sql): a linha "Em roda" ou em
// ordem de chegada, com o filtro das linhas montadas; "enquanto você esteve fora"; os assuntos em alta; e ocultar resposta sem
// apagar. Usa `chamar` da fundação. Sem "@/" de propósito.
//
// Onda 11 (11F): com interesses marcados NESTE aparelho (lib/rede/interesses.ts), a linha e o "enquanto você esteve fora" vão às
// funções rede_o11_* (supabase/migracoes/20261117-alumia-o11-interesses.sql), que recebem os interesses a cada leitura e não
// guardam nada. Sem interesses, as chamadas são as de antes, iguais; banco sem a migração nova: as de antes também.
import { chamar, type Chamar } from "./cliente";
import { filtroDosInteresses, type InteressesNaLinha } from "./interesses";
import type { BaseDaLinha, FiltroDaLinha, ModoDaLinha, NumerosDaRegra, PorQue } from "./linha-aberta";
import type { Post } from "./tipos";

/** Um post da linha com o motivo de estar onde está. */
export type PostDaLinha = Post & { o7_porque?: PorQue | null };

export interface TelaDaLinha {
  itens: PostDaLinha[];
  proximo: string | null;
  modo: ModoDaLinha;
  /** O instante em que a regra foi montada (fica preso no cursor: o que chega depois não muda as telas seguintes). */
  instante: string;
  /** Falso quando a tela já é a continuação em ordem de chegada (o que é mais velho que a janela da regra). */
  na_regra: boolean;
  regra: NumerosDaRegra;
}

export interface TemaEmAlta {
  tag: string;
  nova: boolean;
  faixa: "algumas" | "dezenas" | "centenas";
}

/** A aba que o banco aceita na regra: as três de sempre, uma comunidade, ou os #temas seguidos. */
export type AbaDaRegra = BaseDaLinha | `c:${string}`;

const filtroOuNulo = (f: FiltroDaLinha | null | undefined) => (f && Object.keys(f).length ? f : null);

/** O banco ainda não tem a função pedida (a migração da onda 11 não rodou): volta para a chamada de antes. */
function faltaAFuncao(e: unknown): boolean {
  const codigo = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
  return codigo === "PGRST202" || codigo === "42883" || codigo.includes("desatualizado");
}

/**
 * Chama a função com interesses quando há interesses; sem eles (ou com o banco sem a função nova), a de antes. Os interesses vão
 * só nesta leitura: o banco não guarda.
 */
async function comInteresses<T>(c: Chamar, interesses: InteressesNaLinha | null, nova: string, antiga: string, argumentos: Record<string, unknown>): Promise<T> {
  if (!interesses) return c<T>(antiga, argumentos);
  try {
    return await c<T>(nova, { ...argumentos, p_interesses: interesses });
  } catch (e) {
    if (faltaAFuncao(e)) return c<T>(antiga, argumentos);
    throw e;
  }
}

/** `interesses`: de onde vêm os interesses deste aparelho (os testes passam um de mentira). */
export function criarClienteDaLinha(c: Chamar, interesses: () => InteressesNaLinha | null = () => filtroDosInteresses()) {
  return {
    /** Uma tela da linha. `cursor` é o `proximo` da tela anterior. */
    linha: (aba: AbaDaRegra, modo: ModoDaLinha, filtro: FiltroDaLinha | null = null, cursor: string | null = null) =>
      comInteresses<TelaDaLinha>(c, modo === "roda" ? interesses() : null, "rede_o11_linha", "rede_roda_linha", { p_aba: aba, p_modo: modo, p_filtro: filtroOuNulo(filtro), p_cursor: cursor }),
    /** Os números da regra, como o banco usa. */
    regra: () => c<NumerosDaRegra>("rede_roda_regra", {}),
    /** O que chegou depois de `desde` (ISO guardado no aparelho): quantos e os primeiros pela regra. O banco não grava a visita. */
    desde: (aba: AbaDaRegra, desde: string, filtro: FiltroDaLinha | null = null) =>
      comInteresses<{ novos: number; destaques: PostDaLinha[]; desde: string | null }>(c, interesses(), "rede_o11_desde", "rede_roda_desde", { p_aba: aba, p_desde: desde, p_filtro: filtroOuNulo(filtro) }),
    /** Os #temas em alta: igual para todo mundo, sem número. */
    emAlta: () => c<{ temas: TemaEmAlta[]; horas: number; piso: number }>("rede_roda_em_alta", {}),
    /** A moderação tira (ou devolve) um #tema dos assuntos em alta. */
    reterTema: (tag: string, sim: boolean) => c<{ retido: boolean }>("rede_roda_tema_reter", { p_tag: tag, p_sim: sim }),
    /** Quem abriu a conversa tira (ou devolve) uma resposta do fio, sem apagar. */
    ocultar: (resposta: string, sim: boolean) => c<{ oculta: boolean }>("rede_roda_ocultar", { p_resposta: resposta, p_sim: sim }),
    /** As respostas ocultadas de uma conversa e se quem pergunta é quem a abriu. */
    ocultas: (post: string) => c<{ ids: string[]; pode: boolean }>("rede_roda_ocultas", { p_post: post }),
  };
}

export const linhaAberta = criarClienteDaLinha(chamar);
