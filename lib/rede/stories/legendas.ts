// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As legendas do vídeo do story e a divisão do vídeo longo em partes. Puro (sem DOM), para o teste rodar no Node.
// A legenda é a acessibilidade do vídeo para pessoas surdas e para quem vê com o som desligado: a autora escreve (ou gera no
// aparelho, quando o navegador reconhece a fala SEM mandar o áudio para fora) e aprova cada trecho antes de publicar.
import { LIMITES_DO_STORY, type LegendaDoVideo } from "../tipos-stories";

/** O máximo de um story de vídeo (o banco aceita até 60,5 s, por causa do arredondamento do gravador). */
export const PARTE_MAXIMA = 60_000;
const FOLGA = 500;
/** Sobra menor que isto vai junto da parte anterior (sem story de meio segundo). */
const SOBRA_MINIMA = 1000;

/** Limpa as legendas: tira as vazias e as de tempo invertido, corta no fim do vídeo, ordena e aplica os limites do banco. */
export function limparLegendas(lista: readonly LegendaDoVideo[], duracao: number): LegendaDoVideo[] {
  const fim = Math.max(0, Math.round(duracao));
  return lista
    .map((l) => ({
      de: Math.max(0, Math.round(Number(l.de) || 0)),
      ate: Math.min(fim, Math.round(Number(l.ate) || 0)),
      texto: String(l.texto ?? "").replace(/\s+/g, " ").trim().slice(0, LIMITES_DO_STORY.legendaDoVideo),
      ...(l.grande ? { grande: true } : {}),
    }))
    .filter((l) => l.texto && l.ate > l.de)
    .sort((a, b) => a.de - b.de)
    .slice(0, LIMITES_DO_STORY.legendas);
}

/** A legenda que aparece no tempo `ms` (a última que começou, se ainda não acabou), ou nula. */
export function legendaNoTempo(lista: readonly LegendaDoVideo[] | null | undefined, ms: number): LegendaDoVideo | null {
  let achada: LegendaDoVideo | null = null;
  for (const l of lista ?? []) if (ms >= l.de && ms < l.ate) achada = l;
  return achada;
}

/** As legendas de um trecho [inicio, fim) do vídeo, com o tempo contado a partir do início do trecho. */
export function legendasDoTrecho(lista: readonly LegendaDoVideo[], inicio: number, fim: number): LegendaDoVideo[] {
  return lista
    .filter((l) => l.ate > inicio && l.de < fim)
    .map((l) => ({ ...l, de: Math.max(0, l.de - inicio), ate: Math.min(fim, l.ate) - inicio }));
}

/** Divide um vídeo longo em partes de até 60 s (cada uma vira um story, na ordem). */
export function partesDoVideo(duracao: number): { inicio: number; fim: number }[] {
  const total = Math.max(0, Math.round(duracao));
  if (total <= PARTE_MAXIMA + FOLGA) return [{ inicio: 0, fim: total }];
  const partes: { inicio: number; fim: number }[] = [];
  for (let inicio = 0; inicio < total; inicio += PARTE_MAXIMA) partes.push({ inicio, fim: Math.min(total, inicio + PARTE_MAXIMA) });
  const ultima = partes[partes.length - 1];
  if (partes.length > 1 && ultima.fim - ultima.inicio < SOBRA_MINIMA && ultima.fim - partes[partes.length - 2].inicio <= PARTE_MAXIMA + FOLGA) {
    partes.pop();
    partes[partes.length - 1].fim = total;
  }
  return partes;
}

/** "0:03" para o tempo da legenda (leitor de tela e a lista do editor). */
export function tempoCurto(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
