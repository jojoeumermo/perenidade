// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

/** Os dois lados da linha do tempo: o Brasil à esquerda; a América Latina e o mundo à direita. */
export const lugaresDaLinha = ["brasil", "america-latina", "mundo"] as const;
export type LugarDaLinha = (typeof lugaresDaLinha)[number];

export const temasDaLinha = ["trabalho", "negra", "indigena", "mulheres", "terra", "democracia", "revolucao", "lgbt", "anticolonial"] as const;
export type TemaDaLinha = (typeof temasDaLinha)[number];

export interface Acontecimento {
  ano: number;
  onde: LugarDaLinha;
  temas: TemaDaLinha[];
  /** Uma ou duas frases, com **negrito** e [links](/caminho) e nada mais de Markdown. */
  texto: string;
}

/** O século do acontecimento, como a página o separa: os séculos XVII e XVIII ficam juntos. */
export function seculoDe(ano: number): "18" | "19" | "20" | "21" {
  return ano < 1800 ? "18" : ano < 1900 ? "19" : ano < 2000 ? "20" : "21";
}
