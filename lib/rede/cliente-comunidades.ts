// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do pacote "comunidades" ao banco (rede_com_*): uma função por rpc, nos nomes e parâmetros de
// supabase/migracoes/2026-11-rede-comunidades.sql. Usa `chamar` da fundação. Sem "@/" de propósito.
import { type Chamar, chamar } from "./cliente";
import { criarDubleDosNucleos } from "./nucleos-exemplos";
import type { PaginaDaLinha } from "./tipos";
import type {
  ItemDaLista,
  MinhaProposta,
  NucleoResumo,
  PaginaDaComunidade,
  PaginaDoNucleo,
  PedidoDeEntrada,
  PedidoDeProposta,
  PropostaNaFila,
  SituacaoDaTurma,
  SituacaoNaComunidade,
} from "./tipos-comunidades";

export function criarClienteComunidades(c: Chamar) {
  return {
    lista: () => c<{ itens: ItemDaLista[] }>("rede_com_lista"),
    pagina: (slug: string) => c<PaginaDaComunidade>("rede_com_pagina", { p_slug: slug }),
    entrar: (slug: string) => c<{ situacao: SituacaoNaComunidade }>("rede_com_entrar", { p_slug: slug }),
    sair: (slug: string) => c<{ situacao: SituacaoNaComunidade }>("rede_com_sair", { p_slug: slug }),
    pedidos: (slug: string) => c<{ itens: PedidoDeEntrada[] }>("rede_com_pedidos", { p_slug: slug }),
    decidirPedido: (slug: string, usuario: string, aceita: boolean) => c<{ ok: boolean }>("rede_com_decidir_pedido", { p_slug: slug, p_usuario: usuario, p_aceita: aceita }),
    salvarRegras: (slug: string, regras: { titulo: string; texto: string }[]) => c<{ regras: { numero: number; titulo: string; texto: string }[] }>("rede_com_regras_salvar", { p_slug: slug, p_regras: regras }),
    salvarEtiquetas: (slug: string, etiquetas: { nome: string; cor?: string }[]) => c<{ etiquetas: { nome: string; cor: string }[] }>("rede_com_etiquetas_salvar", { p_slug: slug, p_etiquetas: etiquetas }),
    fixar: (slug: string, post: string, sim: boolean) => c<{ fixado: boolean }>("rede_com_fixar", { p_slug: slug, p_post: post, p_sim: sim }),
    propor: (p: PedidoDeProposta) => c<{ id: string; situacao: "aberta" }>("rede_com_propor", { p }),
    minhasPropostas: () => c<{ itens: MinhaProposta[] }>("rede_com_minhas_propostas"),
    fila: () => c<{ itens: PropostaNaFila[] }>("rede_com_propostas_fila"),
    decidir: (id: string, aprova: boolean, motivo = "") => c<{ situacao: "aprovada" | "recusada"; slug?: string }>("rede_com_decidir", { p_id: id, p_aprova: aprova, p_motivo: motivo }),
    ligarAula: (post: string, aula: string, titulo = "") => c<{ ok: boolean }>("rede_com_ligar_aula", { p_post: post, p_aula: aula, p_titulo: titulo }),
    linhaDaAula: (comunidade: string, aula: string, cursor: string | null = null, limite = 20) =>
      c<PaginaDaLinha>("rede_com_aula_linha", { p_comunidade: comunidade, p_aula: aula, p_cursor: cursor, p_limite: limite }),
    nucleos: () => c<{ itens: NucleoResumo[] }>("rede_com_nucleos"),
    nucleo: (id: string) => c<PaginaDoNucleo>("rede_com_nucleo", { p_id: id }),
    linhaDoNucleo: (id: string, cursor: string | null = null, limite = 20) => c<PaginaDaLinha>("rede_com_nucleo_linha", { p_id: id, p_cursor: cursor, p_limite: limite }),
    sairDoNucleo: (id: string) => c<{ ok: boolean }>("rede_com_nucleo_sair", { p_id: id }),
    salvarEncontro: (p: { nucleo: string; quando: string; local_tipo: string; local_texto: string }) => c<{ id: string }>("rede_com_encontro_salvar", { p }),
    removerEncontro: (id: string) => c<{ ok: boolean }>("rede_com_encontro_remover", { p_id: id }),
    // Onda 5 (PLANO-ALUMIA F3): supabase/migracoes/20261109-alumia-f3.sql. Só as telas novas (rede-v2 + alumia-2) chamam.
    /** A página da tela nova: a de rede_com_pagina + "N posts esta semana" (agregado; nulo abaixo de 3). */
    paginaAlumia: (slug: string) => c<PaginaDaComunidade>("rede_alumia_com_pagina", { p_slug: slug }),
    /** "Comunidades ativas": as com mais posts nos últimos 7 dias (só as com 3 ou mais), sem algoritmo e sem patrocínio. */
    ativas: (quantas = 4) => c<{ itens: ItemDaLista[] }>("rede_alumia_ativas", { p_quantas: quantas }),
    turma: (mes: string) => c<SituacaoDaTurma>("rede_com_turma", { p_mes: mes }),
    entrarNaTurma: (mes: string) => c<{ slug: string }>("rede_com_turma_entrar", { p_mes: mes }),
  };
}

/** A prévia com dados de exemplo está ligada? (A referência é literal para o Next gravar o valor no código do navegador.) */
const PREVIA = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

/**
 * Na prévia, os núcleos e a turma do mês respondem pelo dublê (lib/rede/nucleos-exemplos.ts); o resto segue o caminho de sempre
 * (as telas de comunidade já têm os próprios exemplos).
 */
export function chamarComNucleosDeExemplo(duble = criarDubleDosNucleos(), resto: Chamar = chamar): Chamar {
  return async <T,>(funcao: string, argumentos: Record<string, unknown> = {}) => {
    const f = (duble as unknown as Record<string, ((a: Record<string, unknown>) => unknown) | undefined>)[funcao];
    if (!f) return resto<T>(funcao, argumentos);
    await new Promise((r) => setTimeout(r, 120));
    return structuredClone(f(argumentos)) as T;
  };
}

export const comunidades = criarClienteComunidades(PREVIA ? chamarComNucleosDeExemplo() : chamar);
