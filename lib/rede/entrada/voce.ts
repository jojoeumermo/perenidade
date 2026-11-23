// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O último painel da parede da entrada: o de quem está chegando. Ele nasce vazio e, quando a pessoa escreve o codinome (ou entra
// com uma conta que já tem um), forma o desenho dela em ladrilhos: o mesmo desenho que a rede usa no rosto de cada perfil
// (P5, A2: um símbolo ou um rosto montado de peças, lib/rede/desenhos.ts; antes eram 16 cartões ao acaso). Quem escolheu mostrar a própria foto vê a foto se formar no lugar.
//
// Lógica pura (roda no navegador e nos testes; sem "@/" de propósito). NADA daqui vai ao servidor: o painel é desenhado no
// aparelho, a partir do que a pessoa digitou ou do arquivo que ela escolheu, e ninguém mais o vê.
import { coresDoDesenho, LADO_DO_DESENHO } from "../desenhos";
import { gerador, sementeDe } from "../mosaico";

/** A grade do painel: 12 colunas × 16 linhas (retrato 3:4, como as silhuetas). No computador cada casa vale 2 × 2 ladrilhos. */
export const COLUNAS_DO_PAINEL = 12;
export const LINHAS_DO_PAINEL = 16;

const NOITE = "#141211";
const BRASA = "#5a120b";
const SUPERFICIE = "#2a2622";

/**
 * O codinome como a rede o lê para desenhar o rosto: minúsculas, sem acento, só letras, números e "_". Dois jeitos de escrever
 * o mesmo codinome ("Faísca", "faisca ") dão o mesmo desenho. Vazio quando não sobra nada.
 */
export function sementeDoCodinome(codinome: string): string {
  return codinome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "")
    .slice(0, 30);
}

/**
 * As cores do desenho de um codinome (12 × 12, linha por linha): o mesmo do rosto da rede (Avatar16). Sem codinome que sirva, um
 * quadro cinza.
 */
export function coresDoRosto(codinome: string): string[] {
  const semente = sementeDoCodinome(codinome);
  if (!semente) return Array.from({ length: LADO_DO_DESENHO * LADO_DO_DESENHO }, () => SUPERFICIE);
  return coresDoDesenho(semente);
}

/** O painel vazio: noite com umas poucas brasas, sempre as mesmas (a semente é fixa: nada de sorteio a cada visita). */
export function painelVazio(): string[] {
  const sorte = gerador(sementeDe("entrada:voce"));
  return Array.from({ length: COLUNAS_DO_PAINEL * LINHAS_DO_PAINEL }, () => (sorte() < 0.08 ? BRASA : NOITE));
}

/**
 * O painel com o desenho do codinome: os 12 × 12 ladrilhos do desenho no meio do retrato (uma casa por ladrilho), com a moldura
 * de noite e brasas em cima e embaixo. Sem codinome que sirva, devolve o painel vazio.
 */
export function painelDoCodinome(codinome: string): string[] {
  const casas = painelVazio();
  if (!sementeDoCodinome(codinome)) return casas;
  const rosto = coresDoRosto(codinome);
  const topo = (LINHAS_DO_PAINEL - LADO_DO_DESENHO) / 2;
  for (let y = 0; y < LADO_DO_DESENHO; y++) {
    for (let x = 0; x < LADO_DO_DESENHO; x++) {
      casas[(topo + y) * COLUNAS_DO_PAINEL + x] = rosto[y * LADO_DO_DESENHO + x];
    }
  }
  return casas;
}

/**
 * O painel a partir dos pontos de uma foto já reduzida para 12 × 16 (RGBA, como vem do canvas): uma cor por casa. Serve só à
 * animação dos ladrilhos; a foto mesma aparece por baixo, no aparelho, quando eles terminam de assentar.
 */
export function painelDaFoto(rgba: ArrayLike<number>): string[] {
  const total = COLUNAS_DO_PAINEL * LINHAS_DO_PAINEL;
  if (rgba.length < total * 4) return painelVazio();
  const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return Array.from({ length: total }, (_, i) => `#${hex(rgba[i * 4])}${hex(rgba[i * 4 + 1])}${hex(rgba[i * 4 + 2])}`);
}

/**
 * Quando cada casa assenta (0 a 1): de cima para baixo, com um tanto de acaso para não parecer cortina. Sai da semente
 * (o codinome), então o mesmo codinome assenta sempre do mesmo jeito.
 */
export function atrasosDoPainel(semente: string): number[] {
  const sorte = gerador(sementeDe(`assenta:${semente}`));
  return Array.from({ length: COLUNAS_DO_PAINEL * LINHAS_DO_PAINEL }, (_, i) => {
    const linha = Math.floor(i / COLUNAS_DO_PAINEL) / (LINHAS_DO_PAINEL - 1);
    return Math.min(1, linha * 0.45 + sorte() * 0.55);
  });
}
