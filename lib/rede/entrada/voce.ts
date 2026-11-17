// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O último painel da parede da entrada: o de quem está chegando. Ele nasce vazio e, quando a pessoa escreve o codinome (ou entra
// com uma conta que já tem um), forma o rosto em mosaico dela: o mesmo desenho de 16 cartões que a rede usa (celulasDoAvatar),
// ampliado em ladrilhos. Quem escolheu mostrar a própria foto vê a foto se formar no lugar.
//
// Lógica pura (roda no navegador e nos testes; sem "@/" de propósito). NADA daqui vai ao servidor: o painel é desenhado no
// aparelho, a partir do que a pessoa digitou ou do arquivo que ela escolheu, e ninguém mais o vê.
import { celulasDoAvatar, gerador, sementeDe } from "../mosaico";

/** A grade do painel: 12 colunas × 16 linhas (retrato 3:4, como as silhuetas). No computador cada casa vale 2 × 2 ladrilhos. */
export const COLUNAS_DO_PAINEL = 12;
export const LINHAS_DO_PAINEL = 16;

const NOITE = "#141211";
const BRASA = "#5a120b";
const CREME = "#f3efe6";
const VERMELHO = "#e8321f";
const SUPERFICIE = "#2a2622";
/** As cinco cores de comunidade da Alumia (styles/alumia-tokens.css, --al-com-1 a 5): a "cor própria" do rosto sai do codinome. */
const PROPRIAS = ["#1fc2b5", "#ff5c8a", "#ff8a1f", "#5b8cff", "#a27bff"] as const;

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

/** As cores do rosto de 16 cartões (4 × 4) de um codinome, na ordem das linhas. Mesma regra do Avatar16 da rede. */
export function coresDoRosto(codinome: string): string[] {
  const semente = sementeDoCodinome(codinome);
  if (!semente) return Array.from({ length: 16 }, () => SUPERFICIE);
  const celulas = celulasDoAvatar(semente);
  const propria = PROPRIAS[celulas.reduce<number>((s, c, i) => s + c * (i + 1), 0) % 5];
  return celulas.map((c) => (c === 0 ? NOITE : c === 1 ? CREME : c === 2 ? propria : c === 3 ? VERMELHO : SUPERFICIE));
}

/** O painel vazio: noite com umas poucas brasas, sempre as mesmas (a semente é fixa: nada de sorteio a cada visita). */
export function painelVazio(): string[] {
  const sorte = gerador(sementeDe("entrada:voce"));
  return Array.from({ length: COLUNAS_DO_PAINEL * LINHAS_DO_PAINEL }, () => (sorte() < 0.08 ? BRASA : NOITE));
}

/**
 * O painel com o rosto do codinome: os 16 cartões ampliados (cada cartão vira 3 × 3 casas) no meio do retrato, com a moldura
 * de noite e brasas em cima e embaixo. Sem codinome que sirva, devolve o painel vazio.
 */
export function painelDoCodinome(codinome: string): string[] {
  const casas = painelVazio();
  if (!sementeDoCodinome(codinome)) return casas;
  const rosto = coresDoRosto(codinome);
  const topo = (LINHAS_DO_PAINEL - 12) / 2;
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      casas[(topo + y) * COLUNAS_DO_PAINEL + x] = rosto[Math.floor(y / 3) * 4 + Math.floor(x / 3)];
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
