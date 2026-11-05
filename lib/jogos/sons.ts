// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os dados dos jogos sonoros das crianças. Os sons são sintetizados no navegador (WebAudio, components/jogos/audio.ts):
// nenhum arquivo de som de terceiros. Aqui só ficam as notas, as batidas e a lógica da melodia, para o teste conferir.
import type { Sorteio } from "./base";

/** Frequência em Hz de uma nota, em afinação igual temperada com o lá central (A4) em 440 Hz: f = 440 · 2^((n − 69) / 12), n = número MIDI. */
export const frequenciaMidi = (n: number): number => 440 * 2 ** ((n - 69) / 12);

export interface Tecla {
  id: string;
  nome: string;
  midi: number;
  cor: string;
  bicho: string;
  tecla: string;
}

/** Escala pentatônica de dó maior (dó, ré, mi, sol, lá, dó): qualquer ordem de notas soa bem, então não há nota "errada" ao brincar. */
export const TECLAS: Tecla[] = [
  { id: "do", nome: "Dó", midi: 60, cor: "#E5484D", bicho: "🐞", tecla: "a" },
  { id: "re", nome: "Ré", midi: 62, cor: "#F2994A", bicho: "🦊", tecla: "s" },
  { id: "mi", nome: "Mi", midi: 64, cor: "#F2C94C", bicho: "🐥", tecla: "d" },
  { id: "sol", nome: "Sol", midi: 67, cor: "#4CAF6A", bicho: "🐸", tecla: "f" },
  { id: "la", nome: "Lá", midi: 69, cor: "#3B82C4", bicho: "🐳", tecla: "g" },
  { id: "do2", nome: "Dó agudo", midi: 72, cor: "#8B5CF6", bicho: "🦋", tecla: "h" },
];

export type Batida = "bumbo" | "caixa" | "chimbal" | "palma";
export const BATIDAS: { id: Batida; nome: string; cor: string; desenho: string; tecla: string }[] = [
  { id: "bumbo", nome: "Bumbo", cor: "#E5484D", desenho: "🥁", tecla: "a" },
  { id: "caixa", nome: "Caixa", cor: "#F2994A", desenho: "🪘", tecla: "s" },
  { id: "chimbal", nome: "Chimbal", cor: "#F2C94C", desenho: "🔔", tecla: "d" },
  { id: "palma", nome: "Palma", cor: "#4CAF6A", desenho: "👏", tecla: "f" },
];

/** Uma batida pronta de 8 passos (1 = toca), para a criança ouvir e acompanhar. */
export const RITMO_PRONTO: Record<Batida, number[]> = {
  bumbo: [1, 0, 0, 0, 1, 0, 0, 0],
  caixa: [0, 0, 1, 0, 0, 0, 1, 0],
  chimbal: [1, 1, 1, 1, 1, 1, 1, 1],
  palma: [0, 0, 0, 1, 0, 0, 0, 1],
};

/** A melodia da rodada: `tamanho` teclas sorteadas (pode repetir). */
export function sortearMelodia(tamanho: number, rnd: Sorteio, notas = TECLAS.length): number[] {
  return Array.from({ length: tamanho }, () => Math.floor(rnd() * notas));
}

/** Rodadas do "Repita a melodia": começa com 2 notas e termina em 5. Termina, sem pontos: o jogo não é feito para prender. */
export const RODADAS_DA_MELODIA = [2, 3, 4, 5];

/** A melodia está certa até aqui? E já terminou? */
export function conferirMelodia(certa: readonly number[], tocadas: readonly number[]): "errou" | "continua" | "completa" {
  for (let i = 0; i < tocadas.length; i++) if (tocadas[i] !== certa[i]) return "errou";
  return tocadas.length === certa.length ? "completa" : "continua";
}

/** Pares do "Qual som é igual?": cada nota duas vezes, embaralhadas por quem chama. */
export const paresDeSons = (quantos: number): number[] => TECLAS.slice(0, quantos).flatMap((_, i) => [i, i]);
