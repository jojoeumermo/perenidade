// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do pacote "comunidades" ao banco (rede_com_*): uma função por rpc, nos nomes e parâmetros de
// supabase/migracoes/2026-11-rede-comunidades.sql. Usa `chamar` da fundação. Sem "@/" de propósito.
import { type Chamar, chamar } from "./cliente";
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
    turma: (mes: string) => c<SituacaoDaTurma>("rede_com_turma", { p_mes: mes }),
    entrarNaTurma: (mes: string) => c<{ slug: string }>("rede_com_turma_entrar", { p_mes: mes }),
  };
}

export const comunidades = criarClienteComunidades(chamar);
