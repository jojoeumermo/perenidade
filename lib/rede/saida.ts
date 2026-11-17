// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Sair rápido" da Alumia (antes dentro de components/rede/Casca.tsx; PLANO-ALUMIA F0, dono depois: F6). Encerra a sessão da
// conta, apaga o que a Alumia guardou neste aparelho e vai para uma página neutra de fora (DESTINO_DA_SAIDA). As frentes acrescentam a limpeza delas pelo encaixe aoSairRapido
// (components/rede/encaixes.tsx): a F7 apaga o chaveiro do chat, a F6 o modo ato, a F5 os rascunhos de story…
// Sem "@/" de propósito: as funções puras rodam no Node nos testes.
import { DESTINO_NEUTRO, registrarLimpezaDaSaida, revogarSessao, sairRapido as sairDoSite } from "../modo-seguro";

/**
 * Para onde o "Sair rápido" leva: a mesma página comum, DE FORA, do modo seguro do site (lib/modo-seguro.ts; a previsão do tempo,
 * sem nada da pessoa no endereço). A página inicial do Instituto não serve: tem "Alumia" no menu e na barra de baixo, e quem
 * olha por cima do ombro veria a ligação com a rede.
 */
export const DESTINO_DA_SAIDA = DESTINO_NEUTRO;

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

/** A chave da sessão da conta no armazenamento do navegador (lib/storage.ts, KEYS.session). O "Sair rápido" apaga junto (pedido P17). */
export const CHAVE_DA_SESSAO = "lucia:sessao";

/**
 * As chaves da SESSÃO da conta neste aparelho (lib/storage.ts: a sessão, o primeiro nome e o rosto do cabeçalho). O "Sair
 * rápido" apaga todas: sem isso, quem pega o aparelho depois abre a Alumia já dentro da conta, ou vê o nome de quem estava.
 */
export const CHAVES_DA_SESSAO = [CHAVE_DA_SESSAO, "lucia:nome", "lucia:avatar"] as const;
/** A sessão no nome padrão do Supabase (sb-<projeto>-auth-token, e os pedaços dela), caso algum dia exista neste aparelho. */
const SESSAO_DO_SUPABASE = /^sb-.+-auth-token/;
const daSessao = (chave: string) => (CHAVES_DA_SESSAO as readonly string[]).includes(chave) || SESSAO_DO_SUPABASE.test(chave);

/** Apaga deste aparelho as chaves da sessão da conta e devolve quantas apagou. Nunca lança. */
export function apagarChavesDaSessao(armazens: readonly (Armazem | null | undefined)[]): number {
  let apagadas = 0;
  for (const armazem of armazens) {
    if (!armazem) continue;
    try {
      const chaves: string[] = [];
      for (let i = 0; i < armazem.length; i++) {
        const chave = armazem.key(i);
        if (chave && daSessao(chave)) chaves.push(chave);
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

/**
 * Sai rápido: encerra a sessão da conta (no servidor e no aparelho, como a saída do site faz; pedido P17: quem pega o aparelho
 * não abre a Alumia já dentro da conta), apaga as chaves da Alumia, roda as limpezas dos encaixes (até 0,8 s) e troca a página por
 * `destino` (replace: o botão "voltar" do navegador não traz a Alumia de volta). Só no navegador.
 */
export async function sairRapido(destino: string, limpezas: readonly LimpezaAoSair[] = []): Promise<void> {
  let local: Storage | null = null;
  let armazens: (Armazem | null)[] = [];
  try {
    local = window.localStorage;
    armazens = [local, window.sessionStorage];
  } catch {
    armazens = [];
  }
  // O pedido de saída lê o token guardado: sai ANTES de a chave ser apagada.
  revogarSessao(local);
  apagarChavesDaRede(armazens);
  apagarChavesDaSessao(armazens);
  await rodarLimpezas(limpezas);
  // Segunda passada: uma renovação da sessão que estava no caminho pode ter regravado a chave durante as limpezas.
  apagarChavesDaSessao(armazens);
  window.location.replace(destino);
}

/**
 * Espera uma promessa por no máximo `limiteMs` e diz se ela terminou bem a tempo. Nunca lança (o pânico segue mesmo sem rede).
 */
export async function comTeto(promessa: Promise<unknown>, limiteMs: number): Promise<boolean> {
  let teto: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promessa.then(() => true, () => false),
      new Promise<boolean>((pronto) => {
        teto = setTimeout(() => pronto(false), limiteMs);
      }),
    ]);
  } finally {
    if (teto) clearTimeout(teto);
  }
}

/**
 * O botão de pânico (Ajustes de segurança da Alumia): o "Sair rápido" completo. Primeiro pede ao servidor para desconectar TODOS
 * os aparelhos da conta (e esconder o perfil, se a pessoa marcou), com um teto de 2,5 s; depois faz a saída do site inteiro
 * (lib/modo-seguro.ts: apaga todas as chaves "lucia*", as bases locais, os caches de páginas, roda as limpezas registradas, como
 * o chaveiro do chat, e as dos encaixes da Alumia) e troca a página pela página neutra. Sem rede, a saída do aparelho acontece
 * do mesmo jeito. Só no navegador.
 */
export async function sairDeTudo(desconectarTudo: () => Promise<unknown>, limpezas: readonly LimpezaAoSair[] = []): Promise<void> {
  await comTeto(desconectarTudo(), 2500);
  // A saída do site apaga toda chave "lucia*" (as da Alumia, "lucia:rede…", e a sessão, "lucia:sessao", vão junto).
  const tirar = registrarLimpezaDaSaida(() => rodarLimpezas(limpezas));
  await sairDoSite(DESTINO_DA_SAIDA);
  tirar();
}
