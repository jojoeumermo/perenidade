// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O adaptador da mixnet da Nym (onda R3, item 2.1), PREPARADO E DESLIGADO. Documento: docs/rede/CHAT-PRIVADO.md ("Por onde as
// mensagens passam").
//
// Por que a Nym: rede compartilhada com o mundo (a multidão é maior que a da Alumia), modelo Loopix (atraso exponencial por nó,
// cobertura em laço e em queda), cliente para navegador e WebView (`@nymproject/mix-fetch`, Apache-2.0). O Katzenpost (AGPL-3.0,
// pós-quântico, autohospedável) fica como plano B atrás do mesmo contrato: exigiria uma rede própria (multidão pequena) e um processo
// nativo ao lado (não há cliente de navegador).
//
// Este arquivo NÃO importa o pacote da Nym (18 MB de WebAssembly que entrariam no build sem uso). O `fetch` da mixnet chega
// INJETADO (`ligarMixnet`), ou pelo módulo do pacote (`ligarNym`), por um arquivo pequeno que só existe quando a mixnet for ligada
// (o roteiro de ligar fica fora do repositório). Sem isso, `mixnetLigada()` é falso e as caixas usam outra via (lib/rede/caixas/vias.ts).
//
// Sem "@/" de propósito.
import { CABECALHOS_PELA_MIXNET, OPCOES_DO_NYM } from "./parametros";

let fetchDaMixnet: typeof fetch | null = null;

/** A mixnet foi configurada para esta versão do site/app? (NEXT_PUBLIC_ALUMIA_MIXNET = "nym"; vazio = desligada.) */
export const mixnetConfigurada = (): boolean => process.env.NEXT_PUBLIC_ALUMIA_MIXNET === "nym";

/**
 * Liga a mixnet com um `fetch` que sai por ela. Todo pedido leva os cabeçalhos fixos dos apps (o pacote da Nym poria os de um
 * navegador): quem olha o pedido no nosso servidor não distingue por eles de que aparelho veio.
 */
export function ligarMixnet(mixFetch: (url: string, init?: RequestInit) => Promise<Response>): void {
  fetchDaMixnet = (entrada, init) => {
    const url = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    const cabecalhos = new Headers(init?.headers);
    for (const [k, v] of Object.entries(CABECALHOS_PELA_MIXNET)) if (!cabecalhos.has(k)) cabecalhos.set(k, v);
    return mixFetch(url, { ...init, headers: cabecalhos, credentials: "omit", referrerPolicy: "no-referrer" });
  };
}

/** Desliga (a pessoa saiu, ou a rede caiu de vez): as caixas voltam à via de antes. */
export function desligarMixnet(): void {
  fetchDaMixnet = null;
}

export const mixnetLigada = (): boolean => fetchDaMixnet !== null;

/** O `fetch` da mixnet, se ligada. */
export const fetchPelaMixnet = (): typeof fetch | null => fetchDaMixnet;

/** O módulo `@nymproject/mix-fetch` (3.0.1), do jeito que este adaptador o usa. */
export interface ModuloDaNym {
  createMixFetch(opcoes?: Record<string, unknown>): Promise<(url: string, init?: RequestInit) => Promise<Response>>;
}

/**
 * Liga a mixnet pelo pacote da Nym, com as opções de lib/rede/mixnet/parametros.ts (cobertura e Poisson ligados, TLS por dentro).
 * Só faz algo se a mixnet foi configurada nesta versão. Falhar (rede da Nym fora, sem credencial) deixa a mixnet desligada e devolve
 * false: as caixas seguem pela via de antes, e a tela diz.
 */
export async function ligarNym(modulo: ModuloDaNym): Promise<boolean> {
  if (!mixnetConfigurada()) return false;
  try {
    ligarMixnet(await modulo.createMixFetch({ ...OPCOES_DO_NYM }));
    return true;
  } catch {
    desligarMixnet();
    return false;
  }
}
