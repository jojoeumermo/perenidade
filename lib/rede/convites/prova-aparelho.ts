// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do aparelho da prova de trabalho (lib/rede/convites/prova.ts): procura, com o SHA-256 da Web Crypto do próprio
// navegador, um número que junto do desafio dê o resumo com os bits zero pedidos. Nada vai a serviço de fora; nada é guardado.
// Roda em lotes (as contas de cada lote em paralelo) e devolve a vez à página entre um lote e outro, para a tela não travar.
// Sem os atalhos "@/" de propósito: `npm run testar:alumia-o8-porta` roda este arquivo direto no Node (que tem a mesma Web Crypto).
import { textoDaTentativa, zerosIniciais } from "./prova";

const LOTE = 256;

export interface OpcoesDaProva {
  /** Para parar no meio (a pessoa saiu da tela). */
  sinal?: AbortSignal;
  /** A cada lote: quantas tentativas já foram e quantas se espera em média (2^dificuldade). */
  aoAvancar?: (feitas: number, esperadas: number) => void;
}

/** Resolve o desafio: devolve a resposta (um número em base 36). */
export async function resolverDesafio(desafio: string, dificuldade: number, opcoes: OpcoesDaProva = {}): Promise<string> {
  const sutil = globalThis.crypto?.subtle;
  if (!sutil) throw new Error("sem_web_crypto");
  const codificar = new TextEncoder();
  const esperadas = 2 ** dificuldade;
  for (let inicio = 0; ; inicio += LOTE) {
    if (opcoes.sinal?.aborted) throw new DOMException("parou", "AbortError");
    const respostas = Array.from({ length: LOTE }, (_, i) => (inicio + i).toString(36));
    const resumos = await Promise.all(respostas.map((r) => sutil.digest("SHA-256", codificar.encode(textoDaTentativa(desafio, r)))));
    for (let i = 0; i < resumos.length; i++) {
      if (zerosIniciais(new Uint8Array(resumos[i])) >= dificuldade) return respostas[i];
    }
    opcoes.aoAvancar?.(inicio + LOTE, esperadas);
    // A vez volta à página entre um lote e outro (o leitor de tela e o "Cancelar" continuam respondendo).
    if ((inicio / LOTE) % 16 === 15) await new Promise((r) => setTimeout(r, 0));
  }
}
