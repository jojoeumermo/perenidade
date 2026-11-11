// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O recorte da foto do story (moldura com proporção) e o giro livre. Puro (sem DOM): a tela (components/rede/editor/Recortar.tsx)
// desenha a moldura e o aparelho aplica o recorte quando refaz a imagem, sem metadado nenhum.

/** Um retângulo dentro da foto, em frações (0 a 1) da largura e da altura. */
export interface Recorte {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export const RECORTE_INTEIRO: Recorte = { x: 0, y: 0, largura: 1, altura: 1 };
/** O menor recorte (um quinto da foto em cada lado): menos que isso a foto vira borrão. */
export const RECORTE_MINIMO = 0.2;

export type IdDaProporcao = "livre" | "9:16" | "4:5" | "1:1" | "16:9";
/** As proporções da moldura (a do story primeiro); `valor` = largura ÷ altura, nulo na livre. */
export const PROPORCOES: readonly { id: IdDaProporcao; valor: number | null }[] = [
  { id: "9:16", valor: 9 / 16 },
  { id: "4:5", valor: 4 / 5 },
  { id: "1:1", valor: 1 },
  { id: "16:9", valor: 16 / 9 },
  { id: "livre", valor: null },
];

const dentro = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

/** Traz o recorte para dentro da foto, com o tamanho mínimo. */
export function recorteValido(r: Recorte): Recorte {
  const largura = dentro(r.largura, RECORTE_MINIMO, 1);
  const altura = dentro(r.altura, RECORTE_MINIMO, 1);
  return { x: dentro(r.x, 0, 1 - largura), y: dentro(r.y, 0, 1 - altura), largura, altura };
}

/** O maior recorte centrado com a proporção pedida (largura ÷ altura, em pixels), numa foto de `w` × `h` pixels. */
export function recorteNaProporcao(valor: number | null, w: number, h: number, atual: Recorte = RECORTE_INTEIRO): Recorte {
  if (!valor || !w || !h) return recorteValido(atual);
  const daFoto = w / h;
  let largura = 1;
  let altura = 1;
  if (valor < daFoto) largura = valor / daFoto;
  else altura = daFoto / valor;
  return recorteValido({ x: (1 - largura) / 2, y: (1 - altura) / 2, largura, altura });
}

/** Move o recorte por (dx, dy) frações, sem sair da foto. */
export function moverRecorte(r: Recorte, dx: number, dy: number): Recorte {
  return recorteValido({ ...r, x: r.x + dx, y: r.y + dy });
}

/** Muda o tamanho pelo canto de baixo à direita, mantendo a proporção (em pixels) quando há uma. */
export function redimensionarRecorte(r: Recorte, dl: number, da: number, valor: number | null, w: number, h: number): Recorte {
  let largura = dentro(r.largura + dl, RECORTE_MINIMO, 1 - r.x);
  let altura = dentro(r.altura + da, RECORTE_MINIMO, 1 - r.y);
  if (valor && w && h) {
    altura = (largura * (w / h)) / valor;
    if (altura > 1 - r.y) {
      altura = 1 - r.y;
      largura = (altura * valor) / (w / h);
    }
  }
  return recorteValido({ ...r, largura, altura });
}

/** O giro livre (em graus, de -45 a 45), somado aos quartos de volta. */
export function giroLivre(graus: number): number {
  return dentro(Math.round(graus), -45, 45);
}
