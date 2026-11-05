// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

/**
 * As identidades das páginas dos coletivos que chegaram depois do Na Atividade. Cada uma tem as suas cores, a sua letra e
 * o seu jeito de abrir a página. Foram desenhadas a partir do que cada coletivo tornou público (a frase do perfil, o
 * tema, o tipo de trabalho), sem copiar nenhuma arte deles: docs/TERRITORIOS.md pede ao Jonathan que confira com o
 * anúncio de cada coletivo e ajuste as cores.
 */
export const IDENTIDADES = {
  // NoizOcupa: ocupação do território, festa de rua e educação popular. Amarelo de cartaz, azul-noite de tinta,
  // laranja de selo; letras grossas, adesivos inclinados e sombra dura.
  noizocupa: { fundo: "#ffd23f", papel: "#fff4cc", tinta: "#14213d", destaque: "#e4572e", rotulo: "#a8341a" },
  // Kamikaze: audiovisual. Sala escura de cinema, fita de filme com furos, marcação de tempo e magenta de letreiro.
  kamikaze: { fundo: "#0b0b10", papel: "#17171f", tinta: "#f5f1ea", destaque: "#ff2e88", rotulo: "#ff2e88" },
} as const;
