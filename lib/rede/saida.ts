// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Sair rápido" da Alumia (antes dentro de components/rede/Casca.tsx; PLANO-ALUMIA F0, dono depois: F6). Apaga o que a Alumia
// guardou neste aparelho e vai para uma página neutra do site. As frentes acrescentam a limpeza delas pelo encaixe aoSairRapido
// (components/rede/encaixes.tsx): a F7 apaga o chaveiro do chat, a F6 o modo ato, a F5 os rascunhos de story…
// Sem "@/" de propósito: as funções puras rodam no Node nos testes.

/** O prefixo das chaves que a Alumia grava no armazenamento do navegador (localStorage e sessionStorage). */
export const PREFIXO_DA_REDE = "lucia:rede";

/** O mínimo de um armazenamento (localStorage, sessionStorage, ou um falso nos testes). */
export interface Armazem {
  readonly length: number;
  key(i: number): string | null;
  removeItem(chave: string): void;
}

/** Apaga as chaves da Alumia de cada armazenamento e devolve quantas apagou. Nunca lança: armazenamento bloqueado conta como vazio. */
export function apagarChavesDaRede(armazens: readonly (Armazem | null | undefined)[]): number {
  let apagadas = 0;
  for (const armazem of armazens) {
    if (!armazem) continue;
    try {
      const chaves: string[] = [];
      for (let i = 0; i < armazem.length; i++) {
        const chave = armazem.key(i);
        if (chave && chave.startsWith(PREFIXO_DA_REDE)) chaves.push(chave);
      }
      for (const chave of chaves) {
        armazem.removeItem(chave);
        apagadas++;
      }
    } catch {
      // sem acesso ao armazenamento: nada para apagar
    }
  }
  return apagadas;
}

/** Uma limpeza extra (de um encaixe): pode ser assíncrona, mas nunca segura a saída por mais que `limiteMs`. */
export type LimpezaAoSair = () => void | Promise<void>;

/** Roda as limpezas extras em paralelo, com um teto de tempo (a pessoa precisa sair JÁ). Erros de uma não param as outras. */
export async function rodarLimpezas(limpezas: readonly LimpezaAoSair[], limiteMs = 800): Promise<void> {
  if (limpezas.length === 0) return;
  const todas = Promise.allSettled(
    limpezas.map(async (limpar) => {
      await limpar();
    }),
  );
  await Promise.race([todas, new Promise<void>((pronto) => setTimeout(pronto, limiteMs))]);
}

/**
 * Sai rápido: apaga as chaves da Alumia, roda as limpezas dos encaixes (até 0,8 s) e troca a página por `destino` (replace: o
 * botão "voltar" do navegador não traz a Alumia de volta). Só no navegador.
 */
export async function sairRapido(destino: string, limpezas: readonly LimpezaAoSair[] = []): Promise<void> {
  let armazens: (Armazem | null)[] = [];
  try {
    armazens = [window.localStorage, window.sessionStorage];
  } catch {
    armazens = [];
  }
  apagarChavesDaRede(armazens);
  await rodarLimpezas(limpezas);
  window.location.replace(destino);
}
