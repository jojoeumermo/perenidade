// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Sair rápido" da Alumia (antes dentro de components/rede/Casca.tsx; PLANO-ALUMIA F0, dono depois: F6). Encerra a sessão da
// conta, apaga o que a Alumia guardou neste aparelho e vai para uma página neutra de fora (DESTINO_DA_SAIDA). As frentes acrescentam a limpeza delas pelo encaixe aoSairRapido
// (components/rede/encaixes.tsx): a F7 apaga o chaveiro do chat, a F6 o modo ato, a F5 os rascunhos de story…
// Sem "@/" de propósito: as funções puras rodam no Node nos testes.
import { DESTINO_NEUTRO, revogarSessao } from "../modo-seguro";

/**
 * Para onde o "Sair rápido" leva: a mesma página comum, DE FORA, do modo seguro do site (lib/modo-seguro.ts; a previsão do tempo,
 * sem nada da pessoa no endereço). A página inicial do Instituto não serve: tem "Alumia" no menu e na barra de baixo, e quem
 * olha por cima do ombro veria a ligação com a rede.
 */
export const DESTINO_DA_SAIDA = DESTINO_NEUTRO;

/** O prefixo das chaves que a Alumia grava no armazenamento do navegador (localStorage e sessionStorage). */
export const PREFIXO_DA_REDE = "lucia:rede";

/**
 * As chaves da SESSÃO da conta neste aparelho (lib/storage.ts: sessão, primeiro nome e rosto do cabeçalho). O "Sair rápido"
 * também as apaga: sem isso, quem pega o aparelho depois abre a Alumia já dentro da conta.
 */
export const CHAVES_DA_SESSAO = ["lucia:sessao", "lucia:nome", "lucia:avatar"] as const;
/** A sessão no nome padrão do Supabase (sb-<projeto>-auth-token), caso algum dia exista. */
const SESSAO_DO_SUPABASE = /^sb-.*-auth-token/;

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

/** Apaga deste aparelho as chaves da sessão da conta e devolve quantas apagou. Nunca lança. */
export function apagarChavesDaSessao(armazens: readonly (Armazem | null | undefined)[]): number {
  let apagadas = 0;
  for (const armazem of armazens) {
    if (!armazem) continue;
    try {
      const chaves: string[] = [];
      for (let i = 0; i < armazem.length; i++) {
        const chave = armazem.key(i);
        if (chave && ((CHAVES_DA_SESSAO as readonly string[]).includes(chave) || SESSAO_DO_SUPABASE.test(chave))) chaves.push(chave);
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
 * Sai rápido: ENCERRA A SESSÃO da conta (no servidor, com o mesmo pedido da saída do site, e neste aparelho), apaga as chaves
 * da Alumia, roda as limpezas dos encaixes (até 0,8 s) e troca a página por `destino` (replace: o botão "voltar" do navegador
 * não traz a Alumia de volta). Quem pega o aparelho depois não abre a Alumia dentro da conta. Só no navegador.
 */
export async function sairRapido(destino: string, limpezas: readonly LimpezaAoSair[] = []): Promise<void> {
  let armazens: (Armazem | null)[] = [];
  try {
    armazens = [window.localStorage, window.sessionStorage];
  } catch {
    armazens = [];
  }
  // A revogação lê o token guardado: vem antes de apagar as chaves.
  try {
    revogarSessao(window.localStorage);
  } catch {
    // armazenamento bloqueado: não há sessão guardada para revogar
  }
  apagarChavesDaSessao(armazens);
  apagarChavesDaRede(armazens);
  await rodarLimpezas(limpezas);
  // Uma renovação da sessão que estivesse no caminho pode ter regravado a chave durante as limpezas: apaga de novo.
  apagarChavesDaSessao(armazens);
  window.location.replace(destino);
}
