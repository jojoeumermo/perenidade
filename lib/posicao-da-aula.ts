// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Retomar exatamente (Etapa 4, R1-18): onde a pessoa parou dentro de cada aula, guardado só neste navegador, na chave
// "lucia:posicao-da-aula" (que entra na cópia de segurança de Meus dados, lib/estudo.ts). Nada vai para o servidor.
// Guarda no máximo 100 aulas: ao passar disso, sai a mais antiga. Sem os atalhos "@/": `npm run testar:aula-viva` roda
// este arquivo direto no Node.

export const CHAVE_POSICAO = "lucia:posicao-da-aula";
export const MAX_AULAS = 100;
/** Aviso da página para components/aula/Fatias.tsx mostrar uma parte (o "Voltar para onde parou" no modo uma parte por vez). */
export const IR_PARA_PARTE = "lucia:ir-para-parte";

export interface Ponto {
  /** A parte da aula (0 = a primeira), em components/aula/Fatias.tsx. */
  parte: number;
  /** O bloco do texto (data-p do Markdown, contando do 0). */
  paragrafo: number;
  /** O trecho do "Ouvir a aula" (lib/vozes/leitor.ts), se a pessoa estava ouvindo; senão, -1. */
  trecho: number;
  /** Quando foi guardado (milissegundos desde 1970). */
  em: number;
}

const inteiro = (v: unknown, minimo: number) => typeof v === "number" && Number.isInteger(v) && v >= minimo && v < 100_000;

/** Confere a forma de um ponto lido do armazenamento (pode ter sido mexido à mão ou vir de uma cópia antiga). */
export function pontoValido(v: unknown): v is Ponto {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const p = v as Record<string, unknown>;
  return inteiro(p.parte, 0) && inteiro(p.paragrafo, 0) && inteiro(p.trecho, -1) && typeof p.em === "number" && Number.isFinite(p.em) && p.em > 0;
}

/** Todas as posições guardadas, só as que têm a forma certa. */
export function lerPosicoes(): Record<string, Ponto> {
  let bruto: unknown;
  try {
    bruto = JSON.parse(globalThis.localStorage?.getItem(CHAVE_POSICAO) ?? "{}");
  } catch {
    return {};
  }
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) return {};
  const saida: Record<string, Ponto> = {};
  for (const [aula, ponto] of Object.entries(bruto)) if (aula.length <= 200 && pontoValido(ponto)) saida[aula] = ponto;
  return saida;
}

function gravar(posicoes: Record<string, Ponto>) {
  try {
    globalThis.localStorage?.setItem(CHAVE_POSICAO, JSON.stringify(posicoes));
  } catch {
    // sem armazenamento (aba anônima cheia, bloqueio): a posição vale só até fechar a página
  }
}

/** Guarda onde a pessoa está na aula. Passando de 100 aulas, as mais antigas saem. */
export function gravarPonto(aula: string, ponto: Omit<Ponto, "em"> & { em?: number }): Ponto | null {
  const novo: Ponto = { parte: ponto.parte, paragrafo: ponto.paragrafo, trecho: ponto.trecho, em: ponto.em ?? Date.now() };
  if (!aula || aula.length > 200 || !pontoValido(novo)) return null;
  const posicoes = lerPosicoes();
  posicoes[aula] = novo;
  const aulas = Object.keys(posicoes);
  if (aulas.length > MAX_AULAS) {
    aulas.sort((a, b) => posicoes[a].em - posicoes[b].em);
    for (const velha of aulas.slice(0, aulas.length - MAX_AULAS)) delete posicoes[velha];
  }
  gravar(posicoes);
  return novo;
}

/** Onde a pessoa parou nesta aula, ou null. */
export function pontoDaAula(aula: string): Ponto | null {
  return lerPosicoes()[aula] ?? null;
}

export function apagarPonto(aula: string) {
  const posicoes = lerPosicoes();
  if (!(aula in posicoes)) return;
  delete posicoes[aula];
  gravar(posicoes);
}

/**
 * O endereço que leva ao ponto: o caminho da aula com o parágrafo na âncora ("#p-12"). Só a âncora: nada da posição vai
 * para o servidor. Quem abre o link escolheu ir até lá; a aula aberta sem âncora nunca pula sozinha.
 */
export function linkDoPonto(caminho: string, ponto: Pick<Ponto, "paragrafo"> | null): string {
  const base = caminho.split("#")[0];
  return ponto && inteiro(ponto.paragrafo, 0) ? `${base}#p-${ponto.paragrafo}` : base;
}
