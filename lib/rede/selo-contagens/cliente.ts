// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, itens 3 e 5 (interruptor "alumia-p4-selo-contagens"): as chamadas do selo de verificado das pessoas, dos nomes
// reservados e das contagens públicas por escolha (supabase/migracoes/20261127-p4-selo-contagens.sql). Uma função por rpc; os testes
// trocam `chamar` por uma forma simulada. Sem "@/" de propósito (roda no Node nos testes).
import { ligado } from "../../recursos";
import { chamar, type Chamar } from "../cliente";
import { alumia2Ligada } from "../rotas-novas";

export const FLAG_SELO_CONTAGENS = "alumia-p4-selo-contagens" as const;

/** O selo das pessoas e as contagens por escolha aparecem? "rede-v2" + "alumia-2" + a flag do grupo (só pelo nome). */
export function seloContagensLigado(): boolean {
  return alumia2Ligada() && ligado(FLAG_SELO_CONTAGENS);
}

export const TIPOS_DE_SELO_DE_PESSOA = ["pessoa_publica", "educadora"] as const;
export type TipoDeSeloDePessoa = (typeof TIPOS_DE_SELO_DE_PESSOA)[number];
/** Por onde a coordenação confere. Só o canal: nenhum documento, endereço ou prova é guardado. */
export const CANAIS_DO_SELO = ["email_institucional", "perfil_oficial", "gabinete"] as const;
export type CanalDoSelo = (typeof CANAIS_DO_SELO)[number];

/** O selo no perfil de alguém. "organizacao" é o selo das organizações, que já existia. `por` é sempre "coordenacao". */
export interface SeloDoPerfil {
  tipo: TipoDeSeloDePessoa | "organizacao";
  desde: string;
  por: "coordenacao";
}

export interface MeuSeloEContagens {
  ligado: boolean;
  org?: boolean;
  selo?: { tipo: TipoDeSeloDePessoa; desde: string } | null;
  pedido?: { tipo: TipoDeSeloDePessoa; canal: CanalDoSelo; desde: string } | null;
  seguidores?: boolean;
  apoios?: boolean;
}

/** A contagem de seguidores: sem escolha da pessoa, `mostra: false` e nenhum número; `total` nulo é "menos de 3". */
export interface ContagemDeSeguidores {
  mostra: boolean;
  total?: number | null;
}

export interface PedidoDeSeloNaFila {
  id: string;
  codinome: string;
  handle: string | null;
  tipo: TipoDeSeloDePessoa;
  canal: CanalDoSelo;
  criadoEm: string;
}

export interface NomeReservado {
  id: number;
  nome: string;
  /** Já ligado a uma pessoa verificada (nunca diz qual). */
  verificado: boolean;
}

export function criarClienteSelo(c: Chamar) {
  return {
    /** O meu selo, o meu pedido e as minhas duas chaves (desligado: só {ligado: false}). */
    meu: () => c<MeuSeloEContagens>("rede_p4_meu"),
    pedir: (tipo: TipoDeSeloDePessoa, canal: CanalDoSelo) => c<{ situacao: "esperando" }>("rede_p4_selo_pedir", { p_tipo: tipo, p_canal: canal }),
    desistir: () => c<{ ok: boolean }>("rede_p4_selo_desistir"),
    seloDe: (handle: string) => c<SeloDoPerfil | null>("rede_p4_selo_de", { p_handle: handle }),
    seguidoresDe: (handle: string) => c<ContagemDeSeguidores>("rede_p4_seguidores_de", { p_handle: handle }),
    /** Os apoios publicados dos posts pedidos (até 100): {post: n ou nulo}; post fora da resposta = sem número público. */
    apoiosDe: (posts: string[]) => c<Record<string, number | null>>("rede_p4_apoios_de", { p_posts: posts }),
    salvarContagens: (seguidores: boolean, apoios: boolean) => c<{ seguidores: boolean; apoios: boolean }>("rede_p4_contagens_salvar", { p_seguidores: seguidores, p_apoios: apoios }),
    // Só a coordenação (o banco confere o papel e o segundo fator):
    fila: () => c<PedidoDeSeloNaFila[]>("rede_p4_selo_fila"),
    decidir: (id: string, aceitar: boolean, motivo: string, reservado: number | null) =>
      c<{ ok: boolean }>("rede_p4_selo_decidir", { p_id: id, p_aceitar: aceitar, p_motivo: motivo, p_reservado: reservado }),
    tirar: (handle: string, motivo: string) => c<{ ok: boolean }>("rede_p4_selo_tirar", { p_handle: handle, p_motivo: motivo }),
    reservados: () => c<NomeReservado[]>("rede_p4_reservados"),
    reservar: (nome: string) => c<{ id: number; nome: string }>("rede_p4_reservado_salvar", { p_nome: nome }),
    tirarReservado: (id: number) => c<{ ok: boolean }>("rede_p4_reservado_tirar", { p_id: id }),
  };
}

export const redeSelo = criarClienteSelo(chamar);

/**
 * O que a tela mostra de uma contagem publicada: o número (3 ou mais), "menos" (a pessoa escolheu mostrar, mas são menos de 3) ou
 * nulo (a pessoa não escolheu mostrar: nada aparece). Nunca um número abaixo de 3, mesmo se um dia o banco mandar.
 */
export function contagemPublicada(total: number | null | undefined): number | "menos" | null {
  if (total === undefined) return null;
  if (total === null || !Number.isFinite(total) || total < 3) return "menos";
  return Math.floor(total);
}
