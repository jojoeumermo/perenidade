// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Como o aparelho fala com as rotas das caixas anônimas. Toda chamada de caixa, de pedido, de diretório (leitura) e de passe gasto vai
// SEM a sessão da conta: `credentials: "omit"` (o navegador não manda cookie), sem `Authorization` de conta, sem referência de página.
// Só a emissão dos passes e a publicação no diretório levam a sessão, e por outro caminho (`comSessao`), que nunca carrega caixa nem
// passe de caixa. A troca do transporte serve aos testes (no Node, as rotas são chamadas direto, sem servidor).
//
// Onda R3 (item 2.1): os pedidos anônimos saem pela VIA atual (lib/rede/caixas/vias.ts: direta, Tor ou mixnet); o `fetch` daqui é o da
// via direta (o do navegador, ou o nativo dos apps). Os pedidos com sessão não passam pela via.
// Sem "@/" de propósito.
import { usarFetchDireto, viaAtual } from "./vias";

/** O que o aparelho precisa para falar com o servidor. */
export interface Transporte {
  /** O fetch (o do navegador, por padrão). */
  fetch: typeof fetch;
  /** O começo dos endereços das rotas ("" = o mesmo site). */
  base: string;
  /** O token da sessão da conta, só para as chamadas COM sessão (emitir passes, publicar no diretório). */
  tokenDaConta: () => Promise<string | null>;
  /** Chama uma função do banco com a sessão da conta (o rpc de sempre). */
  rpcComSessao: <T>(funcao: string, argumentos: Record<string, unknown>) => Promise<T>;
}

let atual: Transporte = {
  fetch: (...a) => globalThis.fetch(...a),
  base: "",
  tokenDaConta: async () => {
    const { getClient } = await import("../../backend");
    const { data } = await (await getClient()).auth.getSession();
    return data.session?.access_token ?? null;
  },
  rpcComSessao: async (funcao, argumentos) => {
    const { rpc } = await import("../../backend");
    return rpc(funcao, argumentos);
  },
};

/** Troca partes do transporte (os testes; a prévia). */
export function configurarTransporte(parte: Partial<Transporte>): void {
  atual = { ...atual, ...parte };
  if (parte.fetch) usarFetchDireto(parte.fetch);
}

export const transporte = (): Transporte => atual;

/** Um erro com código (o que as telas mostram). */
export const erroDe = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });

/**
 * POST anônimo para uma rota das caixas. `passe` é o cabeçalho `PrivateToken …` (RFC 9577), quando a ação gasta um. Devolve o corpo
 * JSON e o status; erro de rede vira `{ status: 0 }`.
 */
export async function postAnonimo(caminho: string, corpo: unknown, passe?: string): Promise<{ status: number; corpo: Record<string, unknown> | null }> {
  const t = transporte();
  const via = viaAtual();
  const cabecalhos: Record<string, string> = { "Content-Type": "application/json" };
  if (passe) cabecalhos.Authorization = passe;
  try {
    const r = await via.fetch(`${via.base ?? t.base}${caminho}`, {
      method: "POST",
      headers: cabecalhos,
      body: JSON.stringify(corpo),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
    return { status: r.status, corpo: (await r.json().catch(() => null)) as Record<string, unknown> | null };
  } catch {
    return { status: 0, corpo: null };
  }
}

/** GET anônimo (a chave dos passes do dia, o desafio do pedido). */
export async function getAnonimo(caminho: string): Promise<{ status: number; corpo: Record<string, unknown> | null }> {
  const t = transporte();
  const via = viaAtual();
  try {
    const r = await via.fetch(`${via.base ?? t.base}${caminho}`, { method: "GET", credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
    return { status: r.status, corpo: (await r.json().catch(() => null)) as Record<string, unknown> | null };
  } catch {
    return { status: 0, corpo: null };
  }
}

/** POST com a sessão da conta (só emitir passes e denunciar com prova). Nunca leva caixa nem passe de caixa. */
export async function postComSessao(caminho: string, corpo: unknown): Promise<{ status: number; corpo: Record<string, unknown> | null }> {
  const t = transporte();
  const token = await t.tokenDaConta();
  if (!token) throw erroDe("entre_primeiro");
  try {
    const r = await t.fetch(`${t.base}${caminho}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(corpo),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
    return { status: r.status, corpo: (await r.json().catch(() => null)) as Record<string, unknown> | null };
  } catch {
    return { status: 0, corpo: null };
  }
}
