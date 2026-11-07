// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

/**
 * As identidades das páginas dos coletivos que chegaram depois do Na Atividade. Cada uma tem as suas cores, a sua letra e
 * o seu jeito de abrir a página, tiradas do perfil de cada coletivo no Instagram (a logo, os cartazes, as letras): o que
 * foi observado está em docs/territorios/IDENTIDADES.md. Nenhuma arte deles é copiada além da logo, cedida pela parceria.
 *
 * Contraste (WCAG AA, conferido por scripts/testar-territorios.mjs): `tinta` sobre `fundo` e sobre `papel`, `rotulo` e
 * cada cor de `acentos` sobre `fundo`, e `botaoTexto` sobre `destaque`.
 */
export const IDENTIDADES = {
  // NoizOcupa: ocupação do território, festa de rua e educação popular. As cores dos cartazes do próprio coletivo (o
  // vinho do fundo, o creme da letra, a mostarda dos títulos e o branco da logo); letras grossas, cartazes inclinados e
  // sombra dura.
  noizocupa: { fundo: "#5e120e", papel: "#7a1a14", tinta: "#f6e8cc", destaque: "#e8a93a", rotulo: "#e8a93a", botaoTexto: "#3a0b08", acentos: ["#e8a93a", "#f6e8cc"] },
  // Kamikaze: audiovisual. A logo é a boca preta com dente de ouro sobre amarelo; os cartazes variam entre o amarelo e o
  // verde-bandeira do "Defenda o cinema nacional", o rosa e o azul do "Proteja os direitos trans" e o neon do letreiro.
  // Antes a página era só rosa e preto (pedido de 06/11/2026: variar com a paleta deles).
  kamikaze: { fundo: "#111010", papel: "#1d1b16", tinta: "#fbf6e6", destaque: "#ffe14d", rotulo: "#ffe14d", botaoTexto: "#111010", acentos: ["#ffe14d", "#3ddc84", "#ff7eb6", "#8fd3ff"] },
  // Desordem: teatro de grupo em Cubatão. A logo é um triângulo de "play" em spray amarelo com sombra vermelha e halo
  // preto, cercado das letras soltas de DESORDEM; a bio troca letras por símbolos.
  desordem: { fundo: "#0e0c0b", papel: "#1c1815", tinta: "#f6efe0", destaque: "#ffd21f", rotulo: "#ff6b4a", botaoTexto: "#0e0c0b", acentos: ["#ffd21f", "#ff6b4a"] },
  // noismemo studios: estúdio de pesquisa e criação. Preto e branco puro, a elipse "NM" da logo, letra grotesca pesada
  // e apertada em caixa alta, jeito de ficha técnica.
  noisme: { fundo: "#ffffff", papel: "#f1f1f1", tinta: "#0a0a0a", destaque: "#0a0a0a", rotulo: "#4d4d4d", botaoTexto: "#ffffff", acentos: ["#0a0a0a"] },
} as const;

export type Visual = keyof typeof IDENTIDADES;

/** Diz se um valor vindo do JSON é uma das identidades conhecidas. */
export const ehVisual = (valor: unknown): valor is Visual => typeof valor === "string" && valor in IDENTIDADES;
