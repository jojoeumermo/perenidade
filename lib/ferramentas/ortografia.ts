// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As palavras de um texto, com a posição de cada uma, para o corretor ortográfico marcar sem mexer no resto.

/** Palavras com letras (inclusive acentuadas), hífen e apóstrofo no meio; números e pontuação ficam de fora. */
export function palavrasDoTexto(texto: string): { palavra: string; inicio: number }[] {
  const saida: { palavra: string; inicio: number }[] = [];
  for (const m of texto.matchAll(/\p{L}+(?:[-'’]\p{L}+)*/gu)) saida.push({ palavra: m[0], inicio: m.index ?? 0 });
  return saida;
}
