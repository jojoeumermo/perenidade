// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

// O texto rico do estúdio: estilos misturados na mesma caixa, escritos com marcas simples, e a divisão das palavras
// em sílabas para hifenizar em português.
//
//   _palavra_      itálico (inverte: num texto em itálico, volta ao normal)
//   **palavra**    negrito
//   ==palavra==    na cor de destaque da camada
//
// As marcas podem se combinar ("_==Lúcia==_") e atravessar linhas. Um sublinhado no meio da palavra ("nome_do_arquivo")
// fica como está: só conta quando abre depois de espaço ou pontuação e fecha antes deles.

export interface Trecho {
  texto: string;
  italico: boolean;
  negrito: boolean;
  destaque: boolean;
}

const borda = (ch: string | undefined) => ch === undefined || /[\s.,;:!?…"“”'‘’()«»\[\]—–-]/.test(ch);

/** Divide o texto em trechos com o mesmo estilo. As quebras de linha ficam dentro dos trechos. */
export function trechos(texto: string): Trecho[] {
  const saida: Trecho[] = [];
  let italico = false;
  let negrito = false;
  let destaque = false;
  let atual = "";
  const fechar = () => {
    if (atual) saida.push({ texto: atual, italico, negrito, destaque });
    atual = "";
  };
  for (let i = 0; i < texto.length; i++) {
    const dois = texto.slice(i, i + 2);
    if (dois === "**") {
      fechar();
      negrito = !negrito;
      i++;
      continue;
    }
    if (dois === "==") {
      fechar();
      destaque = !destaque;
      i++;
      continue;
    }
    if (texto[i] === "_") {
      const antes = texto[i - 1];
      const depois = texto[i + 1];
      const abre = !italico && borda(antes) && depois !== undefined && !/\s/.test(depois);
      const fecha = italico && antes !== undefined && !/\s/.test(antes) && borda(depois);
      if (abre || fecha) {
        fechar();
        italico = !italico;
        continue;
      }
    }
    atual += texto[i];
  }
  fechar();
  return saida;
}

/** O texto sem as marcas (para o PSD, a legenda, a conferência de ortografia). */
export const semMarcas = (texto: string) => trechos(texto).map((t) => t.texto).join("");

/** O texto tem alguma marca de estilo? */
export const temMarcas = (texto: string) => trechos(texto).some((t) => t.italico || t.negrito || t.destaque);

// ───── Sílabas (para hifenizar) ─────

const VOGAL = /[aeiouáàâãéêíóôõúüy]/i;
/** Encontros que não se separam: abrem a sílaba seguinte (bra-si-lei-ro, ca-chor-ro, fi-lho, ma-nhã). */
const ENCONTROS = new Set(["bl", "br", "cl", "cr", "dl", "dr", "fl", "fr", "gl", "gr", "kl", "kr", "pl", "pr", "tl", "tr", "vl", "vr", "ch", "lh", "nh", "ph", "th"]);

/**
 * Os pontos onde a palavra pode ser dividida (índices no meio dela), pelas regras de separação silábica do português:
 * consoante sozinha entre vogais vai para a sílaba de baixo (ca-sa); duas consoantes se separam (car-ro, pas-so,
 * nas-cer), a menos que formem encontro (pa-lha, li-vro); três ou mais deixam o encontro final ou a última consoante
 * para a sílaba de baixo (cons-tru-ir, abs-ter). Vogais seguidas não se dividem aqui (hiato ou ditongo exigiriam
 * dicionário); a divisão só acontece entre consoantes, que é sempre segura.
 */
export function pontosDeDivisao(palavra: string): number[] {
  const letras = [...palavra];
  const pontos: number[] = [];
  let i = 0;
  // Pula o começo até a primeira vogal (o que vem antes é da primeira sílaba).
  while (i < letras.length && !VOGAL.test(letras[i])) i++;
  while (i < letras.length) {
    // Fim do grupo de vogais.
    while (i < letras.length && VOGAL.test(letras[i])) i++;
    const inicio = i;
    while (i < letras.length && !VOGAL.test(letras[i]) && /\p{L}/u.test(letras[i])) i++;
    if (i >= letras.length || !/\p{L}/u.test(letras[i] ?? "")) break; // consoantes finais ficam na última sílaba
    const consoantes = letras.slice(inicio, i).join("").toLowerCase();
    if (consoantes.length === 0) continue;
    if (consoantes.length === 1) pontos.push(inicio);
    else {
      const fim = consoantes.slice(-2);
      // "qu" e "gu" antes de vogal: o u é vogal aqui, então não chegam a este ponto.
      pontos.push(ENCONTROS.has(fim) ? i - 2 : i - 1);
    }
  }
  // Ao menos duas letras antes da divisão e três depois (regra de tipografia).
  return pontos.filter((p) => p >= 2 && letras.length - p >= 3);
}

/** As sílabas da palavra, só para conferência ("bra-si-lei-ro" vira ["bra", "si", "lei", "ro"] quando dá). */
export function silabas(palavra: string): string[] {
  const letras = [...palavra];
  const pontos = pontosDeDivisao(palavra);
  const saida: string[] = [];
  let anterior = 0;
  for (const p of pontos) {
    saida.push(letras.slice(anterior, p).join(""));
    anterior = p;
  }
  saida.push(letras.slice(anterior).join(""));
  return saida;
}

/**
 * Corta a palavra no maior pedaço que cabe na largura (com o hífen), se houver ponto de divisão.
 * Devolve o pedaço de cima (com hífen) e o resto, ou null.
 */
export function hifenizar(palavra: string, cabe: (pedaco: string) => boolean): [string, string] | null {
  const letras = [...palavra];
  // Só divide a parte das letras (pontuação no fim fica com o resto).
  const pontos = pontosDeDivisao(palavra).sort((a, b) => b - a);
  for (const p of pontos) {
    const cima = `${letras.slice(0, p).join("")}-`;
    if (cabe(cima)) return [cima, letras.slice(p).join("")];
  }
  return null;
}
