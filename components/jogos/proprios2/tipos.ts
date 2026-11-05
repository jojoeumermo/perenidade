// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

import type { ComponentType } from "react";

/** Uma fonte conferida: nome legível e endereço. Todo dado dos jogos aponta para uma. */
export interface Fonte {
  nome: string;
  url: string;
}

/** Quem o jogo quer alcançar (só orienta o texto do cartão; todos os jogos servem a todas as idades). */
export type PublicoDoJogo = "criancas" | "jovens" | "adultos" | "todos";

/** O módulo de um jogo: o componente é o export default. */
export interface ModuloDoJogo {
  default: ComponentType;
}

/**
 * Um jogo próprio do Instituto. A página Jogos lê o registro (JOGOS_PROPRIOS_2) e carrega o componente só quando a pessoa
 * abre o jogo (`carregar` é um import() dinâmico, não roda sozinho).
 */
export interface JogoProprio {
  id: string;
  titulo: string;
  /** Uma frase: o que se faz e o que se aprende. */
  resumo: string;
  publico: PublicoDoJogo;
  /** Tempo de uma rodada, em minutos (aproximado). */
  minutos: number;
  /** Tema da aula/trilha relacionada, para o cartão da página Jogos. */
  tema: string;
  carregar: () => Promise<ModuloDoJogo>;
  fontes: Fonte[];
}
