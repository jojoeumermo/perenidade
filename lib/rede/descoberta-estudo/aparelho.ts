// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que o lote descoberta e estudo (Prompt 4) guarda NESTE aparelho: chaves "lucia:p4-de:…" no localStorage, que o Sair rápido
// apaga (lib/modo-seguro.ts apaga toda chave que começa com "lucia"). Nada daqui vai ao servidor. Sem "@/" de propósito (roda nos testes).

/** O mínimo de um localStorage (os testes passam um de mentira). */
export interface Guarda {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

export const PREFIXO = "lucia:p4-de:";

function guarda(g?: Guarda | null): Guarda | null {
  if (g !== undefined) return g;
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Lê um valor guardado (JSON), ou nulo. */
export function lerDoAparelho<X>(nome: string, g?: Guarda | null): X | null {
  try {
    const bruto = guarda(g)?.getItem(PREFIXO + nome);
    return bruto ? (JSON.parse(bruto) as X) : null;
  } catch {
    return null;
  }
}

/** Grava (ou apaga, com nulo) um valor. Sem espaço ou em modo privado: vale só enquanto a página estiver aberta. */
export function gravarNoAparelho(nome: string, valor: unknown, g?: Guarda | null): void {
  try {
    const onde = guarda(g);
    if (!onde) return;
    if (valor === null || valor === undefined) onde.removeItem(PREFIXO + nome);
    else onde.setItem(PREFIXO + nome, JSON.stringify(valor));
  } catch {
    // sem armazenamento: nada a fazer
  }
}

/** Um evento da janela para as peças da mesma aba saberem que algo mudou no aparelho. */
export const EVENTO_DE = "lucia:p4-de";
export function avisarMudanca(): void {
  try {
    window.dispatchEvent(new Event(EVENTO_DE));
  } catch {
    // sem janela
  }
}

/** Um identificador sorteado (para itens guardados no aparelho), pelo gerador seguro do navegador. */
export function idNovo(): string {
  const b = new Uint8Array(8);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
